'use strict';

/* POST /api/enquiry — public endpoint behind the contact form.

   Anything here is attacker-reachable, so: method allowlist, field length caps,
   a project-type allowlist, a honeypot, and a per-IP rate limit. The stored IP
   is hashed — enough to correlate spam, not a retained personal identifier. */

const crypto = require('crypto');
const store = require('./_lib/store');
const { send, fail, readJson, clientIp, str } = require('./_lib/http');

const PROJECT_TYPES = [
  'Apartment Interiors',
  'Independent House / Villa',
  'Modular Kitchen',
  'Wardrobes & Storage',
  'Renovation & Remodeling',
  'Commercial / Office',
  'Turnkey Project'
];

const RATE_LIMIT = 6;              // submissions per IP
const RATE_WINDOW = 60 * 60;       // per hour

function hashIp(ip) {
  return crypto.createHash('sha256')
    .update('gi-ip:' + (process.env.SESSION_SECRET || '') + ':' + ip)
    .digest('hex').slice(0, 16);
}

function newId() {
  return Date.now().toString(36) + '-' + crypto.randomBytes(5).toString('hex');
}

function validate(body) {
  var errors = {};
  var name = str(body.name, 120);
  var phone = str(body.phone, 24);
  var email = str(body.email, 160);
  var projectType = str(body.projectType, 60);
  var message = typeof body.message === 'string' ? body.message.trim().slice(0, 2000) : '';

  if (name.length < 2) errors.name = 'Please enter your name.';
  if (!/^[\d\s()+-]{8,18}$/.test(phone)) errors.phone = 'Please enter a valid phone number.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = 'Please enter a valid email address.';
  if (PROJECT_TYPES.indexOf(projectType) < 0) errors.projectType = 'Please choose a project type.';

  return {
    errors: errors,
    value: { name: name, phone: phone, email: email, projectType: projectType, message: message }
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return fail(res, 405, 'Method not allowed.');
  }

  if (!store.isConfigured()) {
    return fail(res, 503, 'Enquiries are not being stored yet. Please call or WhatsApp us instead.', { unconfigured: true });
  }

  var body;
  try {
    body = await readJson(req);
  } catch (e) {
    return fail(res, 400, e.message === 'Payload too large' ? 'That message is too long.' : 'Malformed request.');
  }

  /* Honeypot: a field no human sees. Answer 200 so bots learn nothing. */
  if (str(body.company, 200)) return send(res, 200, { ok: true, id: null });

  var checked = validate(body);
  if (Object.keys(checked.errors).length) {
    return fail(res, 422, 'Please check the highlighted fields.', { fields: checked.errors });
  }

  var ip = clientIp(req);
  var fingerprint = hashIp(ip);

  try {
    var hits = await store.bump('rl:enq:' + fingerprint, RATE_WINDOW);
    if (hits > RATE_LIMIT) {
      return fail(res, 429, 'We have already received several enquiries from you. Please call us on +91 97004 53895.');
    }

    var record = Object.assign({}, checked.value, {
      id: newId(),
      submittedAt: Date.now(),
      status: 'new',
      notes: '',
      source: str(req.headers.referer, 300) || 'website',
      userAgent: str(req.headers['user-agent'], 300),
      ipHash: fingerprint
    });

    await store.saveEnquiry(record);
    return send(res, 201, { ok: true, id: record.id });
  } catch (err) {
    console.error('enquiry failed:', err && err.message);
    return fail(res, 502, 'We could not record that just now. Please call or WhatsApp us on +91 97004 53895.');
  }
};

module.exports.PROJECT_TYPES = PROJECT_TYPES;
