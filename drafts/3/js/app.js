/* FREE2FLY — film strip showroom */
(() => {
'use strict';
const D = window.F2F || { cats: [], works: [] };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
const SMOOTH = FINE && !RM;
const pad = n => String(n).padStart(2, '0');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mod = (a, n) => ((a % n) + n) % n;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerpK = (base, dt) => 1 - Math.pow(1 - base, dt * 60);
const expoOut = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  return x => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 24; i++) {
      const v = ((ax * t + bx) * t + cx) * t;
      if (Math.abs(v - x) < 1e-5) break;
      if (v < x) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return ((ay * t + by) * t + cy) * t;
  };
}
const easeIO = bezier(0.76, 0, 0.24, 1);
const byId = {}; D.works.forEach(w => { byId[w.id] = w; });
const catName = {}; D.cats.forEach(c => { catName[c.key] = c.name; });
const sub = w => [w.c, w.r].filter(Boolean).join(' · ');
const body = document.body;
let entered = false;
let lbOpen = false;
const sm = { y: 0, ty: 0, max: 0, set: -9, anim: null, lock: 0 };

function wrapMask(n, mc, ic) {
  const m = document.createElement('span'), i = document.createElement('span');
  m.className = mc || 'wm'; i.className = ic || 'wi';
  n.parentNode.insertBefore(m, n);
  m.appendChild(i); i.appendChild(n);
  return i;
}
function splitWords(el) {
  Array.from(el.childNodes).forEach(n => {
    if (n.nodeType === 3) {
      n.textContent.split(/(\s+)/).filter(Boolean).forEach(p => {
        const t = document.createTextNode(p);
        el.insertBefore(t, n);
        if (/\S/.test(p)) wrapMask(t);
      });
      el.removeChild(n);
    } else if (n.nodeType === 1 && n.tagName !== 'BR') wrapMask(n);
  });
  el.classList.add('split');
  return el;
}
function groupLines(el) {
  let top = null, li = -1;
  $$('.wm', el).forEach(m => {
    const t = m.offsetTop;
    if (top === null || Math.abs(t - top) > 4) { li++; top = t; }
    m.style.setProperty('--li', Math.min(li, 7));
  });
}
function maskKicker(k) {
  const kids = Array.from(k.childNodes).filter(n => !(n.nodeType === 1 && n.classList.contains('dot')));
  const m = document.createElement('span'), i = document.createElement('span');
  m.className = 'km'; i.className = 'ki';
  kids.forEach(n => i.appendChild(n));
  m.appendChild(i); k.appendChild(m);
  return i;
}
function prepCount(el) {
  Array.from(el.childNodes).forEach(n => {
    if (n.nodeType !== 3 || !/\d/.test(n.textContent)) return;
    const s = document.createElement('span');
    s.innerHTML = esc(n.textContent).replace(/\d+/g, d => '<span class="cnt" data-to="' + d + '" style="min-width:' + d.length + 'ch">' + d + '</span>');
    while (s.firstChild) el.insertBefore(s.firstChild, n);
    el.removeChild(n);
  });
}
function rollHTML(t, chars) {
  const layer = chars ? Array.from(t).map((c, i) => '<i style="--i:' + i + '">' + esc(c) + '</i>').join('') : esc(t);
  return '<span class="roll' + (chars ? ' ch' : '') + '"><span>' + layer + '</span><span aria-hidden="true">' + layer + '</span></span>';
}

/* =========================================================
   LIGHTBOX (YouTube nocookie) — ESC / backdrop / back button
   ========================================================= */
const lb = $('#lb'), lbPlayer = $('#lbPlayer');
let lbPushed = false, lbOpener = null, lbTimer = 0, lbSrc = null, lbGhost = null, lbBase = null;
const flipT = (a, b) => 'translate3d(' + (a.left - b.left).toFixed(1) + 'px,' + (a.top - b.top).toFixed(1) + 'px,0) scale(' +
  (a.width / b.width).toFixed(4) + ',' + (a.height / b.height).toFixed(4) + ')';
