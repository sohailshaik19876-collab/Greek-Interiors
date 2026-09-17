'use strict';

/* /api/admin/session — sign in (POST), sign out (DELETE), check (GET).

   One password guards the dashboard, so brute force is the threat that matters:
   failed attempts are counted per IP and the endpoint locks out for the rest of
   the window once the ceiling is hit. */

const auth = require('../_lib/auth');
const store = require('../_lib/store');
const { send, fail, readJson, clientIp } = require('../_lib/http');

const MAX_ATTEMPTS = 8;
const LOCK_WINDOW = 15 * 60;

/* Fallback throttle for when the shared store is unavailable. It only counts
   attempts within one warm serverless instance, so it is weaker than the Redis
   counter — hence the lower ceiling. Being locked out of your own dashboard
   because the database is missing is worse than this, and with no store there
   are no enquiries behind the login to reach anyway. */
const MEMORY_MAX_ATTEMPTS = 5;
var memoryHits = new Map();

function memoryBump(key, windowSeconds) {
  var now = Date.now();
  var entry = memoryHits.get(key);
  if (!entry || entry.expires < now) entry = { count: 0, expires: now + windowSeconds * 1000 };
  entry.count++;
  memoryHits.set(key, entry);
  if (memoryHits.size > 500) {
    memoryHits.forEach(function (v, k) { if (v.expires < now) memoryHits.delete(k); });
  }
  return entry.count;
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return send(res, 200, {
      ok: true,
      authed: auth.isConfigured() && auth.isAuthed(req),
      configured: auth.isConfigured(),
      storage: store.isConfigured(),
      /* Variable names and booleans only, no values — enough for the dashboard
         to say precisely what is missing instead of "not configured". */
      storageDetail: store.describe()
    });
  }

  if (req.method === 'DELETE') {
    return send(res, 200, { ok: true, authed: false }, { 'Set-Cookie': auth.logoutCookie(req) });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return fail(res, 405, 'Method not allowed.');
  }

  if (!auth.isConfigured()) {
    return fail(res, 503, 'No admin password is set. Add ADMIN_PASSWORD in your Vercel project settings, then redeploy.');
  }

  var body;
  try { body = await readJson(req); } catch (e) { return fail(res, 400, 'Malformed request.'); }

  var throttleKey = 'rl:login:' + clientIp(req);

  /* Throttling prefers the shared store, but a missing or unreachable database
     must not lock the owner out of the dashboard — fall back to the in-memory
     counter and keep sign-in working. */
  var attempts;
  var ceiling = MAX_ATTEMPTS;
  try {
    attempts = await store.bump(throttleKey, LOCK_WINDOW);
  } catch (err) {
    if (!err || err.code !== 'NO_STORE') {
      console.error('login throttle fell back to memory:', err && err.message);
    }
    attempts = memoryBump(throttleKey, LOCK_WINDOW);
    ceiling = MEMORY_MAX_ATTEMPTS;
  }

  if (attempts > ceiling) {
    return fail(res, 429, 'Too many attempts. Please wait fifteen minutes and try again.');
  }

  if (!auth.checkPassword(body && body.password)) {
    return fail(res, 401, 'That password is not correct.', { remaining: Math.max(0, MAX_ATTEMPTS - attempts) });
  }

  try { await store.clearKey(throttleKey); } catch (e) { /* non-fatal */ }

  return send(res, 200, {
    ok: true,
    authed: true,
    storage: store.isConfigured(),
    storageDetail: store.describe()
  }, { 'Set-Cookie': auth.loginCookie(req) });
};
