/* =============================================================
   GREEK INTERIORS — interactions
   Vanilla JS, no dependencies. Every effect degrades gracefully
   and respects prefers-reduced-motion.
   ============================================================= */
(function () {
  'use strict';

  var doc = document;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };

  /* ---------------------------------------------------------
     Photograph fallback — if a stock image fails to load we
     keep the composed material field instead of a broken icon.
     Captured in the capture phase because `error` doesn't bubble.
     --------------------------------------------------------- */
  doc.addEventListener('error', function (e) {
    var el = e.target;
    if (!el || el.tagName !== 'IMG') return;
    var frame = el.closest('.frame');
    if (frame) frame.classList.add('is-fallback');
    else el.style.visibility = 'hidden';
  }, true);

  /* --------------------------- Preloader --------------------------- */
  var preloader = $('#preloader');
  function dismissPreloader() {
    if (!preloader || preloader.classList.contains('is-done')) return;
    preloader.classList.add('is-done');
    doc.body.classList.remove('is-locked');
    window.setTimeout(function () { preloader.remove(); }, 800);
  }
  doc.body.classList.add('is-locked');
  window.addEventListener('load', function () { window.setTimeout(dismissPreloader, reduced ? 0 : 550); });
  window.setTimeout(dismissPreloader, 3200);  // safety net on slow networks

  /* --------------------------- Header --------------------------- */
  var header = $('#siteHeader');
  var progress = $('#scrollProgress');
  var toTop = $('#toTop');
  var lastY = window.scrollY;

  function onScroll() {
    var y = window.scrollY;
    var max = doc.documentElement.scrollHeight - window.innerHeight;

    if (header) {
      header.classList.toggle('is-solid', y > 60);
      var menuOpen = doc.body.classList.contains('menu-open');
      header.classList.toggle('is-hidden', !menuOpen && y > 560 && y > lastY + 4);
    }
    if (progress) progress.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
    if (toTop) toTop.classList.toggle('is-visible', y > window.innerHeight * 0.9);

    lastY = y;
  }
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () { onScroll(); parallax(); ticking = false; });
  }, { passive: true });
  onScroll();

  /* --------------------------- Mobile menu --------------------------- */
  var burger = $('#burger');
  var menu = $('#mobileMenu');

  function setMenu(open) {
    if (!burger || !menu) return;
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    doc.body.classList.toggle('is-locked', open);
    doc.body.classList.toggle('menu-open', open);
    if (open && header) header.classList.remove('is-hidden');
  }
  if (burger) {
    burger.addEventListener('click', function () {
      setMenu(burger.getAttribute('aria-expanded') !== 'true');
    });
  }
  if (menu) {
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
  }
  doc.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setMenu(false);
  });

  /* --------------------------- Reveal on scroll --------------------------- */
  var revealEls = $$('[data-reveal]');
  if ('IntersectionObserver' in window && !reduced) {
    var revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        revealIO.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    revealEls.forEach(function (el) { revealIO.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* --------------------------- Animated counters --------------------------- */
  function runCounter(el) {
    var target = parseInt(el.getAttribute('data-count'), 10) || 0;
    if (reduced) { el.textContent = String(target); return; }
    var duration = 1600;
    var start = null;
    function tick(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(target * eased));
      if (p < 1) window.requestAnimationFrame(tick);
    }
    window.requestAnimationFrame(tick);
  }
  var counters = $$('[data-count]');
  if (counters.length) {
    if ('IntersectionObserver' in window) {
      var countIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          runCounter(entry.target);
          countIO.unobserve(entry.target);
        });
      }, { threshold: 0.6 });
      counters.forEach(function (el) { countIO.observe(el); });
    } else {
      counters.forEach(runCounter);
    }
  }

  /* --------------------------- Subtle parallax --------------------------- */
  var parallaxEls = $$('[data-parallax]');
  function parallax() {
    if (reduced || !parallaxEls.length || window.innerWidth < 861) return;
    var vh = window.innerHeight;
    parallaxEls.forEach(function (el) {
      var rect = el.getBoundingClientRect();
      if (rect.bottom < -200 || rect.top > vh + 200) return;
      var amount = parseFloat(el.getAttribute('data-parallax')) || 0.05;
      var offset = (rect.top + rect.height / 2 - vh / 2) * -amount;
      var img = el.tagName === 'IMG' ? el : el.querySelector('img');
      if (img) img.style.transform = 'scale(1.12) translate3d(0,' + offset.toFixed(2) + 'px,0)';
    });
  }
  parallax();

  /* --------------------------- Scroll spy --------------------------- */
  var navLinks = $$('.nav__link');
  var sections = navLinks
    .map(function (a) { return doc.querySelector(a.getAttribute('href')); })
    .filter(Boolean);

  if (sections.length && 'IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = '#' + entry.target.id;
        navLinks.forEach(function (a) {
          a.classList.toggle('is-active', a.getAttribute('href') === id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* --------------------------- Project filters --------------------------- */
  var filters = $$('.filter');
  var projects = $$('.proj');
  var emptyMsg = $('#workEmpty');

  filters.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var cat = btn.getAttribute('data-filter');
      filters.forEach(function (b) {
        var on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-selected', String(on));
      });
      var shown = 0;
      projects.forEach(function (p) {
        var match = cat === 'all' || p.getAttribute('data-cat') === cat;
        p.classList.toggle('is-hidden', !match);
        if (match) { shown++; p.classList.add('is-in'); }
      });
      if (emptyMsg) emptyMsg.hidden = shown !== 0;
    });
  });

  /* --------------------------- Process timeline fill --------------------------- */
  var timeline = $('#timeline');
  var timelineFill = $('#timelineFill');
  var steps = $$('.step');

  function updateTimeline() {
    if (!timeline || !timelineFill) return;
    var rect = timeline.getBoundingClientRect();
    var anchor = window.innerHeight * 0.62;
    var pct = (anchor - rect.top) / rect.height;
    pct = Math.max(0, Math.min(1, pct));
    timelineFill.style.height = (pct * 100) + '%';

    steps.forEach(function (step) {
      var s = step.getBoundingClientRect();
      step.classList.toggle('is-in', s.top < anchor);
    });
  }
  if (timeline) {
    window.addEventListener('scroll', function () {
      window.requestAnimationFrame(updateTimeline);
    }, { passive: true });
    window.addEventListener('resize', updateTimeline);
    updateTimeline();
  }

  /* --------------------------- Testimonials --------------------------- */
  (function testimonials() {
    var track = $('#quotesTrack');
    if (!track) return;
    var slides = $$('.quote', track);
    var dotsWrap = $('#qDots');
    var prev = $('#qPrev');
    var next = $('#qNext');
    var index = 0;
    var timer = null;

    var dots = slides.map(function (_, i) {
      var d = doc.createElement('button');
      d.className = 'qdot' + (i === 0 ? ' is-active' : '');
      d.setAttribute('role', 'tab');
      d.setAttribute('aria-label', 'Testimonial ' + (i + 1));
      d.setAttribute('aria-selected', String(i === 0));
      d.addEventListener('click', function () { go(i, true); });
      if (dotsWrap) dotsWrap.appendChild(d);
      return d;
    });

    function go(i, stop) {
      index = (i + slides.length) % slides.length;
      slides.forEach(function (s, n) { s.classList.toggle('is-active', n === index); });
      dots.forEach(function (d, n) {
        d.classList.toggle('is-active', n === index);
        d.setAttribute('aria-selected', String(n === index));
      });
      if (stop) pause();
    }
    function play() {
      if (reduced || slides.length < 2) return;
      pause();
      timer = window.setInterval(function () { go(index + 1); }, 7000);
    }
    function pause() { if (timer) { window.clearInterval(timer); timer = null; } }

    if (prev) prev.addEventListener('click', function () { go(index - 1, true); });
    if (next) next.addEventListener('click', function () { go(index + 1, true); });

    var startX = null;
    track.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
    track.addEventListener('touchend', function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 45) go(index + (dx < 0 ? 1 : -1), true);
      startX = null;
    });

    var viewport = $('.quotes__viewport');
    if (viewport) {
      viewport.addEventListener('mouseenter', pause);
      viewport.addEventListener('mouseleave', play);
    }
    play();
  })();

  /* --------------------------- Before / After slider --------------------------- */
  (function beforeAfter() {
    var stage = $('#baStage');
    var clip = $('#baClip');
    var handle = $('#baHandle');
    if (!stage || !clip || !handle) return;

    var dragging = false;

    function setPos(pct) {
      pct = Math.max(0, Math.min(100, pct));
      clip.style.clipPath = 'inset(0 ' + (100 - pct) + '% 0 0)';
      handle.style.left = pct + '%';
      handle.setAttribute('aria-valuenow', String(Math.round(pct)));
    }
    function fromEvent(e) {
      var rect = stage.getBoundingClientRect();
      var x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      setPos((x / rect.width) * 100);
    }

    function start(e) { dragging = true; stage.classList.add('is-dragging'); fromEvent(e); }
    function move(e) {
      if (!dragging) return;
      if (e.cancelable && e.touches) e.preventDefault();
      fromEvent(e);
    }
    function end() { dragging = false; stage.classList.remove('is-dragging'); }

    stage.addEventListener('mousedown', start);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);

    stage.addEventListener('touchstart', start, { passive: true });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end);

    handle.addEventListener('keydown', function (e) {
      var cur = parseFloat(handle.getAttribute('aria-valuenow')) || 50;
      var step = e.shiftKey ? 10 : 4;
      if (e.key === 'ArrowLeft')  { setPos(cur - step); e.preventDefault(); }
      if (e.key === 'ArrowRight') { setPos(cur + step); e.preventDefault(); }
      if (e.key === 'Home')       { setPos(0);  e.preventDefault(); }
      if (e.key === 'End')        { setPos(100); e.preventDefault(); }
    });

    setPos(50);

    // gentle invitation to interact, once, when it first enters view
    if (!reduced && 'IntersectionObserver' in window) {
      var hinted = false;
      var hintIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting || hinted) return;
          hinted = true;
          hintIO.disconnect();
          var t0 = null;
          function hint(ts) {
            if (t0 === null) t0 = ts;
            var p = Math.min((ts - t0) / 1400, 1);
            var eased = Math.sin(p * Math.PI);
            setPos(50 + eased * 14);
            if (p < 1 && !dragging) window.requestAnimationFrame(hint);
          }
          window.setTimeout(function () { window.requestAnimationFrame(hint); }, 450);
        });
      }, { threshold: 0.45 });
      hintIO.observe(stage);
    }
  })();

  /* --------------------------- Enquiry form --------------------------- */
  (function form() {
    var form = $('#enquiryForm');
    if (!form) return;
    var status = $('#formStatus');

    var rules = {
      'f-name':  function (v) { return v.trim().length >= 2 || 'Please enter your name.'; },
      'f-phone': function (v) { return /^[\d\s()+-]{8,18}$/.test(v.trim()) || 'Please enter a valid phone number.'; },
      'f-email': function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'Please enter a valid email address.'; },
      'f-type':  function (v) { return !!v || 'Please choose a project type.'; }
    };

    function validateField(id) {
      var input = doc.getElementById(id);
      if (!input) return true;
      var result = rules[id](input.value);
      var field = input.closest('.field');
      var msg = $('[data-error-for="' + id + '"]', field);
      var ok = result === true;
      field.classList.toggle('has-error', !ok);
      input.setAttribute('aria-invalid', String(!ok));
      if (msg) msg.textContent = ok ? '' : result;
      return ok;
    }

    Object.keys(rules).forEach(function (id) {
      var input = doc.getElementById(id);
      if (!input) return;
      input.addEventListener('blur', function () { validateField(id); });
      input.addEventListener('input', function () {
        if (input.closest('.field').classList.contains('has-error')) validateField(id);
      });
      input.addEventListener('change', function () { validateField(id); });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var valid = Object.keys(rules).map(validateField).every(Boolean);
      if (!valid) {
        if (status) status.textContent = 'Please complete the highlighted fields.';
        var firstBad = $('.field.has-error input, .field.has-error select', form);
        if (firstBad) firstBad.focus();
        return;
      }

      /* -----------------------------------------------------------------
         DEMO ONLY — no backend is wired up.
         Replace the block below with a real endpoint, e.g.:
           fetch('/api/enquiry', { method:'POST', body:new FormData(form) })
         or point the <form> at Formspree / Netlify Forms / your CRM.
         ----------------------------------------------------------------- */
      var btn = $('button[type="submit"]', form);
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
      if (status) status.textContent = '';

      window.setTimeout(function () {
        form.reset();
        if (btn) { btn.disabled = false; btn.textContent = 'Send Enquiry'; }
        if (status) status.textContent = 'Thank you — your enquiry has been received. We will be in touch within one working day.';
      }, 900);
    });
  })();

  /* --------------------------- Misc --------------------------- */
  var year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  // Offset anchor scrolling so the fixed header never covers a heading.
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (!id || id === '#') return;
      var target = doc.querySelector(id);
      if (!target) return;
      e.preventDefault();
      var top = target.getBoundingClientRect().top + window.scrollY -
                (parseFloat(getComputedStyle(doc.documentElement).getPropertyValue('--header-h')) || 80) + 1;
      window.scrollTo({ top: Math.max(top, 0), behavior: reduced ? 'auto' : 'smooth' });
      if (history.replaceState) history.replaceState(null, '', id);
    });
  });

  window.addEventListener('resize', function () {
    if (window.innerWidth > 1080) setMenu(false);
  });
})();