function lbFrame(id, w) {
  lbPlayer.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) +
    '?autoplay=1&rel=0&playsinline=1" title="' + esc(w.t) + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen"></iframe>';
  lb.classList.add('ready');
}
function killGhost() {
  if (lbGhost) { lbGhost.remove(); lbGhost = null; }
  if (lbSrc) { lbSrc.classList.remove('lb-src'); lbSrc = null; }
}
function openLB(id, vertical, from) {
  const w = byId[id]; if (!w) return;
  clearTimeout(lbTimer);
  killGhost();
  lbOpener = document.activeElement;
  const img = from ? (from.tagName === 'IMG' ? from : $('img', from)) : null;
  const a = img ? from.getBoundingClientRect() : null;
  lb.classList.remove('ready');
  lb.classList.toggle('v', !!vertical);
  lbPlayer.innerHTML = '';
  $('#lbTitle').textContent = w.t;
  $('#lbSub').textContent = [w.c, w.r, catName[w.cat]].filter(Boolean).join(' · ');
  lb.hidden = false;
  body.classList.add('lb-open');
  lbOpen = true;
  setCur('');
  const b = lbPlayer.getBoundingClientRect();
  if (!RM && img && img.getAttribute('src') && a.width > 0 && b.width > 0 && a.bottom > 0 && a.top < innerHeight && lb.animate) {
    lbSrc = from; lbBase = b;
    lbGhost = document.createElement('div');
    lbGhost.className = 'lb__ghost';
    lbGhost.style.cssText = 'left:' + b.left + 'px;top:' + b.top + 'px;width:' + b.width + 'px;height:' + b.height + 'px';
    lbGhost.innerHTML = '<img alt="" src="' + esc(img.currentSrc || img.src) + '">';
    lb.insertBefore(lbGhost, $('.lb__box', lb));
    from.classList.add('lb-src');
    lbGhost.animate([{ transform: flipT(a, b) }, { transform: 'none' }], { duration: 820, easing: 'cubic-bezier(.76,0,.24,1)', fill: 'both' })
      .onfinish = () => { if (lbOpen) lbFrame(id, w); };
  } else lbFrame(id, w);
  requestAnimationFrame(() => requestAnimationFrame(() => lb.classList.add('on')));
  try { history.pushState({ f2fLb: 1 }, ''); lbPushed = true; } catch (e) { lbPushed = false; }
  $('.lb__x', lb).focus({ preventScroll: true });
  syncMedia();
}
function closeLB(fromPop) {
  if (!lbOpen) return;
  lbOpen = false;
  lb.classList.remove('on', 'ready');
  body.classList.remove('lb-open');
  lbPlayer.innerHTML = '';
  const back = () => { if (lbOpener && lbOpener.focus) lbOpener.focus({ preventScroll: true }); };
  if (lbGhost && !RM) {
    const g = lbGhost, cur0 = getComputedStyle(g).transform;
    g.getAnimations().forEach(x => x.cancel());
    const start = cur0 && cur0 !== 'none' ? cur0 : 'none';
    const r = lbSrc && lbSrc.isConnected ? lbSrc.getBoundingClientRect() : null;
    const hit = r && r.width > 0 && r.bottom > 0 && r.top < innerHeight;
    const dur = hit ? 720 : 480;
    g.animate(hit ? [{ transform: start }, { transform: flipT(r, lbBase) }]
      : [{ transform: start, clipPath: 'inset(0 0 0 0)' }, { transform: 'translate3d(0,18%,0)', clipPath: 'inset(100% 0 0 0)' }],
    { duration: dur, easing: 'cubic-bezier(.76,0,.24,1)', fill: 'forwards' });
    lbTimer = setTimeout(() => { lb.hidden = true; lbPlayer.innerHTML = ''; killGhost(); back(); }, dur);
  } else {
    killGhost();
    lbTimer = setTimeout(() => { lb.hidden = true; lbPlayer.innerHTML = ''; }, 400);
    back();
  }
  if (!fromPop && lbPushed) { lbPushed = false; history.back(); } else lbPushed = false;
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
const PCOL = ['#f4eee4', '#32bbff', '#ffb03a'];
let W = 0, H = 0, P = [], introRAF = 0, phase = 'form', tBurst = 0, lastT = 0, t0 = 0;
let ptr = { x: -1e4, y: -1e4 }, touched = false, textBox = { cx: 0, cy: 0, w: 0 };
$$('.intro__tag, .intro__hint').forEach(el => {
  const i = document.createElement('span'); i.className = 'ii';
  while (el.firstChild) i.appendChild(el.firstChild);
  el.appendChild(i);
});
const enterBtn = $('#enterBtn');
if (enterBtn.firstChild && enterBtn.firstChild.nodeType === 3) {
  const t = enterBtn.firstChild.textContent.trim();
  const s = document.createElement('span');
  s.innerHTML = rollHTML(t, true);
  enterBtn.replaceChild(s.firstChild, enterBtn.firstChild);
}

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
  tickMag(now, dt / 1000);
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
    const damp = Math.pow(0.95, f);
    for (let i = 0; i < P.length; i++) { const p = P[i]; p.vx *= damp; p.vy *= damp; p.x += p.vx * f; p.y += p.vy * f; }
    drawParticles(1);
    if (tBurst > 1000) stopIntro();
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
  sm.lock = instant ? 0 : performance.now() + 1000;
  if (!instant && !RM) {
    stripsEl.classList.add('slide');
    STRIPS.forEach(s => { s.vel = s.drift * 28; });
    setTimeout(() => stripsEl.classList.remove('slide'), 2800);
  }
  body.classList.remove('is-intro');
  if (instant || RM) {
    intro.classList.add('out');
    setTimeout(stopIntro, instant ? 0 : 700);
  } else {
    phase = 'burst'; tBurst = 0;
    const cx = W / 2, gy = H / 2;
    for (let i = 0; i < P.length; i++) {
      const p = P[i], dx = p.x - cx, dy = p.y - gy, d = Math.hypot(dx, dy) || 1, sp = 6 + Math.random() * 16;
      p.vx = dx / d * sp * 0.5 + (Math.random() - 0.5) * 4;
      p.vy = (dy < 0 ? -1 : 1) * (9 + Math.random() * 20) + dy / d * sp * 0.4;
    }
    intro.style.setProperty('--gh', (H / 2) + 'px');
    intro.classList.add('out');
    setTimeout(stopIntro, 1100);
  }
  if (!instant) $('#showroom').focus({ preventScroll: true });
  startMain();
}
enterBtn.addEventListener('click', () => enter(false));
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
    SPLITS.forEach(groupLines);
    measure();
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
   SMOOTH WHEEL SCROLL (fine pointer only)
   ========================================================= */
