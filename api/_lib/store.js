'use strict';

/* Storage adapter — Upstash Redis over its REST API.
   Chosen because it needs no npm dependency and no build step: plain fetch on
   Node 18+. Provision it from the Vercel dashboard (Storage -> Upstash Redis)
   and the env vars below are injected automatically.

   Everything the rest of the codebase needs is in this file. To move to
   Postgres, Supabase or anything else, reimplement these exported functions —
   nothing outside this module knows how records are stored. */

const REST_URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL   || '';
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

const INDEX = 'enq:index';           // sorted set, score = submitted-at ms
const KEY   = function (id) { return 'enq:' + id; };

function isConfigured() { return Boolean(REST_URL && REST_TOKEN); }

/* Run one or more Redis commands. Upstash answers a pipeline with an array of
   {result} / {error} objects in the same order. */
async function pipeline(commands) {
  if (!isConfigured()) {
    var err = new Error('Storage is not configured');
    err.code = 'NO_STORE';
    throw err;
  }
  var res = await fetch(REST_URL.replace(/\/+$/, '') + '/pipeline', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + REST_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(commands)
  });
  if (!res.ok) {
    throw new Error('Storage request failed with status ' + res.status);
  }
  var payload = await res.json();
  var rows = Array.isArray(payload) ? payload : [payload];
  return rows.map(function (row) {
    if (row && row.error) throw new Error('Storage error: ' + row.error);
    return row ? row.result : null;
  });
}

async function one(command) {
  var out = await pipeline([command]);
  return out[0];
}

/* ---------- enquiries ---------- */

async function saveEnquiry(record) {
  await pipeline([
    ['SET', KEY(record.id), JSON.stringify(record)],
    ['ZADD', INDEX, String(record.submittedAt), record.id]
  ]);
  return record;
}

async function listEnquiries(limit) {
  var max = Math.max(1, Math.min(limit || 500, 1000));
  var ids = await one(['ZRANGE', INDEX, '0', String(max - 1), 'REV']);
  if (!Array.isArray(ids) || !ids.length) return [];
  var rows = await one(['MGET'].concat(ids.map(KEY)));
  var out = [];
  (rows || []).forEach(function (raw, i) {
    if (!raw) return;
    try {
      out.push(JSON.parse(raw));
    } catch (e) {
      // A single unparseable record must not take down the whole list.
      out.push({ id: ids[i], corrupt: true, submittedAt: 0 });
    }
  });
  return out;
}

async function getEnquiry(id) {
  var raw = await one(['GET', KEY(id)]);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

async function updateEnquiry(id, patch) {
  var current = await getEnquiry(id);
  if (!current) return null;
  var next = Object.assign({}, current, patch, { id: current.id, submittedAt: current.submittedAt });
  await one(['SET', KEY(id), JSON.stringify(next)]);
  return next;
}

async function deleteEnquiry(id) {
  var out = await pipeline([
    ['DEL', KEY(id)],
    ['ZREM', INDEX, id]
  ]);
  return Number(out[0]) > 0;
}

/* ---------- counters (rate limiting, login throttling) ---------- */

/* Returns the count after incrementing. The TTL is only set on first use, so a
   burst cannot keep pushing the window out. */
async function bump(key, windowSeconds) {
  var out = await pipeline([
    ['INCR', key],
    ['EXPIRE', key, String(windowSeconds), 'NX']
  ]);
  return Number(out[0]) || 0;
}

async function clearKey(key) { await one(['DEL', key]); }

module.exports = {
  isConfigured: isConfigured,
  saveEnquiry: saveEnquiry,
  listEnquiries: listEnquiries,
  getEnquiry: getEnquiry,
  updateEnquiry: updateEnquiry,
  deleteEnquiry: deleteEnquiry,
  bump: bump,
  clearKey: clearKey
};
