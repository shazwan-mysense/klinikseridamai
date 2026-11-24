
/* SenseFrame: what Framer's runtime did, without it.

   The page is the template's own markup and stylesheet. This replays the
   behaviour that only existed in Framer's script, using values measured on
   the live template (window.SF_BEHAVE, written into the page at build time):

   1. reveals    elements rendered at their start state come in on load or as
                 they scroll into view
   2. hover      the template's own hover styles are in its stylesheet behind
                 a "hover" class its script used to add; we add it
   3. tickers    strips that scroll by themselves, at the measured speed
   4. video      looping videos play while on screen
   5. type       headings a code component sized in script, per screen size
   6. menu       the phone menu, with the template's own look */
(function () {
  var B = window.SF_BEHAVE || {};
  var band = function () { return innerWidth >= 1200 ? '1440' : innerWidth >= 810 ? '834' : '390'; };
  var each = function (list, fn) { [].forEach.call(list, fn); };

  /* ---- 1. reveals */
  var els = [].filter.call(document.querySelectorAll('[style*="opacity:0"],[style*="opacity: 0"],[data-framer-appear-id]'), function (e) {
    var s = e.getAttribute('style') || '';
    return e.hasAttribute('data-framer-appear-id') || /transform|will-change|filter/.test(s) ||
           (/list-style-type/.test(s) && /^(UL|SECTION)$/.test(e.tagName));          // a ticker or slideshow waiting to be measured
  });
  var show = function (e, delay) {
    if (e.classList.contains('sf-in')) return;
    e.style.transitionDelay = (delay || 0) + 'ms';
    e.classList.add('sf-in');
  };
  each(els, function (e) { e.setAttribute('data-sf-reveal', ''); });
  // "appear" effects play when the page opens, wherever the element is
  var n = 0;
  each(els, function (e) { if (e.hasAttribute('data-framer-appear-id') || getComputedStyle(e).position === 'fixed') setTimeout(function () { show(e, 0); }, 80 + Math.min(n++, 10) * 60); });
  var inView = function (e) {
    // judged by the parent's box: the element itself may be slid off screen as its start state
    // ...and by the first ancestor that has a box at all (wrappers set to
    // display:contents have none, and most of a Framer page sits inside one)
    var p = e.parentElement, r = p && p.getBoundingClientRect();
    while (p && p !== document.body && !(r.width || r.height)) { p = p.parentElement; r = p && p.getBoundingClientRect(); }
    return !!r && r.bottom > 0 && r.top < innerHeight * 0.96 && r.width > 0;
  };
  var sweep = function () {
    each(els, function (e) {
      if (e.classList.contains('sf-in') || !inView(e)) return;
      show(e, Math.min(8, [].indexOf.call(e.parentNode.children, e)) * 70);
    });
  };
  var tick = 0;
  addEventListener('scroll', function () { if (!tick) tick = setTimeout(function () { tick = 0; sweep(); }, 60); }, { passive: true });
  addEventListener('resize', sweep);
  setTimeout(sweep, 120); addEventListener('load', sweep);

  /* ---- 2. hover */
  var css = [].map.call(document.querySelectorAll('style'), function (x) { return x.textContent; }).join('\n');
  var marks = {}, m, re = /\.(framer-[A-Za-z0-9]+)(\.framer-v-[a-z0-9]+)?\.hover\b/g;
  while ((m = re.exec(css))) marks['.' + m[1] + (m[2] || '')] = 1;
  Object.keys(marks).forEach(function (sel) {
    each(document.querySelectorAll(sel), function (e) {
      if (e.hasAttribute('data-sf-hover')) return;
      e.setAttribute('data-sf-hover', '');
      e.addEventListener('mouseenter', function () { e.classList.add('hover'); });
      e.addEventListener('mouseleave', function () { e.classList.remove('hover'); });
    });
  });

  /* ---- 2b. hover looks a template sets from script, measured on the live one:
          which layer inside the thing pointed at, and what it changed to */
  var layers = function (e) {                       // every layer inside; a line of text counts once, whatever is in it
    var out = [e];
    each(e.querySelectorAll('*'), function (n) { if (!n.parentElement.closest('p,h1,h2,h3,h4,h5,h6')) out.push(n); });
    return out.slice(0, 160);
  };
  var put = function (n, p, v) { if (p.charAt(0) === '-') { if (v) n.style.setProperty(p, v); else n.style.removeProperty(p); } else n.style[p] = v; };
  var walk = function (e, path) { for (var k = 0; e && k < path.length; k++) e = e.children[path[k]]; return e; };
  if (matchMedia('(hover: hover)').matches) each(B.hover || [], function (h) {
    each(document.querySelectorAll('.' + h.c), function (r) {
      var e = walk(r, h.path);
      if (!e || e.hasAttribute('data-sf-hov')) return;
      var list = layers(e);
      if (list.length !== h.count) return;           // not the same build of this part: leave it be
      e.setAttribute('data-sf-hov', ''); e.setAttribute('data-sf-hover', '');
      var was = null;
      e.addEventListener('mouseenter', function () {
        if (was) return;
        was = h.set.map(function (s) {
          var n = list[s[0]], keep = {}, p;
          if (!n) return keep;
          if (n.classList.contains('sf-in')) {       // its entrance is over; free it from the reveal rules
            n.removeAttribute('data-sf-reveal'); n.classList.remove('sf-in');
            n.style.opacity = '1'; n.style.transform = 'none'; n.style.filter = 'none';
          }
          var want = {}; for (p in s[1]) want[p] = s[1][p];
          if (want.color) { want['--framer-text-color'] = want.color; want['--framer-link-text-color'] = want.color; }
          for (p in want) { keep[p] = p.charAt(0) === '-' ? n.style.getPropertyValue(p) : n.style[p]; put(n, p, want[p]); }
          return keep;
        });
      });
      e.addEventListener('mouseleave', function () {
        if (!was) return;
        h.set.forEach(function (s, k) { var n = list[s[0]]; if (n) for (var p in was[k]) put(n, p, was[k][p]); });
        was = null;
      });
    });
  });

  /* ---- 2c. things that are not links but took you to a page when clicked */
  each(B.go || [], function (g) {
    var r = [].filter.call(document.querySelectorAll('.' + g.c), function (x) { return x.getBoundingClientRect().width > 0; })[g.i];
    var e = r && walk(r, g.path);
    if (!e) return;
    if (!g.to) { e.setAttribute('data-sf-hide', ''); return; }
    e.setAttribute('data-sf-go', ''); e.setAttribute('role', 'link'); e.tabIndex = 0;
    e.addEventListener('click', function (ev) { if (!ev.target.closest('a[href]')) location.href = g.to; });
    e.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') location.href = g.to; });
  });

  /* ---- 3. tickers */
  var running = [];
  var tickers = function () {
    running.forEach(function (a) { a.cancel(); }); running = [];
    ((B.tickers || {})[band()] || []).forEach(function (t) {
      each(document.querySelectorAll('.' + t.c), function (box) {
        var ul = box.querySelector('ul');
        if (!ul || ul.children.length < 1 || !box.offsetWidth) return;
        var kids = [].slice.call(ul.children), p = kids.length;
        // the page may already hold repeats of the same set: find the set
        for (var k = 1; k <= kids.length / 2; k++) {
          if (kids.length % k) continue;
          var same = true;
          for (var i = k; i < kids.length && same; i++) same = kids[i].innerHTML === kids[i - k].innerHTML;
          if (same) { p = k; break; }
        }
        var set = kids.slice(0, p), vert = !!t.vy && !t.vx;
        var need = (vert ? box.offsetHeight : box.offsetWidth) * 2, guard = 0;
        while ((vert ? ul.scrollHeight : ul.scrollWidth) < need + 200 && guard++ < 10 || ul.children.length < p * 2) {
          set.forEach(function (c) { var d = c.cloneNode(true); d.setAttribute('aria-hidden', 'true'); ul.appendChild(d); });
          if (guard > 10) break;
        }
        var all = ul.children, len = vert ? all[p].offsetTop - all[0].offsetTop : all[p].offsetLeft - all[0].offsetLeft;
        var v = vert ? t.vy : t.vx;
        if (!len || !v) return;
        // out of the reveal rules: their !important transform would pin the strip still
        ul.removeAttribute('data-sf-reveal'); ul.classList.remove('sf-in');
        ul.style.opacity = '1'; ul.style.willChange = 'transform';
        var ax = vert ? 'translateY' : 'translateX', from = v < 0 ? 0 : -len, to = v < 0 ? -len : 0;
        running.push(ul.animate([{ transform: ax + '(' + from + 'px)' }, { transform: ax + '(' + to + 'px)' }],
                                { duration: Math.abs(len / v) * 1000, iterations: Infinity, easing: 'linear' }));
      });
    });
  };

  /* ---- 3a. changes asked for in review, each on one section of the page */
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var countUp = function (sec) {
    var NUM = /\d[\d,]*(?:\.\d+)?/g;
    each(sec.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,div'), function (e) {
      var t = e.textContent.trim();
      if (e.children.length || !/\d/.test(t) || t.length > 12 || parseFloat(getComputedStyle(e).fontSize) < 28) return;
      var full = e.textContent, t0 = 0;
      var draw = function (k) {
        e.textContent = full.replace(NUM, function (m) {
          var dec = (m.split('.')[1] || '').length, s = (parseFloat(m.replace(/,/g, '')) * k).toFixed(dec);
          while (/^0\d/.test(m) && s.split('.')[0].length < m.split('.')[0].length) s = '0' + s;
          return m.indexOf(',') > -1 ? s.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : s;
        });
      };
      if (calm || !window.IntersectionObserver) return;
      e.classList.add('sf-count'); draw(0);
      var step = function (now) { t0 = t0 || now; var k = Math.min(1, (now - t0) / 1500); draw(1 - Math.pow(1 - k, 3)); if (k < 1) requestAnimationFrame(step); else e.textContent = full; };
      var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { io.disconnect(); requestAnimationFrame(step); } }, { threshold: 0.4 });
      io.observe(e);
    });
  };
  var slider = function (sec, dir) {
    // the row of cards: the box whose children are all alike and side by side (or stacked, on a phone).
    // A card often sits in a wrapper with no box of its own; the card is measured, the wrapper is moved.
    var boxed = function (k) { var r = k.getBoundingClientRect(); if (r.width > 0 && r.height > 0) return k;
      return k.firstElementChild && getComputedStyle(k).display === 'contents' ? boxed(k.firstElementChild) : null; };
    var best = null, top = 0;
    each(sec.querySelectorAll('*'), function (box) {
      if (!box.getBoundingClientRect().width || box.closest('.sf-slider') || box.tagName === 'UL' && /list-style-type/.test(box.getAttribute('style') || '')) return;
      var kids = [].map.call(box.children, function (k) { return { wrap: k, el: boxed(k) }; }).filter(function (x) { return x.el; });
      if (kids.length < 3 || kids.length > 16) return;
      var w = kids[0].el.getBoundingClientRect().width;
      var alike = kids.every(function (x) { var r = x.el.getBoundingClientRect(); return r.width >= 120 && r.height >= 90 && Math.abs(r.width - w) < w * 0.3 && x.el.tagName === kids[0].el.tagName; });
      var area = kids.length * w * kids[0].el.getBoundingClientRect().height;
      if (alike && area > top) { top = area; best = { box: box, kids: kids }; }
    });
    if (!best) return;
    var box = best.box, kids = best.kids, cs = getComputedStyle(box);
    var gap = kids[1].el.getBoundingClientRect().left - kids[0].el.getBoundingClientRect().right;
    if (!(gap > 0 && gap < 200)) gap = parseFloat(cs.columnGap) || parseFloat(cs.rowGap) || 20;
    var sizes = kids.map(function (x) { return x.el.getBoundingClientRect().width; }), wide = box.getBoundingClientRect().width;
    var track = document.createElement('div'); track.className = 'sf-slide-track'; track.style.gap = gap + 'px';
    kids.forEach(function (x, n) { x.el.style.width = sizes[n] + 'px'; x.el.style.maxWidth = 'none'; x.el.style.flex = 'none'; track.appendChild(x.wrap); });
    box.appendChild(track); box.classList.add('sf-slider');
    var len = sizes.reduce(function (a, b) { return a + b + gap; }, 0), guard = 0;
    while (track.scrollWidth < wide + len + 40 && guard++ < 6) kids.forEach(function (x) { var d = x.wrap.cloneNode(true); d.setAttribute('aria-hidden', 'true'); track.appendChild(d); });
    each(track.querySelectorAll('[data-sf-reveal]'), function (x) { x.style.transitionDelay = '0ms'; x.classList.add('sf-in'); });
    if (calm) { box.style.overflowX = 'auto'; return; }
    var a = track.animate(dir === 'right' ? [{ transform: 'translateX(' + -len + 'px)' }, { transform: 'translateX(0)' }]
                                          : [{ transform: 'translateX(0)' }, { transform: 'translateX(' + -len + 'px)' }],
                          { duration: len / 55 * 1000, iterations: Infinity, easing: 'linear' });
    track.addEventListener('mouseenter', function () { a.pause(); });
    track.addEventListener('mouseleave', function () { a.play(); });
  };
  var fxRoot = document.querySelector('[data-framer-root]') || document.querySelector('#main > div') || document.body;
  each(B.fx || [], function (f) {
    var sec = fxRoot.children[f.ci];
    if (!sec) return;
    if (f.kind === 'hide') sec.setAttribute('data-sf-hide', '');
    if (f.kind === 'count') countUp(sec);
    if (f.kind === 'slider') {
      var go = function () { setTimeout(function () { slider(sec, f.dir); }, 400); };
      if (document.readyState === 'complete') go(); else addEventListener('load', go);
    }
  });

  /* ---- 3b. loops: motion recorded on the live template and played back */
  var looping = [];
  var loops = function () {
    looping.forEach(function (a) { a.cancel(); }); looping = [];
    ((B.loops || {})[band()] || []).forEach(function (l) {
      var e = [].filter.call(document.querySelectorAll('.' + l.c), function (x) { return x.getBoundingClientRect().width > 0; })[l.i];
      if (!e || !l.f || l.f.length < 2) return;
      e.removeAttribute('data-sf-reveal'); e.classList.remove('sf-in');
      looping.push(e.animate(l.f.map(function (f) { return { opacity: f[0], transform: f[1] }; }), { duration: l.d, iterations: Infinity, easing: 'linear' }));
    });
  };

  /* ---- 3c. parts that open: accordion rows, recorded open on the live template */
  // the page holds a copy of each part for every screen size; only the one on show counts
  var shown = function (c) { return [].filter.call(document.querySelectorAll('.' + c), function (x) { return x.getBoundingClientRect().width > 0; }); };
  var parts = (B.states || {})[band()] || [];
  var homes = {};                                   // each part's markup as the page first had it
  var mark = function (root, gid, state) {
    root.setAttribute('data-sf-root', gid); root.setAttribute('data-sf-state', state);
    parts.forEach(function (p, k) {
      if (p.root[0] + ':' + p.root[1] !== gid) return;
      var t = root.querySelectorAll('.' + p.trig[0])[p.trig[1]] || (root.classList.contains(p.trig[0]) ? root : null);
      if (t) t.setAttribute('data-sf-trig', k);
    });
  };
  parts.forEach(function (p) {
    var gid = p.root[0] + ':' + p.root[1], root = shown(p.root[0])[p.root[1]];
    if (!root || homes[gid]) return;
    homes[gid] = root.outerHTML;
    mark(root, gid, '');
  });
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest && ev.target.closest('[data-sf-trig]');
    var root = t && t.closest('[data-sf-root]');
    if (!root || ev.target.closest('a[href]:not([href="#"])')) return;
    var k = t.getAttribute('data-sf-trig'), gid = root.getAttribute('data-sf-root'), back = root.getAttribute('data-sf-state') === k;
    var h0 = root.getBoundingClientRect().height;
    root.insertAdjacentHTML('afterend', back ? homes[gid] : parts[+k].other);
    var nu = root.nextElementSibling; root.remove();
    mark(nu, gid, back ? '' : k);
    each(nu.querySelectorAll('[style*="opacity:0"],[style*="opacity: 0"]'), function (x) { x.style.opacity = 1; x.style.transform = 'none'; });
    var h1 = nu.getBoundingClientRect().height;
    if (nu.animate && Math.abs(h1 - h0) > 4) nu.animate([{ height: h0 + 'px', overflow: 'hidden' }, { height: h1 + 'px', overflow: 'hidden' }],
                                                        { duration: 320, easing: 'cubic-bezier(.44,0,.56,1)' });
  });

  /* ---- 3e. script-drawn components: the template's own drawing for this screen size */
  var drawn = {};
  var snaps = function () {
    Object.keys(drawn).forEach(function (k) { var d = drawn[k]; if (d.el.isConnected) d.el.innerHTML = d.home; });
    drawn = {};
    ((B.snaps || {})[band()] || []).forEach(function (s, n) {
      var e = shown(s.c)[s.i];
      if (!e) return;
      drawn[n] = { el: e, home: e.innerHTML };
      e.innerHTML = s.html;
      each(e.querySelectorAll('[style*="opacity: 0"],[style*="opacity:0"]'), function (x) { x.style.opacity = 1; x.style.transform = 'none'; x.style.filter = 'none'; });
    });
  };

  /* ---- 3d. slideshows: the hidden row is shown and made to slide; arrows and dots are the template's own */
  var slideshows = function () {
    var known = (B.slides || {})[band()] || [];
    each(document.querySelectorAll('section[style*="list-style-type"]'), function (sec) {
      var ul = sec.querySelector('ul'), track = ul && ul.parentElement;
      if (!ul || sec.hasAttribute('data-sf-slides') || !ul.querySelector('[style*="visibility:hidden"],[style*="visibility: hidden"]')) return;
      sec.setAttribute('data-sf-slides', '');
      sec.removeAttribute('data-sf-reveal'); sec.style.opacity = 1;
      each(ul.querySelectorAll('[style*="visibility:hidden"],[style*="visibility: hidden"]'), function (x) { x.style.visibility = 'visible'; });
      track.classList.add('sf-track');
      var items = function () { return [].filter.call(ul.querySelectorAll('li > *'), function (x) { return x.offsetWidth > 0; }); };
      var stepBy = function () { var it = items(); return it.length > 1 ? it[1].offsetLeft - it[0].offsetLeft : track.clientWidth; };
      var box = sec.closest('[class*="-container"]');
      var rec = null;
      known.forEach(function (k) { if (box && box.classList.contains(k.c) && shown(k.c)[k.i] === box) rec = k; });
      if (!rec || sec.querySelector('fieldset')) return;
      sec.insertAdjacentHTML('beforeend', rec.controls);
      var fs = sec.querySelector('fieldset');
      fs.addEventListener('click', function (ev) {
        var b = ev.target.closest('button'); if (!b) return;
        var label = b.getAttribute('aria-label') || '', page = label.match(/page (\d+)/);
        if (/prev/i.test(label)) track.scrollBy({ left: -stepBy(), behavior: 'smooth' });
        else if (/next/i.test(label)) track.scrollBy({ left: stepBy(), behavior: 'smooth' });
        else if (page) track.scrollTo({ left: (+page[1] - 1) * track.clientWidth, behavior: 'smooth' });
      });
    });
  };

  /* ---- 4. video */
  var vids = [].filter.call(document.querySelectorAll('video[loop]'), function (v) { return v.getAttribute('src') || v.querySelector('source'); });
  if (vids.length && 'IntersectionObserver' in window) {
    var vio = new IntersectionObserver(function (es) {
      es.forEach(function (x) {
        var v = x.target;
        if (x.isIntersecting) { v.muted = true; v.playsInline = true; var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
        else v.pause();
      });
    }, { threshold: 0.05 });
    vids.forEach(function (v) { v.muted = true; v.setAttribute('playsinline', ''); vio.observe(v); });
  }

  /* ---- 5. type set in script */
  var type = function () {
    var sizes = (B.type || {})[band()], hs = document.querySelectorAll('h1:not(.framer-text),h2:not(.framer-text),h3:not(.framer-text)');
    hs = [].filter.call(hs, function (e) { return /font-size/.test(e.getAttribute('style') || ''); });
    if (!sizes || sizes.length !== hs.length) return;
    hs.forEach(function (e, i) { e.style.fontSize = sizes[i] + 'px'; });
  };

  var lastBand = null;
  var onBand = function () { if (band() === lastBand) return; lastBand = band(); snaps(); tickers(); loops(); type(); slideshows(); };
  addEventListener('resize', onBand);
  if (document.readyState === 'complete') onBand(); else addEventListener('load', onBand);

  /* ---- 6. the phone menu */
  var M = B.menu || {};
  var links = [], seen = {};
  var take = function (a) {
    var t = (a.textContent || '').replace(/\s+/g, ' ').trim(), h = a.getAttribute('href');
    if (!t || t.length > 28 || seen[t] || a.hasAttribute('data-sf-hide')) return;
    if (!(M.links && M.links.length) && /^(https?:|mailto:|tel:)/.test(h) && !/wa\.me/.test(h)) return;
    seen[t] = 1; links.push([t, h]);
  };
  // the template's menu links are its nav's links: every copy of the nav holds the same ones
  if (M.links && M.links.length) {
    var byText = {};
    each(document.querySelectorAll('a[href]'), function (a) { var t = (a.textContent || '').replace(/\s+/g, ' ').trim(); if (t && !byText[t] && !a.hasAttribute('data-sf-hide')) byText[t] = a; });
    M.links.forEach(function (t) { if (byText[t]) take(byText[t]); });
  }
  if (links.length < 2) each(document.querySelectorAll('nav a[href], header a[href], [data-framer-name*="Nav" i] a[href]'), take);
  if (links.length < 2) each(document.querySelectorAll('a[href]'), function (a) { if (a.getBoundingClientRect().top + scrollY < 1400 || links.length < 3) take(a); });
  var menu = document.createElement('div');
  menu.className = 'sf-menu';
  var bs = getComputedStyle(document.body);
  menu.style.setProperty('--sf-page', M.bg || (bs.backgroundColor === 'rgba(0, 0, 0, 0)' ? '#fff' : bs.backgroundColor));
  menu.style.setProperty('--sf-ink', M.colour || bs.color);
  if (M.size) menu.style.setProperty('--sf-size', M.size + 'px');
  if (M.family) menu.style.setProperty('--sf-font', '"' + M.family + '"');
  if (M.weight) menu.style.setProperty('--sf-weight', M.weight);
  if (M.gap && M.size) menu.style.setProperty('--sf-gap', Math.max(0, M.gap - M.size * 1.25) + 'px');
  if (M.align) menu.style.setProperty('--sf-align', /center/.test(M.align) ? 'center' : /right|end/.test(M.align) ? 'flex-end' : 'flex-start');
  menu.innerHTML = '<button aria-label="Close">&times;</button>' + links.slice(0, 12).map(function (l) {
    return '<a href="' + l[1] + '">' + l[0] + '</a>'; }).join('');
  document.body.appendChild(menu);
  menu.addEventListener('click', function () { menu.classList.remove('open'); });
  document.addEventListener('click', function (e) {
    if (innerWidth >= 1000) return;
    var hit = M.trigger && e.target.closest('.' + M.trigger), r = hit && hit.getBoundingClientRect();
    if (hit && r.top < 160 && r.width < 160) { e.preventDefault(); menu.classList.add('open'); return; }
    // a control in the header that simply says "Menu"
    var said = e.target.closest('a, button, div, p, span');
    for (var up = 0; said && up < 3; up++, said = said.parentElement) {
      if (/^menu$/i.test((said.textContent || '').trim()) && said.getBoundingClientRect().top < 160) { e.preventDefault(); menu.classList.add('open'); return; }
    }
    var b = e.target.closest('[data-framer-name]');
    while (b) {
      r = b.getBoundingClientRect();
      if (/menu|burger|hamburger|toggle/i.test(b.getAttribute('data-framer-name')) && r.width < 110 && r.top < 140) {
        e.preventDefault(); menu.classList.add('open'); return;
      }
      b = b.parentElement && b.parentElement.closest('[data-framer-name]');
    }
  });
})();
