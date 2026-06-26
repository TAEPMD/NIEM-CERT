const crypto = require('crypto');

const COOKIE_NAME = 'staff_session';
const SESSION_SECONDS = 60 * 60 * 8;

function getStaffPassword() {
  const password = String(process.env.STAFF_PASSWORD || '').trim();
  if (!password) {
    throw new Error('Missing STAFF_PASSWORD environment variable.');
  }
  return password;
}

function getAuthSecret() {
  const secret = String(process.env.STAFF_AUTH_SECRET || '').trim();
  if (!secret || secret.length < 24) {
    throw new Error('Missing STAFF_AUTH_SECRET environment variable. Use at least 24 random characters.');
  }
  return secret;
}

function verifyPassword(password) {
  return timingSafeEqual(String(password || ''), getStaffPassword());
}

function createSessionToken() {
  const payload = {
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
    nonce: crypto.randomBytes(16).toString('hex')
  };
  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function verifySessionToken(token) {
  const value = String(token || '');
  const parts = value.split('.');
  if (parts.length !== 2) return false;

  const [encodedPayload, signature] = parts;
  if (!timingSafeEqual(sign(encodedPayload), signature)) return false;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    return Number(payload.exp || 0) > Math.floor(Date.now() / 1000);
  } catch (error) {
    return false;
  }
}

function getSessionFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  return cookies[COOKIE_NAME] || '';
}

function isAuthenticated(req) {
  return verifySessionToken(getSessionFromRequest(req));
}

function setSessionCookie(req, res, token) {
  const secure = isSecureRequest(req) ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}`);
}

function clearSessionCookie(req, res) {
  const secure = isSecureRequest(req) ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=0`);
}

function parseCookies(header) {
  return String(header || '').split(';').reduce((cookies, pair) => {
    const index = pair.indexOf('=');
    if (index < 0) return cookies;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function sign(value) {
  return crypto
    .createHmac('sha256', getAuthSecret())
    .update(value)
    .digest('base64url');
}

function base64url(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function timingSafeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function isSecureRequest(req) {
  return req.headers['x-forwarded-proto'] === 'https' ||
    req.headers['x-forwarded-ssl'] === 'on' ||
    process.env.VERCEL === '1';
}

module.exports = {
  clearSessionCookie,
  createSessionToken,
  isAuthenticated,
  setSessionCookie,
  verifyPassword
};
