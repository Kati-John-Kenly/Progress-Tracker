export const getStatementFileFingerprint = async (file) => {
    const subtleCrypto = globalThis.crypto?.subtle;
    if (!subtleCrypto) {
        throw new Error('This browser cannot check for duplicate statement files. Please use a modern browser.');
    }

    const digest = await subtleCrypto.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
};
