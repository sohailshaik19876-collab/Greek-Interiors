'use strict';

/* Shared HTTP helpers for the Greek Interiors API.
   CommonJS + zero dependencies — Vercel deploys /api/*.js as Node functions
   with no build step, matching the rest of the project. */

const MAX_BODY = 32 * 1024; // 32 KB is far more than any enquiry needs

function send(res, status, payload, headers) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (headers) Object.keys(headers).forEach(function (k) { res.setHeader(k, headers[k]); });
  res.end(JSON.stringify(payload));
}

function fail(res, status, message, extra) {
  send(res, status, Object.assign({ ok: false, error: message }, extra || {}));
}

/* Vercel pre-parses JSON bodies; the local test harness does not. Handle both. */
function readJson(req) {
  return new Promise(function (resolve, reject) {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    if (typeof req.body === 'string') {
      try { return resolve(JSON.parse(req.body || '{}')); } catch (e) { return reject(new Error('Malformed JSON')); }
    }
    var size = 0;
    var chunks = [];
    req.on('data', function (c) {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('Payload too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', function () {
      var raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error('Malformed JSON')); }
    });
    req.on('error', reject);
  });
}

/* Behind Vercel's proxy the client address is the first x-forwarded-for hop. */
function clientIp(req) {
  var fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  if (Array.isArray(fwd) && fwd.length) return String(fwd[0]).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

function str(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

module.exports = { send: send, fail: fail, readJson: readJson, clientIp: clientIp, str: str };
