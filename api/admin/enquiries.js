'use strict';

/* /api/admin/enquiries — list (GET), update status/notes (PATCH), remove (DELETE).
   Every method is behind the session guard. */

const auth = require('../_lib/auth');
const store = require('../_lib/store');
const { send, fail, readJson, str } = require('../_lib/http');

const STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost'];

function idFromRequest(req, body) {
  if (body && typeof body.id === 'string' && body.id) return body.id;
  try {
    var url = new URL(req.url, 'http://localhost');
    return url.searchParams.get('id') || '';
  } catch (e) {
    return '';
  }
}

module.exports = async function handler(req, res) {
  if (!auth.requireAuth(req, res, fail)) return;

  if (!store.isConfigured()) {
    return fail(res, 503, 'Storage is not configured. Connect an Upstash Redis database in Vercel and redeploy.');
  }

  try {
    if (req.method === 'GET') {
      var rows = await store.listEnquiries(500);
      return send(res, 200, { ok: true, enquiries: rows, statuses: STATUSES });
    }

    if (req.method === 'PATCH') {
      var body = await readJson(req);
      var id = idFromRequest(req, body);
      if (!id) return fail(res, 400, 'Missing enquiry id.');

      var patch = {};
      if (typeof body.status === 'string') {
        if (STATUSES.indexOf(body.status) < 0) return fail(res, 422, 'Unknown status.');
        patch.status = body.status;
      }
      if (typeof body.notes === 'string') {
        patch.notes = body.notes.trim().slice(0, 4000);
      }
      if (!Object.keys(patch).length) return fail(res, 400, 'Nothing to update.');
      patch.updatedAt = Date.now();

      var updated = await store.updateEnquiry(id, patch);
      if (!updated) return fail(res, 404, 'That enquiry no longer exists.');
      return send(res, 200, { ok: true, enquiry: updated });
    }

    if (req.method === 'DELETE') {
      var delBody = {};
      try { delBody = await readJson(req); } catch (e) { delBody = {}; }
      var delId = idFromRequest(req, delBody);
      if (!delId) return fail(res, 400, 'Missing enquiry id.');
      var removed = await store.deleteEnquiry(delId);
      return send(res, 200, { ok: true, deleted: removed });
    }

    res.setHeader('Allow', 'GET, PATCH, DELETE');
    return fail(res, 405, 'Method not allowed.');
  } catch (err) {
    console.error('admin/enquiries failed:', err && err.message);
    return fail(res, 502, 'Could not reach the enquiry store.');
  }
};

module.exports.STATUSES = STATUSES;
