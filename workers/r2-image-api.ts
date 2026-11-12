import { createRemoteJWKSet } from 'jose';
import {
  firebaseUidFromClaims,
  isAnonymousFirebaseSignIn,
  verifyFirebaseIdToken,
} from './firebaseIdToken';
import {
  createExpenseImageSlotFileName,
  createExpenseImageSlotUniqueId,
  expenseImageObjectKey,
  isValidExpenseImageSlot,
} from './expenseImageSlotKey';
import { verifyProfileAccess } from './profileImageAccess';
import {
  createProfileImageFileName,
  parseProfileImageKey,
  profileImageObjectKey,
  profileImagePrefix,
} from './profileImageKey';
import {
  canDeleteOwnedMemoryImage,
  canUploadSpaceMemoryImage,
  createSpaceMemoryImageFileName,
  isSpaceMemoryR2CountAtCap,
  isSpaceMemoryR2CountOverCap,
  isUsableSpaceMemoryId,
  parseSpaceMemoryImageKey,
  SPACE_MEMORY_R2_OBJECT_MAX,
  spaceMemoryImageCustomMetadata,
  spaceMemoryImageExtension,
  spaceMemoryImageObjectKey,
  spaceMemoryImagePrefix,
} from './spaceMemoryImageKey';
import { lookupMemoryAuthorUid, lookupSpaceMembership } from './spaceMembershipLookup';

interface Env {
  IMAGES: R2Bucket;
  FIREBASE_PROJECT_ID: string;
  ALLOWED_ORIGINS: string;
  PROFILE_IMAGE_PEPPER?: string;
}

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(body, { status, headers });
}

function isLocalDevOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const host = url.hostname;
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '10.0.2.2' ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)
    );
  } catch {
    return false;
  }
}

function allowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get('Origin');
  if (!origin) return null;
  const allowed = env.ALLOWED_ORIGINS.split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (allowed.includes(origin) || isLocalDevOrigin(origin)) return origin;
  return '';
}

function corsHeaders(request: Request, env: Env): Headers {
  const headers = new Headers();
  const origin = allowedOrigin(request, env);
  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Vary', 'Origin');
  return headers;
}

async function requireFirebaseSession(
  request: Request,
  env: Env,
  registeredOnly = false,
): Promise<{ uid: string; token: string }> {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new Response('Unauthorized', { status: 401 });
  }

  const token = authorization.slice('Bearer '.length).trim();
  try {
    const claims = await verifyFirebaseIdToken(token, FIREBASE_JWKS, env.FIREBASE_PROJECT_ID);
    const uid = firebaseUidFromClaims(claims);
    if (!uid) throw new Error('missing-user-id');
    if (registeredOnly && isAnonymousFirebaseSignIn(claims)) {
      throw new Response('Forbidden', { status: 403 });
    }
    return { uid, token };
  } catch (error) {
    if (error instanceof Response) throw error;
    throw new Response('Unauthorized', { status: 401 });
  }
}

async function requireFirebaseUser(request: Request, env: Env, registeredOnly = false): Promise<string> {
  const session = await requireFirebaseSession(request, env, registeredOnly);
  return session.uid;
}

async function requireSpaceMember(
  request: Request,
  env: Env,
  spaceId: string,
): Promise<{ uid: string; token: string }> {
  const session = await requireFirebaseSession(request, env, true);
  const allowed = await lookupSpaceMembership({
    projectId: env.FIREBASE_PROJECT_ID,
    idToken: session.token,
    spaceId,
    uid: session.uid,
  });
  if (!allowed) throw new Response('Forbidden', { status: 403 });
  return session;
}

