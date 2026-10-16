/* FREE2FLY — film strip showroom */
(() => {
'use strict';
const D = window.F2F || { cats: [], works: [] };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
const pad = n => String(n).padStart(2, '0');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mod = (a, n) => ((a % n) + n) % n;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const byId = {}; D.works.forEach(w => { byId[w.id] = w; });
const catName = {}; D.cats.forEach(c => { catName[c.key] = c.name; });
const sub = w => [w.c, w.r].filter(Boolean).join(' · ');
const body = document.body;
let entered = false;
let lbOpen = false;

/* =========================================================
   LIGHTBOX (YouTube nocookie) — ESC / backdrop / back button
   ========================================================= */
const lb = $('#lb'), lbPlayer = $('#lbPlayer');
let lbPushed = false, lbOpener = null, lbTimer = 0;
function openLB(id, vertical) {
  const w = byId[id]; if (!w) return;
  clearTimeout(lbTimer);
  lbOpener = document.activeElement;
  lb.classList.toggle('v', !!vertical);
  lbPlayer.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) +
    '?autoplay=1&rel=0&playsinline=1" title="' + esc(w.t) + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen"></iframe>';
  $('#lbTitle').textContent = w.t;
  $('#lbSub').textContent = [w.c, w.r, catName[w.cat]].filter(Boolean).join(' · ');
  lb.hidden = false;
  body.classList.add('lb-open');
  requestAnimationFrame(() => requestAnimationFrame(() => lb.classList.add('on')));
  lbOpen = true;
  try { history.pushState({ f2fLb: 1 }, ''); lbPushed = true; } catch (e) { lbPushed = false; }
  $('.lb__x', lb).focus({ preventScroll: true });
  syncMedia();
}
function closeLB(fromPop) {
  if (!lbOpen) return;
  lbOpen = false;
  lb.classList.remove('on');
  body.classList.remove('lb-open');
  lbTimer = setTimeout(() => { lb.hidden = true; lbPlayer.innerHTML = ''; }, 400);
  if (!fromPop && lbPushed) { lbPushed = false; history.back(); } else lbPushed = false;
  if (lbOpener && lbOpener.focus) lbOpener.focus({ preventScroll: true });
  syncMedia();
}
lb.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeLB(); });
addEventListener('popstate', () => { if (lbOpen) closeLB(true); });
addEventListener('keydown', e => {
  if (!lbOpen) return;
  if (e.key === 'Escape') { e.preventDefault(); closeLB(); }
  else if (e.key === 'Tab') { e.preventDefault(); $('.lb__x', lb).focus(); }
});

/* =========================================================
   INTRO — particles assemble into the FREE2FLY wordmark
   ========================================================= */
const intro = $('#intro'), cv = $('#particles'), ctx = cv.getContext('2d');
intro.insertAdjacentHTML('beforeend', '<div class="intro__flash" aria-hidden="true"></div>');
const PCOL = ['#f4eee4', '#32bbff', '#ffb03a'];
let W = 0, H = 0, P = [], introRAF = 0, phase = 'form', tBurst = 0, lastT = 0, t0 = 0;
let ptr = { x: -1e4, y: -1e4 }, touched = false, textBox = { cx: 0, cy: 0, w: 0 };

