/* FREE2FLY — main interactions */
(() => {
  'use strict';
  const D = window.F2F;
  if (!D) return;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const mq = q => window.matchMedia(q);
  const RM = mq('(prefers-reduced-motion: reduce)').matches;
  const FINE = mq('(hover: hover) and (pointer: fine)').matches;
  const SMOOTH = FINE && !RM;
  const isDesk = () => mq('(min-width: 900px)').matches;
  const pad2 = n => String(n).padStart(2, '0');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const body = document.body;
  const lerpK = (b, dt) => 1 - Math.pow(1 - b, dt * 60);
  const bez = (x1, y1, x2, y2) => {
    const f = (t, a, b) => ((1 - 3 * b + 3 * a) * t + (3 * b - 6 * a)) * t * t + 3 * a * t;
    return x => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let lo = 0, hi = 1, t = x;
      for (let i = 0; i < 24; i++) { const v = f(t, x1, x2); if (Math.abs(v - x) < 1e-5) break; if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; }
      return f(t, y1, y2);
    };
  };
  const easeIO = bez(.76, 0, .24, 1), easeOut = bez(.19, 1, .22, 1);
  const inView = r => r.width > 0 && r.bottom > 0 && r.top < window.innerHeight;

  const byId = Object.fromEntries(D.works.map(w => [w.id, w]));
  const catName = Object.fromEntries(D.cats.map(c => [c.key, c.name]));
  const vertical = new Set(D.featured.filter(f => f.vertical).map(f => f.id));
  const playVideo = v => { if (!v || RM) return; const p = v.play(); if (p && p.catch) p.catch(() => {}); };
  const loadVideo = v => { if (v && !v.src && v.dataset.src) { v.src = v.dataset.src; } };

  let sY = window.scrollY, tY = sY, maxY = 0, sOn = false, sAnim = null, lastSet = -1;
  let fmTop = 0, fmH = 0;
  function measure() {
    maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    tY = clamp(tY, 0, maxY);
    if (footMark) { const r = footMark.getBoundingClientRect(); fmTop = r.top + window.scrollY; fmH = r.height; }
  }
  function innerScroll(el, dy) {
    for (; el && el !== body && el !== document.documentElement; el = el.parentElement) {
      if (el.scrollHeight > el.clientHeight + 1) {
        const oy = getComputedStyle(el).overflowY;
        if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && (dy > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0)) return true;
      }
    }
    return false;
  }
  function setScroll(y) { lastSet = y; window.scrollTo(0, y); }
  function scrollToY(y) {
    if (!SMOOTH) { window.scrollTo({ top: Math.max(0, y), behavior: RM ? 'auto' : 'smooth' }); return; }
    measure();
    y = clamp(y, 0, maxY);
    const from = window.scrollY, dist = Math.abs(y - from);
    if (dist < 1) return;
    sOn = false; sY = from; tY = y; lastSet = from;
    sAnim = { from, to: y, t0: performance.now(), dur: clamp(900 + dist * 0.12, 900, 1600) };
  }
  const scrollToEl = (el, off = 72) => { if (el) scrollToY(el.getBoundingClientRect().top + window.scrollY - off); };
  if (SMOOTH) {
    window.addEventListener('wheel', e => {
      if (e.ctrlKey || e.defaultPrevented) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (body.classList.contains('lb-open') || body.classList.contains('menu-open') || body.classList.contains('is-loading')) return;
      let d = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1);
      if (innerScroll(e.target, d)) return;
      e.preventDefault();
      d = clamp(d, -240, 240);
      if (sAnim) { sAnim = null; sY = window.scrollY; tY = sY; }
      if (!sOn) { sY = window.scrollY; tY = sY; lastSet = sY; }
      tY = clamp(tY + d, 0, maxY);
      sOn = true;
    }, { passive: false });
    window.addEventListener('scroll', () => {
      if ((sOn || sAnim) && Math.abs(window.scrollY - lastSet) > 2) { sOn = false; sAnim = null; }
      if (!sOn && !sAnim) { sY = tY = window.scrollY; }
    }, { passive: true });
    document.addEventListener('click', e => {
      if (e.defaultPrevented || e.detail === 0) return;
      const a = e.target.closest('a[href^="#"]');
      if (!a || a.hasAttribute('data-filter')) return;
      const id = a.getAttribute('href').slice(1);
      const t = id && id !== 'top' ? document.getElementById(id) : null;
      if (id && id !== 'top' && !t) return;
      e.preventDefault();
      if (t) scrollToEl(t); else scrollToY(0);
    });
  }
  function scrollStep(now, dt) {
    if (sAnim) {
      const p = clamp((now - sAnim.t0) / sAnim.dur, 0, 1);
      sY = sAnim.from + (sAnim.to - sAnim.from) * easeIO(p);
      tY = sY;
      if (p >= 1) sAnim = null;
      setScroll(sY);
    } else if (sOn) {
      sY += (tY - sY) * lerpK(0.1, dt);
      if (Math.abs(tY - sY) < 0.5) { sY = tY; sOn = false; }
      setScroll(sY);
    }
  }

  /* ---------------- lightbox ---------------- */
  const lb = $('#lb'), lbFrame = $('#lbFrame'), lbClose = $('#lbClose');
  let lastFocus = null, lbSrc = null, lbTimer = 0, lbClosing = false, lbHist = false, lbBack = false;
  function srcMedia(src) {
    if (!src || RM) return null;
    if (src === reelV) return { el: reelV, video: true };
    let img = src.tagName === 'IMG' ? src : $('img', src);
    if (!img) { const box = src.closest('.dbody'); if (box) img = $('.stills img', box); }
    return img ? { el: img.parentElement, img } : null;
  }
  function flipTo(S, F) {
    const s = Math.max(S.width / F.width, S.height / F.height);
    const ix = Math.max(0, (F.width - S.width / s) / 2), iy = Math.max(0, (F.height - S.height / s) / 2);
    return {
      t: 'translate3d(' + (S.left - F.left - s * ix).toFixed(2) + 'px,' + (S.top - F.top - s * iy).toFixed(2) + 'px,0) scale(' + s.toFixed(4) + ')',
      c: 'inset(' + iy.toFixed(2) + 'px ' + ix.toFixed(2) + 'px ' + iy.toFixed(2) + 'px ' + ix.toFixed(2) + 'px)'
    };
  }
  function openLB(id, src) {
    const w = byId[id];
    if (!w || !lb.hidden) return;
    lastFocus = document.activeElement;
    lb.classList.toggle('is-vert', vertical.has(id));
    const frame = '<iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) +
      '?autoplay=1&rel=0&playsinline=1" title="' + esc(w.title) + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen"></iframe>';
    $('#lbTitle').textContent = w.title;
    $('#lbSub').textContent = [w.client, catName[w.cat], w.region].filter(Boolean).join(' · ');
    const m = srcMedia(src);
    lbSrc = m;
    lbFrame.innerHTML = '';
    lb.classList.remove('is-on', 'is-ready');
    lb.hidden = false;
    body.classList.add('lb-open');
    reelV.pause();
    fpHide();
    lbClose.focus({ preventScroll: true });
    lbBack = false;
    try { history.pushState({ f2fLb: 1 }, ''); lbHist = true; } catch (_) { lbHist = false; }
    if (!m) { lbFrame.innerHTML = frame; lbFrame.getBoundingClientRect(); lb.classList.add('is-on', 'is-ready'); return; }
    const fly = document.createElement('div');
    fly.className = 'lb__fly';
    let pic = null;
    if (m.video) {
      try {
        const vw = reelV.videoWidth, vh = reelV.videoHeight;
        if (vw) { pic = document.createElement('canvas'); pic.width = Math.min(1280, vw); pic.height = Math.round(pic.width * vh / vw); pic.getContext('2d').drawImage(reelV, 0, 0, pic.width, pic.height); }
      } catch (_) { pic = null; }
      if (!pic) { pic = new Image(); pic.src = 'media/prev/' + id + '.jpg'; }
    } else { pic = new Image(); pic.src = m.img.currentSrc || m.img.src; }
    if (pic.tagName === 'IMG') pic.alt = '';
    pic.className = 'lb__pic';
    fly.appendChild(pic);
    lbFrame.appendChild(fly);
    lbFrame.insertAdjacentHTML('beforeend', frame);
    const ifr = $('iframe', lbFrame);
    let loaded = false, arrived = false;
    const ready = () => { if (loaded && arrived && !lbClosing && !lb.hidden) lb.classList.add('is-ready'); };
    ifr.addEventListener('load', () => { loaded = true; ready(); });
    const f = flipTo(m.el.getBoundingClientRect(), lbFrame.getBoundingClientRect());
    fly.animate([{ transform: f.t, clipPath: f.c }, { transform: 'none', clipPath: 'inset(0px 0px 0px 0px)' }], { duration: 800, easing: 'cubic-bezier(.76,0,.24,1)', fill: 'forwards' });
    lb.classList.add('is-on');
    clearTimeout(lbTimer);
    lbTimer = setTimeout(() => { arrived = true; ready(); lbTimer = setTimeout(() => { loaded = true; ready(); }, 1800); }, 830);
  }
  function closeLB() {
    if (lb.hidden || lbClosing) return;
    const fly = $('.lb__fly', lbFrame), ifr = $('iframe', lbFrame);
    clearTimeout(lbTimer);
    const done = () => {
      lbClosing = false;
      lb.hidden = true;
      lb.classList.remove('is-on', 'is-ready');
      lbFrame.innerHTML = '';
      body.classList.remove('lb-open');
      if (reelVisible) playVideo(reelV);
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    };
    if (!fly) { done(); return; }
    if (ifr) ifr.remove();
    lbClosing = true;
    lb.classList.remove('is-ready', 'is-on');
    const F = lbFrame.getBoundingClientRect();
    const S = lbSrc && lbSrc.el.isConnected ? lbSrc.el.getBoundingClientRect() : null;
    const cs = getComputedStyle(fly), from = { transform: cs.transform, clipPath: cs.clipPath === 'none' ? 'inset(0px 0px 0px 0px)' : cs.clipPath };
    fly.getAnimations().forEach(a => a.cancel());
    let to;
    if (S && inView(S)) { const f = flipTo(S, F); to = { transform: f.t, clipPath: f.c }; }
    else to = { transform: 'translate3d(0,' + Math.round(window.innerHeight * 0.4) + 'px,0)', clipPath: 'inset(100% 0px 0px 0px)' };
    fly.animate([from, to], { duration: 800, easing: 'cubic-bezier(.76,0,.24,1)', fill: 'forwards' });
    lbTimer = setTimeout(done, 820);
  }
  function askCloseLB() {
    if (lb.hidden || lbClosing) return;
    if (!lbHist) { closeLB(); return; }
    if (lbBack) return;
    lbBack = true;
    history.back();
    setTimeout(() => { if (lbBack && lbHist) { lbHist = false; lbBack = false; closeLB(); } }, 500);
  }
  window.addEventListener('popstate', () => { if (lbHist) { lbHist = false; lbBack = false; closeLB(); } });
  lbClose.addEventListener('click', askCloseLB);
  lb.addEventListener('click', e => { if (e.target.hasAttribute('data-close')) askCloseLB(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { askCloseLB(); setMenu(false); }
    if (e.key === 'Tab' && !lb.hidden) { e.preventDefault(); lbClose.focus(); }
  });
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-play]');
    if (t) { e.preventDefault(); openLB(t.getAttribute('data-play'), t); }
  });

  /* ---------------- loader + showreel ---------------- */
  const reel = $('#reel'), reelV = $('#reelVideo');
  const num = $('#loaderNum'), line = $('#loaderLine'), loader = $('#loader');
  const footMark = $('#footMark');
  const portrait = window.innerWidth / window.innerHeight < 0.9;
  const base = portrait ? 'media/reel/reel-m' : 'media/reel/reel';
  reelV.poster = base + '.jpg';
  reelV.src = base + '.mp4';
  reelV.muted = true;
  let ready = false;
  const markReady = () => { ready = true; };
  reelV.addEventListener('canplaythrough', markReady, { once: true });
  reelV.addEventListener('error', markReady, { once: true });
  setTimeout(markReady, 5000);
  if (RM) reelV.removeAttribute('autoplay'), reelV.pause();

  const t0 = performance.now();
  const MIN = RM ? 250 : 1900;
  let shown = 0, finished = false;
  function loaderTick(now, dt) {
    const el = now - t0;
    let buf = 0;
    try { if (reelV.duration && reelV.buffered.length) buf = reelV.buffered.end(reelV.buffered.length - 1) / reelV.duration; } catch (_) {}
    const timeP = clamp(el / MIN, 0, 1);
    const target = ready ? timeP * 100 : Math.min(timeP * 100, 40 + buf * 52, 92);
    shown += (target - shown) * (RM ? 1 : lerpK(0.14, dt));
    if (ready && timeP >= 1 && target - shown < 0.6) shown = 100;
    num.textContent = String(Math.floor(shown)).padStart(3, '0');
    line.style.transform = 'scaleX(' + (shown / 100) + ')';
    if (shown >= 100) finishLoader();
  }
  function finishLoader() {
    if (finished) return;
    finished = true;
    try { reelV.currentTime = 0; } catch (_) {}
    playVideo(reelV);
    fitAll();
    body.classList.add('loaded');
    body.classList.remove('is-loading');
    setTimeout(() => { loader.style.display = 'none'; }, 1300);
    measure();
    sY = tY = window.scrollY;
  }

  // segments + caption sync
  const segs = D.reel.map(s => Object.assign({ w: byId[s.id] }, s));
  const idxEl = $('#reelIdx'), titleEl = $('#reelTitle'), subEl = $('#reelSub');
  const barsEl = $('#reelBars');
  $('#reelTotal').textContent = pad2(segs.length);
  barsEl.innerHTML = segs.map(() => '<i><b></b></i>').join('');
  const bars = $$('b', barsEl);
  const ringC = $('#cursorRing'), ringM = $('#playRingM');
  const RC = 301.59, RM_C = 295.31;
  let cur = -1;
  const segAt = t => { for (let i = segs.length - 1; i >= 0; i--) if (t >= segs[i].t0 - 0.03) return i; return 0; };
  function swapText(el, text) {
    $$('span', el).forEach(s => { s.classList.remove('swap'); s.classList.add('out'); setTimeout(() => s.remove(), 900); });
    el.insertAdjacentHTML('beforeend', '<span class="swap">' + esc(text) + '</span>');
  }
  function setSeg(i) {
    if (i === cur) return;
    const first = cur === -1;
    cur = i;
    const w = segs[i].w;
    idxEl.textContent = pad2(i + 1);
    if (first) { titleEl.innerHTML = '<span>' + esc(w.title) + '</span>'; subEl.innerHTML = '<span>' + esc(w.client + ' · ' + catName[w.cat]) + '</span>'; }
    else { swapText(titleEl, w.title); swapText(subEl, w.client + ' · ' + catName[w.cat]); }
    bars.forEach((b, j) => { if (j !== i) b.style.transform = 'scaleX(' + (j < i ? 1 : 0) + ')'; });
    reelPlay.setAttribute('aria-label', '“' + w.title + '” 원본 영상 보기');
  }
  function syncReel() {
    const t = reelV.currentTime || 0;
    const i = segAt(t);
    setSeg(i);
    const s = segs[i];
    const p = clamp((t - s.t0) / (s.t1 - s.t0), 0, 1);
    bars[i].style.transform = 'scaleX(' + p + ')';
    ringC.style.strokeDashoffset = RC * (1 - p);
    ringM.style.strokeDashoffset = RM_C * (1 - p);
  }
  const reelPlay = $('#reelPlayBtn');
  setSeg(0);
  reelV.addEventListener('timeupdate', syncReel);
  let reelVisible = true;
  new IntersectionObserver(es => {
    reelVisible = es[0].isIntersecting;
    if (!finished) return;
    if (reelVisible && lb.hidden) playVideo(reelV); else reelV.pause();
  }, { threshold: 0.05 }).observe(reel);
  const openCurrent = () => openLB(segs[Math.max(cur, 0)].id, reelV);
  reelPlay.addEventListener('click', e => { e.stopPropagation(); openCurrent(); });

  // desktop PLAY cursor
  const cursor = $('#cursor'), cursorLabel = $('#cursorLabel');
  let mx = -300, my = -300, cx = -300, cy = -300, cs = 0, rx = -300, ry = -300, rs = 0, ds = 0, seen = false, cst = 'def', cOut = true, cDirty = false;
  let cdot = null, cring = null;
  function cStateAt(t) {
    if (!t || !t.closest) return 'def';
    if (t.closest('input,textarea,select')) return 'hide';
    if (t.closest('.reel')) return t.closest('a,button') ? 'link' : 'reel';
    if (t.closest('.aitem__m,.strip button[data-play]')) return 'play';
    if (t.closest('.card__media')) return 'view';
    if (t.closest('a,button,label,[role="tab"]')) return 'link';
    return 'def';
  }
  function cSet(st) {
    if (st === cst) return;
    cst = st;
    cursor.classList.toggle('is-reel', st === 'reel');
    if (st === 'reel' || st === 'play') cursorLabel.textContent = 'PLAY';
    else if (st === 'view') cursorLabel.textContent = 'VIEW';
  }
  if (FINE) {
    document.documentElement.classList.add('has-cursor');
    cring = document.createElement('div'); cring.className = 'cring'; cring.setAttribute('aria-hidden', 'true');
    cdot = document.createElement('div'); cdot.className = 'cdot'; cdot.setAttribute('aria-hidden', 'true');
    body.append(cring, cdot);
    document.addEventListener('pointermove', e => {
      mx = e.clientX; my = e.clientY;
      if (!seen) { cx = rx = mx; cy = ry = my; seen = true; }
      cOut = false;
      cSet(cStateAt(e.target));
    }, { passive: true });
    document.addEventListener('mouseout', e => { if (!e.relatedTarget) cOut = true; });
    window.addEventListener('blur', () => { cOut = true; });
    window.addEventListener('scroll', () => { cDirty = true; }, { passive: true });
    reel.addEventListener('click', e => { if (!e.target.closest('a,button') && finished) openCurrent(); });
  } else {
    reel.addEventListener('click', e => { if (!e.target.closest('a,button') && finished && e.target === reelV) openCurrent(); });
  }
  function cursorStep(dt) {
    if (!FINE) return;
    if (cDirty && seen && !cOut) { cDirty = false; cSet(cStateAt(document.elementFromPoint(mx, my))); }
    const on = lb.hidden && finished && !cOut && seen;
    const big = on && (cst === 'reel' || cst === 'play' || cst === 'view') ? 1 : 0;
    const ringT = on && cst !== 'hide' && !big ? (cst === 'link' ? 0.42 : 1) : 0;
    const dotT = on && cst !== 'hide' && !big ? 1 : 0;
    const k = RM ? 1 : lerpK(0.2, dt), k2 = RM ? 1 : lerpK(0.16, dt);
    cx += (mx - cx) * k; cy += (my - cy) * k;
    rx += (mx - rx) * (RM ? 1 : lerpK(0.24, dt)); ry += (my - ry) * (RM ? 1 : lerpK(0.24, dt));
    cs += (big - cs) * k2; rs += (ringT - rs) * k2; ds += (dotT - ds) * (RM ? 1 : lerpK(0.3, dt));
    cursor.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0) scale(' + cs.toFixed(3) + ')';
    cring.style.transform = 'translate3d(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px,0) scale(' + rs.toFixed(3) + ')';
    cdot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0) scale(' + ds.toFixed(3) + ')';
  }

  /* ---------------- text fit (giant wordmarks) ---------------- */
  function fit(el) {
    if (!el) return;
    const host = el.parentElement;
    const cs = getComputedStyle(host);
    const avail = host.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    el.style.fontSize = '100px';
    const w = el.getBoundingClientRect().width;
    if (w > 0) el.style.fontSize = (100 * avail / w).toFixed(2) + 'px';
  }
  function fitAll() { $$('.fit').forEach(fit); movePill(); measure(); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { fitAll(); resplit(); });
  let rz;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { fitAll(); resplit(); mqMeasure(); }, 120); });
  footMark.innerHTML = 'FREE'.split('').map(c => '<span class="fch">' + c + '</span>').join('') + '<span class="o fch">2</span>' + 'FLY'.split('').map(c => '<span class="fch">' + c + '</span>').join('');
  const fchs = $$('.fch', footMark);

  /* ---------------- nav + menu ---------------- */
  const nav = $('#nav'), burger = $('#burger'), menu = $('#menu');
  function setMenu(on) {
    body.classList.toggle('menu-open', on);
    burger.setAttribute('aria-expanded', on ? 'true' : 'false');
    burger.setAttribute('aria-label', on ? '메뉴 닫기' : '메뉴 열기');
    menu.setAttribute('aria-hidden', on ? 'false' : 'true');
  }
  burger.addEventListener('click', () => setMenu(!body.classList.contains('menu-open')));
  $$('a', menu).forEach(a => a.addEventListener('click', () => setMenu(false)));
  let lastY = window.scrollY;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    nav.classList.toggle('is-up', y > lastY && y > window.innerHeight * 0.8 && !body.classList.contains('menu-open'));
    lastY = y;
  }, { passive: true });
  function roll(el) {
    const tn = Array.from(el.childNodes).find(n => n.nodeType === 3 && n.nodeValue.trim());
    if (!tn) return null;
    const t = tn.nodeValue.trim();
    const kr = /[가-힣]/.test(t);
    const mk = () => kr ? '<span>' + esc(t) + '</span>' : Array.from(t).map((c, i) => '<span style="--c:' + i + '">' + (c === ' ' ? '&nbsp;' : esc(c)) + '</span>').join('');
    const w = document.createElement('span');
    w.className = 'roll';
    w.innerHTML = '<span class="roll__a">' + mk() + '</span><span class="roll__b" aria-hidden="true">' + mk() + '</span>';
    tn.replaceWith(w);
    return w;
  }
  $$('.nav__links a').forEach(roll);
  const ctaRoll = roll($('.nav__cta'));

  /* ---------------- reveal ---------------- */
  const splitSrc = new WeakMap();
  function split(el) {
    if (!splitSrc.has(el)) splitSrc.set(el, el.innerHTML);
    el.innerHTML = splitSrc.get(el);
    const toks = [];
    (function walk(node, chain) {
      Array.from(node.childNodes).forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.nodeValue.split(/(\s+)/).forEach(p => {
            if (!p) return;
            if (/^\s+$/.test(p)) { const t = document.createTextNode(p); frag.appendChild(t); toks.push({ n: t, chain, sp: 1 }); }
            else { const s = document.createElement('span'); s.textContent = p; frag.appendChild(s); toks.push({ n: s, chain, w: 1 }); }
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) {
          if (n.tagName === 'BR') toks.push({ n, chain, br: 1 });
          else if (n.childNodes.length) walk(n, chain.concat(n));
          else toks.push({ n, chain, w: 1, el: 1 });
        }
      });
    })(el, []);
    const st = getComputedStyle(el);
    const thr = Math.max(parseFloat(st.lineHeight) || 0, parseFloat(st.fontSize) || 16) * 0.5;
    const lines = [];
    let cur = null, lastTop = -1e9, force = true;
    toks.forEach(t => {
      if (t.br) { force = true; return; }
      if (t.w) {
        const top = t.n.getBoundingClientRect().top;
        if (force || !cur || top > lastTop + thr) { cur = []; lines.push(cur); lastTop = top; force = false; }
      }
      if (cur) cur.push(t);
    });
    el.textContent = '';
    lines.forEach((ln, i) => {
      while (ln.length && ln[ln.length - 1].sp) ln.pop();
      while (ln.length && ln[0].sp) ln.shift();
      const box = document.createElement('span'), inner = document.createElement('span');
      box.className = 'ln'; inner.className = 'lni';
      inner.style.setProperty('--li', Math.min(i, 7));
      box.appendChild(inner); el.appendChild(box);
      const open = [], made = [];
      ln.forEach(t => {
        let k = 0;
        while (k < open.length && k < t.chain.length && open[k] === t.chain[k]) k++;
        open.length = k; made.length = k;
        for (let j = k; j < t.chain.length; j++) { const c = t.chain[j].cloneNode(false); (j ? made[j - 1] : inner).appendChild(c); open.push(t.chain[j]); made.push(c); }
        (made.length ? made[made.length - 1] : inner).appendChild(t.w && !t.el ? document.createTextNode(t.n.textContent) : t.n);
      });
    });
    el._lines = lines.length;
    return lines.length;
  }
  function unsplit(el) { if (splitSrc.has(el)) { el.innerHTML = splitSrc.get(el); splitSrc.delete(el); } }
  const pending = new Set();
  function resplit() { pending.forEach(el => split(el)); }
  const counts = [];
  function reveal(el) {
    el.classList.add('is-in');
    const subs = el._splits || [];
    if (subs.length) {
      subs.forEach(s => pending.delete(s));
      const n = Math.max.apply(null, subs.map(s => Math.min(s._lines || 1, 8)));
      setTimeout(() => { subs.forEach(unsplit); el.classList.add('is-done'); }, 1500 + n * 90);
    } else setTimeout(() => el.classList.add('is-done'), 1600);
    counts.forEach(c => { if (!c.t0 && el.contains(c.b)) { c.t0 = performance.now(); c.t.nodeValue = '0'; } });
  }
  const revIO = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { revIO.unobserve(e.target); reveal(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  function countStep(now) {
    for (const c of counts) {
      if (!c.t0 || c.end) continue;
      const p = clamp((now - c.t0) / 1400, 0, 1);
      c.t.nodeValue = p >= 1 ? c.s : String(Math.round(c.n * easeOut(p)));
      if (p >= 1) c.end = true;
    }
  }
  let itemN = 0, itemTimer = 0;
  function showItem(el, extra) {
    el.style.setProperty('--d', Math.min(itemN++, 7) + (extra || 0));
    clearTimeout(itemTimer);
    itemTimer = setTimeout(() => { itemN = 0; }, 60);
    el.classList.add('is-in');
    setTimeout(() => { el.classList.add('is-done'); }, 1900);
  }
  const itemIO = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { itemIO.unobserve(e.target); showItem(e.target); }
  }), { rootMargin: '0px 0px -6% 0px' });
  function watchItem(el) {
    if (RM) { el.classList.add('is-in', 'is-done'); return; }
    el.classList.remove('is-in', 'is-done');
    itemIO.observe(el);
  }

  /* ---------------- selected works ---------------- */
  const feat = D.featured.map(f => byId[f.id]).filter(Boolean);
  const worksSec = $('#works'), wlist = $('#wlist'), wgrid = $('#wgrid');
  $('#featCount').textContent = pad2(feat.length);
  const metaLine = w => esc(w.client) + ' · ' + esc(catName[w.cat]);

  function detailHTML(w) {
    const v = vertical.has(w.id);
    const stills = [1, 2, 3, 4, 5].map(k => '<figure><img src="media/stills/' + w.id + '_' + k + '.jpg" alt="' + esc(w.title) + ' 장면 ' + k + '" loading="lazy" decoding="async"></figure>').join('');
    const credits = [['분야', catName[w.cat]], ['클라이언트', w.client], ['지역', w.region]]
      .filter(c => c[1]).map(c => '<div><dt>' + c[0] + '</dt><dd>' + esc(c[1]) + '</dd></div>').join('');
    return '<div class="dbody"><div class="stills' + (v ? ' vert' : '') + '">' + stills + '</div>' +
      '<div class="dfoot"><dl class="credits">' + credits + '</dl>' +
      '<button class="btn-watch" type="button" data-play="' + w.id + '">영상 보기 <i></i></button></div></div>';
  }

  wlist.innerHTML = feat.map((w, i) =>
    '<li class="row" data-id="' + w.id + '">' +
      '<button class="row__head" type="button" aria-expanded="false" aria-controls="wd-' + i + '">' +
        '<span class="row__no">' + pad2(i + 1) + '</span>' +
        '<span class="row__mid"><span class="row__title">' + esc(w.title) + '</span><span class="row__sub">' + metaLine(w) + '</span></span>' +
        '<span class="row__client">' + esc(w.client) + '</span>' +
        '<span class="row__cat">' + esc(catName[w.cat]) + '</span>' +
        '<span class="row__thumb"><img src="media/prev/' + w.id + '.jpg" alt="" loading="lazy" decoding="async"><video muted playsinline autoplay loop preload="none" data-src="media/prev/' + w.id + '.mp4"></video></span>' +
        '<span class="row__plus" aria-hidden="true"></span>' +
      '</button>' +
      '<div class="row__detail" id="wd-' + i + '" role="region" aria-label="' + esc(w.title) + ' 상세"><div class="row__inner">' + detailHTML(w) + '</div></div>' +
    '</li>').join('');

  wgrid.innerHTML = feat.map((w, i) =>
    '<article class="card" data-id="' + w.id + '" data-i="' + i + '">' +
      '<button class="card__btn" type="button" aria-expanded="false" style="width:100%;text-align:left">' +
        '<span class="card__media"><img src="media/prev/' + w.id + '.jpg" alt="" loading="lazy" decoding="async"><video muted playsinline autoplay loop preload="none" data-src="media/prev/' + w.id + '.mp4"></video><span class="card__no">' + pad2(i + 1) + '</span></span>' +
        '<span class="card__meta"><b>' + esc(w.title) + '</b><em>' + metaLine(w) + '</em></span>' +
      '</button>' +
    '</article>').join('');

  const rows = $$('.row', wlist);
  rows.forEach(watchItem);
  function closeRows(except) {
    rows.forEach(r => {
      if (r === except) return;
      r.classList.remove('open', 'is-open');
      $('.row__head', r).setAttribute('aria-expanded', 'false');
    });
  }
  rows.forEach(r => {
    const head = $('.row__head', r);
    head.addEventListener('click', () => {
      const open = !r.classList.contains('open');
      closeRows(r);
      r.classList.toggle('open', open);
      r.classList.toggle('is-open', open);
      head.setAttribute('aria-expanded', open ? 'true' : 'false');
      fpHide();
      if (open) setTimeout(() => {
        const rect = r.getBoundingClientRect();
        if (rect.top < 60 || rect.top > window.innerHeight * 0.45) scrollToY(window.scrollY + rect.top - 80);
      }, 380);
    });
  });

  // grid detail panel
  let gOpen = null;
  function closeGrid() {
    const g = $('.gdetail', wgrid);
    if (g) g.remove();
    $$('.card', wgrid).forEach(c => { c.classList.remove('sel'); $('.card__btn', c).setAttribute('aria-expanded', 'false'); });
    gOpen = null;
  }
  wgrid.addEventListener('click', e => {
    const btn = e.target.closest('.card__btn');
    if (!btn) return;
    const card = btn.parentElement, id = card.dataset.id;
    if (gOpen === id) { closeGrid(); return; }
    closeGrid();
    gOpen = id;
    card.classList.add('sel');
    btn.setAttribute('aria-expanded', 'true');
    const cards = $$('.card', wgrid);
    const cols = getComputedStyle(wgrid).gridTemplateColumns.split(' ').filter(Boolean).length || 1;
    const i = cards.indexOf(card);
    const last = cards[Math.min(cards.length - 1, (Math.floor(i / cols) + 1) * cols - 1)];
    const panel = document.createElement('div');
    panel.className = 'gdetail';
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', byId[id].title + ' 상세');
    panel.innerHTML = detailHTML(byId[id]);
    last.after(panel);
    requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add('is-open')));
    setTimeout(() => {
      const r = panel.getBoundingClientRect();
      if (r.bottom > window.innerHeight || r.top < 0) scrollToY(window.scrollY + card.getBoundingClientRect().top - 80);
    }, 120);
  });

  // view toggle
  const tBtns = $$('.toggle button'), pill = $('.toggle__pill');
  function movePill() {
    const on = tBtns.find(b => b.classList.contains('is-on'));
    if (!on || !pill) return;
    const l = on.offsetLeft - pill.offsetLeft, r = pill.offsetWidth - l - on.offsetWidth;
    pill.style.clipPath = 'inset(0 ' + Math.max(0, r) + 'px 0 ' + Math.max(0, l) + 'px round 99px)';
  }
  let viewTimer = 0;
  function swapView(v) {
    worksSec.dataset.view = v;
    wlist.hidden = v !== 'list';
    wgrid.hidden = v !== 'grid';
    fpHide();
    closeRows(null);
    closeGrid();
    observePreviews();
    $$(v === 'grid' ? '.card' : '.row', worksSec).forEach(watchItem);
  }
  function setView(v) {
    const from = worksSec.dataset.view;
    tBtns.forEach(b => { const on = b.dataset.view === v; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    movePill();
    clearTimeout(viewTimer);
    if (from === v || RM) { swapView(v); return; }
    fpHide();
    const outs = $$(from === 'grid' ? '.card' : '.row', worksSec).filter(el => inView(el.getBoundingClientRect()));
    outs.forEach((el, i) => { el.style.animationDelay = Math.min(i, 7) * 30 + 'ms'; el.classList.add('is-gone'); });
    viewTimer = setTimeout(() => {
      outs.forEach(el => { el.classList.remove('is-gone'); el.style.animationDelay = ''; });
      swapView(v);
    }, outs.length ? 340 + Math.min(outs.length - 1, 7) * 30 : 0);
  }
  tBtns.forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  movePill();

  // desktop: floating preview following the cursor
  const fp = $('#fprev'), fpTag = $('#fprevTag');
  let fpV = $('video', fp);
  let fpCur = document.createElement('div');
  fpCur.className = 'fprev__m';
  fp.insertBefore(fpCur, fpV);
  fpCur.appendChild(fpV);
  let fpId = null, fpOn = false, fx = -999, fy = -999, tx = -999, ty = -999, fRot = 0, fpW = 0, fpH = 0;
  function fpShow(w) {
    if (!FINE || !isDesk()) return;
    if (fpId !== w.id) {
      const push = fpOn && fpId !== null && !RM;
      fpId = w.id;
      fp.classList.toggle('vert', vertical.has(w.id));
      fpTag.textContent = catName[w.cat];
      if (push) {
        const old = fpCur;
        old.classList.remove('is-in');
        old.classList.add('is-out');
        setTimeout(() => old.remove(), 650);
        fpCur = document.createElement('div');
        fpCur.className = 'fprev__m is-in';
        fpCur.innerHTML = '<video muted playsinline autoplay loop preload="auto"></video>';
        fp.insertBefore(fpCur, fpTag);
        fpV = $('video', fpCur);
      }
      fpV.poster = 'media/prev/' + w.id + '.jpg';
      fpV.src = 'media/prev/' + w.id + '.mp4';
      fpW = fp.offsetWidth; fpH = fp.offsetHeight;
    }
    if (!fpOn) { fx = tx; fy = ty; fRot = 0; fpW = fp.offsetWidth; fpH = fp.offsetHeight; }
    fpOn = true;
    fp.classList.add('on');
    playVideo(fpV);
  }
  function fpHide() {
    fpOn = false;
    fp.classList.remove('on');
    fpV.pause();
  }
  function fpStep(dt) {
    if (!fpOn) return;
    const px = fx;
    const k = RM ? 1 : lerpK(0.15, dt);
    fx += (tx - fx) * k; fy += (ty - fy) * k;
    const vx = dt > 0 ? (fx - px) / dt : 0;
    fRot += (clamp(vx * 0.006, -6, 6) - fRot) * (RM ? 1 : lerpK(0.12, dt));
    if (RM) fRot = 0;
    let x = fx + 34;
    if (x + fpW > window.innerWidth - 16) x = fx - fpW - 34;
    const y = clamp(fy - fpH / 2, 12, window.innerHeight - fpH - 12);
    fp.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) rotate(' + fRot.toFixed(2) + 'deg)';
  }
  if (FINE) {
    document.addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; }, { passive: true });
    rows.forEach(r => {
      const head = $('.row__head', r);
      head.addEventListener('mouseenter', () => {
        if (!isDesk()) return;
        r.classList.add('hov'); wlist.classList.add('hovering');
        if (!r.classList.contains('open')) fpShow(byId[r.dataset.id]); else fpHide();
      });
      head.addEventListener('mouseleave', () => { r.classList.remove('hov'); wlist.classList.remove('hovering'); fpHide(); });
    });
    window.addEventListener('scroll', () => {
      if (!fpOn) return;
      const el = document.elementFromPoint(tx, ty);
      if (!el || !el.closest('.row__head')) { fpHide(); $$('.row.hov').forEach(r => r.classList.remove('hov')); wlist.classList.remove('hovering'); }
    }, { passive: true });
    // grid cards: hover plays inline
    wgrid.addEventListener('mouseover', e => {
      const c = e.target.closest('.card');
      if (!c || c.classList.contains('play')) return;
      const v = $('video', c); loadVideo(v); playVideo(v); c.classList.add('play');
    });
    wgrid.addEventListener('mouseout', e => {
      const c = e.target.closest('.card');
      if (!c || (e.relatedTarget && c.contains(e.relatedTarget))) return;
      c.classList.remove('play'); const v = $('video', c); if (v) v.pause();
    });
    if (!RM) document.addEventListener('pointermove', e => {
      const m = e.target.closest && e.target.closest('.aitem__m,.card__media');
      if (!m) return;
      const r = m.getBoundingClientRect();
      m.style.setProperty('--px', (((e.clientX - r.left) / r.width - 0.5) * -16).toFixed(1) + 'px');
      m.style.setProperty('--py', (((e.clientY - r.top) / r.height - 0.5) * -16).toFixed(1) + 'px');
    }, { passive: true });
  }

  // mobile: inline preview when an item is centred in the viewport
  let centerIO = null;
  function observePreviews() {
    if (centerIO) centerIO.disconnect();
    if (FINE && isDesk()) return;
    centerIO = new IntersectionObserver(es => es.forEach(e => {
      const el = e.target, v = $('video', el);
      if (e.isIntersecting) {
        el.classList.add(el.classList.contains('card') ? 'play' : 'center');
        loadVideo(v); playVideo(v);
      } else {
        el.classList.remove('center', 'play');
        if (v) v.pause();
      }
      wlist.classList.toggle('has-center', !!$('.row.center', wlist));
    }), { rootMargin: '-47% 0px -47% 0px', threshold: 0 });
    $$(worksSec.dataset.view === 'grid' ? '.card' : '.row', worksSec).forEach(el => centerIO.observe(el));
  }
  observePreviews();

  /* ---------------- fields ---------------- */
  const flist = $('#flist');
  flist.innerHTML = D.cats.map((c, i) => {
    const ws = D.works.filter(w => w.cat === c.key).slice(0, 6);
    return '<li class="frow" data-cat="' + c.key + '">' +
      '<button class="frow__head" type="button" aria-expanded="false">' +
        '<span class="frow__no">' + pad2(i + 1) + '</span><span class="frow__name">' + esc(c.name) + '</span>' +
        '<span class="frow__cnt">' + c.count + '편</span><span class="frow__go" aria-hidden="true">→</span>' +
      '</button>' +
      '<div class="frow__strip"><div class="frow__in"><div class="strip">' +
        ws.map((w, k) => '<button type="button" data-play="' + w.id + '" style="--i:' + k + '" aria-label="' + esc(w.title) + ' 영상 보기"><img src="media/thumbs/' + w.id + '.jpg" alt="" loading="lazy" decoding="async"><span>' + esc(w.title) + '</span></button>').join('') +
        '<a class="strip__all" href="#all" data-filter="' + c.key + '">' + esc(c.name) + '<br>' + c.count + '편 모두 보기 <i aria-hidden="true">→</i></a>' +
      '</div></div></div></li>';
  }).join('');
  const frows = $$('.frow', flist);
  frows.forEach(watchItem);
  const deskFields = () => FINE && isDesk();
  frows.forEach(r => {
    const head = $('.frow__head', r);
    r.addEventListener('mouseenter', () => { if (!deskFields()) return; r.classList.add('on'); flist.classList.add('hovering'); });
    r.addEventListener('mouseleave', () => { if (!deskFields()) return; r.classList.remove('on'); flist.classList.remove('hovering'); });
    head.addEventListener('click', () => {
      if (deskFields()) { applyFilter(r.dataset.cat, true); return; }
      const on = !r.classList.contains('on');
      frows.forEach(o => { o.classList.remove('on'); $('.frow__head', o).setAttribute('aria-expanded', 'false'); });
      r.classList.toggle('on', on);
      head.setAttribute('aria-expanded', on ? 'true' : 'false');
    });
  });

  /* ---------------- clients marquee ---------------- */
  const cl = D.clients, half = Math.ceil(cl.length / 2);
  function fillMarquee(el, arr) {
    const set = arr.map(n => '<span>' + esc(n) + '</span>').join('');
    el.innerHTML = '<div class="marquee__track"><div class="marquee__set">' + set + '</div><div class="marquee__set" aria-hidden="true">' + set + '</div></div>';
  }
  fillMarquee($('#marquee1'), cl.slice(0, half));
  fillMarquee($('#marquee2'), cl.slice(half));
  const mqs = RM ? [] : $$('.marquee').map((el, i) => {
    const m = { tr: $('.marquee__track', el), x: 0, w: 0, sp: 0, sec: i ? 100 : 90, dir: i ? -1 : 1, hov: 1, ht: 1 };
    el.addEventListener('pointerenter', () => { m.ht = 0.28; });
    el.addEventListener('pointerleave', () => { m.ht = 1; });
    return m;
  });
  function mqMeasure() { mqs.forEach(m => { m.w = m.tr.firstElementChild.offsetWidth; m.sp = m.w / m.sec; if (m.dir < 0 && !m.x) m.x = -m.w; }); }
  mqMeasure();
  let mqOn = false, mqDir = 1, vel = 0;
  new IntersectionObserver(es => { mqOn = es[0].isIntersecting; }).observe($('#clients'));
  function mqStep(dt) {
    if (!mqOn || !mqs.length) return;
    if (Math.abs(vel) > 40) mqDir += (Math.sign(vel) - mqDir) * lerpK(0.08, dt);
    const boost = Math.min(Math.abs(vel) * 0.18, 700);
    mqs.forEach(m => {
      if (!m.w) return;
      m.hov += (m.ht - m.hov) * lerpK(0.08, dt);
      m.x -= (m.sp + boost) * m.hov * m.dir * mqDir * dt;
      if (m.x <= -m.w) m.x += m.w;
      if (m.x > 0) m.x -= m.w;
      m.tr.style.transform = 'translate3d(' + m.x.toFixed(2) + 'px,0,0)';
    });
  }

  /* ---------------- archive ---------------- */
  const chips = $('#chips'), agrid = $('#agrid'), moreBtn = $('#moreBtn'), moreLeft = $('#moreLeft');
  const PAGE = isDesk() ? 16 : 10;
  let filter = 'all', limit = PAGE;
  $('#allCount').textContent = D.works.length;
  chips.innerHTML = [{ key: 'all', name: '전체', count: D.works.length }].concat(D.cats).map(c =>
    '<button class="chip' + (c.key === 'all' ? ' is-on' : '') + '" type="button" role="tab" aria-selected="' + (c.key === 'all') + '" data-cat="' + c.key + '">' + esc(c.name) + '<sup>' + c.count + '</sup></button>').join('');
  const itemHTML = w => '<button class="aitem" type="button" data-play="' + w.id + '">' +
    '<span class="aitem__m"><img src="media/thumbs/' + w.id + '.jpg" alt="" loading="lazy" decoding="async"></span>' +
    '<b>' + esc(w.title) + '</b><em>' + metaLine(w) + '</em></button>';
  const curList = () => filter === 'all' ? D.works : D.works.filter(w => w.cat === filter);
  function moreState(list) {
    const left = list.length - limit;
    moreBtn.parentElement.hidden = left <= 0;
    moreLeft.textContent = left > 0 ? '+' + left : '';
  }
  function renderAll(from) {
    const list = curList();
    const start = from || 0;
    const html = list.slice(start, limit).map(itemHTML).join('');
    if (start) agrid.insertAdjacentHTML('beforeend', html); else agrid.innerHTML = html;
    $$('.aitem:not(.is-in)', agrid).forEach(watchItem);
    moreState(list);
  }
  function flipRender(old) {
    const gr = agrid.getBoundingClientRect();
    const list = curList(), show = list.slice(0, limit);
    const keep = new Set(show.map(w => w.id));
    const ghosts = [];
    old.forEach((o, id) => {
      if (keep.has(id)) return;
      o.el.remove();
      if (!inView(o.r)) return;
      itemIO.unobserve(o.el);
      o.el.classList.add('is-gone');
      o.el.style.cssText = 'position:absolute;left:' + (o.r.left - gr.left).toFixed(1) + 'px;top:' + (o.r.top - gr.top).toFixed(1) + 'px;width:' + o.r.width.toFixed(1) + 'px';
      ghosts.push(o.el);
    });
    const frag = document.createDocumentFragment();
    show.forEach(w => {
      const o = old.get(w.id);
      if (o) frag.appendChild(o.el);
      else { const t = document.createElement('template'); t.innerHTML = itemHTML(w); frag.appendChild(t.content.firstChild); }
    });
    agrid.insertBefore(frag, agrid.firstChild);
    ghosts.forEach(g => agrid.appendChild(g));
    const moved = [];
    show.forEach(w => {
      const o = old.get(w.id);
      if (!o) return;
      const r = o.el.getBoundingClientRect();
      const dx = o.r.left - r.left, dy = o.r.top - r.top;
      if ((!dx && !dy) || (!inView(o.r) && !inView(r))) return;
      o.el.style.transition = 'none';
      o.el.style.transform = 'translate3d(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px,0)';
      moved.push(o.el);
    });
    agrid.offsetWidth;
    moved.forEach(el => { el.style.transition = 'transform .7s cubic-bezier(.76,0,.24,1)'; el.style.transform = ''; });
    setTimeout(() => moved.forEach(el => { el.style.transition = ''; }), 760);
    setTimeout(() => ghosts.forEach(g => g.remove()), 380);
    itemN = 0;
    $$('.aitem:not(.is-in):not(.is-gone)', agrid).forEach(el => {
      if (inView(el.getBoundingClientRect())) showItem(el, 3);
      else watchItem(el);
    });
    moreState(list);
  }
  function applyFilter(key, scroll) {
    const gr = agrid.getBoundingClientRect();
    const flip = !RM && !scroll && inView(gr);
    const old = new Map();
    if (flip) $$('.aitem', agrid).forEach(el => old.set(el.dataset.play, { el, r: el.getBoundingClientRect() }));
    filter = key; limit = PAGE;
    $$('.chip', chips).forEach(c => { const on = c.dataset.cat === key; c.classList.toggle('is-on', on); c.setAttribute('aria-selected', on ? 'true' : 'false'); });
    if (flip) flipRender(old); else renderAll();
    const chip = $('.chip.is-on', chips);
    if (chip) chips.scrollTo({ left: chip.offsetLeft - 20, behavior: RM ? 'auto' : 'smooth' });
    if (scroll) scrollToEl($('#all'));
  }
  chips.addEventListener('click', e => { const c = e.target.closest('.chip'); if (c) applyFilter(c.dataset.cat, false); });
  moreBtn.addEventListener('click', () => { const from = limit; limit += PAGE; renderAll(from); });
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-filter]');
    if (!a) return;
    e.preventDefault();
    setMenu(false);
    applyFilter(a.dataset.filter, true);
  });
  renderAll();

  /* ---------------- inquiry ---------------- */
  const form = $('#inqForm'), done = $('#inqDone'), err = $('#inqErr');
  $('#pcards').innerHTML = D.cats.map(c =>
    '<label class="pcard"><input type="checkbox" name="type" value="' + esc(c.name) + '">' +
      '<img src="media/stills/' + c.still + '.jpg" alt="" loading="lazy" decoding="async">' +
      '<img class="pcard__c" src="media/stills/' + c.still + '.jpg" alt="" loading="lazy" decoding="async">' +
      '<span class="pcard__ck" aria-hidden="true"></span>' +
      '<span class="pcard__n">' + esc(c.name) + '<small>작업 ' + c.count + '편</small></span></label>').join('');
  $$('.pcards .pcard, .opts .opt, .fields-in .in').forEach(el => el.style.setProperty('--k', Array.prototype.indexOf.call(el.parentElement.children, el)));
  const steps = $$('.step', form);
  const phoneDigits = v => v.replace(/\D/g, '');
  function stepState() {
    steps[0].classList.toggle('is-filled', !!$('.pcard input:checked', form));
    steps[1].classList.toggle('is-filled', !!$('.opts[data-name="budget"] .opt.is-on', form));
    steps[2].classList.toggle('is-filled', !!$('.opts[data-name="timing"] .opt.is-on', form));
    steps[3].classList.toggle('is-filled', !!form.name.value.trim() && phoneDigits(form.phone.value).length >= 9);
  }
  $$('.pcard input').forEach(i => i.addEventListener('change', () => { i.parentElement.classList.toggle('is-on', i.checked); stepState(); }));
  $$('.opts').forEach(g => g.addEventListener('click', e => {
    const b = e.target.closest('.opt');
    if (!b) return;
    const on = !b.classList.contains('is-on');
    $$('.opt', g).forEach(o => { o.classList.remove('is-on'); o.setAttribute('aria-pressed', 'false'); });
    if (on) { b.classList.add('is-on'); b.setAttribute('aria-pressed', 'true'); }
    stepState();
  }));
  form.phone.addEventListener('input', () => {
    const d = phoneDigits(form.phone.value).slice(0, 11);
    form.phone.value = d.length < 4 ? d : d.length < 8 ? d.slice(0, 3) + '-' + d.slice(3) : d.slice(0, 3) + '-' + d.slice(3, d.length - 4) + '-' + d.slice(-4);
  });
  form.addEventListener('input', stepState);
  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = form.name.value.trim(), phone = form.phone.value.trim();
    const bad = [];
    form.name.parentElement.classList.toggle('err', !name);
    form.phone.parentElement.classList.toggle('err', phoneDigits(phone).length < 9);
    if (!name) bad.push('이름');
    if (phoneDigits(phone).length < 9) bad.push('연락처');
    if (bad.length) {
      err.textContent = bad.length === 2 ? '이름과 연락처를 확인해 주세요.' : bad[0] === '이름' ? '이름을 입력해 주세요.' : '연락처를 확인해 주세요.';
      (bad[0] === '이름' ? form.name : form.phone).focus();
      return;
    }
    err.textContent = '';
    const types = $$('.pcard input:checked').map(i => i.value);
    const pick = n => { const o = $('.opts[data-name="' + n + '"] .opt.is-on'); return o ? o.textContent : ''; };
    const items = types.concat([pick('budget') && '예산 ' + pick('budget'), pick('timing')]).filter(Boolean);
    items.unshift(name + ' 님');
    $('#doneSum').innerHTML = items.map((t, k) => '<span style="--k:' + Math.min(k, 7) + '">' + esc(t) + '</span>').join('');
    form.hidden = true;
    done.classList.remove('is-in', 'is-done');
    done.hidden = false;
    const parts = RM ? [] : $$('h3, p', done);
    parts.forEach(split);
    done._splits = parts;
    done.offsetWidth;
    reveal(done);
    done.focus({ preventScroll: true });
    scrollToY(window.scrollY + $('#contact').getBoundingClientRect().top);
  });
  $('#inqAgain').addEventListener('click', () => {
    form.reset();
    $$('.pcard').forEach(p => p.classList.remove('is-on'));
    $$('.opt.is-on').forEach(o => { o.classList.remove('is-on'); o.setAttribute('aria-pressed', 'false'); });
    done.hidden = true;
    form.hidden = false;
    $$('#inqForm [data-reveal]').forEach(el => el.classList.add('is-in'));
    stepState();
  });

  const mags = [];
  if (SMOOTH) {
    [[$('.nav__cta'), ctaRoll, 8], [$('.btn-primary'), $('.btn-primary span'), 8], [$('.foot__big'), null, 10], [moreBtn, null, 8]].forEach(([el, inner, max]) => {
      if (!el) return;
      const m = { el, inner, max, x: 0, y: 0, tx: 0, ty: 0 };
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        m.tx = clamp((e.clientX - (r.left + r.width / 2 - m.x)) * 0.3, -max, max);
        m.ty = clamp((e.clientY - (r.top + r.height / 2 - m.y)) * 0.35, -max, max);
      });
      el.addEventListener('pointerleave', () => { m.tx = 0; m.ty = 0; });
      mags.push(m);
    });
  }
  function magStep(dt) {
    const k = lerpK(0.1, dt);
    mags.forEach(m => {
      if (!m.tx && !m.ty && Math.abs(m.x) < 0.05 && Math.abs(m.y) < 0.05) {
        if (m.x || m.y) { m.x = m.y = 0; m.el.style.transform = ''; if (m.inner) m.inner.style.transform = ''; }
        return;
      }
      m.x += (m.tx - m.x) * k; m.y += (m.ty - m.y) * k;
      m.el.style.transform = 'translate3d(' + m.x.toFixed(2) + 'px,' + m.y.toFixed(2) + 'px,0)';
      if (m.inner) m.inner.style.transform = 'translate3d(' + (m.x * 0.5).toFixed(2) + 'px,' + (m.y * 0.5).toFixed(2) + 'px,0)';
    });
  }
  let fmLast = -1;
  function footStep(y) {
    if (RM || !fmH) return;
    const top = fmTop - y;
    if (top > window.innerHeight + 60 && fmLast === 0) return;
    const p = clamp((window.innerHeight - top) / (fmH * 0.9 + 40), 0, 1);
    if (p === fmLast) return;
    fmLast = p;
    fchs.forEach((c, i) => {
      const e = easeOut(clamp((p - i * 0.045) / 0.6, 0, 1));
      c.style.transform = e >= 1 ? '' : 'translate3d(0,' + ((1 - e) * 105).toFixed(2) + '%,0)';
    });
  }

  const texts = $$('.statement__eyebrow, .statement__text, .sec-title, .sec-note');
  $$('.statement__facts b').forEach(b => {
    const t = b.firstChild;
    if (!RM && t && t.nodeType === 3 && /^\d+$/.test(t.nodeValue.trim())) counts.push({ b, t, n: +t.nodeValue.trim(), s: t.nodeValue, t0: 0 });
  });
  if (RM) {
    $$('[data-reveal]').forEach(el => el.classList.add('is-in', 'is-done'));
  } else {
    texts.forEach(el => { split(el); el._splits = [el]; pending.add(el); });
    const facts = $('.statement__facts');
    facts._splits = $$('span', facts);
    facts._splits.forEach(s => { split(s); pending.add(s); });
    steps.forEach(s => { const lg = $('legend', s); split(lg); s._splits = [lg]; pending.add(lg); });
    $$('[data-reveal]').forEach(el => revIO.observe(el));
  }
  if (!SMOOTH) window.addEventListener('resize', measure);
  if (window.ResizeObserver) new ResizeObserver(() => measure()).observe(body);
  measure();

  let lastT = performance.now(), prevY = window.scrollY;
  function tick(now) {
    const dt = Math.min(Math.max((now - lastT) / 1000, 0), 0.05);
    lastT = now;
    if (!finished) loaderTick(now, dt);
    scrollStep(now, dt);
    const y = window.scrollY;
    if (dt > 0) vel += ((y - prevY) / dt - vel) * lerpK(0.2, dt);
    prevY = y;
    if (reelVisible && !reelV.paused) syncReel();
    cursorStep(dt);
    fpStep(dt);
    magStep(dt);
    mqStep(dt);
    footStep(y);
    countStep(now);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