function imageExtension(contentType: string): string {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/heic' || contentType === 'image/heif') return 'heic';
  return 'jpg';
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function uploadExpenseImage(
  request: Request,
  env: Env,
  expenseId: string,
): Promise<Response> {
  const uid = await requireFirebaseUser(request, env);
  const contentType = request.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!contentType.startsWith('image/')) {
    return json({ error: 'image-required' }, 415, corsHeaders(request, env));
  }

  const declaredSize = Number(request.headers.get('Content-Length') ?? 0);
  if (declaredSize > MAX_IMAGE_BYTES) {
    return json({ error: 'image-too-large' }, 413, corsHeaders(request, env));
  }

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
    return json(
      { error: bytes.byteLength === 0 ? 'empty-image' : 'image-too-large' },
      bytes.byteLength === 0 ? 400 : 413,
      corsHeaders(request, env),
    );
  }

  const accessToken = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
  const accessTokenHash = await sha256(accessToken);
  const extension = imageExtension(contentType);
  const objectKey = `users/${uid}/expenses/${expenseId}.${extension}`;

  // 레거시 단일 키만 교체한다. `{expenseId}_1.jpg` 같은 슬롯 키는 접두어가 `expenseId.`가 아니라 지우지 않는다.
  const previous = await env.IMAGES.list({ prefix: `users/${uid}/expenses/${expenseId}.`, limit: 10 });
  await Promise.all(previous.objects.map((object) => env.IMAGES.delete(object.key)));

  await env.IMAGES.put(objectKey, bytes, {
    httpMetadata: { contentType },
    customMetadata: {
      ownerUid: uid,
      expenseId,
      accessTokenHash,
    },
  });

  const baseUrl = new URL(request.url).origin;
  const imageUrl = `${baseUrl}/v1/images/${encodeURIComponent(uid)}/${encodeURIComponent(expenseId)}.${extension}?token=${accessToken}`;
  return json({ imageUrl }, 201, corsHeaders(request, env));
}

/**
 * 신규 슬롯 업로드. 기존 객체를 삭제하지 않고
 * `{expenseId}_{slot}_{uniqueId}.{ext}` 키로만 PUT 한다.
 */
async function uploadExpenseImageSlot(
  request: Request,
  env: Env,
  expenseId: string,
  slot: number,
): Promise<Response> {
  if (!isValidExpenseImageSlot(slot)) {
    return json({ error: 'invalid-slot' }, 400, corsHeaders(request, env));
  }

  const uid = await requireFirebaseUser(request, env);
  const contentType = request.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!contentType.startsWith('image/')) {
    return json({ error: 'image-required' }, 415, corsHeaders(request, env));
  }

  const declaredSize = Number(request.headers.get('Content-Length') ?? 0);
  if (declaredSize > MAX_IMAGE_BYTES) {
    return json({ error: 'image-too-large' }, 413, corsHeaders(request, env));
  }

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
    return json(
      { error: bytes.byteLength === 0 ? 'empty-image' : 'image-too-large' },
      bytes.byteLength === 0 ? 400 : 413,
      corsHeaders(request, env),
    );
  }

  const accessToken = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
  const accessTokenHash = await sha256(accessToken);
  const extension = imageExtension(contentType);
  const uniqueId = createExpenseImageSlotUniqueId();
  const fileName = createExpenseImageSlotFileName(expenseId, slot, uniqueId, extension);
  const objectKey = expenseImageObjectKey(uid, fileName);

  await env.IMAGES.put(objectKey, bytes, {
    httpMetadata: { contentType },
    customMetadata: {
      ownerUid: uid,
      expenseId,
      slot: String(slot),
      accessTokenHash,
    },
  });

  const baseUrl = new URL(request.url).origin;
  const imageUrl = `${baseUrl}/v1/images/${encodeURIComponent(uid)}/${encodeURIComponent(fileName)}?token=${accessToken}`;
  return json({ imageUrl, slot }, 201, corsHeaders(request, env));
}

async function uploadProfileImage(request: Request, env: Env): Promise<Response> {
  const uid = await requireFirebaseUser(request, env, true);
  const contentType = request.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!contentType.startsWith('image/')) {
    return json({ error: 'image-required' }, 415, corsHeaders(request, env));
  }

  const declaredSize = Number(request.headers.get('Content-Length') ?? 0);
  if (declaredSize > MAX_IMAGE_BYTES) {
    return json({ error: 'image-too-large' }, 413, corsHeaders(request, env));
  }

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
    return json(
      { error: bytes.byteLength === 0 ? 'empty-image' : 'image-too-large' },
      bytes.byteLength === 0 ? 400 : 413,
      corsHeaders(request, env),
    );
  }

  const extension = imageExtension(contentType);
  const fileName = createProfileImageFileName(extension);
  const objectKey = profileImageObjectKey(uid, fileName);

  await env.IMAGES.put(objectKey, bytes, {
    httpMetadata: { contentType },
    customMetadata: {
      ownerUid: uid,
      kind: 'profile',
    },
  });

  return json({ imageKey: objectKey }, 201, corsHeaders(request, env));
}