function innerScroll(el, dy) {
  for (; el && el.nodeType === 1 && el !== body && el !== document.documentElement; el = el.parentElement) {
    if (el.scrollHeight <= el.clientHeight + 1) continue;
    const oy = getComputedStyle(el).overflowY;
    if (oy !== 'auto' && oy !== 'scroll') continue;
    if (dy > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0) return true;
  }
  return false;
}
function smWrite(y) { sm.set = y; scrollTo(0, y); }
function smoothTick(now, dt) {
  if (!entered || lbOpen) return;
  if (sm.anim) {
    const a = sm.anim, p = clamp((now - a.t0) / a.dur, 0, 1);
    sm.y = sm.ty = a.from + (a.to - a.from) * easeIO(p);
    if (p >= 1) sm.anim = null;
    smWrite(sm.y);
  } else if (Math.abs(sm.ty - sm.y) > 0.3) {
    sm.y += (sm.ty - sm.y) * lerpK(0.1, dt);
    if (Math.abs(sm.ty - sm.y) <= 0.3) sm.y = sm.ty;
    smWrite(sm.y);
  }
}
function scrollToY(y) {
  const max = Math.max(0, document.documentElement.scrollHeight - innerHeight);
  y = clamp(Math.round(y), 0, max);
  if (SMOOTH && entered) {
    sm.max = max;
    sm.y = scrollY;
    sm.anim = { from: scrollY, to: y, t0: performance.now(), dur: clamp(900 + Math.abs(y - scrollY) * 0.18, 900, 1600) };
  } else scrollTo({ top: y, behavior: RM ? 'auto' : 'smooth' });
}
function scrollToEl(el, block) {
  const r = el.getBoundingClientRect();
  const m = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  scrollToY(block === 'center' ? scrollY + r.top - (innerHeight - r.height) / 2 : scrollY + r.top - m);
}
if (SMOOTH) {
  document.documentElement.classList.add('ss');
  addEventListener('wheel', e => {
    if (!entered || lbOpen || e.ctrlKey) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (innerScroll(e.target, e.deltaY)) return;
    e.preventDefault();
    if (performance.now() < sm.lock) return;
    const d = clamp(e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1), -240, 240);
    if (sm.anim) { sm.anim = null; sm.ty = sm.y; }
    sm.ty = clamp(sm.ty + d, 0, sm.max);
  }, { passive: false });
  addEventListener('scroll', () => {
    if (Math.abs(scrollY - sm.set) > 2) { sm.y = sm.ty = scrollY; sm.anim = null; }
  }, { passive: true });
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || !entered || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const id = a.getAttribute('href').slice(1), t = id && document.getElementById(id);
    if (!t) return;
    e.preventDefault();
    scrollToEl(t);
  });
}

/* =========================================================
   MAGNETIC CTA + CURSOR LABEL (fine pointer only)
   ========================================================= */
