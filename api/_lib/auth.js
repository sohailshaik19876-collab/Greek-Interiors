'use strict';

/* Admin session handling.

   One shared password (ADMIN_PASSWORD) exchanged for an HMAC-signed session
   cookie. The cookie carries only an expiry and its signature — there is no
   session store to keep, and nothing in it is secret or forgeable without
   SESSION_SECRET.

   The password is never compared with ===: that leaks length and prefix through
   timing. Both the password check and the signature check are constant-time. */

const crypto = require('crypto');

const COOKIE = 'gi_admin';
const TTL_SECONDS = 60 * 60 * 8;   // eight hours — a working day

function adminPassword() { return process.env.ADMIN_PASSWORD || ''; }

/* SESSION_SECRET is preferred. Falling back to a hash of the password keeps
   setup to a single env var; the trade-off is that changing the password
   invalidates existing sessions, which is the safe direction anyway. */
function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  var pw = adminPassword();
  if (!pw) return '';
  return crypto.createHash('sha256').update('gi-session:' + pw).digest('hex');
}

function isConfigured() { return Boolean(adminPassword()); }

function timingSafeEqual(a, b) {
  var bufA = Buffer.from(String(a), 'utf8');
  var bufB = Buffer.from(String(b), 'utf8');
  // Hash both sides first so differing lengths cannot throw or leak length.
  var hashA = crypto.createHash('sha256').update(bufA).digest();
  var hashB = crypto.createHash('sha256').update(bufB).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function checkPassword(candidate) {
  var expected = adminPassword();
  if (!expected || typeof candidate !== 'string' || !candidate) return false;
  return timingSafeEqual(candidate, expected);
}

function sign(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url');
}

function issueToken() {
  var exp = Date.now() + TTL_SECONDS * 1000;
  var payload = 'v1.' + exp;
  return payload + '.' + sign(payload);
}

function verifyToken(token) {
  if (typeof token !== 'string') return false;
  var parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return false;
  var exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  if (!secret()) return false;
  return timingSafeEqual(parts[2], sign('v1.' + parts[1]));
}

function parseCookies(header) {
  var out = {};
  if (typeof header !== 'string') return out;
  header.split(';').forEach(function (part) {
    var i = part.indexOf('=');
    if (i < 0) return;
    var k = part.slice(0, i).trim();
    var v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

function isAuthed(req) {
  return verifyToken(parseCookies(req.headers.cookie)[COOKIE]);
}

/* Secure is set whenever the request arrived over https, which is always true
   on Vercel; it is dropped on plain http so local testing still works. */
function cookieHeader(req, token, maxAge) {
  var proto = req.headers['x-forwarded-proto'];
  var secureFlag = (proto ? String(proto).split(',')[0] === 'https' : false) ? '; Secure' : '';
  return COOKIE + '=' + (token || '') +
    '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + maxAge + secureFlag;
}

function loginCookie(req) { return cookieHeader(req, issueToken(), TTL_SECONDS); }
function logoutCookie(req) { return cookieHeader(req, '', 0); }

/* Guard for every admin route. Returns true when the request may proceed. */
function requireAuth(req, res, fail) {
  if (!isConfigured()) {
    fail(res, 503, 'The admin area is not configured. Set ADMIN_PASSWORD in your Vercel project settings.');
    return false;
  }
  if (!isAuthed(req)) {
    fail(res, 401, 'Not signed in.');
    return false;
  }
  return true;
}

module.exports = {
  COOKIE: COOKIE,
  TTL_SECONDS: TTL_SECONDS,
  isConfigured: isConfigured,
  checkPassword: checkPassword,
  isAuthed: isAuthed,
  loginCookie: loginCookie,
  logoutCookie: logoutCookie,
  requireAuth: requireAuth
};