function sampleWordmark() {
  W = innerWidth; H = innerHeight;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const oc = document.createElement('canvas'); oc.width = W; oc.height = H;
  const o = oc.getContext('2d', { willReadFrequently: true });
  const font = s => '700 ' + s + 'px Fredoka, "Pretendard Variable", Pretendard, sans-serif';
  const parts = ['FREE', '2', 'FLY'];
  o.font = font(100);
  const w100 = parts.reduce((a, p) => a + o.measureText(p).width, 0);
  const targetW = W < 700 ? W * 0.86 : Math.min(W * 0.7, 1120);
  const fs = Math.min(targetW / w100 * 100, H * 0.3);
  o.font = font(fs);
  const ws = parts.map(p => o.measureText(p).width);
  const total = ws[0] + ws[1] + ws[2];
  const uiTop = H / 2 + Math.min(W * 0.1, 120);
  const base = uiTop - Math.max(20, fs * 0.2);
  let x = (W - total) / 2;
  o.textBaseline = 'alphabetic';
  o.fillStyle = '#f00'; o.fillText(parts[0], x, base); x += ws[0];
  o.strokeStyle = '#00f'; o.lineWidth = Math.max(2, fs * 0.07); o.lineJoin = 'round';
  o.strokeText(parts[1], x + o.lineWidth * 0.1, base); x += ws[1];
  o.fillText(parts[2], x, base);
  const top = Math.max(0, Math.floor(base - fs * 0.95)), bot = Math.min(H, Math.ceil(base + fs * 0.3));
  const left = Math.max(0, Math.floor((W - total) / 2 - fs * 0.1)), right = Math.min(W, Math.ceil((W + total) / 2 + fs * 0.1));
  textBox = { cx: W / 2, cy: base - fs * 0.36, w: total, top: base - fs * 0.72, bot: base };
  const data = o.getImageData(0, 0, W, H).data;
  const maxN = W < 700 ? 2000 : 3000;
  let pts = [], step = 2;
  for (; step < 16; step++) {
    pts = [];
    for (let y = top; y < bot; y += step) for (let xx = left; xx < right; xx += step) {
      const i = (y * W + xx) * 4;
      if (data[i] > 140) pts.push([xx, y, 0]); else if (data[i + 2] > 140) pts.push([xx, y, 1]);
    }
    if (pts.length <= maxN) break;
  }
  const size = clamp(step * 0.62, 1.3, 3);
  for (let i = 0; i < pts.length; i++) {
    const [px, py, c] = pts[i];
    let p = P[i];
    if (!p) {
      const a = Math.random() * Math.PI * 2, r = Math.max(W, H) * (0.35 + Math.random() * 0.5);
      p = P[i] = { x: W / 2 + Math.cos(a) * r, y: H / 2 + Math.sin(a) * r, vx: 0, vy: 0, k: 0.016 + Math.random() * 0.034, ph: Math.random() * 6.283 };
    }
    p.tx = px + (Math.random() - 0.5) * step * 0.5;
    p.ty = py + (Math.random() - 0.5) * step * 0.5;
    p.c = c === 1 ? 1 : (Math.random() < 0.07 ? 2 : 0);
    p.s = size * (0.7 + Math.random() * 0.6);
    if (RM) { p.x = p.tx; p.y = p.ty; }
  }
  P.length = pts.length;
}
function drawParticles(alpha) {
  ctx.clearRect(0, 0, W, H);
  ctx.globalAlpha = alpha;
  for (let c = 0; c < 3; c++) {
    ctx.fillStyle = PCOL[c];
    for (let i = 0; i < P.length; i++) { const p = P[i]; if (p.c === c) ctx.fillRect(p.x, p.y, p.s, p.s); }
  }
  ctx.globalAlpha = 1;
}
function introTick(now) {
  introRAF = requestAnimationFrame(introTick);
  if (!t0) t0 = now;
  const dt = Math.min(48, now - (lastT || now)); lastT = now;
  const f = dt / 16.667;
  if (phase === 'form') {
    // a single phantom sweep shows the interaction if nobody touched it yet
    let mx = ptr.x, my = ptr.y;
    const ts = now - t0;
    let R = W < 700 ? 64 : 110;
    if (!touched && ts > 2200 && ts < 3400) {
      const k = (ts - 2200) / 1200;
      mx = textBox.cx - textBox.w * 0.6 + textBox.w * 1.2 * k;
      my = textBox.cy;
      R *= 0.55;
    }
    const R2 = R * R, damp = Math.pow(0.87, f), tw = now * 0.0016;
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      p.vx = (p.vx + (p.tx + Math.sin(tw + p.ph) * 0.6 - p.x) * p.k * f) * damp;
      p.vy = (p.vy + (p.ty + Math.cos(tw + p.ph) * 0.6 - p.y) * p.k * f) * damp;
      const dx = p.x - mx, dy = p.y - my, d2 = dx * dx + dy * dy;
      if (d2 < R2) { const d = Math.sqrt(d2) || 1, fo = (1 - d / R) * 5.5 * f; p.vx += dx / d * fo; p.vy += dy / d * fo; }
      p.x += p.vx * f; p.y += p.vy * f;
    }
    drawParticles(1);
  } else {
    tBurst += dt;
    const damp = Math.pow(0.955, f);
    for (let i = 0; i < P.length; i++) { const p = P[i]; p.vx *= damp; p.vy = p.vy * damp + 0.12 * f; p.x += p.vx * f; p.y += p.vy * f; }
    drawParticles(Math.max(0, 1 - tBurst / 1000));
    if (tBurst > 1150) stopIntro();
  }
}
function stopIntro() {
  cancelAnimationFrame(introRAF); introRAF = 0;
  intro.classList.add('gone');
  P = [];
}
function setPtr(e) { ptr.x = e.clientX; ptr.y = e.clientY; touched = true; }
cv.addEventListener('pointermove', setPtr);
cv.addEventListener('pointerdown', setPtr);
const ptrOut = () => { ptr.x = -1e4; ptr.y = -1e4; };
cv.addEventListener('pointerleave', ptrOut);
cv.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') ptrOut(); });
cv.addEventListener('pointercancel', ptrOut);

function enter(instant) {
  if (entered) return;
  entered = true;
  body.classList.remove('is-intro');
  if (instant || RM) {
    intro.classList.add('out');
    setTimeout(stopIntro, instant ? 0 : 700);
  } else {
    phase = 'burst'; tBurst = 0;
    const cx = W / 2, cy = textBox.cy;
    for (let i = 0; i < P.length; i++) {
      const p = P[i], dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy) || 1, sp = 7 + Math.random() * 24;
      p.vx = dx / d * sp + (Math.random() - 0.5) * 7; p.vy = dy / d * sp + (Math.random() - 0.5) * 7 - 2;
    }
    intro.classList.add('out');
    setTimeout(stopIntro, 1500);
  }
  if (!instant) $('#showroom').focus({ preventScroll: true });
  startMain();
}
$('#enterBtn').addEventListener('click', () => enter(false));
addEventListener('keydown', e => {
  if (entered || lbOpen) return;
  if ((e.key === 'Enter' || e.key === ' ') && (e.target === body || e.target === document.documentElement)) { e.preventDefault(); enter(false); }
  if (e.key === 'ArrowDown' || e.key === 'PageDown') enter(false);
});
addEventListener('wheel', e => { if (!entered && e.deltaY > 24) enter(false); }, { passive: true });
let rsT = 0;
addEventListener('resize', () => {
  clearTimeout(rsT);
  rsT = setTimeout(() => {
    if (!entered && phase === 'form') { sampleWordmark(); if (RM) drawParticles(1); }
    layoutStrips(true);
  }, 160);
});

