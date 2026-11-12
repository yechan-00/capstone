import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SignJWT, generateKeyPair } from 'jose';
import {
  firebaseSecureTokenIssuer,
  firebaseUidFromClaims,
  isAnonymousFirebaseSignIn,
  verifyFirebaseIdToken,
} from './firebaseIdToken.ts';

const PROJECT = 'regret-wallet-test';
const OTHER_PROJECT = 'other-firebase-project';

async function signedToken(args: {
  privateKey: CryptoKey;
  projectId?: string;
  uid?: string;
  provider?: string;
  exp?: string | number | Date;
  iat?: number | Date;
  alg?: 'RS256';
}) {
  const projectId = args.projectId ?? PROJECT;
  const uid = args.uid ?? 'user-1';
  return new SignJWT({
    user_id: uid,
    firebase: { sign_in_provider: args.provider ?? 'password' },
  })
    .setProtectedHeader({ alg: args.alg ?? 'RS256' })
    .setSubject(uid)
    .setAudience(projectId)
    .setIssuer(firebaseSecureTokenIssuer(projectId))
    .setIssuedAt(args.iat ?? new Date())
    .setExpirationTime(args.exp ?? '1h')
    .sign(args.privateKey);
}

test('valid RS256 Firebase ID token yields the signed uid', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const token = await signedToken({ privateKey });
  const claims = await verifyFirebaseIdToken(token, publicKey, PROJECT);
  assert.equal(firebaseUidFromClaims(claims), 'user-1');
  assert.equal(isAnonymousFirebaseSignIn(claims), false);
});

test('expired tokens are rejected even if the signature is valid', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const now = new Date('2026-11-07T03:00:00.000Z');
  const token = await signedToken({
    privateKey,
    iat: new Date('2026-11-07T01:50:00.000Z'),
    exp: new Date('2026-11-07T02:50:00.000Z'),
  });
  await assert.rejects(() => verifyFirebaseIdToken(token, publicKey, PROJECT, now));
});

test('tokens from another Firebase project are rejected', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const token = await signedToken({ privateKey, projectId: OTHER_PROJECT });
  await assert.rejects(() => verifyFirebaseIdToken(token, publicKey, PROJECT));
});

test('tampered payload and unsigned JWT are rejected', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const token = await signedToken({ privateKey });
  const [header, payload, signature] = token.split('.');
  const raw = JSON.parse(Buffer.from(payload, 'base64url').toString());
  raw.user_id = 'attacker';
  raw.sub = 'attacker';
  const tampered = `${header}.${Buffer.from(JSON.stringify(raw)).toString('base64url')}.${signature}`;
  await assert.rejects(() => verifyFirebaseIdToken(tampered, publicKey, PROJECT));
  await assert.rejects(() => verifyFirebaseIdToken(`${header}.${payload}.`, publicKey, PROJECT));
  await assert.rejects(() => verifyFirebaseIdToken('not-a-jwt', publicKey, PROJECT));
});

test('a token signed with a different key is rejected', async () => {
  const valid = await generateKeyPair('RS256');
  const other = await generateKeyPair('RS256');
  const token = await signedToken({ privateKey: other.privateKey });
  await assert.rejects(() => verifyFirebaseIdToken(token, valid.publicKey, PROJECT));
});

test('anonymous provider is detected after verification', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const token = await signedToken({ privateKey, provider: 'anonymous' });
  const claims = await verifyFirebaseIdToken(token, publicKey, PROJECT);
  assert.equal(isAnonymousFirebaseSignIn(claims), true);
});