const MAGS = [];
let magLast = 0;
function magnet(el, max) {
  if (!FINE || RM || !el) return;
  const m = { el, max, inner: $$(':scope > b, :scope > svg, :scope > .roll, :scope > span:not(.kakao-fab__qr)', el), x: 0, y: 0, tx: 0, ty: 0 };
  MAGS.push(m);
  el.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    if (e.target.closest('.kakao-fab__qr')) { m.tx = 0; m.ty = 0; return; }
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2 - m.x, cy = r.top + r.height / 2 - m.y;
    m.tx = clamp((e.clientX - cx) / (r.width / 2), -1, 1) * max;
    m.ty = clamp((e.clientY - cy) / (r.height / 2), -1, 1) * max;
  });
  el.addEventListener('pointerleave', () => { m.tx = 0; m.ty = 0; });
}
function tickMag(now, dt) {
  if (now === magLast) return;
  magLast = now;
  const k = lerpK(0.12, dt);
  for (const m of MAGS) {
    if (m.x === m.tx && m.y === m.ty) continue;
    m.x += (m.tx - m.x) * k; m.y += (m.ty - m.y) * k;
    if (Math.abs(m.tx - m.x) < 0.02 && Math.abs(m.ty - m.y) < 0.02) { m.x = m.tx; m.y = m.ty; }
    const idle = m.x === 0 && m.y === 0;
    m.el.style.translate = idle ? '' : m.x.toFixed(2) + 'px ' + m.y.toFixed(2) + 'px';
    m.inner.forEach(n => { n.style.translate = idle ? '' : (m.x * 0.5).toFixed(2) + 'px ' + (m.y * 0.5).toFixed(2) + 'px'; });
  }
}
const cur = FINE ? document.createElement('div') : null;
const cu = { x: -200, y: -200, rx: -200, ry: -200, on: false, label: '', wx: 0, wy: 0, wrx: 0, wry: 0 };
let curDot = null, curRw = null, curB = null;
if (cur) {
  cur.className = 'cur';
  cur.setAttribute('aria-hidden', 'true');
  cur.innerHTML = '<span class="cur__rw"><span class="cur__ring"><b>DRAG</b></span></span><i class="cur__dot"></i>';
  body.appendChild(cur);
  curDot = $('.cur__dot', cur); curRw = $('.cur__rw', cur); curB = $('b', cur);
  document.documentElement.classList.add('has-cur');
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    cu.x = e.clientX; cu.y = e.clientY;
    const t = e.target instanceof Element ? e.target : null;
    let label = '';
    if (t && t.closest('.strip')) label = t.closest('.frame.is-active') ? 'PLAY' : 'DRAG';
    else if (t && t.closest('.deck .card')) label = 'DRAG';
    else if (t && t.closest('.tile')) label = 'PLAY';
    setCur(label);
  }, { passive: true });
  addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') cur.classList.add('down'); });
  addEventListener('pointerup', () => cur.classList.remove('down'));
  document.documentElement.addEventListener('mouseleave', () => setCur(''));
}
function setCur(label) {
  if (!cur) return;
  const on = !!label && entered && !lbOpen;
  if (on && label !== cu.label) { curB.textContent = label; cu.label = label; }
  if (on !== cu.on) {
    if (on) { cu.rx = cu.x; cu.ry = cu.y; }
    cu.on = on;
    cur.classList.toggle('on', on);
  }
}
function tickCursor(dt) {
  if (!cur) return;
  const k = lerpK(0.2, dt);
  cu.rx += (cu.x - cu.rx) * k; cu.ry += (cu.y - cu.ry) * k;
  if (cu.x !== cu.wx || cu.y !== cu.wy) { curDot.style.transform = 'translate3d(' + cu.x + 'px,' + cu.y + 'px,0)'; cu.wx = cu.x; cu.wy = cu.y; }
  if (Math.abs(cu.rx - cu.wrx) > 0.05 || Math.abs(cu.ry - cu.wry) > 0.05) {
    curRw.style.transform = 'translate3d(' + cu.rx.toFixed(1) + 'px,' + cu.ry.toFixed(1) + 'px,0)';
    cu.wrx = cu.rx; cu.wry = cu.ry;
  }
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
      inView: false, imgs: false, active: -1, suppress: false, fw: 0, pitch: 0, total: 0, sw: 0, last: { sk: 99 }
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
  const sk = RM ? 0 : clamp(-v * 0.0011, -3, 3);
  if (Math.abs(sk - s.last.sk) > 0.02) { s.track.style.transform = Math.abs(sk) < 0.03 ? '' : 'skewX(' + sk.toFixed(2) + 'deg)'; s.last.sk = sk; }
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
    openLB(fe.dataset.id, false, fe);
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

let mainRAF = 0, mainLast = 0, mediaTick = 0, lastSY = -1, sVel = 0;
function mainLoop(now) {
  mainRAF = requestAnimationFrame(mainLoop);
  const dt = Math.min(0.05, (now - (mainLast || now)) / 1000); mainLast = now;
  if (SMOOTH) smoothTick(now, dt);
  const sy = scrollY;
  if (lastSY < 0) lastSY = sy;
  if (dt > 0) sVel += ((sy - lastSY) / dt - sVel) * lerpK(0.25, dt);
  lastSY = sy;
  const still = paused || !lb.hidden;
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
      const target = (s.hold || still) ? 0 : s.drift;
      s.vel += (target - s.vel) * (1 - Math.exp(-dt / 0.55));
      s.off += s.vel * dt;
    }
    positionStrip(s, dt);
  }
  if (++mediaTick % 8 === 0) STRIPS.forEach(stripMedia);
  tickMag(now, dt);
  tickCursor(dt);
  tickPeek(dt);
  tickMarquee(dt);
  tickFooter(sy);
  tickCounters(now);
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
if (!RM) deck.classList.add('pre');
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
  c.style.transition = 'transform .6s cubic-bezier(.19,1,.22,1), opacity .3s .16s';
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
  openLB(c.dataset.id, true, c);
});
deck.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') { e.preventDefault(); deckNext(-1); requestAnimationFrame(() => cards[topI].focus()); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); deckPrev(); requestAnimationFrame(() => cards[topI].focus()); }
  else if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('card')) { e.preventDefault(); openLB(e.target.dataset.id, true, e.target); }
});
new IntersectionObserver(en => {
  deckInView = en[0].isIntersecting;
  if (deckInView && deck.classList.contains('pre')) {
    cards.forEach((c, i) => { c.style.setProperty('--cd', ((2 - Math.min(mod(i - topI, cards.length), 2)) * 0.09).toFixed(2) + 's'); });
    deck.classList.remove('pre');
  }
  deckMedia();
}, { threshold: 0.2 }).observe($('#shorts'));
// IPTV ads (real works with IPTV in the title)
$('#iptvList').innerHTML = D.works.filter(w => /IPTV/.test(w.t)).map(w =>
  '<button class="iptv__item" type="button" data-id="' + w.id + '"><img src="media/thumbs/' + w.id + '.jpg" alt="" loading="lazy">' +
  esc(w.t.replace(/\s*IPTV 광고/, '')) + '</button>').join('');
