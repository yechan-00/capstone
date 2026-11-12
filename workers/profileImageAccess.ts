import { isValidProfileImageFileName, PROFILE_IMAGE_UID_PATTERN } from './profileImageKey';

export const PROFILE_ACCESS_TTL_MS = 60 * 60 * 1000;
export const PROFILE_ACCESS_FUTURE_SKEW_MS = 60 * 1000;

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function profileAccessMessage(uid: string, fileName: string, exp: number): string {
  return `${uid}:${fileName}:${exp}`;
}

export async function signProfileAccess(
  uid: string,
  fileName: string,
  pepper: string,
  now = Date.now(),
): Promise<string> {
  const exp = now + PROFILE_ACCESS_TTL_MS;
  const hmac = await hmacSha256Hex(pepper, profileAccessMessage(uid, fileName, exp));
  return `${exp}.${hmac}`;
}

export async function verifyProfileAccess(
  uid: string,
  fileName: string,
  token: string,
  pepper: string,
  now = Date.now(),
): Promise<boolean> {
  if (!PROFILE_IMAGE_UID_PATTERN.test(uid) || !isValidProfileImageFileName(fileName)) return false;
  if (typeof token !== 'string' || typeof pepper !== 'string' || pepper.length === 0) return false;
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const exp = Number(token.slice(0, dot));
  const hmac = token.slice(dot + 1);
  if (!Number.isFinite(exp) || hmac.length === 0) return false;
  if (exp <= now) return false;
  if (exp > now + PROFILE_ACCESS_TTL_MS + PROFILE_ACCESS_FUTURE_SKEW_MS) return false;
  const expected = await hmacSha256Hex(pepper, profileAccessMessage(uid, fileName, exp));
  return timingSafeEqual(hmac, expected);
}