function bootIntro() {
  const go = () => {
    if (entered) return;
    sampleWordmark();
    intro.classList.add('ready');
    if (RM) drawParticles(1); else introRAF = requestAnimationFrame(introTick);
  };
  const fontP = (document.fonts && document.fonts.load) ? document.fonts.load('700 100px Fredoka') : Promise.resolve();
  Promise.race([fontP, new Promise(r => setTimeout(r, 1400))]).then(go, go).then(() => {
    // the brand font arrived late: re-target the particles to the real glyphs
    if (document.fonts && !document.fonts.check('700 100px Fredoka')) {
      document.fonts.ready.then(() => { if (!entered && document.fonts.check('700 100px Fredoka')) { sampleWordmark(); if (RM) drawParticles(1); } });
    }
  });
}

/* =========================================================
   SHOWROOM — 4 draggable film strips with inertia
   ========================================================= */
const ROLLS = [
  { name: '하늘·숙소', tilt: -1.4, speed: -26, ids: ['t-TAO3vrIRM', 'F6c9QaZwF2o', 'T8EKJoSv_6A', 'MMVwrEEi3Ls', 'mN7O2KOM2cg', 'RVhcfgSF-iM', 'iVcn4A4zzSA', 'Dzv8-kgZCpo'] },
  { name: '스포츠·행사', tilt: 1.1, speed: 34, ids: ['Klw4SmkuPuY', 'teYb6yg-k10', 'oaagXTz0bBA', '-6c0wpxKU-M', 'ZvtqwCj716w', 'mbjvvZB4eKM', 'vgSpdrmUo84', 'CADRkxEo1i0', '8wa-ksPhIXc'] },
  { name: '브랜드·제품', tilt: -0.8, speed: -20, ids: ['ydxPk4YJuYY', '7srAEMaj9OU', 'DGnKnpbkXNg', 'oFs6sOKxrIo', 'IXA8Im45LVU', 'CY9D4_oinPs', 'vywQWhC3dQ8', 'hEYaNDw2Rt4', 'JmqGIuCcXoA'] },
  { name: '사람·기록', tilt: 1.6, speed: 28, ids: ['4pYKCFTbqGw', 'xbV4pWObwVE', 'VIzxJvoWrHY', 'vcNDsFkCuVA', 'xJKXyXvuJ_g', 'XUicqIqCk3o', 'a6vFofgCQTo', 'LNsN10tLD9s', 'Xs5e8CFQPyg'] }
];
const stripsEl = $('#strips');
const STRIPS = [];
let paused = false;

