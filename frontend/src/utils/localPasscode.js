const passcodeRecordKey = 'appPasscodeRecord';
const legacyPasscodeKey = 'appPasscode';
const iterations = 150000;

const toBase64 = (bytes) => {
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary);
};

const fromBase64 = (value) => Uint8Array.from(atob(value), character => character.charCodeAt(0));

const derivePasscodeHash = async (passcode, salt) => {
    if (!crypto.subtle) throw new Error('Passcode protection requires a secure browser connection.');
    const material = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(passcode),
        'PBKDF2',
        false,
        ['deriveBits']
    );
    return new Uint8Array(await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
        material,
        256
    ));
};

export const isLocalPasscodeConfigured = () => (
    Boolean(localStorage.getItem(passcodeRecordKey) || localStorage.getItem(legacyPasscodeKey))
);

export const saveLocalPasscode = async (passcode) => {
    const salt = new Uint8Array(16);
    crypto.getRandomValues(salt);
    const hash = await derivePasscodeHash(passcode, salt);
    localStorage.setItem(passcodeRecordKey, JSON.stringify({
        salt: toBase64(salt),
        hash: toBase64(hash),
        iterations,
    }));
    localStorage.removeItem(legacyPasscodeKey);
};

export const verifyLocalPasscode = async (passcode) => {
    const stored = localStorage.getItem(passcodeRecordKey);
    if (!stored) {
        const legacyPasscode = localStorage.getItem(legacyPasscodeKey);
        if (!legacyPasscode || legacyPasscode !== passcode) return false;
        await saveLocalPasscode(passcode);
        return true;
    }

    const record = JSON.parse(stored);
    const calculatedHash = await derivePasscodeHash(passcode, fromBase64(record.salt));
    const expectedHash = fromBase64(record.hash);
    if (calculatedHash.length !== expectedHash.length) return false;
    return calculatedHash.reduce((difference, byte, index) => difference | (byte ^ expectedHash[index]), 0) === 0;
};

export const removeLocalPasscode = () => {
    localStorage.removeItem(passcodeRecordKey);
    localStorage.removeItem(legacyPasscodeKey);
};
