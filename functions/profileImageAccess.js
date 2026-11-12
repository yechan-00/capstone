const crypto = require('crypto');

const PROFILE_ACCESS_TTL_MS = 60 * 60 * 1000;
const PROFILE_ACCESS_FUTURE_SKEW_MS = 60 * 1000;
const DEFAULT_PROFILE_IMAGE_BASE = 'https://regret-wallet-images.regret-wallet-3db60.workers.dev';
const PROFILE_IMAGE_KEY_PATTERN =
  /^users\/([A-Za-z0-9_-]{1,128})\/profile\/([A-Za-z0-9_-]{1,180}\.(?:jpg|png|webp|heic))$/;

function getProfileImagePepper(opts) {
  if (opts && typeof opts.pepper === 'string' && opts.pepper.length > 0) {
    return opts.pepper;
  }
  if (typeof process.env.PROFILE_IMAGE_PEPPER === 'string' && process.env.PROFILE_IMAGE_PEPPER.length > 0) {
    return process.env.PROFILE_IMAGE_PEPPER;
  }
  if (process.env.FUNCTIONS_EMULATOR === 'true') {
    return 'emulator-profile-image-pepper';
  }
  return null;
}

function getProfileImageBaseUrl(opts) {
  if (opts && typeof opts.baseUrl === 'string' && opts.baseUrl.trim().length > 0) {
    return opts.baseUrl.trim().replace(/\/$/, '');
  }
  if (typeof process.env.PROFILE_IMAGE_BASE_URL === 'string' && process.env.PROFILE_IMAGE_BASE_URL.trim().length > 0) {
    return process.env.PROFILE_IMAGE_BASE_URL.trim().replace(/\/$/, '');
  }
  return DEFAULT_PROFILE_IMAGE_BASE;
}

function parseProfileImageKey(raw, expectedUid) {
  if (typeof raw !== 'string') return null;
  const key = raw.trim();
  if (key.includes('/expenses/') || key.includes('..')) return null;
  const match = PROFILE_IMAGE_KEY_PATTERN.exec(key);
  if (!match) return null;
  if (expectedUid && match[1] !== expectedUid) return null;
  return { uid: match[1], fileName: match[2], key };
}

function profileAccessMessage(uid, fileName, exp) {
  return `${uid}:${fileName}:${exp}`;
}

function signProfileAccess(uid, fileName, pepper, now = Date.now()) {
  const exp = now + PROFILE_ACCESS_TTL_MS;
  const hmac = crypto.createHmac('sha256', pepper).update(profileAccessMessage(uid, fileName, exp), 'utf8').digest('hex');
  return `${exp}.${hmac}`;
}

function verifyProfileAccess(uid, fileName, token, pepper, now = Date.now()) {
  if (typeof token !== 'string' || typeof pepper !== 'string' || pepper.length === 0) return false;
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const exp = Number(token.slice(0, dot));
  const hmac = token.slice(dot + 1);
  if (!Number.isFinite(exp) || hmac.length === 0) return false;
  if (exp <= now) return false;
  if (exp > now + PROFILE_ACCESS_TTL_MS + PROFILE_ACCESS_FUTURE_SKEW_MS) return false;
  const expected = crypto
    .createHmac('sha256', pepper)
    .update(profileAccessMessage(uid, fileName, exp), 'utf8')
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac, 'utf8'), Buffer.from(expected, 'utf8'));
  } catch {
    return false;
  }
}

function buildProfileImageUrl(baseUrl, uid, fileName, token) {
  const root = (baseUrl || DEFAULT_PROFILE_IMAGE_BASE).replace(/\/$/, '');
  return `${root}/v1/profiles/${encodeURIComponent(uid)}/${encodeURIComponent(fileName)}?access=${encodeURIComponent(token)}`;
}

function profileImageUrlForKey(key, expectedUid, opts = {}, now = Date.now()) {
  const pepper = getProfileImagePepper(opts);
  const parsed = parseProfileImageKey(key, expectedUid);
  if (!pepper || !parsed) return null;
  const token = signProfileAccess(parsed.uid, parsed.fileName, pepper, now);
  return buildProfileImageUrl(getProfileImageBaseUrl(opts), parsed.uid, parsed.fileName, token);
}

module.exports = {
  PROFILE_ACCESS_TTL_MS,
  DEFAULT_PROFILE_IMAGE_BASE,
  getProfileImagePepper,
  getProfileImageBaseUrl,
  parseProfileImageKey,
  signProfileAccess,
  verifyProfileAccess,
  buildProfileImageUrl,
  profileImageUrlForKey,
};