function frameHTML(w, r, i) {
  const poster = w.v ? 'media/clips/' + w.id + '.jpg' : 'media/thumbs/' + w.id + '.jpg';
  return '<button class="frame" type="button" data-id="' + w.id + '" aria-label="' + esc(w.t + ' — ' + sub(w)) + ' 영상 보기">' +
    '<img alt="" draggable="false" decoding="async" data-src="' + poster + '">' +
    (w.v ? '<video muted playsinline loop autoplay preload="none" data-src="media/clips/' + w.id + '.mp4" data-poster="' + poster + '"></video>' : '') +
    '<span class="frame__no">R' + (r + 1) + '·' + pad(i + 1) + '</span><span class="frame__play">▶ PLAY</span>' +
    '<span class="frame__cap"><b>' + esc(w.t) + '</b><span>' + esc(sub(w)) + '</span></span></button>';
}
function buildStrips() {
  stripsEl.innerHTML = ROLLS.map((R, r) => {
    const works = R.ids.map(id => byId[id]).filter(Boolean);
    return '<div class="strip" style="--tilt:' + R.tilt + 'deg" data-r="' + r + '" role="group" aria-label="ROLL ' + pad(r + 1) + ' ' + R.name + '">' +
      '<p class="strip__label"><b>ROLL ' + pad(r + 1) + '</b>' + R.name + '</p>' +
      '<p class="strip__count" aria-hidden="true"><span>01</span> / ' + pad(works.length) + '</p>' +
      '<div class="strip__film"><div class="strip__track">' + works.map((w, i) => frameHTML(w, r, i)).join('') + '</div></div></div>';
  }).join('');
  $$('.strip', stripsEl).forEach((el, r) => {
    const s = {
      el, r, film: $('.strip__film', el), track: $('.strip__track', el), countEl: $('.strip__count span', el),
      frames: $$('.frame', el).map(fe => ({ el: fe, img: $('img', fe), vid: $('video', fe), loaded: false, playing: false, x: 0 })),
      off: 0, vel: RM ? 0 : ROLLS[r].speed, drift: RM ? 0 : ROLLS[r].speed, drag: null, hold: false, focusTo: null,
      inView: false, imgs: false, active: -1, suppress: false, fw: 0, pitch: 0, total: 0, sw: 0, last: { sk: 99, bl: 99 }
    };
    s.off = -r * 97; // offset rows so frames don't line up vertically
    STRIPS.push(s);
    bindStrip(s);
  });
  layoutStrips(false);
}
function layoutStrips(resize) {
  const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap')) || 14;
  STRIPS.forEach(s => {
    s.fw = s.frames[0].el.offsetWidth || 300;
    s.pitch = s.fw + gap;
    s.total = s.pitch * s.frames.length;
    s.sw = s.el.offsetWidth;
    // ultra-wide screens: make sure the loop never shows a hole
    if (s.total < s.sw + s.pitch * 2 && !s.cloned) {
      s.cloned = true;
      const html = s.track.innerHTML; s.track.insertAdjacentHTML('beforeend', html);
      s.frames = $$('.frame', s.el).map(fe => ({ el: fe, img: $('img', fe), vid: $('video', fe), loaded: false, playing: false, x: 0 }));
      s.total = s.pitch * s.frames.length;
      if (s.imgs) loadStripImages(s, true);
    }
    positionStrip(s, 0);
  });
}
function loadStripImages(s, force) {
  if (s.imgs && !force) return;
  s.imgs = true;
  s.frames.forEach(f => {
    if (f.img.src) return;
    f.img.addEventListener('error', () => { // one retry if a request gets dropped
      if (f.img.dataset.retry) return;
      f.img.dataset.retry = '1';
      setTimeout(() => { f.img.src = f.img.dataset.src + '?r=1'; }, 600);
    });
    f.img.src = f.img.dataset.src;
  });
}
function positionStrip(s, dt) {
  const half = s.sw / 2, n0 = ROLLS[s.r].ids.length;
  let best = 1e9, bi = 0;
  for (let i = 0; i < s.frames.length; i++) {
    const f = s.frames[i];
    const x = mod(i * s.pitch + s.off + s.pitch, s.total) - s.pitch;
    const d = Math.abs(x + s.fw / 2 - half);
    if (d < best) { best = d; bi = i; }
    const sc = 1 + 0.06 * Math.max(0, 1 - d / s.pitch);
    f.x = x; f.d = d;
    f.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,0) scale(' + sc.toFixed(4) + ')';
  }
  if (bi !== s.active) {
    if (s.active >= 0 && s.frames[s.active]) s.frames[s.active].el.classList.remove('is-active');
    s.frames[bi].el.classList.add('is-active');
    s.active = bi;
    s.countEl.textContent = pad((bi % n0) + 1);
  }
  // motion: skew + blur proportional to velocity
  const v = (s.drag || s.focusTo !== null) ? s.vel : s.vel - s.drift;
  const sk = RM ? 0 : clamp(-v * 0.0042, -11, 11);
  const bl = RM ? 0 : clamp((Math.abs(v) - 350) / 650, 0, 3.2);
  if (Math.abs(sk - s.last.sk) > 0.05) { s.track.style.transform = Math.abs(sk) < 0.06 ? '' : 'skewX(' + sk.toFixed(2) + 'deg)'; s.last.sk = sk; }
  if (Math.abs(bl - s.last.bl) > 0.05) { s.track.style.filter = bl < 0.06 ? '' : 'blur(' + bl.toFixed(2) + 'px)'; s.last.bl = bl; }
  const bp = mod(s.off, 26).toFixed(1) + 'px';
  s.track.style.backgroundPositionX = bp + ',' + bp;
}
function stripMedia(s) {
  const narrow = innerWidth < 700;
  const vl = (s.sw - innerWidth) / 2;
  for (let i = 0; i < s.frames.length; i++) {
    const f = s.frames[i]; if (!f.vid) continue;
    let want = s.inView && entered && !paused && !lbOpen && !RM && f.x + s.fw > vl && f.x < vl + innerWidth;
    if (want && narrow) want = f.d < s.pitch * 0.9;
    if (want && !f.playing) {
      if (!f.loaded) { f.vid.poster = f.vid.dataset.poster; f.vid.src = f.vid.dataset.src; f.loaded = true; f.vid.addEventListener('playing', () => f.vid.classList.add('on'), { once: true }); }
      const pr = f.vid.play(); if (pr && pr.catch) pr.catch(() => {});
      f.playing = true;
    } else if (!want && f.playing) { f.vid.pause(); f.playing = false; }
  }
}
function bindStrip(s) {
  const el = s.el;
  el.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    s.suppress = false; s.focusTo = null;
    s.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, off0: s.off, lx: e.clientX, lt: performance.now(), axis: null };
  });
  el.addEventListener('click', e => {
    const fe = e.target.closest('.frame');
    if (!fe || s.suppress) { s.suppress = false; return; }
    openLB(fe.dataset.id);
  });
  if (FINE) {
    el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') s.hold = true; });
    el.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') s.hold = false; });
  }
  el.addEventListener('focusin', e => {
    const fe = e.target.closest('.frame');
    s.film.scrollLeft = 0; requestAnimationFrame(() => { s.film.scrollLeft = 0; });
    if (!fe || !fe.matches(':focus-visible')) return;
    const i = s.frames.findIndex(f => f.el === fe);
    // offset that puts frame i in the middle, picked closest to the current one
    const ideal = s.sw / 2 - s.fw / 2 - i * s.pitch;
    s.focusTo = s.off + (mod(ideal - s.off + s.total / 2, s.total) - s.total / 2);
    s.hold = true;
  });
  el.addEventListener('focusout', () => { s.hold = false; });
  el.addEventListener('wheel', e => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 2) return;
    e.preventDefault();
    s.focusTo = null; s.off -= e.deltaX; s.vel = clamp(-e.deltaX * 30, -2500, 2500);
  }, { passive: false });
}
function onStripMove(e) {
  for (const s of STRIPS) {
    const d = s.drag; if (!d || d.id !== e.pointerId) continue;
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (!d.axis && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) d.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
    if (d.axis === 'y' && e.pointerType !== 'mouse') { s.drag = null; continue; }
    if (d.axis) {
      s.suppress = true;
      s.el.classList.add('is-drag');
      s.off = d.off0 + dx;
      const now = performance.now(), dtm = now - d.lt;
      if (dtm > 0) s.vel = s.vel * 0.55 + ((e.clientX - d.lx) / dtm * 1000) * 0.45;
      d.lx = e.clientX; d.lt = now;
    }
  }
}
function onStripUp(e) {
  for (const s of STRIPS) {
    const d = s.drag; if (!d || d.id !== e.pointerId) continue;
    if (performance.now() - d.lt > 90) s.vel *= 0.2; // finger paused before release: no fling
    s.vel = clamp(s.vel, -4200, 4200);
    s.drag = null;
    s.el.classList.remove('is-drag');
    if (e.type === 'pointercancel') s.suppress = false;
  }
}
addEventListener('pointermove', onStripMove, { passive: true });
addEventListener('pointerup', onStripUp);
addEventListener('pointercancel', onStripUp);

