const biometricStorageKey = 'appBiometricCredential';

const toBase64Url = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (value) => {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return Uint8Array.from(atob(padded), character => character.charCodeAt(0));
};

const createChallenge = () => {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    return challenge;
};

export const hasSavedDeviceBiometric = () => {
    try {
        return Boolean(localStorage.getItem(biometricStorageKey));
    } catch {
        return false;
    }
};

export const isDeviceBiometricAvailable = async () => {
    if (!window.isSecureContext || !window.PublicKeyCredential || !navigator.credentials?.create) {
        return false;
    }
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
        return false;
    }
    return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
};

export const registerDeviceBiometric = async (userName = 'Progress user') => {
    if (!(await isDeviceBiometricAvailable())) {
        throw new Error('This device does not offer a supported biometric authenticator. You can use a passcode instead.');
    }

    const challenge = createChallenge();
    const userId = new Uint8Array(16);
    crypto.getRandomValues(userId);
    const credential = await navigator.credentials.create({
        publicKey: {
            challenge,
            rp: { name: 'Progress Tracker', id: window.location.hostname },
            user: {
                id: userId,
                name: userName,
                displayName: userName,
            },
            pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
            authenticatorSelection: {
                authenticatorAttachment: 'platform',
                residentKey: 'preferred',
                userVerification: 'required',
            },
            timeout: 60000,
            attestation: 'none',
        },
    });

    const publicKey = credential?.response?.getPublicKey?.();
    const algorithm = credential?.response?.getPublicKeyAlgorithm?.();
    if (!credential || !publicKey || algorithm !== -7) {
        throw new Error('This device could not create a supported biometric credential.');
    }

    localStorage.setItem(biometricStorageKey, JSON.stringify({
        id: toBase64Url(credential.rawId),
        publicKey: toBase64Url(publicKey),
        rpId: window.location.hostname,
        counter: 0,
    }));
};

const derToP1363 = (signature) => {
    if (signature.length === 64) return signature;
    if (signature[0] !== 0x30) throw new Error('The device returned an invalid biometric signature.');

    let offset = 2;
    if (signature[1] & 0x80) offset += (signature[1] & 0x7f) + 1;
    if (signature[offset++] !== 0x02) throw new Error('The device returned an invalid biometric signature.');
    const rLength = signature[offset++];
    let r = signature.slice(offset, offset + rLength);
    offset += rLength;
    if (signature[offset++] !== 0x02) throw new Error('The device returned an invalid biometric signature.');
    const sLength = signature[offset++];
    let s = signature.slice(offset, offset + sLength);

    if (r.length > 32 && r[0] === 0) r = r.slice(1);
    if (s.length > 32 && s[0] === 0) s = s.slice(1);
    if (r.length > 32 || s.length > 32) throw new Error('The device returned an invalid biometric signature.');

    const result = new Uint8Array(64);
    result.set(r, 32 - r.length);
    result.set(s, 64 - s.length);
    return result;
};

export const verifyDeviceBiometric = async () => {
    const stored = localStorage.getItem(biometricStorageKey);
    if (!stored) throw new Error('Biometric unlock is not set up on this device.');

    const record = JSON.parse(stored);
    const challenge = createChallenge();
    const assertion = await navigator.credentials.get({
        publicKey: {
            challenge,
            rpId: record.rpId,
            allowCredentials: [{ type: 'public-key', id: fromBase64Url(record.id) }],
            userVerification: 'required',
            timeout: 60000,
        },
    });

    if (!assertion) throw new Error('Biometric verification was not completed.');

    const clientData = JSON.parse(new TextDecoder().decode(assertion.response.clientDataJSON));
    if (
        clientData.type !== 'webauthn.get' ||
        clientData.challenge !== toBase64Url(challenge) ||
        clientData.origin !== window.location.origin
    ) {
        throw new Error('Biometric verification could not be validated.');
    }

    const authenticatorData = new Uint8Array(assertion.response.authenticatorData);
    const expectedRpIdHash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(record.rpId)));
    const hasUserPresence = (authenticatorData[32] & 0x01) !== 0;
    const hasUserVerification = (authenticatorData[32] & 0x04) !== 0;
    if (
        !hasUserPresence ||
        !hasUserVerification ||
        expectedRpIdHash.some((byte, index) => byte !== authenticatorData[index])
    ) {
        throw new Error('Biometric verification could not be validated.');
    }

    const clientDataHash = new Uint8Array(await crypto.subtle.digest('SHA-256', assertion.response.clientDataJSON));
    const signedData = new Uint8Array(authenticatorData.length + clientDataHash.length);
    signedData.set(authenticatorData);
    signedData.set(clientDataHash, authenticatorData.length);
    const publicKey = await crypto.subtle.importKey(
        'spki',
        fromBase64Url(record.publicKey),
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify']
    );
    const isValid = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        publicKey,
        derToP1363(new Uint8Array(assertion.response.signature)),
        signedData
    );
    if (!isValid) throw new Error('Biometric verification failed.');

    const counter = new DataView(authenticatorData.buffer, authenticatorData.byteOffset + 33, 4).getUint32(0);
    if (record.counter > 0 && counter > 0 && counter <= record.counter) {
        throw new Error('Biometric verification was rejected because the device counter did not advance.');
    }
    if (counter > record.counter) {
        localStorage.setItem(biometricStorageKey, JSON.stringify({ ...record, counter }));
    }
};

export const removeDeviceBiometric = () => {
    localStorage.removeItem(biometricStorageKey);
};