async function deleteProfileImage(request: Request, env: Env): Promise<Response> {
  const uid = await requireFirebaseUser(request, env, true);
  let requestedKey: string | null = null;
  const contentType = request.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => null)) as { imageKey?: unknown } | null;
    if (body && body.imageKey != null) {
      const parsed = parseProfileImageKey(body.imageKey, uid);
      if (!parsed) {
        return json({ error: 'invalid-key' }, 403, corsHeaders(request, env));
      }
      requestedKey = parsed.key;
    }
  }

  const prefix = profileImagePrefix(uid);
  if (requestedKey) {
    if (!requestedKey.startsWith(prefix) || requestedKey.includes('/expenses/')) {
      return json({ error: 'invalid-key' }, 403, corsHeaders(request, env));
    }
    await env.IMAGES.delete(requestedKey);
    return json({ deleted: true }, 200, corsHeaders(request, env));
  }

  const listed = await env.IMAGES.list({ prefix, limit: 20 });
  await Promise.all(
    listed.objects
      .filter((object) => object.key.startsWith(prefix) && !object.key.includes('/expenses/'))
      .map((object) => env.IMAGES.delete(object.key)),
  );
  return json({ deleted: true }, 200, corsHeaders(request, env));
}

function profileImageHeaders(request: Request, env: Env, object: R2ObjectBody, fileName: string): Headers {
  const headers = corsHeaders(request, env);
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', 'private, max-age=300');
  headers.set('X-Content-Type-Options', 'nosniff');
  if (!headers.get('Content-Type')) {
    if (fileName.endsWith('.png')) headers.set('Content-Type', 'image/png');
    else if (fileName.endsWith('.webp')) headers.set('Content-Type', 'image/webp');
    else if (fileName.endsWith('.heic')) headers.set('Content-Type', 'image/heic');
    else headers.set('Content-Type', 'image/jpeg');
  }
  return headers;
}