let mainRAF = 0, mainLast = 0, mediaTick = 0;
function mainLoop(now) {
  mainRAF = requestAnimationFrame(mainLoop);
  const dt = Math.min(0.05, (now - (mainLast || now)) / 1000); mainLast = now;
  for (const s of STRIPS) {
    if (!s.inView) continue;
    if (s.drag && s.drag.axis) {
      if (now - s.drag.lt > 70) s.vel *= Math.pow(0.0005, dt); // holding still: relax motion blur
    } else if (s.focusTo !== null) {
      const delta = s.focusTo - s.off;
      s.off += delta * (1 - Math.pow(0.0001, dt));
      s.vel = delta * 4;
      if (Math.abs(delta) < 0.5) { s.off = s.focusTo; s.focusTo = null; s.vel = 0; }
    } else {
      const target = (s.hold || paused) ? 0 : s.drift;
      s.vel += (target - s.vel) * (1 - Math.exp(-dt / 0.55));
      s.off += s.vel * dt;
    }
    positionStrip(s, dt);
  }
  if (++mediaTick % 8 === 0) STRIPS.forEach(stripMedia);
}
const stripIO = new IntersectionObserver(entries => {
  entries.forEach(en => {
    const s = STRIPS.find(x => x.el === en.target); if (!s) return;
    s.inView = en.isIntersecting;
    if (s.inView) loadStripImages(s);
    stripMedia(s);
  });
}, { rootMargin: '240px 0px' });

/* =========================================================
   SHORT-FORM DECK
   ========================================================= */
const SHORTS = [
  { id: 'QBg5hXiJkPM', name: '호천당', desc: '춘천 · 돈가스', chips: ['숏폼', '인스타그램', 'IPTV광고'] },
  { id: '2pLN-MgOWME', name: '요거참', desc: '춘천 · 그릭요거트', chips: ['숏폼', '인스타그램'] },
  { id: 'tyO9gJW7UHQ', name: '복건성', desc: '춘천 · 중화요리', chips: ['숏폼', '인스타그램'] },
  { id: 'lbFCdtCGX4Q', name: '모리셔스브라운', desc: '춘천점', chips: ['숏폼', '인스타그램'] }
];
const deck = $('#deck');
deck.innerHTML = SHORTS.map((c, i) =>
  '<article class="card" data-id="' + c.id + '" role="button" aria-label="' + esc(c.name) + ' 숏폼 원본 보기">' +
  '<img src="media/clips/' + c.id + '_v.jpg" alt="" draggable="false" decoding="async">' +
  '<video muted playsinline loop autoplay preload="none" data-src="media/clips/' + c.id + '_v.mp4" poster="media/clips/' + c.id + '_v.jpg"></video>' +
  '<div class="card__top"><i>SHORTS ' + pad(i + 1) + '</i><em>▶ 원본</em></div>' +
  '<div class="card__info"><h3>' + esc(c.name) + '</h3><p>' + esc(c.desc) + '</p><div class="card__chips">' +
  c.chips.map(ch => '<span>' + esc(ch) + '</span>').join('') + '</div></div></article>').join('');