$('#iptvList').addEventListener('click', e => { const b = e.target.closest('.iptv__item'); if (b) openLB(b.dataset.id, false, $('img', b)); });
const mq = $('.shorts__marquee div');
let mqW = 0, mqX = 0, mqDir = -1, mqDirT = -1, mqSp = 0, mqOn = false, mqHover = false;
new IntersectionObserver(en => { mqOn = en[0].isIntersecting; }).observe($('.shorts__panel'));
if (FINE) {
  $('.shorts__panel').addEventListener('pointerenter', () => { mqHover = true; });
  $('.shorts__panel').addEventListener('pointerleave', () => { mqHover = false; });
}
function tickMarquee(dt) {
  if (RM || !mqOn || !mqW) return;
  if (sVel > 30) mqDirT = -1; else if (sVel < -30) mqDirT = 1;
  mqDir += (mqDirT - mqDir) * lerpK(0.05, dt);
  const target = (mqW / 26 + Math.min(Math.abs(sVel), 4000) * 0.35) * (mqHover ? 0.3 : 1);
  mqSp += (target - mqSp) * lerpK(0.06, dt);
  mqX = mod(mqX + mqSp * mqDir * dt, mqW);
  mq.style.transform = 'translate3d(' + (mqX - mqW).toFixed(1) + 'px,0,0)';
}

/* =========================================================
   FIELDS — big category type + filterable grid
   ========================================================= */