async function serveProfileImage(
  request: Request,
  env: Env,
  ownerUid: string,
  fileName: string,
): Promise<Response> {
  const objectKey = profileImageObjectKey(ownerUid, fileName);
  const parsed = parseProfileImageKey(objectKey, ownerUid);
  if (!parsed) return new Response('Not found', { status: 404 });

  let allowed = false;
  const access = new URL(request.url).searchParams.get('access') ?? '';
  const pepper = typeof env.PROFILE_IMAGE_PEPPER === 'string' ? env.PROFILE_IMAGE_PEPPER : '';
  if (access && pepper) {
    allowed = await verifyProfileAccess(ownerUid, fileName, access, pepper);
  }
  if (!allowed) {
    try {
      const requesterUid = await requireFirebaseUser(request, env, true);
      allowed = requesterUid === ownerUid;
    } catch {
      allowed = false;
    }
  }
  if (!allowed) return new Response('Not found', { status: 404 });

  const object = await env.IMAGES.get(objectKey);
  if (!object || object.customMetadata?.ownerUid !== ownerUid) {
    return new Response('Not found', { status: 404 });
  }

  const headers = profileImageHeaders(request, env, object, fileName);
  const inboundEtag = request.headers.get('If-None-Match');
  if (inboundEtag && object.httpEtag && inboundEtag === object.httpEtag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(object.body, { headers });
}

function memoryImageHeaders(request: Request, env: Env, object: R2ObjectBody, fileName: string): Headers {
  const headers = corsHeaders(request, env);
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', 'private, max-age=60');
  headers.set('Vary', 'Origin, Authorization');
  headers.set('X-Content-Type-Options', 'nosniff');
  if (!headers.get('Content-Type')) {
    if (fileName.endsWith('.png')) headers.set('Content-Type', 'image/png');
    else if (fileName.endsWith('.webp')) headers.set('Content-Type', 'image/webp');
    else if (fileName.endsWith('.heic')) headers.set('Content-Type', 'image/heic');
    else headers.set('Content-Type', 'image/jpeg');
  }
  return headers;
}

async function uploadSpaceMemoryImage(
  request: Request,
  env: Env,
  spaceId: string,
  memoryId: string,
): Promise<Response> {
  if (!isUsableSpaceMemoryId(spaceId) || !isUsableSpaceMemoryId(memoryId)) {
    return json({ error: 'invalid-id' }, 400, corsHeaders(request, env));
  }
  const session = await requireSpaceMember(request, env, spaceId);
  const memory = await lookupMemoryAuthorUid({
    projectId: env.FIREBASE_PROJECT_ID,
    idToken: session.token,
    spaceId,
    memoryId,
  });
  if (
    !canUploadSpaceMemoryImage({
      memoryExists: memory.exists,
      createdByUid: memory.createdByUid,
      sessionUid: session.uid,
    })
  ) {
    return json({ error: 'not-author' }, 403, corsHeaders(request, env));
  }

  const contentType = request.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase() ?? '';
  const extension = spaceMemoryImageExtension(contentType);
  if (!extension) {
    return json({ error: 'image-required' }, 415, corsHeaders(request, env));
  }
  const declaredSize = Number(request.headers.get('Content-Length') ?? 0);
  if (declaredSize > MAX_IMAGE_BYTES) {
    return json({ error: 'image-too-large' }, 413, corsHeaders(request, env));
  }
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
    return json(
      { error: bytes.byteLength === 0 ? 'empty-image' : 'image-too-large' },
      bytes.byteLength === 0 ? 400 : 413,
      corsHeaders(request, env),
    );
  }

  const prefix = spaceMemoryImagePrefix(spaceId, memoryId);
  const existing = await env.IMAGES.list({
    prefix,
    limit: SPACE_MEMORY_R2_OBJECT_MAX + 1,
  });
  if (isSpaceMemoryR2CountAtCap(existing.objects.length)) {
    return json({ error: 'too-many-images' }, 409, corsHeaders(request, env));
  }

  const fileName = createSpaceMemoryImageFileName(extension);
  const objectKey = spaceMemoryImageObjectKey(spaceId, memoryId, fileName);
  await env.IMAGES.put(objectKey, bytes, {
    httpMetadata: { contentType },
    customMetadata: spaceMemoryImageCustomMetadata(session.uid, spaceId, memoryId),
  });
  const after = await env.IMAGES.list({
    prefix,
    limit: SPACE_MEMORY_R2_OBJECT_MAX + 1,
  });
  if (isSpaceMemoryR2CountOverCap(after.objects.length)) {
    await env.IMAGES.delete(objectKey);
    return json({ error: 'too-many-images' }, 409, corsHeaders(request, env));
  }
  return json({ imageKey: objectKey }, 201, corsHeaders(request, env));
}

async function deleteSpaceMemoryImage(
  request: Request,
  env: Env,
  spaceId: string,
  memoryId: string,
): Promise<Response> {
  if (!isUsableSpaceMemoryId(spaceId) || !isUsableSpaceMemoryId(memoryId)) {
    return json({ error: 'invalid-id' }, 400, corsHeaders(request, env));
  }
  const session = await requireSpaceMember(request, env, spaceId);
  const body = (await request.json().catch(() => null)) as { imageKey?: unknown } | null;
  const parsed = parseSpaceMemoryImageKey(body?.imageKey, { spaceId, memoryId });
  if (!parsed) {
    return json({ error: 'invalid-key' }, 403, corsHeaders(request, env));
  }

  const object = await env.IMAGES.head(parsed.key);
  if (!object) {
    return json({ deleted: true }, 200, corsHeaders(request, env));
  }
  if (!canDeleteOwnedMemoryImage(object.customMetadata?.ownerUid, session.uid)) {
    return json({ error: 'not-author' }, 403, corsHeaders(request, env));
  }
  await env.IMAGES.delete(parsed.key);
  return json({ deleted: true }, 200, corsHeaders(request, env));
}