const cards = $$('.card', deck);
$('#deckTotal').textContent = pad(cards.length);
let topI = 0, deckBusy = false, deckInView = false, dd = null, deckSuppress = false;
function kTransform(k) {
  if (k === 0) return 'translate3d(0,0,0) rotate(0deg) scale(1)';
  const rot = k === 1 ? 4.5 : k === 2 ? -3.5 : 0;
  return 'translate3d(' + (k * 16) + 'px,' + (k * -12) + 'px,0) rotate(' + rot + 'deg) scale(' + (1 - k * 0.06) + ')';
}
function applyK(c, k) {
  c.style.zIndex = String(10 - k);
  c.style.opacity = k > 2 ? '0' : '1';
  c.style.transform = kTransform(k);
}
function deckLayout(skip) {
  const n = cards.length;
  cards.forEach((c, i) => {
    const k = mod(i - topI, n);
    c.tabIndex = k === 0 ? 0 : -1;
    c.setAttribute('aria-hidden', k === 0 ? 'false' : 'true');
    if (c !== skip) applyK(c, k);
  });
  $('#deckIdx').textContent = pad(topI + 1);
  $('#deckName').textContent = SHORTS[topI].name;
  deckMedia();
}
function deckMedia() {
  cards.forEach((c, i) => {
    const v = $('video', c);
    const want = i === topI && deckInView && entered && !lbOpen && !RM;
    if (want) {
      if (!v.src) { v.src = v.dataset.src; v.addEventListener('playing', () => v.classList.add('on'), { once: true }); }
      const pr = v.play(); if (pr && pr.catch) pr.catch(() => {});
    } else if (!v.paused) v.pause();
  });
}
function deckNext(dir) {
  if (deckBusy) return;
  deckBusy = true;
  const c = cards[topI];
  c.classList.remove('dragging');
  c.style.transition = 'transform .5s cubic-bezier(.2,.7,.3,1), opacity .35s .12s';
  c.style.transform = 'translate3d(' + (dir * 135) + '%,-5%,0) rotate(' + (dir * 20) + 'deg)';
  c.style.opacity = '0';
  topI = mod(topI + 1, cards.length);
  deckLayout(c);
  setTimeout(() => {
    c.style.transition = 'none';
    applyK(c, mod(cards.indexOf(c) - topI, cards.length));
    void c.offsetWidth;
    c.style.transition = '';
    deckBusy = false;
  }, RM ? 30 : 470);
}
function deckPrev() {
  if (deckBusy) return;
  deckBusy = true;
  topI = mod(topI - 1, cards.length);
  const c = cards[topI];
  c.style.transition = 'none';
  c.style.transform = 'translate3d(-135%,-5%,0) rotate(-20deg)';
  c.style.opacity = '0';
  c.style.zIndex = '20';
  void c.offsetWidth;
  c.style.transition = '';
  deckLayout();
  setTimeout(() => { deckBusy = false; }, RM ? 30 : 470);
}
$('#deckNext').addEventListener('click', () => deckNext(-1));
$('#deckPrev').addEventListener('click', deckPrev);
deck.addEventListener('pointerdown', e => {
  const c = e.target.closest('.card');
  if (!c || c !== cards[topI] || deckBusy) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  deckSuppress = false;
  dd = { id: e.pointerId, c, x0: e.clientX, y0: e.clientY, dx: 0, axis: null, lx: e.clientX, lt: performance.now(), v: 0 };
  try { c.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
});
deck.addEventListener('pointermove', e => {
  if (!dd || dd.id !== e.pointerId) return;
  const dx = e.clientX - dd.x0, dy = e.clientY - dd.y0;
  if (!dd.axis && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) dd.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
  if (dd.axis === 'y' && e.pointerType !== 'mouse') { dd = null; return; }
  if (!dd.axis) return;
  deckSuppress = true;
  dd.dx = dx;
  const now = performance.now(), dtm = now - dd.lt;
  if (dtm > 0) dd.v = dd.v * 0.5 + ((e.clientX - dd.lx) / dtm * 1000) * 0.5;
  dd.lx = e.clientX; dd.lt = now;
  dd.c.classList.add('dragging');
  dd.c.style.transform = 'translate3d(' + dx + 'px,' + (dy * 0.12) + 'px,0) rotate(' + (dx * 0.055) + 'deg)';
});
function deckUp(e) {
  if (!dd || dd.id !== e.pointerId) return;
  const { c, dx } = dd;
  const v = performance.now() - dd.lt > 100 ? 0 : dd.v;
  const fling = e.type !== 'pointercancel' && (Math.abs(dx) > deck.offsetWidth * 0.28 || (Math.abs(v) > 650 && Math.abs(dx) > 20));
  dd = null;
  c.classList.remove('dragging');
  if (fling) deckNext(Math.sign(dx || v) || -1); else applyK(c, 0);
}
deck.addEventListener('pointerup', deckUp);
deck.addEventListener('pointercancel', deckUp);
deck.addEventListener('click', e => {
  const c = e.target.closest('.card');
  if (!c || c !== cards[topI]) return;
  if (deckSuppress) { deckSuppress = false; return; }
  openLB(c.dataset.id, true);
});
deck.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') { e.preventDefault(); deckNext(-1); requestAnimationFrame(() => cards[topI].focus()); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); deckPrev(); requestAnimationFrame(() => cards[topI].focus()); }
  else if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('card')) { e.preventDefault(); openLB(e.target.dataset.id, true); }
});
new IntersectionObserver(en => { deckInView = en[0].isIntersecting; deckMedia(); }, { threshold: 0.2 }).observe($('#shorts'));
// IPTV ads (real works with IPTV in the title)
$('#iptvList').innerHTML = D.works.filter(w => /IPTV/.test(w.t)).map(w =>
  '<button class="iptv__item" type="button" data-id="' + w.id + '"><img src="media/thumbs/' + w.id + '.jpg" alt="" loading="lazy">' +
  esc(w.t.replace(/\s*IPTV 광고/, '')) + '</button>').join('');
$('#iptvList').addEventListener('click', e => { const b = e.target.closest('.iptv__item'); if (b) openLB(b.dataset.id); });

/* =========================================================
   FIELDS — big category type + filterable grid
   ========================================================= */