const catsEl = $('#cats'), filterEl = $('#filter'), grid = $('#grid'), moreBtn = $('#moreBtn');
let curCat = 'all', expanded = false;
function staggerIO(step) {
  const io = new IntersectionObserver(en => {
    const vis = en.filter(x => x.isIntersecting).map(x => x.target)
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1);
    vis.forEach((t, i) => {
      io.unobserve(t);
      t.style.setProperty('--td', (Math.min(i, 7) * step + (t._late || 0)).toFixed(3) + 's');
      t.classList.add('is-in');
      setTimeout(() => t.style.removeProperty('--td'), 2400);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -4% 0px' });
  return io;
}
const tileIO = staggerIO(0.07), catIO = staggerIO(0.07);
catsEl.innerHTML = D.cats.map((c, i) =>
  '<li><button class="cat" type="button" data-cat="' + c.key + '" aria-controls="grid"><span class="cat__idx">' + pad(i + 1) +
  '</span><span class="cat__name">' + esc(c.name) + '</span><sup>' + c.n + '</sup><span class="cat__arrow" aria-hidden="true">→</span></button></li>').join('');
$$('.cat', catsEl).forEach(b => catIO.observe(b));
filterEl.innerHTML = '<button class="fchip" type="button" data-cat="all">전체<sup>' + D.works.length + '</sup></button>' +
  D.cats.map(c => '<button class="fchip" type="button" data-cat="' + c.key + '">' + esc(c.name) + '<sup>' + c.n + '</sup></button>').join('');
function tileHTML(w) {
  return '<button class="tile" type="button" data-id="' + w.id + '">' +
    '<span class="tile__img"><img src="media/thumbs/' + w.id + '.jpg" alt="" loading="lazy" decoding="async" width="480" height="270"></span>' +
    '<span class="tile__meta"><b>' + esc(w.t) + '</b><span>' + esc(sub(w) || 'FREE2FLY') + '</span><em class="tile__cat">' + esc(catName[w.cat]) + '</em></span></button>';
}
function renderGrid(anim) {
  const list = curCat === 'all' ? D.works : D.works.filter(w => w.cat === curCat);
  const show = curCat === 'all' && !expanded ? list.slice(0, 12) : list;
  const old = new Map($$('.tile:not(.tile-out)', grid).map(t => [t.dataset.id, t]));
  const flip = !!anim && !RM && old.size > 0 && !!grid.animate;
  const vh = innerHeight, first = new Map();
  const seen = r => r.bottom > 0 && r.top < vh;
  if (flip) old.forEach((t, id) => first.set(id, t.getBoundingClientRect()));
  $$('.tile-out', grid).forEach(t => t.remove());
  const tmp = document.createElement('div');
  const els = show.map(w => {
    const t = old.get(w.id);
    if (t) { old.delete(w.id); return t; }
    tmp.innerHTML = tileHTML(w);
    const n = tmp.firstChild; n._new = true;
    return n;
  });
  grid.replaceChildren(...els);
  old.forEach(t => tileIO.unobserve(t));
  if (flip) {
    const g = grid.getBoundingClientRect();
    old.forEach((t, id) => {
      const r = first.get(id);
      if (!seen(r)) return;
      t.classList.add('tile-out');
      t.style.left = (r.left - g.left) + 'px'; t.style.top = (r.top - g.top) + 'px'; t.style.width = r.width + 'px';
      grid.appendChild(t);
      t.animate([{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(100% 0 0 0)' }], { duration: 340, easing: 'cubic-bezier(.76,0,.24,1)', fill: 'forwards' })
        .onfinish = () => t.remove();
    });
    els.forEach(t => {
      if (t._new) return;
      const a = first.get(t.dataset.id), b = t.getBoundingClientRect();
      if (!a || (!seen(a) && !seen(b))) return;
      const dx = a.left - b.left, dy = a.top - b.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      t.animate([{ transform: 'translate3d(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px,0)' }, { transform: 'none' }], { duration: 700, easing: 'cubic-bezier(.76,0,.24,1)' });
    });
  }
  els.forEach(t => { if (!t._new) return; t._new = false; t._late = flip ? 0.16 : 0; tileIO.observe(t); });
  moreBtn.hidden = !(curCat === 'all' && !expanded);
  moreBtn.textContent = '전체 ' + list.length + '편 모두 보기 ↓';
  $$('.fchip', filterEl).forEach(b => { const on = b.dataset.cat === curCat; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  $$('.cat', catsEl).forEach(b => { const on = b.dataset.cat === curCat; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
}
function setCat(key, scroll) {
  curCat = key; expanded = false; renderGrid(true);
  const chip = $('.fchip.on', filterEl);
  if (chip) filterEl.scrollTo({ left: chip.offsetLeft - 20, behavior: RM ? 'auto' : 'smooth' });
  if (scroll) scrollToEl(filterEl);
}
catsEl.addEventListener('click', e => { const b = e.target.closest('.cat'); if (b) setCat(curCat === b.dataset.cat ? 'all' : b.dataset.cat, true); });
filterEl.addEventListener('click', e => { const b = e.target.closest('.fchip'); if (b) setCat(b.dataset.cat, false); });
grid.addEventListener('click', e => { const t = e.target.closest('.tile'); if (t && !t.classList.contains('tile-out')) openLB(t.dataset.id, false, $('.tile__img', t)); });
moreBtn.addEventListener('click', () => { expanded = true; renderGrid(true); const t = $$('.tile', grid)[12]; if (t) t.focus({ preventScroll: true }); });
renderGrid(false);
// hover peek (desktop)
const peek = $('#peek');
let peekOn = false, peekCat = '', peekIdx = 0, peekTimer = 0, pk = { x: 0, y: 0, tx: 0, ty: 0, r: 0, live: false, mx: -1, my: -1 };
function peekTop() { const im = $$('img', peek); return im[im.length - 1]; }
function tickPeek(dt) {
  if (!pk.live) return;
  const px = pk.x, k = lerpK(0.2, dt);
  pk.x += (pk.tx - pk.x) * k; pk.y += (pk.ty - pk.y) * k;
  const v = dt > 0 ? (pk.x - px) / dt : 0;
  pk.r += (clamp(v * 0.006, -6, 6) - pk.r) * lerpK(0.12, dt);
  peek.style.transform = 'translate3d(' + pk.x.toFixed(1) + 'px,' + pk.y.toFixed(1) + 'px,0) translate(-50%,-50%) rotate(' + pk.r.toFixed(2) + 'deg)';
  if (!peekOn && Math.abs(pk.tx - pk.x) < 0.5 && Math.abs(pk.r) < 0.05) pk.live = false;
}
function showPeek(key) {
  if (peekCat === key && peekOn) return;
  const wasOn = peekOn;
  peekCat = key; peekIdx = 0;
  const list = D.works.filter(w => w.cat === key);
  const next = () => { const w = list[peekIdx++ % list.length]; return w ? 'media/thumbs/' + w.id + '.jpg' : ''; };
  clearInterval(peekTimer);
  const src = next();
  if (wasOn && !RM && peek.animate) {
    const old = $$('img', peek);
    const im = document.createElement('img'); im.alt = ''; im.src = src;
    peek.appendChild(im);
    im.animate([{ transform: 'translate3d(0,100%,0)' }, { transform: 'none' }], { duration: 700, easing: 'cubic-bezier(.19,1,.22,1)' });
    old.forEach(o => {
      o.animate([{ transform: 'none' }, { transform: 'translate3d(0,-35%,0)' }], { duration: 700, easing: 'cubic-bezier(.19,1,.22,1)', fill: 'forwards' })
        .onfinish = () => o.remove();
    });
  } else {
    const im = $$('img', peek);
    im.slice(0, -1).forEach(o => o.remove());
    im[im.length - 1].src = src;
  }
  if (!RM) peekTimer = setInterval(() => { const t = peekTop(); if (t) t.src = next(); }, 700);
  peekOn = true; pk.live = true; peek.classList.add('on');
}
function hidePeek() { peekOn = false; peekCat = ''; clearInterval(peekTimer); peek.classList.remove('on'); }
if (FINE) {
  catsEl.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    pk.mx = e.clientX; pk.my = e.clientY;
    pk.tx = e.clientX + 170; pk.ty = e.clientY;
    if (!peekOn) { pk.x = pk.tx; pk.y = pk.ty; pk.r = 0; }
    const b = e.target.closest('.cat'); if (b) showPeek(b.dataset.cat); else hidePeek();
  });
  catsEl.addEventListener('pointerleave', hidePeek);
  addEventListener('scroll', () => {
    if (!peekOn) return;
    const el = document.elementFromPoint(pk.mx, pk.my);
    const b = el && el.closest('.cat');
    if (b && catsEl.contains(b)) showPeek(b.dataset.cat); else hidePeek();
  }, { passive: true });
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
const doneH3 = splitWords($('h3', done));
maskKicker($('.clap__body', done));
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
  form.hidden = true; done.hidden = false; $('#copied').textContent = '';
  groupLines(doneH3);
  done.focus({ preventScroll: true });
  const top = done.getBoundingClientRect().top;
  if (top < 70 || top > innerHeight * 0.7) scrollToEl(done, 'center');
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

/* =========================================================
   REVEAL + MEDIA SYNC + BOOT
   ========================================================= */
const SPLITS = ['#shTitle', '#fdTitle', '#ctTitle'].map(s => splitWords($(s)));
$$('.kicker').forEach(maskKicker);
prepCount($('.fields__head .kicker .ki'));
const COUNTERS = [];
function startCount(root) {
  if (RM) return;
  $$('.cnt', root).forEach(c => {
    if (c._c) return;
    c._c = true;
    COUNTERS.push({ el: c, to: +c.dataset.to, txt: c.dataset.to, t0: performance.now() + 220 });
    c.textContent = '0';
  });
}
function tickCounters(now) {
  for (let i = COUNTERS.length - 1; i >= 0; i--) {
    const c = COUNTERS[i], p = (now - c.t0) / 1400;
    if (p >= 1) { c.el.textContent = c.txt; COUNTERS.splice(i, 1); }
    else c.el.textContent = String(Math.round(c.to * expoOut(Math.max(0, p))));
  }
}
const fxIO = new IntersectionObserver(en => en.forEach(x => {
  if (!x.isIntersecting) return;
  fxIO.unobserve(x.target);
  x.target.classList.add('is-in');
  startCount(x.target);
}), { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
[['.shorts .kicker', 0], ['#shTitle', 0.08], ['.shorts__desc', 0.2, 1], ['.deck__ctrl', 0.3, 1], ['.iptv', 0.4, 1],
  ['.fields__head .kicker', 0], ['#fdTitle', 0.08],
  ['.contact .kicker', 0], ['#ctTitle', 0.08], ['.contact__desc', 0.2, 1], ['.contact__quick', 0.3, 1]].forEach(([s, d, up]) => {
  const el = $(s); if (!el) return;
  if (up) el.classList.add('fx-up');
  if (d) el.style.setProperty('--d0', d + 's');
  fxIO.observe(el);
});
$$('.nav a, .hd__cta').forEach(a => { a.innerHTML = rollHTML(a.textContent.trim()); });
magnet(enterBtn, 10); magnet($('.hd__cta'), 8); magnet($('#kfab'), 8); magnet($('.submit', form), 8); magnet(moreBtn, 8); magnet($('#kakaoGo'), 6);
const ftBig = $('.ft__big');
Array.from(ftBig.childNodes).forEach(n => {
  if (n.nodeType === 3) {
    Array.from(n.textContent).forEach(ch => { const s = document.createElement('span'); s.className = 'fc'; s.textContent = ch; ftBig.insertBefore(s, n); });
    ftBig.removeChild(n);
  } else if (n.nodeType === 1) { const s = document.createElement('span'); s.className = 'fc'; ftBig.insertBefore(s, n); s.appendChild(n); }
});
const FT = $$('.fc', ftBig);
function kernFooter() {
  const d = document.createElement('div');
  d.className = 'ft__big';
  d.setAttribute('aria-hidden', 'true');
  d.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;display:inline-block;clip-path:none';
  d.innerHTML = FT.map(c => c.innerHTML).join('');
  ftBig.parentNode.appendChild(d);
  const rg = document.createRange(), want = [];
  Array.from(d.childNodes).forEach(n => {
    if (n.nodeType === 3) for (let i = 0; i < n.length; i++) { rg.setStart(n, i); rg.setEnd(n, i + 1); want.push(rg.getBoundingClientRect().left); }
    else want.push(n.getBoundingClientRect().left);
  });
  d.remove();
  if (want.length !== FT.length) return;
  FT.forEach(c => { c.style.marginLeft = ''; });
  const have = FT.map(c => c.getBoundingClientRect().left);
  const fs = parseFloat(getComputedStyle(ftBig).fontSize) || 1;
  FT.forEach((c, i) => {
    if (!i) return;
    const m = (want[i] - want[i - 1]) - (have[i] - have[i - 1]);
    if (Math.abs(m) > 0.1) c.style.marginLeft = (m / fs).toFixed(4) + 'em';
  });
}
kernFooter();
let ftTop = 0, maxSY = 0, ftP = -1;
function measure() {
  maxSY = Math.max(0, document.documentElement.scrollHeight - innerHeight);
  sm.max = maxSY;
  ftTop = ftBig.getBoundingClientRect().top + scrollY;
  mqW = mq.firstElementChild ? mq.firstElementChild.offsetWidth : 0;
  ftP = -1;
}
function tickFooter(sy) {
  if (RM) return;
  const st = ftTop - innerHeight, en = Math.min(ftTop - innerHeight * 0.45, maxSY);
  const p = en > st ? clamp((sy - st) / (en - st), 0, 1) : 1;
  if (Math.abs(p - ftP) < 0.0005) return;
  ftP = p;
  const sp = 0.06, wd = 1 - sp * (FT.length - 1);
  FT.forEach((c, i) => {
    const l = clamp((p - i * sp) / wd, 0, 1), e = 1 - Math.pow(1 - l, 3);
    c.style.transform = e >= 1 ? '' : 'translate3d(0,' + ((1 - e) * 110).toFixed(2) + '%,0)';
  });
}
function syncMedia() { STRIPS.forEach(stripMedia); deckMedia(); }
document.addEventListener('visibilitychange', () => { paused = document.hidden; syncMedia(); });

function startMain() {
  sm.y = sm.ty = scrollY; sm.set = -9;
  if (!mainRAF) mainRAF = requestAnimationFrame(mainLoop);
  syncMedia();
}
buildStrips();
deckLayout();
STRIPS.forEach(s => stripIO.observe(s.el));
measure();
tickFooter(scrollY);
new ResizeObserver(() => measure()).observe(body);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { SPLITS.forEach(groupLines); kernFooter(); measure(); });
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
