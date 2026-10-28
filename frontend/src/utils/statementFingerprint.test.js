import assert from 'node:assert/strict';
import test from 'node:test';
import { getStatementFileFingerprint } from './statementFingerprint.js';

test('fingerprints matching statement contents consistently', async () => {
    const firstFile = new Blob(['statement content']);
    const sameContent = new Blob(['statement content']);
    const differentContent = new Blob(['another statement']);

    const fingerprint = await getStatementFileFingerprint(firstFile);

    assert.match(fingerprint, /^[a-f\d]{64}$/);
    assert.equal(await getStatementFileFingerprint(sameContent), fingerprint);
    assert.notEqual(await getStatementFileFingerprint(differentContent), fingerprint);
});