async function serveSpaceMemoryImage(
  request: Request,
  env: Env,
  spaceId: string,
  memoryId: string,
  fileName: string,
): Promise<Response> {
  if (!isUsableSpaceMemoryId(spaceId) || !isUsableSpaceMemoryId(memoryId)) {
    return new Response('Not found', { status: 404 });
  }
  const parsed = parseSpaceMemoryImageKey(spaceMemoryImageObjectKey(spaceId, memoryId, fileName), {
    spaceId,
    memoryId,
  });
  if (!parsed) return new Response('Not found', { status: 404 });

  try {
    await requireSpaceMember(request, env, spaceId);
  } catch (error) {
    if (error instanceof Response) {
      const headers = new Headers(error.headers);
      corsHeaders(request, env).forEach((value, key) => headers.set(key, value));
      return new Response(error.body, { status: error.status === 401 ? 401 : 404, headers });
    }
    return new Response('Not found', { status: 404 });
  }

  const object = await env.IMAGES.get(parsed.key);
  if (
    !object ||
    object.customMetadata?.kind !== 'space-memory' ||
    object.customMetadata?.spaceId !== spaceId ||
    object.customMetadata?.memoryId !== memoryId
  ) {
    return new Response('Not found', { status: 404 });
  }

  const headers = memoryImageHeaders(request, env, object, fileName);
  const inboundEtag = request.headers.get('If-None-Match');
  if (inboundEtag && object.httpEtag && inboundEtag === object.httpEtag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(object.body, { headers });
}

async function serveImage(
  request: Request,
  env: Env,
  uid: string,
  fileName: string,
): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  if (!token) return new Response('Not found', { status: 404 });

  const object = await env.IMAGES.get(`users/${uid}/expenses/${fileName}`);
  const expectedHash = object?.customMetadata?.accessTokenHash;
  if (!object || !expectedHash || !timingSafeEqual(await sha256(token), expectedHash)) {
    return new Response('Not found', { status: 404 });
  }

  const headers = corsHeaders(request, env);
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  // 개인 이미지(토큰 URL). 공유 CDN public 캐시는 쓰지 않고, 기기 HTTP 캐시만 허용합니다.
  headers.set('Cache-Control', 'private, max-age=604800, immutable');
  headers.set('X-Content-Type-Options', 'nosniff');
  if (!headers.get('Content-Type')) {
    if (fileName.endsWith('.png')) headers.set('Content-Type', 'image/png');
    else if (fileName.endsWith('.webp')) headers.set('Content-Type', 'image/webp');
    else if (fileName.endsWith('.heic')) headers.set('Content-Type', 'image/heic');
    else headers.set('Content-Type', 'image/jpeg');
  }

  const inboundEtag = request.headers.get('If-None-Match');
  if (inboundEtag && object.httpEtag && inboundEtag === object.httpEtag) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(object.body, { headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return allowedOrigin(request, env) === ''
        ? new Response('Forbidden', { status: 403 })
        : new Response(null, { status: 204, headers: cors });
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true, storage: 'r2' }, 200, cors);
    }

    const uploadMatch = url.pathname.match(/^\/v1\/expenses\/([A-Za-z0-9_-]{1,128})\/image$/);
    if (request.method === 'POST' && uploadMatch?.[1]) {
      try {
        return await uploadExpenseImage(request, env, uploadMatch[1]);
      } catch (error) {
        if (error instanceof Response) {
          const headers = new Headers(error.headers);
          cors.forEach((value, key) => headers.set(key, value));
          return new Response(error.body, { status: error.status, headers });
        }
        console.error('image upload failed', error);
        return json({ error: 'upload-failed' }, 500, cors);
      }
    }

    const slotUploadMatch = url.pathname.match(
      /^\/v1\/expenses\/([A-Za-z0-9_-]{1,128})\/images\/(\d+)$/,
    );
    if (request.method === 'POST' && slotUploadMatch?.[1] && slotUploadMatch[2]) {
      try {
        return await uploadExpenseImageSlot(
          request,
          env,
          slotUploadMatch[1],
          Number(slotUploadMatch[2]),
        );
      } catch (error) {
        if (error instanceof Response) {
          const headers = new Headers(error.headers);
          cors.forEach((value, key) => headers.set(key, value));
          return new Response(error.body, { status: error.status, headers });
        }
        console.error('image slot upload failed', error);
        return json({ error: 'upload-failed' }, 500, cors);
      }
    }

    const imageMatch = url.pathname.match(
      /^\/v1\/images\/([A-Za-z0-9_-]{1,128})\/([A-Za-z0-9_-]{1,180}\.(?:jpg|png|webp|heic))$/,
    );
    if (request.method === 'GET' && imageMatch?.[1] && imageMatch[2]) {
      return serveImage(request, env, imageMatch[1], imageMatch[2]);
    }

    if (url.pathname === '/v1/profile/image' && request.method === 'POST') {
      try {
        return await uploadProfileImage(request, env);
      } catch (error) {
        if (error instanceof Response) {
          const headers = new Headers(error.headers);
          cors.forEach((value, key) => headers.set(key, value));
          return new Response(error.body, { status: error.status, headers });
        }
        console.error('profile image upload failed', error);
        return json({ error: 'upload-failed' }, 500, cors);
      }
    }

    if (url.pathname === '/v1/profile/image' && request.method === 'DELETE') {
      try {
        return await deleteProfileImage(request, env);
      } catch (error) {
        if (error instanceof Response) {
          const headers = new Headers(error.headers);
          cors.forEach((value, key) => headers.set(key, value));
          return new Response(error.body, { status: error.status, headers });
        }
        console.error('profile image delete failed', error);
        return json({ error: 'delete-failed' }, 500, cors);
      }
    }

    const profileMatch = url.pathname.match(
      /^\/v1\/profiles\/([A-Za-z0-9_-]{1,128})\/([A-Za-z0-9_-]{1,180}\.(?:jpg|png|webp|heic))$/,
    );
    if (request.method === 'GET' && profileMatch?.[1] && profileMatch[2]) {
      return serveProfileImage(request, env, profileMatch[1], profileMatch[2]);
    }

    const memoryUploadMatch = url.pathname.match(
      /^\/v1\/spaces\/([A-Za-z0-9_-]{1,128})\/memories\/([A-Za-z0-9_-]{1,128})\/images$/,
    );
    if (memoryUploadMatch?.[1] && memoryUploadMatch[2]) {
      try {
        if (request.method === 'POST') {
          return await uploadSpaceMemoryImage(request, env, memoryUploadMatch[1], memoryUploadMatch[2]);
        }
        if (request.method === 'DELETE') {
          return await deleteSpaceMemoryImage(request, env, memoryUploadMatch[1], memoryUploadMatch[2]);
        }
      } catch (error) {
        if (error instanceof Response) {
          const headers = new Headers(error.headers);
          cors.forEach((value, key) => headers.set(key, value));
          return new Response(error.body, { status: error.status, headers });
        }
        console.error('space memory image failed', error);
        return json({ error: request.method === 'DELETE' ? 'delete-failed' : 'upload-failed' }, 500, cors);
      }
    }

    const memoryGetMatch = url.pathname.match(
      /^\/v1\/spaces\/([A-Za-z0-9_-]{1,128})\/memories\/([A-Za-z0-9_-]{1,128})\/images\/([A-Za-z0-9_-]{1,180}\.(?:jpg|png|webp|heic))$/,
    );
    if (request.method === 'GET' && memoryGetMatch?.[1] && memoryGetMatch[2] && memoryGetMatch[3]) {
      try {
        return await serveSpaceMemoryImage(
          request,
          env,
          memoryGetMatch[1],
          memoryGetMatch[2],
          memoryGetMatch[3],
        );
      } catch (error) {
        if (error instanceof Response) {
          const headers = new Headers(error.headers);
          cors.forEach((value, key) => headers.set(key, value));
          return new Response(error.body, { status: error.status, headers });
        }
        return json({ error: 'not-found' }, 404, cors);
      }
    }

    return json({ error: 'not-found' }, 404, cors);
  },
} satisfies ExportedHandler<Env>;
