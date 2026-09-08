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

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return send(res, 200, {
      ok: true,
      authed: auth.isConfigured() && auth.isAuthed(req),
      configured: auth.isConfigured(),
      storage: store.isConfigured()
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

  /* Throttling needs the store. If it is unavailable, fail closed rather than
     silently handing out unlimited password guesses. */
  var attempts;
  try {
    attempts = await store.bump(throttleKey, LOCK_WINDOW);
  } catch (err) {
    if (err && err.code === 'NO_STORE') {
      return fail(res, 503, 'Storage is not configured, so sign-in is disabled. Connect an Upstash Redis database in Vercel.');
    }
    console.error('login throttle failed:', err && err.message);
    return fail(res, 502, 'Could not sign you in just now. Please try again.');
  }

  if (attempts > MAX_ATTEMPTS) {
    return fail(res, 429, 'Too many attempts. Please wait fifteen minutes and try again.');
  }

  if (!auth.checkPassword(body && body.password)) {
    return fail(res, 401, 'That password is not correct.', { remaining: Math.max(0, MAX_ATTEMPTS - attempts) });
  }

  try { await store.clearKey(throttleKey); } catch (e) { /* non-fatal */ }

  return send(res, 200, { ok: true, authed: true }, { 'Set-Cookie': auth.loginCookie(req) });
};