const catsEl = $('#cats'), filterEl = $('#filter'), grid = $('#grid'), moreBtn = $('#moreBtn');
let curCat = 'all', expanded = false;
catsEl.innerHTML = D.cats.map((c, i) =>
  '<li><button class="cat" type="button" data-cat="' + c.key + '" aria-controls="grid"><span class="cat__idx">' + pad(i + 1) +
  '</span><span class="cat__name">' + esc(c.name) + '</span><sup>' + c.n + '</sup><span class="cat__arrow" aria-hidden="true">→</span></button></li>').join('');
filterEl.innerHTML = '<button class="fchip" type="button" data-cat="all">전체<sup>' + D.works.length + '</sup></button>' +
  D.cats.map(c => '<button class="fchip" type="button" data-cat="' + c.key + '">' + esc(c.name) + '<sup>' + c.n + '</sup></button>').join('');
function renderGrid() {
  const list = curCat === 'all' ? D.works : D.works.filter(w => w.cat === curCat);
  const show = curCat === 'all' && !expanded ? list.slice(0, 12) : list;
  grid.innerHTML = show.map((w, i) =>
    '<button class="tile" type="button" data-id="' + w.id + '" style="--d:' + (Math.min(i, 14) * 0.035).toFixed(3) + 's">' +
    '<span class="tile__img"><img src="media/thumbs/' + w.id + '.jpg" alt="" loading="lazy" decoding="async" width="480" height="270"></span>' +
    '<span class="tile__meta"><b>' + esc(w.t) + '</b><span>' + esc(sub(w) || 'FREE2FLY') + '</span><em class="tile__cat">' + esc(catName[w.cat]) + '</em></span></button>').join('');
  moreBtn.hidden = !(curCat === 'all' && !expanded);
  moreBtn.textContent = '전체 ' + list.length + '편 모두 보기 ↓';
  $$('.fchip', filterEl).forEach(b => { const on = b.dataset.cat === curCat; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  $$('.cat', catsEl).forEach(b => { const on = b.dataset.cat === curCat; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
}
function setCat(key, scroll) {
  curCat = key; expanded = false; renderGrid();
  const chip = $('.fchip.on', filterEl);
  if (chip) filterEl.scrollTo({ left: chip.offsetLeft - 20, behavior: RM ? 'auto' : 'smooth' });
  if (scroll) filterEl.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' });
}
catsEl.addEventListener('click', e => { const b = e.target.closest('.cat'); if (b) setCat(curCat === b.dataset.cat ? 'all' : b.dataset.cat, true); });
filterEl.addEventListener('click', e => { const b = e.target.closest('.fchip'); if (b) setCat(b.dataset.cat, false); });
grid.addEventListener('click', e => { const t = e.target.closest('.tile'); if (t) openLB(t.dataset.id); });
moreBtn.addEventListener('click', () => { expanded = true; renderGrid(); const t = $$('.tile', grid)[12]; if (t) t.focus({ preventScroll: true }); });
renderGrid();
// hover peek (desktop)
const peek = $('#peek'), peekImg = $('img', peek);
let peekOn = false, peekCat = '', peekIdx = 0, peekTimer = 0, pk = { x: 0, y: 0, tx: 0, ty: 0 }, peekRAF = 0;
function peekLoop() {
  pk.x += (pk.tx - pk.x) * 0.2; pk.y += (pk.ty - pk.y) * 0.2;
  peek.style.left = pk.x.toFixed(1) + 'px'; peek.style.top = pk.y.toFixed(1) + 'px';
  peekRAF = peekOn || Math.abs(pk.tx - pk.x) > 0.5 ? requestAnimationFrame(peekLoop) : 0;
}
function showPeek(key) {
  if (peekCat === key && peekOn) return;
  peekCat = key; peekIdx = 0;
  const list = D.works.filter(w => w.cat === key);
  const swap = () => { const w = list[peekIdx++ % list.length]; if (w) peekImg.src = 'media/thumbs/' + w.id + '.jpg'; };
  clearInterval(peekTimer); swap();
  if (!RM) peekTimer = setInterval(swap, 700);
  peekOn = true; peek.classList.add('on');
  if (!peekRAF) peekRAF = requestAnimationFrame(peekLoop);
}
function hidePeek() { peekOn = false; peekCat = ''; clearInterval(peekTimer); peek.classList.remove('on'); }
if (FINE) {
  catsEl.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    pk.tx = e.clientX + 170; pk.ty = e.clientY;
    if (!peekOn) { pk.x = pk.tx; pk.y = pk.ty; }
    const b = e.target.closest('.cat'); if (b) showPeek(b.dataset.cat); else hidePeek();
  });
  catsEl.addEventListener('pointerleave', hidePeek);
  addEventListener('scroll', () => { if (peekOn) hidePeek(); }, { passive: true });
}

/* =========================================================
   INQUIRY — chips + contact, no network: fun success state
   ========================================================= */
const form = $('#form'), done = $('#done');
const F_CATS = ['기업·브랜드 홍보', '행사·스케치', '기관·관공서', '공연·기록', '매장 숏폼·IPTV 광고', '웨딩·돌잔치', '유튜브·SNS', '펜션·숙소', '아직 모르겠어요'];
const F_BUDGET = ['100만원 미만', '100~300만원', '300~500만원', '500만원 이상', '상담 후 결정'];
$('#fCats').innerHTML = F_CATS.map(t => '<button class="chip" type="button" aria-pressed="false">' + t + '</button>').join('');
$('#fBudget').innerHTML = F_BUDGET.map(t => '<button class="chip" type="button" aria-pressed="false">' + t + '</button>').join('');
$('#fCats').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  const on = !b.classList.contains('on'); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
});
$('#fBudget').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  $$('.chip', $('#fBudget')).forEach(x => { const on = x === b && !x.classList.contains('on'); x.classList.toggle('on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
});
const fName = form.elements.namedItem('name'), fTel = form.elements.namedItem('tel'), fMsg = form.elements.namedItem('msg');
[fName, fTel].forEach(inp => inp.addEventListener('input', () => { inp.closest('.field').classList.remove('err'); $('#formErr').textContent = ''; }));
let summaryText = '';
form.addEventListener('submit', e => {
  e.preventDefault();
  const name = fName.value.trim(), tel = fTel.value.trim(), digits = tel.replace(/\D/g, '');
  const errs = [];
  if (!name) { errs.push('이름이나 회사명을 적어 주세요.'); fName.closest('.field').classList.add('err'); }
  if (digits.length < 9) { errs.push('연락 받을 번호를 확인해 주세요.'); fTel.closest('.field').classList.add('err'); }
  if (errs.length) { $('#formErr').textContent = errs.join(' '); (name ? fTel : fName).focus(); return; }
  const cats = $$('.chip.on', $('#fCats')).map(b => b.textContent);
  const budget = ($('.chip.on', $('#fBudget')) || {}).textContent || '';
  const rows = [['영상', cats.join(', ') || '상담하며 정할게요'], ['예산', budget || '상담 후 결정'], ['이름', name], ['연락처', tel]];
  if (fMsg.value.trim()) rows.push(['내용', fMsg.value.trim()]);
  $('#sum').innerHTML = rows.map(r => '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>').join('');
  summaryText = '[프리투플라이 영상 문의]\n' + rows.map(r => r[0] + ': ' + r[1]).join('\n');
  const btn = $('.submit', form).getBoundingClientRect();
  form.hidden = true; done.hidden = false; $('#copied').textContent = '';
  done.focus({ preventScroll: true });
  const top = done.getBoundingClientRect().top;
  if (top < 70 || top > innerHeight * 0.7) done.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' });
  confetti(btn.left + btn.width / 2, btn.top + btn.height / 2);
});
$('#resetBtn').addEventListener('click', () => {
  form.reset(); $$('.chip.on', form).forEach(b => { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); });
  done.hidden = true; form.hidden = false; fName.focus();
});
$('#kakaoGo').addEventListener('click', () => {
  const ok = () => { $('#copied').textContent = '문의 내용이 복사됐어요. 카카오톡 채팅창에 붙여 넣어 주세요.'; };
  try {
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(summaryText).then(ok, () => {});
    else { const ta = document.createElement('textarea'); ta.value = summaryText; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); if (document.execCommand('copy')) ok(); ta.remove(); }
  } catch (err) { /* clipboard is optional */ }
});
function confetti(x, y) {
  if (RM || !Element.prototype.animate) return;
  const cols = ['#ffb03a', '#32bbff', '#f4eee4', '#fee500', '#ff7b1c'];
  for (let i = 0; i < 44; i++) {
    const el = document.createElement('i');
    el.className = 'confetti'; el.style.background = cols[i % cols.length];
    if (i % 3 === 0) { el.style.width = '7px'; el.style.height = '7px'; el.style.borderRadius = '50%'; }
    body.appendChild(el);
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.95, sp = 260 + Math.random() * 380;
    const dx = Math.cos(a) * sp, dy = Math.sin(a) * sp, rot = (Math.random() - 0.5) * 1000;
    const an = el.animate([
      { transform: 'translate(' + x + 'px,' + y + 'px) rotate(0deg)', opacity: 1 },
      { transform: 'translate(' + (x + dx * 0.85) + 'px,' + (y + dy * 0.85) + 'px) rotate(' + (rot * 0.5) + 'deg)', opacity: 1, offset: 0.4 },
      { transform: 'translate(' + (x + dx) + 'px,' + (y + dy + 460) + 'px) rotate(' + rot + 'deg)', opacity: 0 }
    ], { duration: 1500 + Math.random() * 700, easing: 'cubic-bezier(.15,.6,.4,1)' });
    an.onfinish = () => el.remove();
  }
}

/* =========================================================
   REVEAL + MEDIA SYNC + BOOT
   ========================================================= */
const revIO = new IntersectionObserver(en => en.forEach(x => { if (x.isIntersecting) { x.target.classList.add('in'); revIO.unobserve(x.target); } }), { threshold: 0.12 });
$$('.rv').forEach(el => revIO.observe(el));
function syncMedia() { STRIPS.forEach(stripMedia); deckMedia(); }
document.addEventListener('visibilitychange', () => { paused = document.hidden; syncMedia(); });

function startMain() {
  if (!mainRAF) mainRAF = requestAnimationFrame(mainLoop);
  syncMedia();
}
buildStrips();
deckLayout();
STRIPS.forEach(s => stripIO.observe(s.el));
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
const hashEl = location.hash && location.hash.length > 1 ? document.getElementById(location.hash.slice(1)) : null;
if (hashEl) {
  enter(true);
  requestAnimationFrame(() => hashEl.scrollIntoView());
} else {
  scrollTo(0, 0);
  bootIntro();
}
})();
