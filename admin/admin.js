/* =============================================================
   Greek Interiors — enquiry dashboard
   Vanilla JS, no dependencies.

   Enquiry content is written by strangers on the public internet, so every
   value from the API reaches the DOM through textContent or a created node —
   never innerHTML. The only markup this file builds by hand is the chart SVG,
   from numbers it computed itself.
   ============================================================= */
(function () {
  'use strict';

  var $ = function (s, c) { return (c || document).querySelector(s); };

  var STATUS_LABELS = {
    new: 'New',
    contacted: 'Contacted',
    quoted: 'Quoted',
    won: 'Won',
    lost: 'Lost'
  };
  var STATUS_ORDER = ['new', 'contacted', 'quoted', 'won', 'lost'];

  var state = {
    enquiries: [],
    filtered: [],
    status: 'all',
    type: '',
    query: '',
    openId: null
  };

  /* ------------------------------------------------------------------
     API
     ------------------------------------------------------------------ */
  async function api(path, options) {
    var res = await fetch(path, Object.assign({
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin'
    }, options || {}));
    var data = {};
    try { data = await res.json(); } catch (e) { data = {}; }
    if (!res.ok) {
      var err = new Error(data.error || ('Request failed (' + res.status + ')'));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  /* ------------------------------------------------------------------
     Formatting
     ------------------------------------------------------------------ */
  function fmtDateTime(ms) {
    if (!ms) return '—';
    return new Date(ms).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }
  function fmtShort(ms) {
    if (!ms) return '—';
    return new Date(ms).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  }
  function startOfWeek(d) {
    var x = new Date(d);
    x.setHours(0, 0, 0, 0);
    var day = (x.getDay() + 6) % 7;      // Monday = 0
    x.setDate(x.getDate() - day);
    return x;
  }
  function digitsOnly(s) { return String(s || '').replace(/[^\d]/g, ''); }

  /* ------------------------------------------------------------------
     Sign in
     ------------------------------------------------------------------ */
  function showGate(message) {
    $('#app').hidden = true;
    $('#gate').hidden = false;
    if (message) $('#loginMsg').textContent = message;
    var pw = $('#password');
    if (pw) pw.focus();
  }

  function showApp() {
    $('#gate').hidden = true;
    $('#app').hidden = false;
  }

  $('#loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var btn = $('#loginBtn');
    var msg = $('#loginMsg');
    msg.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    try {
      await api('/api/admin/session', {
        method: 'POST',
        body: JSON.stringify({ password: $('#password').value })
      });
      $('#password').value = '';
      showApp();
      await load();
    } catch (err) {
      msg.textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign in';
    }
  });

  $('#logoutBtn').addEventListener('click', async function () {
    try { await api('/api/admin/session', { method: 'DELETE' }); } catch (e) { /* ignore */ }
    state.enquiries = [];
    closeDrawer();
    showGate('Signed out.');
  });

  /* ------------------------------------------------------------------
     Load + render
     ------------------------------------------------------------------ */
  function setNotice(text, isHtmlSafeLink) {
    var el = $('#notice');
    if (!text) { el.hidden = true; el.textContent = ''; return; }
    el.textContent = text;
    el.hidden = false;
    if (isHtmlSafeLink) {
      var a = document.createElement('a');
      a.href = isHtmlSafeLink.href;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = ' ' + isHtmlSafeLink.label;
      el.appendChild(a);
    }
  }

  async function load() {
    try {
      var data = await api('/api/admin/enquiries');
      state.enquiries = (data.enquiries || []).filter(function (e) { return e && !e.corrupt; });
      setNotice('');
      buildTypeFilter();
      render();
    } catch (err) {
      if (err.status === 401) { showGate('Your session expired. Please sign in again.'); return; }
      setNotice(err.message);
      state.enquiries = [];
      render();
    }
  }

  $('#refreshBtn').addEventListener('click', load);

  function applyFilters() {
    var q = state.query.trim().toLowerCase();
    state.filtered = state.enquiries.filter(function (e) {
      if (state.status !== 'all' && (e.status || 'new') !== state.status) return false;
      if (state.type && e.projectType !== state.type) return false;
      if (!q) return true;
      var hay = [e.name, e.phone, e.email, e.projectType, e.message, e.notes]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  function render() {
    applyFilters();
    renderSummary();
    renderChips();
    renderChart();
    renderRows();
  }

  /* ---------- summary ---------- */
  function renderSummary() {
    var all = state.enquiries;
    var now = Date.now();
    var weekAgo = now - 7 * 864e5;
    var twoWeeksAgo = now - 14 * 864e5;

    var thisWeek = all.filter(function (e) { return e.submittedAt >= weekAgo; }).length;
    var lastWeek = all.filter(function (e) {
      return e.submittedAt >= twoWeeksAgo && e.submittedAt < weekAgo;
    }).length;

    var byStatus = {};
    STATUS_ORDER.forEach(function (s) { byStatus[s] = 0; });
    all.forEach(function (e) {
      var s = e.status || 'new';
      if (byStatus[s] === undefined) byStatus[s] = 0;
      byStatus[s]++;
    });

    $('#statTotal').textContent = String(all.length);
    $('#statNew').textContent = String(byStatus['new'] || 0);
    $('#statWeek').textContent = String(thisWeek);
    $('#statOpen').textContent = String((byStatus.contacted || 0) + (byStatus.quoted || 0));
    $('#statWon').textContent = String(byStatus.won || 0);

    var delta = $('#statDelta');
    delta.textContent = '';
    if (!all.length) { delta.textContent = 'No enquiries yet.'; return; }
    var diff = thisWeek - lastWeek;
    var b = document.createElement('b');
    b.textContent = (diff > 0 ? '+' : '') + diff;
    delta.appendChild(b);
    delta.appendChild(document.createTextNode(' vs the previous 7 days'));
  }

  /* ---------- status chips ---------- */
  function renderChips() {
    var wrap = $('#statusChips');
    wrap.textContent = '';
    var counts = { all: state.enquiries.length };
    STATUS_ORDER.forEach(function (s) { counts[s] = 0; });
    state.enquiries.forEach(function (e) {
      var s = e.status || 'new';
      counts[s] = (counts[s] || 0) + 1;
    });

    ['all'].concat(STATUS_ORDER).forEach(function (key) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip chip--' + key;
      btn.setAttribute('aria-pressed', String(state.status === key));
      var dot = document.createElement('span');
      dot.className = 'chip__dot';
      btn.appendChild(dot);
      btn.appendChild(document.createTextNode(key === 'all' ? 'All' : STATUS_LABELS[key]));
      var n = document.createElement('span');
      n.className = 'chip__n';
      n.textContent = String(counts[key] || 0);
      btn.appendChild(n);
      btn.addEventListener('click', function () {
        state.status = key;
        render();
      });
      wrap.appendChild(btn);
    });
  }

  function buildTypeFilter() {
    var sel = $('#typeFilter');
    var current = sel.value;
    var types = [];
    state.enquiries.forEach(function (e) {
      if (e.projectType && types.indexOf(e.projectType) < 0) types.push(e.projectType);
    });
    types.sort();
    sel.textContent = '';
    var first = document.createElement('option');
    first.value = '';
    first.textContent = 'All project types';
    sel.appendChild(first);
    types.forEach(function (t) {
      var o = document.createElement('option');
      o.value = t;
      o.textContent = t;
      sel.appendChild(o);
    });
    if (types.indexOf(current) >= 0) sel.value = current;
  }

  $('#typeFilter').addEventListener('change', function () {
    state.type = this.value;
    render();
  });

  var searchTimer = null;
  $('#search').addEventListener('input', function () {
    var value = this.value;
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(function () {
      state.query = value;
      render();
    }, 160);
  });

  /* ------------------------------------------------------------------
     Weekly volume chart
     Single series, so no legend — the panel title names what is plotted.
     ------------------------------------------------------------------ */
  var WEEKS = 12;

  function weeklyBuckets() {
    var thisWeekStart = startOfWeek(new Date());
    var buckets = [];
    for (var i = WEEKS - 1; i >= 0; i--) {
      var start = new Date(thisWeekStart);
      start.setDate(start.getDate() - i * 7);
      var end = new Date(start);
      end.setDate(end.getDate() + 7);
      buckets.push({ start: start, end: end, count: 0 });
    }
    state.enquiries.forEach(function (e) {
      for (var i = 0; i < buckets.length; i++) {
        if (e.submittedAt >= buckets[i].start.getTime() && e.submittedAt < buckets[i].end.getTime()) {
          buckets[i].count++;
          return;
        }
      }
    });
    return buckets;
  }

  function niceStep(max) {
    if (max <= 4) return 1;
    var raw = max / 4;
    var pow = Math.pow(10, Math.floor(Math.log10(raw)));
    var candidates = [1, 2, 2.5, 5, 10].map(function (m) { return m * pow; });
    for (var i = 0; i < candidates.length; i++) if (candidates[i] >= raw) return candidates[i];
    return candidates[candidates.length - 1];
  }

  function svgEl(name, attrs) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    return el;
  }

  /* Rounded at the data-end, square on the baseline. */
  function barPath(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h));
    return 'M' + x + ',' + (y + h) +
           ' L' + x + ',' + (y + r) +
           ' Q' + x + ',' + y + ' ' + (x + r) + ',' + y +
           ' L' + (x + w - r) + ',' + y +
           ' Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) +
           ' L' + (x + w) + ',' + (y + h) + ' Z';
  }

  function renderChart() {
    var host = $('#chart');
    host.textContent = '';

    var buckets = weeklyBuckets();
    var maxCount = buckets.reduce(function (m, b) { return Math.max(m, b.count); }, 0);

    if (!state.enquiries.length) {
      var none = document.createElement('p');
      none.className = 'chart__empty';
      none.textContent = 'No enquiries yet — the chart fills in as they arrive.';
      host.appendChild(none);
      renderChartTable(buckets);
      return;
    }

    var wrap = document.createElement('div');
    wrap.className = 'chart__wrap';
    host.appendChild(wrap);

    var W = Math.max(320, host.clientWidth || 640);
    var H = 210;
    var padL = 36, padR = 10, padT = 20, padB = 28;
    var plotW = W - padL - padR;
    var plotH = H - padT - padB;

    var step = niceStep(maxCount || 1);
    var top = Math.max(step, Math.ceil((maxCount || 1) / step) * step);

    var summary = 'Enquiries per week over the last 12 weeks. ' +
      buckets.map(function (b) { return fmtShort(b.start.getTime()) + ': ' + b.count; }).join(', ') + '.';

    var svg = svgEl('svg', {
      viewBox: '0 0 ' + W + ' ' + H,
      role: 'img',
      'aria-label': summary
    });

    /* gridlines + y ticks */
    var grid = svgEl('g', { class: 'grid' });
    for (var v = 0; v <= top + 0.0001; v += step) {
      var y = padT + plotH - (v / top) * plotH;
      grid.appendChild(svgEl('line', { x1: padL, y1: y, x2: W - padR, y2: y }));
      var t = svgEl('text', { class: 'tick', x: padL - 8, y: y + 4, 'text-anchor': 'end' });
      t.textContent = String(Math.round(v));
      grid.appendChild(t);
    }
    svg.appendChild(grid);

    /* columns */
    var band = plotW / buckets.length;
    var barW = Math.max(6, Math.min(24, band - 10));   // leftover band is air; gap never under 2px
    var peakIndex = buckets.reduce(function (best, b, i) {
      return b.count > buckets[best].count ? i : best;
    }, 0);

    var tip = document.createElement('div');
    tip.className = 'chart__tip';
    wrap.appendChild(tip);

    buckets.forEach(function (b, i) {
      var cx = padL + band * i + band / 2;
      var h = top ? (b.count / top) * plotH : 0;
      var y = padT + plotH - h;
      var g = svgEl('g', { class: 'col' });

      if (b.count > 0) {
        g.appendChild(svgEl('path', { class: 'bar', d: barPath(cx - barW / 2, y, barW, h, 4) }));
      }

      /* Selective direct label: the peak only. */
      if (i === peakIndex && b.count > 0) {
        var lab = svgEl('text', { class: 'peak', x: cx, y: y - 7, 'text-anchor': 'middle' });
        lab.textContent = String(b.count);
        g.appendChild(lab);
      }

      /* x label every other week so they never collide */
      if (i % 2 === 1 || buckets.length <= 6) {
        var xl = svgEl('text', { class: 'xlab', x: cx, y: H - 9, 'text-anchor': 'middle' });
        xl.textContent = fmtShort(b.start.getTime());
        g.appendChild(xl);
      }

      /* hit target spans the whole band, not just the bar */
      var hit = svgEl('rect', {
        class: 'hit', x: padL + band * i, y: padT, width: band, height: plotH
      });
      g.appendChild(hit);

      g.addEventListener('mouseenter', function () {
        g.classList.add('is-active');
        tip.textContent = '';
        var strong = document.createElement('b');
        strong.textContent = b.count + (b.count === 1 ? ' enquiry' : ' enquiries');
        tip.appendChild(strong);
        tip.appendChild(document.createElement('br'));
        tip.appendChild(document.createTextNode('week of ' + fmtShort(b.start.getTime())));
        tip.style.left = ((cx / W) * 100) + '%';
        tip.style.top = (padT + plotH - h) * (wrap.clientHeight / H) + 'px';
        tip.style.opacity = '1';
      });
      g.addEventListener('mouseleave', function () {
        g.classList.remove('is-active');
        tip.style.opacity = '0';
      });

      svg.appendChild(g);
    });

    wrap.appendChild(svg);
    renderChartTable(buckets);
  }

  function renderChartTable(buckets) {
    var host = $('#chartTable');
    host.textContent = '';
    var table = document.createElement('table');
    var thead = document.createElement('thead');
    var hr = document.createElement('tr');
    ['Week beginning', 'Enquiries'].forEach(function (h) {
      var th = document.createElement('th');
      th.scope = 'col';
      th.textContent = h;
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = document.createElement('tbody');
    buckets.forEach(function (b) {
      var tr = document.createElement('tr');
      var d = document.createElement('td');
      d.textContent = b.start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      var c = document.createElement('td');
      c.textContent = String(b.count);
      tr.appendChild(d); tr.appendChild(c);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    host.appendChild(table);
  }

  $('#chartTableBtn').addEventListener('click', function () {
    var panel = $('#chartTable');
    var open = panel.hidden;
    panel.hidden = !open;
    this.setAttribute('aria-expanded', String(open));
    this.textContent = open ? 'Hide data' : 'Show data';
  });

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      if (!$('#app').hidden) renderChart();
    }, 180);
  });

  /* ------------------------------------------------------------------
     Table
     ------------------------------------------------------------------ */
  function statusNode(status) {
    var s = STATUS_LABELS[status] ? status : 'new';
    var span = document.createElement('span');
    span.className = 'status status--' + s;
    var dot = document.createElement('span');
    dot.className = 'status__dot';
    span.appendChild(dot);
    span.appendChild(document.createTextNode(STATUS_LABELS[s]));
    return span;
  }

  function renderRows() {
    var body = $('#rows');
    body.textContent = '';

    $('#resultCount').textContent = state.filtered.length === state.enquiries.length
      ? state.enquiries.length + (state.enquiries.length === 1 ? ' enquiry' : ' enquiries')
      : state.filtered.length + ' of ' + state.enquiries.length;

    var empty = $('#empty');
    if (!state.filtered.length) {
      empty.hidden = false;
      empty.textContent = state.enquiries.length
        ? 'No enquiries match those filters.'
        : 'No enquiries yet. They will appear here the moment someone submits the contact form.';
      return;
    }
    empty.hidden = true;

    state.filtered.forEach(function (e) {
      var tr = document.createElement('tr');
      tr.tabIndex = 0;
      if (e.id === state.openId) tr.className = 'is-open';

      var td1 = document.createElement('td');
      td1.className = 'cell-when';
      td1.textContent = fmtDateTime(e.submittedAt);

      var td2 = document.createElement('td');
      var nm = document.createElement('span');
      nm.className = 'cell-name';
      nm.textContent = e.name || '—';
      td2.appendChild(nm);

      /* Repeated on narrow screens, where the contact and project columns are
         hidden rather than pushed off the edge. */
      var fold = document.createElement('span');
      fold.className = 'cell-sub cell-fold';
      fold.textContent = [e.phone, e.projectType].filter(Boolean).join(' · ');
      td2.appendChild(fold);

      if (e.notes) {
        var sub = document.createElement('span');
        sub.className = 'cell-sub';
        sub.textContent = e.notes.slice(0, 60) + (e.notes.length > 60 ? '…' : '');
        td2.appendChild(sub);
      }

      var td3 = document.createElement('td');
      td3.className = 'cell-contact';
      td3.textContent = e.phone || '—';
      var mail = document.createElement('span');
      mail.className = 'cell-sub';
      mail.textContent = e.email || '';
      td3.appendChild(mail);

      var td4 = document.createElement('td');
      td4.textContent = e.projectType || '—';

      var td5 = document.createElement('td');
      td5.appendChild(statusNode(e.status));

      [td1, td2, td3, td4, td5].forEach(function (td) { tr.appendChild(td); });

      tr.addEventListener('click', function () { openDrawer(e.id); });
      tr.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openDrawer(e.id); }
      });
      body.appendChild(tr);
    });
  }

  /* ------------------------------------------------------------------
     Detail drawer
     ------------------------------------------------------------------ */
  function findEnquiry(id) {
    for (var i = 0; i < state.enquiries.length; i++) {
      if (state.enquiries[i].id === id) return state.enquiries[i];
    }
    return null;
  }

  function quickLink(href, label, cls) {
    var a = document.createElement('a');
    a.href = href;
    a.textContent = label;
    if (cls) a.className = cls;
    if (href.indexOf('http') === 0) { a.target = '_blank'; a.rel = 'noopener'; }
    return a;
  }

  function openDrawer(id) {
    var e = findEnquiry(id);
    if (!e) return;
    state.openId = id;

    $('#dName').textContent = e.name || 'Enquiry';
    $('#dWhen').textContent = 'Received ' + fmtDateTime(e.submittedAt);
    $('#dPhone').textContent = '';
    $('#dEmail').textContent = '';

    var phoneDigits = digitsOnly(e.phone);
    if (e.phone) {
      $('#dPhone').appendChild(quickLink('tel:' + e.phone.replace(/\s+/g, ''), e.phone));
    } else { $('#dPhone').textContent = '—'; }
    if (e.email) {
      $('#dEmail').appendChild(quickLink('mailto:' + e.email, e.email));
    } else { $('#dEmail').textContent = '—'; }

    $('#dType').textContent = e.projectType || '—';
    $('#dSource').textContent = e.source || 'website';

    var msg = $('#dMessage');
    msg.textContent = e.message || 'No message was left.';
    msg.classList.toggle('is-empty', !e.message);

    var quick = $('#dQuick');
    quick.textContent = '';
    if (phoneDigits) {
      quick.appendChild(quickLink('tel:' + e.phone.replace(/\s+/g, ''), 'Call'));
      var wa = phoneDigits.length === 10 ? '91' + phoneDigits : phoneDigits;
      quick.appendChild(quickLink(
        'https://wa.me/' + wa + '?text=' + encodeURIComponent(
          'Hello ' + (e.name || '') + ', thank you for your enquiry with Greek Interiors.'
        ), 'WhatsApp', 'is-wa'));
    }
    if (e.email) quick.appendChild(quickLink('mailto:' + e.email, 'Email'));

    var sel = $('#dStatus');
    sel.textContent = '';
    STATUS_ORDER.forEach(function (s) {
      var o = document.createElement('option');
      o.value = s;
      o.textContent = STATUS_LABELS[s];
      sel.appendChild(o);
    });
    sel.value = STATUS_LABELS[e.status] ? e.status : 'new';

    $('#dNotes').value = e.notes || '';
    $('#drawerMsg').textContent = '';

    $('#drawer').hidden = false;
    $('#drawer').setAttribute('aria-hidden', 'false');
    $('#scrim').hidden = false;
    $('#closeDrawer').focus();
    renderRows();
  }

  function closeDrawer() {
    state.openId = null;
    $('#drawer').hidden = true;
    $('#drawer').setAttribute('aria-hidden', 'true');
    $('#scrim').hidden = true;
    renderRows();
  }

  $('#closeDrawer').addEventListener('click', closeDrawer);
  $('#scrim').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !$('#drawer').hidden) closeDrawer();
  });

  $('#saveBtn').addEventListener('click', async function () {
    if (!state.openId) return;
    var btn = this;
    btn.disabled = true;
    $('#drawerMsg').textContent = 'Saving…';
    try {
      var data = await api('/api/admin/enquiries', {
        method: 'PATCH',
        body: JSON.stringify({
          id: state.openId,
          status: $('#dStatus').value,
          notes: $('#dNotes').value
        })
      });
      for (var i = 0; i < state.enquiries.length; i++) {
        if (state.enquiries[i].id === data.enquiry.id) state.enquiries[i] = data.enquiry;
      }
      $('#drawerMsg').textContent = 'Saved.';
      render();
    } catch (err) {
      $('#drawerMsg').textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  $('#deleteBtn').addEventListener('click', async function () {
    if (!state.openId) return;
    var e = findEnquiry(state.openId);
    var who = e && e.name ? e.name : 'this enquiry';
    if (!window.confirm('Delete the enquiry from ' + who + '? This cannot be undone.')) return;
    var btn = this;
    btn.disabled = true;
    try {
      await api('/api/admin/enquiries?id=' + encodeURIComponent(state.openId), { method: 'DELETE' });
      state.enquiries = state.enquiries.filter(function (x) { return x.id !== state.openId; });
      closeDrawer();
      buildTypeFilter();
      render();
    } catch (err) {
      $('#drawerMsg').textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  /* ------------------------------------------------------------------
     CSV export
     ------------------------------------------------------------------ */
  function csvCell(value) {
    var s = value === null || value === undefined ? '' : String(value);
    /* A leading =, +, - or @ makes a spreadsheet treat the cell as a formula.
       Enquiry text is untrusted, so neutralise it before it reaches Excel. */
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }

  $('#exportBtn').addEventListener('click', function () {
    var rows = state.filtered.length ? state.filtered : state.enquiries;
    if (!rows.length) { setNotice('There is nothing to export yet.'); return; }

    var header = ['Received', 'Name', 'Phone', 'Email', 'Project type', 'Status', 'Message', 'Notes'];
    var lines = [header.map(csvCell).join(',')];
    rows.forEach(function (e) {
      lines.push([
        fmtDateTime(e.submittedAt), e.name, e.phone, e.email,
        e.projectType, STATUS_LABELS[e.status] || 'New', e.message, e.notes
      ].map(csvCell).join(','));
    });

    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'greek-interiors-enquiries-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */
  (async function boot() {
    try {
      var s = await api('/api/admin/session');
      if (!s.configured) {
        showGate('No admin password is set yet. Add ADMIN_PASSWORD in your Vercel project settings and redeploy.');
        $('#loginBtn').disabled = true;
        return;
      }
      if (s.authed) { showApp(); await load(); }
      else showGate('');
    } catch (err) {
      showGate('Could not reach the server. If you opened this file directly, run it through Vercel instead.');
    }
  })();
})();
