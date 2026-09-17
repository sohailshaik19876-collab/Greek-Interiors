'use strict';

/* Storage adapter — Upstash Redis over its REST API.
   Chosen because it needs no npm dependency and no build step: plain fetch on
   Node 18+. Provision it from the Vercel dashboard (Storage -> Upstash Redis)
   and the env vars below are injected automatically.

   Everything the rest of the codebase needs is in this file. To move to
   Postgres, Supabase or anything else, reimplement these exported functions —
   nothing outside this module knows how records are stored. */

/* Vercel names these differently depending on how the database was attached:
   the legacy KV integration uses KV_REST_API_*, the Upstash marketplace
   integration uses UPSTASH_REDIS_REST_*, and naming the store prefixes
   whichever pair you get (STORAGE_KV_REST_API_URL and so on). Rather than
   guess, look for any variable whose name ends in a known suffix and pair the
   token to the URL it was found beside. */
const URL_SUFFIXES = ['KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL', 'REDIS_REST_URL'];
const TOKEN_SUFFIXES = ['KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN', 'REDIS_REST_TOKEN'];

/* Connection strings that are NOT the REST API. Their presence means the
   database is attached but the REST credentials were not exposed — a
   different problem from "no database", and worth saying so. */
const NON_REST_VARS = ['REDIS_URL', 'KV_URL', 'UPSTASH_REDIS_URL'];

function findVar(suffixes) {
  for (var i = 0; i < suffixes.length; i++) {
    if (process.env[suffixes[i]]) return { name: suffixes[i], value: process.env[suffixes[i]] };
  }
  var keys = Object.keys(process.env);
  for (var j = 0; j < suffixes.length; j++) {
    for (var k = 0; k < keys.length; k++) {
      if (keys[k].endsWith('_' + suffixes[j]) && process.env[keys[k]]) {
        return { name: keys[k], value: process.env[keys[k]] };
      }
    }
  }
  return null;
}

function resolveCredentials() {
  var url = findVar(URL_SUFFIXES);
  if (!url) return { url: null, token: findVar(TOKEN_SUFFIXES) };

  /* Prefer the token sitting on the same prefix as the URL we matched. */
  var token = null;
  for (var i = 0; i < URL_SUFFIXES.length; i++) {
    if (!url.name.endsWith(URL_SUFFIXES[i])) continue;
    var prefix = url.name.slice(0, url.name.length - URL_SUFFIXES[i].length);
    for (var j = 0; j < TOKEN_SUFFIXES.length; j++) {
      var candidate = prefix + TOKEN_SUFFIXES[j];
      if (process.env[candidate]) { token = { name: candidate, value: process.env[candidate] }; break; }
    }
    if (token) break;
  }
  return { url: url, token: token || findVar(TOKEN_SUFFIXES) };
}

const CREDS = resolveCredentials();
const REST_URL = CREDS.url ? String(CREDS.url.value).trim().replace(/\/+$/, '') : '';
const REST_TOKEN = CREDS.token ? String(CREDS.token.value).trim() : '';
const URL_IS_HTTP = /^https?:\/\//i.test(REST_URL);

function nonRestVarPresent() {
  var keys = Object.keys(process.env);
  for (var i = 0; i < NON_REST_VARS.length; i++) {
    for (var j = 0; j < keys.length; j++) {
      if ((keys[j] === NON_REST_VARS[i] || keys[j].endsWith('_' + NON_REST_VARS[i])) && process.env[keys[j]]) {
        return keys[j];
      }
    }
  }
  return null;
}

/* Variable NAMES and booleans only — never a value. Safe to hand to the
   dashboard so setup can be diagnosed without reading Vercel's settings. */
function describe() {
  return {
    configured: isConfigured(),
    urlVar: CREDS.url ? CREDS.url.name : null,
    tokenVar: CREDS.token ? CREDS.token.name : null,
    urlIsHttp: URL_IS_HTTP,
    nonRestVar: nonRestVarPresent()
  };
}

const INDEX = 'enq:index';           // sorted set, score = submitted-at ms
const KEY   = function (id) { return 'enq:' + id; };

function isConfigured() { return Boolean(REST_URL && REST_TOKEN && URL_IS_HTTP); }

/* Run one or more Redis commands. Upstash answers a pipeline with an array of
   {result} / {error} objects in the same order. */
async function pipeline(commands) {
  if (!isConfigured()) {
    var err = new Error('Storage is not configured');
    err.code = 'NO_STORE';
    err.detail = describe();
    throw err;
  }
  var res = await fetch(REST_URL + '/pipeline', {
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
  describe: describe,
  saveEnquiry: saveEnquiry,
  listEnquiries: listEnquiries,
  getEnquiry: getEnquiry,
  updateEnquiry: updateEnquiry,
  deleteEnquiry: deleteEnquiry,
  bump: bump,
  clearKey: clearKey
};
