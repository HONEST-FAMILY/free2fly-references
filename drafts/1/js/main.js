/* FREE2FLY — main interactions (take-off fog, viewfinder, works, about, chat inquiry, lightbox) */
(function () {
  'use strict';

  var D = window.F2F || { cats: [], works: [], clients: [] };
  var html = document.documentElement;
  var body = document.body;
  var RM = html.classList.contains('rm');
  var FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var KAKAO = 'http://pf.kakao.com/_txencb/chat';

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var range = function (v, a, b) { return clamp((v - a) / (b - a), 0, 1); };
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
  var easeIO = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var expo = function (t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); };
  var lerpK = function (base, dt) { return 1 - Math.pow(1 - base, dt * 60); };
  function bezier(x1, y1, x2, y2) {
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      var t = x;
      for (var i = 0; i < 8; i++) {
        var u = 1 - t;
        var fx = 3 * x1 * t * u * u + 3 * x2 * t * t * u + t * t * t - x;
        var d = 3 * x1 * u * u + 6 * (x2 - x1) * t * u + 3 * (1 - x2) * t * t;
        if (Math.abs(fx) < 1e-5 || !d) break;
        t = clamp(t - fx / d, 0, 1);
      }
      var w = 1 - t;
      return 3 * y1 * t * w * w + 3 * y2 * t * t * w + t * t * t;
    };
  }
  var easeSwap = bezier(0.76, 0, 0.24, 1);
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
  var KAKAO_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5C6.75 3.5 2.5 6.86 2.5 11c0 2.68 1.78 5.03 4.46 6.36l-.9 3.32c-.08.3.26.54.52.37l3.94-2.6c.48.05.97.08 1.48.08 5.25 0 9.5-3.36 9.5-7.53S17.25 3.5 12 3.5Z"/></svg>';

  var catName = {};
  D.cats.forEach(function (c) { catName[c.key] = c.name; });
  var byId = {};
  D.works.forEach(function (w) { byId[w.id] = w; });

  var vw = window.innerWidth, vh = window.innerHeight;
  var mobile = function () { return vw < 641; };

  try { history.scrollRestoration = 'manual'; } catch (e) { /* noop */ }

  /* ---------------------------------------------------------------- loaded */
  var fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, wait(900)]).then(function () {
    requestAnimationFrame(function () {
      html.classList.add('is-loaded');
      setTimeout(function () { $('.takeoff__word').classList.add('is-landed'); }, RM ? 0 : 2100);
    });
  });

  /* ---------------------------------------------------------------- header + menu */
  var hd = $('#hd');
  var lightSections = $$('main [data-theme="light"]');
  var hdHidden = false, lastY = window.scrollY;
  function setHeaderHidden(h) {
    if (h === hdHidden) return;
    hdHidden = h;
    hd.classList.toggle('is-hidden', h);
    html.classList.toggle('hd-off', h);
  }
  function headerUpdate(y) {
    hd.classList.toggle('is-solid', y > 40 && flight.getBoundingClientRect().bottom < hd.offsetHeight);
    var probe = 28, theme = 'dark';
    for (var i = 0; i < lightSections.length; i++) {
      var r = lightSections[i].getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) { theme = 'light'; break; }
    }
    if (hd.getAttribute('data-theme') !== theme) hd.setAttribute('data-theme', theme);
    var dy = y - lastY;
    if (!body.classList.contains('menu-open')) {
      if (y > vh * 0.8 && dy > 4) setHeaderHidden(true);
      else if (dy < -4 || y < vh * 0.5) setHeaderHidden(false);
    }
    lastY = y;
  }

  var menuBtn = $('#menuBtn'), mnav = $('#mnav');
  function setMenu(open) {
    body.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
    mnav.setAttribute('aria-hidden', String(!open));
    if (open) setHeaderHidden(false);
  }
  menuBtn.addEventListener('click', function () { setMenu(!body.classList.contains('menu-open')); });

  var SMOOTH = FINE && !RM;
  var ss = { y: window.scrollY, t: window.scrollY, set: -9, anim: null };
  var docMax = 0;
  function isLocked() { return body.classList.contains('is-locked') || body.classList.contains('menu-open'); }
  function innerScroller(el, dy) {
    for (; el && el.nodeType === 1 && el !== body && el !== html; el = el.parentElement) {
      if (el.scrollHeight <= el.clientHeight + 1) continue;
      var oy = getComputedStyle(el).overflowY;
      if (oy !== 'auto' && oy !== 'scroll') continue;
      if (dy > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0) return true;
    }
    return false;
  }
  function ssTo(top) {
    top = Math.max(0, top);
    if (!SMOOTH) { window.scrollTo({ top: top, behavior: RM ? 'auto' : 'smooth' }); return; }
    docMax = Math.max(0, html.scrollHeight - window.innerHeight);
    top = Math.min(top, docMax);
    ss.y = ss.t = window.scrollY;
    var dist = Math.abs(top - ss.y);
    if (dist < 1) return;
    ss.anim = { from: ss.y, to: top, t0: performance.now(), dur: clamp(900 + dist / vh * 110, 900, 1600) };
  }
  function ssFrame(dt) {
    if (!SMOOTH) return;
    if (isLocked()) { ss.anim = null; ss.y = ss.t = window.scrollY; return; }
    if (ss.anim) {
      var a = ss.anim, k = clamp((performance.now() - a.t0) / a.dur, 0, 1);
      ss.y = ss.t = a.from + (a.to - a.from) * easeSwap(k);
      if (k >= 1) ss.anim = null;
    } else {
      var d = ss.t - ss.y;
      if (d === 0) return;
      ss.y = Math.abs(d) < 0.4 ? ss.t : ss.y + d * lerpK(0.1, dt);
    }
    ss.set = ss.y;
    window.scrollTo(0, ss.y);
  }
  if (SMOOTH) {
    window.addEventListener('wheel', function (e) {
      if (e.defaultPrevented || e.ctrlKey || e.shiftKey || isLocked()) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      var d = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1);
      if (!d || innerScroller(e.target, d)) return;
      e.preventDefault();
      if (ss.anim) { ss.anim = null; ss.t = ss.y; }
      ss.t = clamp(ss.t + clamp(d, -240, 240), 0, docMax);
    }, { passive: false });
    window.addEventListener('scroll', function () {
      var y = window.scrollY;
      if (Math.abs(y - ss.set) > 1.5) { ss.y = ss.t = y; ss.anim = null; }
    }, { passive: true });
  }

  /* in-page anchors: smooth scroll (respecting reduced motion) */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href');
    if (id.length < 2 && id !== '#') return;
    var target = id === '#top' || id === '#' ? null : $(id);
    if (id !== '#top' && id !== '#' && !target) return;
    e.preventDefault();
    if (body.classList.contains('menu-open')) setMenu(false);
    var top = target ? target.getBoundingClientRect().top + window.scrollY : 0;
    ssTo(top);
  });

  /* ---------------------------------------------------------------- scenes helpers */
  function sceneProgress(el) {
    var r = el.getBoundingClientRect();
    var total = el.offsetHeight - vh;
    if (total <= 0) return 0;
    return clamp(-r.top / total, 0, 1);
  }
  function inView(el, margin) {
    var r = el.getBoundingClientRect();
    margin = margin || 0;
    return r.bottom > -margin && r.top < vh + margin;
  }

  /* ---------------------------------------------------------------- 01 take-off */
  var takeoff = $('#takeoff');
  var toStick = $('.takeoff__stick');
  var heroVideo = $('#heroVideo');
  var fogDensity = 1, toProg = 0, toVisible = true;

  var heroChars = $$('.takeoff__word > span');
  var HERO_SP = [0.92, 1.3, 0.78, 1.12, 1.42, 0.86, 1.22, 1.0];
  var HERO_D = [0.05, 0, 0.07, 0.02, 0.04, 0.08, 0.01, 0.06];
  var toLines = [];
  function takeoffUpdate() {
    toVisible = inView(takeoff);
    if (RM || !toVisible) return;
    var p = sceneProgress(takeoff);
    toProg = p;
    var s = toStick.style;
    var m = range(p, 0.08, 0.56);
    fogDensity = 1 - easeOut(range(p, 0.04, 0.72));
    s.setProperty('--sky', (0.4 * (1 - easeOut(range(p, 0, 0.5)))).toFixed(3));
    s.setProperty('--ms', (1 + m * 0.08).toFixed(3));
    s.setProperty('--vs', (1.24 - 0.24 * easeOut(p)).toFixed(3));
    s.setProperty('--eyo', (1 - range(p, 0, 0.16)).toFixed(3));
    s.setProperty('--cueo', (1 - range(p, 0, 0.07)).toFixed(3));
    s.setProperty('--fogo', fogDensity.toFixed(3));
    for (var i = 0; i < heroChars.length; i++) {
      var c = heroChars[i], q = range(p, 0.05 + HERO_D[i], 0.52 + HERO_D[i]);
      if (q <= 0) {
        if (c._q) { c.style.transform = ''; c.style.opacity = ''; c._q = 0; }
        continue;
      }
      var e = q * q * (3 - 2 * q), sp = HERO_SP[i], off = i - 3.5;
      c.style.transform = 'translate3d(' + (off * e * vw * 0.034 * (0.7 + sp * 0.3)).toFixed(1) + 'px,' + (-e * vh * 0.36 * sp).toFixed(1) + 'px,0) scale(' + (1 + e * (0.18 + sp * 0.12)).toFixed(3) + ')';
      c.style.opacity = (1 - easeOut(range(q, 0.12, 0.94))).toFixed(3);
      c._q = q;
    }
    for (var j = 0; j < toLines.length; j++) {
      var lp = easeOut(range(p, 0.6 + j * 0.05, 0.82 + j * 0.05));
      toLines[j].style.transform = lp >= 1 ? 'none' : 'translate3d(0,' + ((1 - lp) * 112).toFixed(2) + '%,0)';
    }
  }

  /* WebGL fbm fog */
  var fogCv = $('#fog'), gl = null, uRes, uT, uD, uP, fogW = 0, fogH = 0, fogCleared = false;
  function initFog() {
    if (RM) return;
    try {
      gl = fogCv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
    } catch (e) { gl = null; }
    if (!gl) { html.classList.add('no-gl'); return; }
    var vsrc = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
    var fsrc = [
      'precision mediump float;',
      'uniform vec2 r;uniform float t;uniform float d;uniform float p;',
      'float h(vec2 q){return fract(sin(dot(q,vec2(127.1,311.7)))*43758.5453);}',
      'float n(vec2 q){vec2 i=floor(q),f=fract(q);f=f*f*(3.-2.*f);',
      ' return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}',
      'float fbm(vec2 q){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);',
      ' for(int i=0;i<5;i++){v+=a*n(q);q=m*q;a*=.5;}return v;}',
      'void main(){',
      ' vec2 uv=gl_FragCoord.xy/r;',
      ' vec2 q=(uv-.5)*vec2(r.x/r.y,1.);',
      ' q*=1.55-p*.85;',
      ' q.y-=p*1.9;',
      ' float w=fbm(q*1.25+vec2(t*.022,t*.008));',
      ' float f=fbm(q*2.0+w*1.8+vec2(t*.035,-t*.012));',
      ' float g=fbm(q*4.6-vec2(t*.05,0.)+f);',
      ' f=f*.78+g*.22;',
      ' float bias=(1.-uv.y)*.34-uv.y*.05;',
      ' float lo=mix(.86,.2,d);',
      ' float al=smoothstep(lo,lo+.42,f+bias*d);',
      ' al*=smoothstep(0.,.22,d)*.96;',
      ' vec3 c=mix(vec3(.78,.86,.95),vec3(1.,.992,.982),smoothstep(.32,.82,f));',
      ' gl_FragColor=vec4(c*al,al);',
      '}'
    ].join('\n');
    function sh(type, src) {
      var o = gl.createShader(type);
      gl.shaderSource(o, src); gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o));
      return o;
    }
    try {
      var pr = gl.createProgram();
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, vsrc));
      gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fsrc));
      gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('link');
      gl.useProgram(pr);
      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(pr, 'a');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      uRes = gl.getUniformLocation(pr, 'r');
      uT = gl.getUniformLocation(pr, 't');
      uD = gl.getUniformLocation(pr, 'd');
      uP = gl.getUniformLocation(pr, 'p');
      gl.clearColor(0, 0, 0, 0);
      resizeFog();
      fogCv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); gl = null; html.classList.add('no-gl'); });
    } catch (err) {
      gl = null;
      html.classList.add('no-gl');
    }
  }
  function resizeFog() {
    if (!gl) return;
    var scale = mobile() ? 0.42 : 0.5;
    fogW = Math.max(2, Math.round(fogCv.clientWidth * scale));
    fogH = Math.max(2, Math.round(fogCv.clientHeight * scale));
    fogCv.width = fogW; fogCv.height = fogH;
    gl.viewport(0, 0, fogW, fogH);
  }
  function drawFog(now) {
    if (!gl) return;
    if (fogDensity <= 0.002) {
      if (!fogCleared) { gl.clear(gl.COLOR_BUFFER_BIT); fogCleared = true; }
      return;
    }
    fogCleared = false;
    gl.uniform2f(uRes, fogW, fogH);
    gl.uniform1f(uT, now / 1000);
    gl.uniform1f(uD, fogDensity);
    gl.uniform1f(uP, toProg);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /* ---------------------------------------------------------------- 02 viewfinder */
  var flight = $('#flight');
  var flStick = $('.flight__stick');
  var flCopy = $('#flightCopy');
  var vfVideo = $('#vfVideo');
  var tcEl = $('#tc'), altEl = $('#alt'), altBar = $('#altbar'), tape = $('#tape');
  var flVisible = false, lastAlt = -1, flTop = 0, flBot = 0, aimIt = 28.5, aimIx = 23;
  var tapeLabels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  (function buildTape() {
    var out = '';
    for (var d = 0; d <= 735; d += 15) {
      var k = d % 360;
      out += '<span>' + (tapeLabels[k] != null ? tapeLabels[k] : k) + '</span>';
    }
    tape.innerHTML = out;
  })();

  function flightUpdate() {
    flVisible = inView(flight);
    if (RM || !flVisible) return;
    var fr = flight.getBoundingClientRect();
    flTop = fr.top; flBot = fr.bottom;
    var p = clamp(-fr.top / Math.max(1, flight.offsetHeight - vh), 0, 1);
    var s = flStick.style;
    var e = easeIO(range(p, 0.04, 0.56));
    var it0 = mobile() ? 27 : 28.5, ix0 = mobile() ? 6.5 : 23;
    aimIt = it0 * (1 - e); aimIx = ix0 * (1 - e);
    s.setProperty('--it', (it0 * (1 - e)).toFixed(2) + '%');
    s.setProperty('--ib', (it0 * (1 - e)).toFixed(2) + '%');
    s.setProperty('--ix', (ix0 * (1 - e)).toFixed(2) + '%');
    s.setProperty('--ir', (16 * (1 - e)).toFixed(1) + 'px');
    s.setProperty('--fs', (1.18 - 0.18 * e).toFixed(3));
    var g = range(p, 0.06, 0.5);
    s.setProperty('--gax', (-easeIO(g) * 50).toFixed(2) + 'vw');
    s.setProperty('--gbx', (easeIO(g) * 50).toFixed(2) + 'vw');
    s.setProperty('--go', (1 - easeOut(g)).toFixed(3));
    s.setProperty('--ho', (1 - range(p, 0.44, 0.6)).toFixed(3));
    var co = easeOut(range(p, 0.6, 0.8));
    s.setProperty('--co', co.toFixed(3));
    flCopy.classList.toggle('is-live', co > 0.5);
    var alt = Math.round(150 * easeOut(range(p, 0, 0.56)));
    if (alt !== lastAlt) {
      lastAlt = alt;
      altEl.textContent = alt;
      altBar.style.height = (alt / 150 * 100).toFixed(1) + '%';
    }
    var heading = 318 + p * 96;
    var hw = tape.parentNode.clientWidth;
    var x = hw / 2 - ((heading % 360 + 360) / 15 * 40 + 20);
    tape.style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,0)';
  }
  var tcStart = performance.now();
  function updateTimecode(now) {
    var f = Math.floor((now - tcStart) / (1000 / 24));
    var ff = f % 24, sec = Math.floor(f / 24);
    tcEl.textContent = '00:' + pad2(Math.floor(sec / 60) % 60) + ':' + pad2(sec % 60) + ':' + pad2(ff);
  }

  /* chips that jump into works with a filter */
  var flightChips = $('#flightChips');
  flightChips.innerHTML = D.cats.map(function (c) {
    return '<a href="#works" data-cat="' + c.key + '">' + esc(c.name) + '<sup>' + c.count + '</sup></a>';
  }).join('');
  flightChips.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-cat]');
    if (a) setFilter(a.getAttribute('data-cat'), false);
  });

  /* ---------------------------------------------------------------- 03 works */
  var grid = $('#grid'), tabsBox = $('#tabs'), tabsIn = $('#tabsIn');
  var more = $('#more'), moreBtn = $('#moreBtn'), moreN = $('#moreN');
  var viewToggle = $('#viewToggle');
  var filter = 'all', view = 'grid', limit = 0;
  var PAGE = function () { return mobile() ? 8 : 12; };
  $('#worksTotal').textContent = D.works.length + '편';
  $('#factWorks').innerHTML = D.works.length + '<small>편</small>';

  function listFor() {
    return filter === 'all' ? D.works : D.works.filter(function (w) { return w.cat === filter; });
  }
  var tabsData = [{ key: 'all', name: '전체', count: D.works.length }].concat(D.cats);
  tabsIn.innerHTML = tabsData.map(function (t) {
    var on = t.key === filter;
    return '<button type="button" class="tab' + (on ? ' is-on' : '') + '" role="tab" aria-selected="' + on + '" data-cat="' + t.key + '">' + esc(t.name) + '<sup>' + t.count + '</sup></button>';
  }).join('');

  function cardHTML(w, i) {
    var cat = esc(catName[w.cat] || '');
    return '<article class="card" data-id="' + esc(w.id) + '">' +
      '<a class="card__media" href="https://www.youtube.com/watch?v=' + esc(w.id) + '" aria-label="' + esc(w.title) + ' 영상 보기">' +
      '<img src="media/thumbs/' + esc(w.id) + '.jpg" alt="" loading="lazy" decoding="async" width="640" height="360">' +
      '<span class="card__tag">' + cat + '</span>' +
      (w.pv ? '<span class="card__live"><b></b>PREVIEW</span>' : '') +
      '<span class="card__playbtn" aria-hidden="true"></span></a>' +
      '<div class="card__meta"><span class="card__no"><span class="m">' + pad2(i + 1) + '</span></span>' +
      '<div><h3><span class="m">' + esc(w.title) + '</span></h3><p><span class="m">' + esc(w.client) + '</span></p></div>' +
      '<span class="card__region"><span class="m">' + esc(w.region || '—') + '</span></span>' +
      '<span class="card__cat"><span class="m">' + cat + '</span></span></div></article>';
  }

  var swapUntil = 0;
  var revealCardIO = new IntersectionObserver(function (entries) {
    var k = 0, base = performance.now() < swapUntil ? 200 : 0;
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var el = en.target;
      el.style.setProperty('--d', RM ? '0ms' : (base + Math.min(k++, 7) * 70) + 'ms');
      el.classList.add('is-in');
      revealCardIO.unobserve(el);
      setTimeout(function () { el.style.removeProperty('--d'); }, 2600);
    });
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.08 });

  function renderMore() {
    var L = listFor();
    var target = view === 'list' ? L.length : Math.min(L.length, limit);
    var have = grid.children.length;
    if (target > have) {
      var frag = document.createElement('div');
      frag.innerHTML = L.slice(have, target).map(function (w, j) { return cardHTML(w, have + j); }).join('');
      var nodes = Array.prototype.slice.call(frag.children);
      nodes.forEach(function (n) { grid.appendChild(n); revealCardIO.observe(n); if (centerIO) centerIO.observe(n); });
    }
    var left = L.length - grid.children.length;
    more.hidden = left <= 0;
    moreN.textContent = left + '편 더';
  }
  function renderAll() {
    stopAllPreviews();
    grid.innerHTML = '';
    limit = PAGE();
    renderMore();
  }
  moreBtn.addEventListener('click', function () {
    limit = grid.children.length + PAGE();
    renderMore();
  });

  function visRect(el) {
    var r = el.getBoundingClientRect();
    return (r.width > 0 && r.bottom > -40 && r.top < vh + 40) ? r : null;
  }
  function flipMove(c, r, l) {
    var dx = r.left - l.left, dy = r.top - l.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return false;
    c.animate([{ transform: 'translate3d(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px,0)' }, { transform: 'translate3d(0,0,0)' }], { duration: 700, easing: 'cubic-bezier(.76,0,.24,1)' });
    return true;
  }
  function reflowGrid(nextIds) {
    stopAllPreviews();
    var anim = !RM && !!grid.animate;
    var olds = $$('.card', grid).filter(function (c) { return !c.classList.contains('is-leaving'); });
    var gr = grid.getBoundingClientRect();
    var first = new Map(), byCard = {}, keep = {};
    olds.forEach(function (c) {
      byCard[c.getAttribute('data-id')] = c;
      if (anim) { var r = visRect(c); if (r) first.set(c, r); }
    });
    nextIds.forEach(function (id) { keep[id] = 1; });
    var frag = document.createDocumentFragment(), fresh = [];
    olds.forEach(function (c) {
      if (keep[c.getAttribute('data-id')]) return;
      revealCardIO.unobserve(c);
      if (centerIO) centerIO.unobserve(c);
      var r = first.get(c);
      if (!r) { c.remove(); return; }
      c.classList.add('is-leaving');
      c.style.left = (r.left - gr.left).toFixed(1) + 'px';
      c.style.top = (r.top - gr.top).toFixed(1) + 'px';
      c.style.width = r.width.toFixed(1) + 'px';
      c.style.height = r.height.toFixed(1) + 'px';
      var gone = function () { c.remove(); };
      c.animate([{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(100% 0 0 0)' }], { duration: 340, easing: 'cubic-bezier(.76,0,.24,1)', fill: 'forwards' }).finished.then(gone, gone);
    });
    nextIds.forEach(function (id, i) {
      var c = byCard[id];
      if (c) {
        var no = $('.card__no .m', c);
        if (no) no.textContent = pad2(i + 1);
      } else {
        var tmp = document.createElement('div');
        tmp.innerHTML = cardHTML(byId[id], i);
        c = tmp.firstChild;
        fresh.push(c);
      }
      frag.appendChild(c);
    });
    grid.appendChild(frag);
    swapUntil = performance.now() + 500;
    fresh.forEach(function (n) { revealCardIO.observe(n); if (centerIO) centerIO.observe(n); });
    if (anim) first.forEach(function (r, c) {
      if (!keep[c.getAttribute('data-id')]) return;
      flipMove(c, r, c.getBoundingClientRect());
    });
  }
  function setFilter(cat, scrollIntoGrid) {
    if (!catName[cat] && cat !== 'all') cat = 'all';
    filter = cat;
    $$('.tab', tabsIn).forEach(function (b) {
      var on = b.getAttribute('data-cat') === cat;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', String(on));
      if (on) tabsIn.scrollTo({ left: b.offsetLeft - (tabsIn.clientWidth - b.offsetWidth) / 2, behavior: RM ? 'auto' : 'smooth' });
    });
    limit = PAGE();
    var L = listFor();
    var target = view === 'list' ? L.length : Math.min(L.length, limit);
    reflowGrid(L.slice(0, target).map(function (w) { return w.id; }));
    var left = L.length - target;
    more.hidden = left <= 0;
    moreN.textContent = left + '편 더';
    if (scrollIntoGrid) {
      var gTop = grid.getBoundingClientRect().top;
      var stickH = tabsBox.offsetHeight + (hdHidden ? 0 : hd.offsetHeight);
      if (gTop < stickH) ssTo(window.scrollY + gTop - stickH - 18);
    }
  }
  tabsIn.addEventListener('click', function (e) {
    var b = e.target.closest('.tab');
    if (b) setFilter(b.getAttribute('data-cat'), true);
  });

  /* grid / list toggle */
  var pill = $('.view-toggle__pill');
  function movePill() {
    var on = $('button.is-on', viewToggle);
    if (!on) return;
    viewToggle.style.setProperty('--px', (on.offsetLeft - 4) + 'px');
    viewToggle.style.setProperty('--pw', on.offsetWidth + 'px');
  }
  viewToggle.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-view]');
    if (!b || b.getAttribute('data-view') === view) return;
    view = b.getAttribute('data-view');
    $$('button[data-view]', viewToggle).forEach(function (x) {
      var on = x === b;
      x.classList.toggle('is-on', on);
      x.setAttribute('aria-pressed', String(on));
    });
    movePill();
    stopAllPreviews();
    peek.classList.remove('is-on'); peekOn = false;
    var anim = !RM && !!grid.animate;
    var olds = $$('.card', grid).filter(function (c) { return !c.classList.contains('is-leaving'); });
    var first = new Map();
    if (anim) olds.forEach(function (c) { var r = visRect(c); if (r) first.set(c, r); });
    grid.setAttribute('data-view', view);
    renderMore();
    olds.forEach(function (c) { c.classList.add('is-in'); });
    if (anim) first.forEach(function (r, c) {
      var l = c.getBoundingClientRect();
      if (!(l.bottom > -40 && l.top < vh + 40)) return;
      flipMove(c, r, l);
      if (view === 'grid') {
        var m = $('.card__media', c), rad = parseFloat(getComputedStyle(m).borderTopLeftRadius) || 0;
        m.animate([{ clipPath: 'inset(100% -8px -8px -8px round ' + rad + 'px)' }, { clipPath: 'inset(-8px round ' + (rad + 8) + 'px)' }], { duration: 1000, easing: 'cubic-bezier(.19,1,.22,1)' });
      }
    });
  });

  /* previews: hover on desktop, centered-in-view on touch */
  var playing = new Set();
  function startPreview(card) {
    if (!card || view !== 'grid' || lbOpen) return;
    var w = byId[card.getAttribute('data-id')];
    if (!w) return;
    card.classList.add('is-hot');
    playing.add(card);
    if (w.pv) {
      var media = $('.card__media', card);
      var v = $('video', media);
      if (!v) {
        v = document.createElement('video');
        v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true;
        v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
        v.preload = 'auto';
        v.poster = 'media/thumbs/' + w.id + '.jpg';
        v.src = 'media/prev/' + w.id + '.mp4';
        media.insertBefore(v, $('.card__tag', media));
        v.addEventListener('playing', function () { if (card.classList.contains('is-hot')) card.classList.add('is-playing'); });
      }
      var pr = v.play();
      if (pr && pr.catch) pr.catch(function () { if (card.classList.contains('is-hot')) card.classList.add('is-kb'); });
      if (!v.paused && v.readyState > 2) card.classList.add('is-playing');
    } else if (!RM) {
      card.classList.add('is-kb');
    }
  }
  function stopPreview(card) {
    if (!card) return;
    card.classList.remove('is-hot', 'is-playing', 'is-kb');
    playing.delete(card);
    var v = $('video', card);
    if (v) v.pause();
  }
  function stopAllPreviews() { Array.from(playing).forEach(stopPreview); }

  var centerIO = null;
  if (FINE) {
    grid.addEventListener('mouseover', function (e) {
      var m = e.target.closest('.card__media');
      if (!m) return;
      var card = m.closest('.card');
      if (!card.classList.contains('is-hot')) { stopAllPreviews(); startPreview(card); }
    });
    grid.addEventListener('mouseout', function (e) {
      var m = e.target.closest('.card__media');
      if (!m) return;
      if (e.relatedTarget && m.contains(e.relatedTarget)) return;
      stopPreview(m.closest('.card'));
    });
  } else {
    centerIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) startPreview(en.target); else stopPreview(en.target);
      });
    }, { rootMargin: '-42% 0px -42% 0px', threshold: 0 });
  }

  /* opening a work */
  grid.addEventListener('click', function (e) {
    var card = e.target.closest('.card');
    if (!card) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    openLB(byId[card.getAttribute('data-id')], card);
  });

  /* custom cursor (desktop grid) + list peek (desktop list) */
  var cursor = $('#cursor'), cDot = $('.cursor__dot', cursor), cFollow = $('.cursor__f', cursor);
  var peek = $('#peek'), peekIn = $('.list-peek__in', peek);
  var CUR = FINE && !RM;
  var mx = -300, my = -300, cx = -300, cy = -300, px = -300, py = -300, peekOn = false, peekId = '', peekRot = 0, peekVis = 0, pointerIn = false, curState = '';
  var MAG_SEL = '.kakao-btn,.btn-more,.btn-send,.btn-kakao', magEl = null, mags = [];
  function cursorState(t) {
    if (!t || !t.closest) return '';
    if (t.closest('input,textarea,select')) return 'text';
    if (view === 'grid' && !lbOpen && t.closest('#grid .card__media')) return 'media';
    if (t.closest('a,button,[role="tab"]')) return 'link';
    return '';
  }
  function setCursor(st) {
    if (st === curState) return;
    if (curState) cursor.classList.remove('is-' + curState);
    curState = st;
    if (st) cursor.classList.add('is-' + st);
  }
  function hideCursor() { pointerIn = false; cursor.classList.remove('is-vis'); }
  function magState(el) {
    for (var i = 0; i < mags.length; i++) if (mags[i].el === el) return mags[i];
    var st = { el: el, inn: $('.mag-in', el), x: 0, y: 0, tx: 0, ty: 0 };
    mags.push(st);
    return st;
  }
  function magRelease() {
    if (!magEl) return;
    var o = magState(magEl);
    o.tx = o.ty = 0;
    magEl = null;
  }
  function peekSwap(id, animate) {
    var img = document.createElement('img');
    img.alt = '';
    img.src = 'media/thumbs/' + id + '.jpg';
    var olds = $$('img', peekIn);
    peekIn.appendChild(img);
    if (!animate || RM || !img.animate) { olds.forEach(function (o) { o.remove(); }); return; }
    olds.slice(0, -1).forEach(function (o) { o.remove(); });
    var last = olds[olds.length - 1];
    img.animate([{ transform: 'translate3d(0,100%,0)' }, { transform: 'translate3d(0,0,0)' }], { duration: 650, easing: 'cubic-bezier(.19,1,.22,1)' });
    if (last) {
      var a = last.animate([{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(0,-38%,0)' }], { duration: 650, easing: 'cubic-bezier(.19,1,.22,1)', fill: 'forwards' });
      a.onfinish = function () { last.remove(); };
    }
  }
  if (FINE) {
    if (CUR) html.classList.add('has-cursor');
    window.addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY;
      var t = e.target;
      if (!pointerIn) { pointerIn = true; cx = mx; cy = my; if (CUR) cursor.classList.add('is-vis'); }
      if (CUR) setCursor(cursorState(t));
      if (!RM) {
        var mg = t.closest ? t.closest(MAG_SEL) : null;
        if (mg !== magEl) { magRelease(); magEl = mg; }
        if (mg) {
          var st = magState(mg), r = mg.getBoundingClientRect();
          var ccx = r.left - st.x + r.width / 2, ccy = r.top - st.y + r.height / 2;
          st.tx = clamp((mx - ccx) / (r.width / 2), -1, 1) * 8;
          st.ty = clamp((my - ccy) / (r.height / 2), -1, 1) * 8;
        }
      }
      var row = view === 'list' && !lbOpen && t.closest && t.closest('#grid .card');
      if (row && !row.classList.contains('is-leaving')) {
        var id = row.getAttribute('data-id');
        if (id !== peekId) { peekSwap(id, peekOn); peekId = id; }
        if (!peekOn && peekVis <= 0) { px = mx; py = my; peekRot = 0; }
        peekOn = true;
      } else peekOn = false;
      peek.classList.toggle('is-on', peekOn);
    }, { passive: true });
    html.addEventListener('mouseleave', function () { hideCursor(); peek.classList.remove('is-on'); peekOn = false; magRelease(); });
    window.addEventListener('mouseout', function (e) {
      var r = e.relatedTarget;
      if (!r || r.tagName === 'IFRAME') { hideCursor(); magRelease(); }
    });
  }
  function pointerFrame(dt) {
    if (!FINE) return;
    if (CUR && pointerIn) {
      var k = lerpK(0.2, dt);
      cx += (mx - cx) * k; cy += (my - cy) * k;
      cDot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
      cFollow.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
    }
    if (peekOn || peekVis > 0) {
      var pk = lerpK(0.14, dt), ox = px;
      px += (mx - px) * pk; py += (my - py) * pk;
      var vx = (px - ox) / Math.max(dt, 0.008);
      peekRot = RM ? 0 : peekRot + (clamp(vx * 0.012, -6, 6) - peekRot) * lerpK(0.1, dt);
      peekVis = peekOn ? 1 : Math.max(0, peekVis - dt / 0.5);
      peek.style.transform = 'translate3d(' + (px + 40).toFixed(1) + 'px,' + py.toFixed(1) + 'px,0) translate(0,-50%) rotate(' + peekRot.toFixed(2) + 'deg)';
    }
  }
  function magFrame(dt) {
    if (!mags.length) return;
    var k = lerpK(0.12, dt);
    for (var i = mags.length - 1; i >= 0; i--) {
      var m = mags[i];
      m.x += (m.tx - m.x) * k; m.y += (m.ty - m.y) * k;
      if (!m.tx && !m.ty && Math.abs(m.x) < 0.05 && Math.abs(m.y) < 0.05) {
        m.el.style.translate = '';
        if (m.inn) m.inn.style.translate = '';
        mags.splice(i, 1);
        continue;
      }
      m.el.style.translate = m.x.toFixed(2) + 'px ' + m.y.toFixed(2) + 'px';
      if (m.inn) m.inn.style.translate = (m.x * 0.5).toFixed(2) + 'px ' + (m.y * 0.5).toFixed(2) + 'px';
    }
  }
  var hudCross = $('.hud__cross'), aim = { x: 0, y: 0, vx: 0, vy: 0 };
  if (FINE && !RM) vfVideo.style.scale = '1.035';
  function aimFrame(dt) {
    if (!FINE || RM || !flVisible) return;
    var cw = html.clientWidth;
    var inside = pointerIn && my >= Math.max(0, flTop) && my <= Math.min(vh, flBot);
    var hl = cw * aimIx / 100, ht = vh * aimIt / 100, hw = cw - 2 * hl, hh = vh - 2 * ht;
    var tx = 0, ty = 0, nx = 0, ny = 0;
    if (inside) {
      tx = clamp(mx - (hl + hw / 2), -hw * 0.38, hw * 0.38);
      ty = clamp(my - (ht + hh / 2), -hh * 0.34, hh * 0.34);
      nx = clamp((mx / cw - 0.5) * 2, -1, 1);
      ny = clamp((my / vh - 0.5) * 2, -1, 1);
    }
    var k = lerpK(0.075, dt), k2 = lerpK(0.05, dt);
    aim.x += (tx - aim.x) * k; aim.y += (ty - aim.y) * k;
    aim.vx += (nx - aim.vx) * k2; aim.vy += (ny - aim.vy) * k2;
    hudCross.style.transform = 'translate(-50%,-50%) translate3d(' + aim.x.toFixed(1) + 'px,' + aim.y.toFixed(1) + 'px,0)';
    vfVideo.style.translate = (-aim.vx * 1.5).toFixed(3) + '% ' + (-aim.vy * 1.5).toFixed(3) + '%';
  }

  /* sticky tabs state */
  function tabsUpdate() {
    var top = tabsBox.getBoundingClientRect().top;
    var stuckAt = hdHidden ? 0 : hd.offsetHeight;
    tabsBox.classList.toggle('is-stuck', top <= stuckAt + 1 && grid.getBoundingClientRect().bottom > stuckAt + 60);
  }

  /* ---------------------------------------------------------------- lightbox */
  var lb = $('#lb'), lbPlayer = $('#lbPlayer');
  var lbOpen = false, lbPushed = false, lbLastFocus = null, lbTimer = 0, lbTok = 0, lbCard = null, lbW = null, lbGhost = null, lbHid = null;
  function lbRadius(el) { return parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0; }
  function lbSource(card) {
    if (!card || !card.isConnected) return null;
    var m = $('.card__media', card);
    var r = m ? m.getBoundingClientRect() : null;
    if (r && r.width > 4 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw) return { el: m, r: r, rad: lbRadius(m) };
    if (peek.classList.contains('is-on') && peekId === card.getAttribute('data-id')) {
      var pr = peekIn.getBoundingClientRect();
      if (pr.width > 4) return { el: null, r: pr, rad: 12 };
    }
    return null;
  }
  function lbTf(r, base) {
    var sx = r.width / base.width, sy = r.height / base.height;
    return { t: 'translate3d(' + (r.left - base.left).toFixed(1) + 'px,' + (r.top - base.top).toFixed(1) + 'px,0) scale(' + sx.toFixed(4) + ',' + sy.toFixed(4) + ')', s: sx };
  }
  function lbFly(src, base, a, ra, b, rb) {
    if (lbGhost) lbGhost.remove();
    var g = document.createElement('div');
    g.className = 'lb__ghost';
    g.style.cssText = 'left:' + base.left + 'px;top:' + base.top + 'px;width:' + base.width + 'px;height:' + base.height + 'px';
    g.innerHTML = '<img src="' + src + '" alt="">';
    lb.insertBefore(g, $('.lb__x', lb));
    lbGhost = g;
    var A = lbTf(a, base), B = lbTf(b, base);
    return g.animate([
      { transform: A.t, clipPath: 'inset(0 round ' + (ra / A.s).toFixed(2) + 'px)' },
      { transform: B.t, clipPath: 'inset(0 round ' + (rb / B.s).toFixed(2) + 'px)' }
    ], { duration: 800, easing: 'cubic-bezier(.76,0,.24,1)', fill: 'forwards' }).finished;
  }
  function lbHide(el) {
    if (lbHid && lbHid !== el) lbHid.style.visibility = '';
    lbHid = el;
    if (el) el.style.visibility = 'hidden';
  }
  function lbIframe(w) {
    lbPlayer.insertAdjacentHTML('beforeend', '<iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(w.id) +
      '?autoplay=1&rel=0&playsinline=1&modestbranding=1" title="' + esc(w.title) +
      '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen"></iframe>');
    var f = $('iframe', lbPlayer);
    var ready = function () { f.classList.add('is-ready'); };
    f.addEventListener('load', ready);
    setTimeout(ready, 2500);
  }
  function openLB(w, card) {
    if (!w) return;
    clearTimeout(lbTimer);
    var tok = ++lbTok;
    lbLastFocus = document.activeElement;
    var src = RM || !lb.animate ? null : lbSource(card);
    stopAllPreviews();
    setCursor(''); peek.classList.remove('is-on'); peekOn = false;
    if (src && !src.el) {
      peekIn.style.transition = 'none';
      requestAnimationFrame(function () { requestAnimationFrame(function () { peekIn.style.transition = ''; }); });
    }
    lbCard = card || null; lbW = w;
    var thumb = 'media/thumbs/' + w.id + '.jpg';
    lbPlayer.innerHTML = '<img class="lb__poster" src="' + thumb + '" alt="">';
    $('#lbCat').textContent = catName[w.cat] || '';
    $('#lbTitle').textContent = w.title;
    $('#lbClient').textContent = w.client + (w.region ? ' · ' + w.region : '');
    $('#lbYt').href = 'https://www.youtube.com/watch?v=' + w.id;
    lb.classList.remove('is-closing', 'is-open');
    lb.classList.toggle('is-flying', !!src);
    lb.hidden = false;
    body.classList.add('is-locked');
    lbOpen = true;
    if (src) {
      var to = lbPlayer.getBoundingClientRect();
      lbHide(src.el);
      lbFly(thumb, to, src.r, src.rad, to, lbRadius(lbPlayer)).then(function () {
        if (tok !== lbTok || !lbOpen) return;
        lb.classList.remove('is-flying');
        lbIframe(w);
        if (lbGhost) { lbGhost.remove(); lbGhost = null; }
      }, function () {});
    } else {
      lbHide(null);
      if (lbGhost) { lbGhost.remove(); lbGhost = null; }
      lbTimer = setTimeout(function () { if (tok === lbTok && lbOpen) lbIframe(w); }, RM ? 0 : 520);
    }
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (tok === lbTok && lbOpen) lb.classList.add('is-open'); }); });
    try { history.pushState({ f2fLb: 1 }, ''); lbPushed = true; } catch (e) { lbPushed = false; }
    setTimeout(function () { var x = $('.lb__x', lb); if (x) x.focus({ preventScroll: true }); }, 60);
  }
  function closeLB(fromPop) {
    if (!lbOpen) return;
    lbOpen = false;
    var tok = ++lbTok;
    clearTimeout(lbTimer);
    var from = lbPlayer.getBoundingClientRect(), fromRad = lbRadius(lbPlayer);
    var wasFlying = lb.classList.contains('is-flying');
    if (wasFlying && lbGhost) { from = lbGhost.getBoundingClientRect(); fromRad = 14; }
    var fr = $('iframe', lbPlayer);
    if (fr) fr.remove();
    body.classList.remove('is-locked');
    var src = RM || !lb.animate || !lbW ? null : lbSource(lbCard);
    lb.classList.remove('is-open', 'is-flying');
    var done = function () {
      if (tok !== lbTok) return;
      lb.hidden = true;
      lbPlayer.innerHTML = '';
      lb.classList.remove('is-closing');
      if (lbGhost) { lbGhost.remove(); lbGhost = null; }
      lbHide(null);
    };
    if (src) {
      lb.classList.add('is-closing');
      lbFly('media/thumbs/' + lbW.id + '.jpg', from, from, fromRad, src.r, src.rad).then(done, done);
    } else {
      if (lbGhost) { lbGhost.remove(); lbGhost = null; }
      lbHide(null);
      lbTimer = setTimeout(done, RM ? 0 : 820);
    }
    if (lbPushed && !fromPop) { lbPushed = false; history.back(); } else lbPushed = false;
    if (lbLastFocus && lbLastFocus.focus) lbLastFocus.focus({ preventScroll: true });
  }
  lb.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) closeLB(false); });
  window.addEventListener('popstate', function () { if (lbOpen) closeLB(true); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (lbOpen) closeLB(false);
    else if (body.classList.contains('menu-open')) setMenu(false);
  });

  /* ---------------------------------------------------------------- 04 about */
  var reelBox = $('#reel');
  var reels = $$('.reel', reelBox);
  var reelVideos = $$('video', reelBox);
  function reelParallax() {
    if (RM || !inView(reelBox, 100)) return;
    var r = reelBox.getBoundingClientRect();
    var c = r.top + r.height / 2 - vh / 2;
    reels.forEach(function (fig) {
      var sp = parseFloat(fig.getAttribute('data-speed')) || 0;
      fig.style.setProperty('--py', (c * sp).toFixed(1) + 'px');
    });
  }
  var mq1 = $('#mq1'), mq2 = $('#mq2');
  (function marquee() {
    var cl = D.clients && D.clients.length ? D.clients : [];
    var half = Math.ceil(cl.length / 2);
    function fill(el, names) {
      var a = names.map(function (n) { return '<span>' + esc(n) + '</span>'; }).join('');
      el.innerHTML = a + names.map(function (n) { return '<span aria-hidden="true">' + esc(n) + '</span>'; }).join('');
    }
    fill(mq1, cl.slice(0, half));
    fill(mq2, cl.slice(half));
  })();
  var reelIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add('is-in'); reelIO.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.15 });
  reels.forEach(function (fig) { reelIO.observe(fig); });
  var clientsBox = $('.clients'), mqVis = false, mqHover = 0, mqHoverT = 0, mqDir = 1, mqDirT = 1;
  var mqs = [{ el: mq1, x: 0, w: 0, base: 0, sign: -1, dur: 70 }, { el: mq2, x: 0, w: 0, base: 0, sign: 1, dur: 80 }];
  function measureMq() { mqs.forEach(function (m) { m.w = m.el.scrollWidth / 2; m.base = m.w / m.dur; }); }
  if (!RM) {
    new IntersectionObserver(function (en) { mqVis = en[0].isIntersecting; }, { rootMargin: '100px 0px' }).observe(clientsBox);
    clientsBox.addEventListener('mouseenter', function () { mqHoverT = 1; });
    clientsBox.addEventListener('mouseleave', function () { mqHoverT = 0; });
  }
  function marqueeFrame(dt) {
    if (RM || !mqVis) return;
    mqHover += (mqHoverT - mqHover) * lerpK(0.06, dt);
    if (svS > 40) mqDirT = 1; else if (svS < -40) mqDirT = -1;
    mqDir += (mqDirT - mqDir) * lerpK(0.05, dt);
    var boost = Math.min(Math.abs(svS) * 0.12, 900), slow = 1 - mqHover * 0.72;
    for (var i = 0; i < mqs.length; i++) {
      var m = mqs[i];
      if (!m.w) continue;
      m.x += (m.base + boost) * slow * mqDir * m.sign * dt;
      m.x %= m.w;
      if (m.x > 0) m.x -= m.w;
      m.el.style.transform = 'translate3d(' + m.x.toFixed(2) + 'px,0,0)';
    }
  }
  var counters = $$('.facts dt').filter(function (dt) { return !dt.classList.contains('facts__route'); }).map(function (dt) {
    var tn = dt.firstChild;
    if (!tn || tn.nodeType !== 3) return null;
    var sp = document.createElement('span');
    sp.className = 'num';
    sp.textContent = tn.textContent;
    dt.replaceChild(sp, tn);
    return sp;
  }).filter(Boolean);
  function countUp(sp) {
    var fin = sp.textContent, to = parseInt(fin, 10);
    if (RM || !(to > 0)) return;
    sp.style.minWidth = sp.getBoundingClientRect().width + 'px';
    sp.style.display = 'inline-block';
    sp.textContent = '0';
    var t0 = performance.now();
    (function step(now) {
      var k = clamp((now - t0) / 1400, 0, 1);
      if (k >= 1) { sp.textContent = fin; sp.style.minWidth = ''; sp.style.display = ''; return; }
      sp.textContent = String(Math.round(to * expo(k)));
      requestAnimationFrame(step);
    })(t0);
  }

  /* ---------------------------------------------------------------- media visibility (autoplay only when seen) */
  function safePlay(v) { if (!v) return; var p = v.play(); if (p && p.catch) p.catch(function () { /* autoplay blocked: poster stays */ }); }
  var mediaIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      var v = en.target;
      if (en.isIntersecting) {
        if (v.dataset.src && !v.getAttribute('src')) { v.src = v.dataset.src; }
        if (!RM) safePlay(v);
      } else if (!v.paused) v.pause();
    });
  }, { rootMargin: '120px 0px', threshold: 0 });
  [heroVideo, vfVideo].concat(reelVideos).forEach(function (v) {
    if (RM) { v.removeAttribute('autoplay'); v.pause(); }
    mediaIO.observe(v);
  });
  if (RM) { reelVideos.forEach(function (v) { if (v.dataset.src) v.src = v.dataset.src; v.preload = 'metadata'; }); }

  /* ---------------------------------------------------------------- reveal */
  var revealIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var el = en.target;
      el.classList.add('is-in');
      revealIO.unobserve(el);
      if (el.classList.contains('facts')) counters.forEach(countUp);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  $$('[data-reveal]').forEach(function (el) { revealIO.observe(el); });

  /* ---------------------------------------------------------------- 05 chat inquiry */
  var log = $('#log'), chatInput = $('#chatInput'), stepNow = $('#stepNow'), bar = $('#bar'), chat = $('#chat');
  var planeStage = $('#planeStage'), contact = $('#contact');
  var answers = {}, chatStarted = false, chatBusy = false;
  var QUESTIONS = [
    { k: 'cat', label: '분야', q: '안녕하세요, 프리투플라이입니다.<strong>어떤 영상을 생각하고 계세요?</strong>',
      chips: D.cats.map(function (c) { return c.name; }).concat(['아직 잘 모르겠어요']) },
    { k: 'budget', label: '예산', q: '<strong>예산은 어느 정도로 생각하세요?</strong>대략이어도 괜찮아요. 맞춰서 제안드릴게요.',
      chips: ['100만 원 미만', '100–300만 원', '300–500만 원', '500만 원 이상', '상담하고 정할게요'] },
    { k: 'when', label: '시기', q: '<strong>언제쯤 필요하세요?</strong>',
      chips: ['2주 안에', '한 달 안에', '두세 달 안에', '아직 미정이에요'] },
    { k: 'contact', label: '연락처', q: '<strong>마지막으로, 연락받으실 성함과 번호를 남겨주세요.</strong>', form: true }
  ];

  function scrollLog() { log.scrollTop = log.scrollHeight; }
  function addMsg(who, htmlStr) {
    var m = document.createElement('div');
    m.className = 'msg msg--' + who;
    m.innerHTML = htmlStr;
    log.appendChild(m);
    scrollLog();
    return m;
  }
  function typing(ms) {
    var t = document.createElement('div');
    t.className = 'msg msg--bot msg--typing';
    t.setAttribute('aria-label', '입력 중');
    t.innerHTML = '<i></i><i></i><i></i>';
    log.appendChild(t);
    scrollLog();
    return wait(RM ? 120 : ms).then(function () { t.remove(); });
  }
  function setProgress(answered, current) {
    bar.style.width = (answered / QUESTIONS.length * 100) + '%';
    stepNow.textContent = Math.min(current + 1, QUESTIONS.length);
  }
  function ask(i) {
    chatBusy = true;
    setProgress(i, i);
    chatInput.innerHTML = '';
    return typing(i === 0 ? 700 : 560).then(function () {
      addMsg('bot', QUESTIONS[i].q);
      return wait(RM ? 0 : 160);
    }).then(function () {
      chatBusy = false;
      if (QUESTIONS[i].form) showForm(); else showChips(i);
    });
  }
  function showChips(i) {
    chatInput.innerHTML = '<div class="chips" role="group" aria-label="' + QUESTIONS[i].label + ' 선택">' +
      QUESTIONS[i].chips.map(function (c, j) {
        return '<button type="button" class="chip" style="animation-delay:' + (RM ? 0 : j * 40) + 'ms" data-v="' + esc(c) + '">' + esc(c) + '</button>';
      }).join('') + '</div>';
    chatInput.onclick = function (e) {
      var b = e.target.closest('.chip');
      if (!b || chatBusy) return;
      var val = b.getAttribute('data-v');
      answers[QUESTIONS[i].k] = val;
      chatInput.onclick = null;
      chatInput.innerHTML = '';
      addMsg('me', esc(val));
      setProgress(i + 1, i + 1);
      ask(i + 1);
    };
  }
  function formatTel(v) {
    var d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length < 4) return d;
    if (d.indexOf('02') === 0) {
      if (d.length <= 5) return d.slice(0, 2) + '-' + d.slice(2);
      if (d.length <= 9) return d.slice(0, 2) + '-' + d.slice(2, d.length - 4) + '-' + d.slice(-4);
      return d.slice(0, 2) + '-' + d.slice(2, 6) + '-' + d.slice(6, 10);
    }
    if (d.length <= 7) return d.slice(0, 3) + '-' + d.slice(3);
    if (d.length <= 10) return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6);
    return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7);
  }
  function showForm() {
    chatInput.onclick = null;
    chatInput.innerHTML =
      '<form class="form" id="chatForm" novalidate>' +
      '<div class="field"><input id="fName" name="name" type="text" placeholder=" " autocomplete="name" maxlength="30" required><label for="fName">성함 또는 회사명</label></div>' +
      '<div class="field"><input id="fTel" name="tel" type="tel" inputmode="numeric" placeholder=" " autocomplete="tel" maxlength="13" required><label for="fTel">연락처</label></div>' +
      '<button class="btn-send" type="submit"><b class="mag-in"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6l-.02 6.53L15 12 3.38 13.87z"/></svg>보내기</b></button>' +
      '<p class="form__note">보내기를 누르면 남겨주신 번호로 직접 연락드려요.</p>' +
      '</form>';
    var form = $('#chatForm'), fName = $('#fName'), fTel = $('#fTel');
    fTel.addEventListener('input', function () { fTel.value = formatTel(fTel.value); fTel.parentNode.classList.remove('is-err'); });
    fName.addEventListener('input', function () { fName.parentNode.classList.remove('is-err'); });
    if (FINE) setTimeout(function () { fName.focus({ preventScroll: true }); }, 80);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = fName.value.trim(), tel = fTel.value.trim();
      var okName = name.length >= 1, okTel = tel.replace(/\D/g, '').length >= 9;
      fName.parentNode.classList.toggle('is-err', !okName);
      fTel.parentNode.classList.toggle('is-err', !okTel);
      if (!okName) { fName.focus(); return; }
      if (!okTel) { fTel.focus(); return; }
      answers.name = name; answers.tel = tel;
      chatInput.innerHTML = '';
      addMsg('me', esc(name) + ' · ' + esc(tel));
      setProgress(4, 3);
      chatBusy = true;
      flyPlane().then(finish);
    });
  }
  function finish() {
    return typing(520).then(function () {
      addMsg('bot', '<strong>곧 연락드릴게요</strong>' + esc(answers.name) + '님, 보내주신 내용을 확인하고 남겨주신 번호로 연락드리겠습니다. 급하시면 카카오톡으로 바로 이어서 이야기 나눠요.');
      chatInput.innerHTML = '<div class="done"><a class="btn-kakao" href="' + KAKAO + '" target="_blank" rel="noopener"><b class="mag-in">' + KAKAO_SVG + '카카오톡으로 바로 이어서</b></a>' +
        '<button type="button" class="btn-ghost" id="restart">처음부터 다시</button></div>';
      chat.classList.add('is-done');
      $('#restart').addEventListener('click', restartChat);
      chatBusy = false;
    });
  }
  function restartChat() {
    answers = {};
    log.innerHTML = '';
    chat.classList.remove('is-done');
    ask(0);
  }

  /* paper sheet -> folds into a plane -> flies off leaving a dotted trail (no network request) */
  var PLANE_SVG = '<svg class="plane" viewBox="0 0 120 80" aria-hidden="true">' +
    '<polygon points="2,38 118,4 46,48" fill="#ffffff"/><polygon points="46,48 118,4 58,74" fill="#dbeefa"/>' +
    '<polygon points="46,48 58,74 50,52" fill="#9fd7f7"/><polygon points="2,38 46,48 40,56" fill="#e9f5fd"/></svg>';
  function flyPlane() {
    var sec = contact.getBoundingClientRect();
    var cr = chat.getBoundingClientRect();
    var x0 = cr.left - sec.left + cr.width / 2, y0 = cr.top - sec.top + cr.height * 0.46;
    var sheet = document.createElement('div');
    sheet.className = 'sheet';
    sheet.style.left = x0 + 'px'; sheet.style.top = y0 + 'px';
    sheet.innerHTML = '<h4>영상 제작 문의</h4>' +
      ['cat', 'budget', 'when'].map(function (k, i) { return '<p><span>' + QUESTIONS[i].label + '</span>' + esc(answers[k]) + '</p>'; }).join('') +
      '<p><span>성함</span>' + esc(answers.name) + '</p>' +
      '<span class="logo">FREE<span class="logo__2">2</span>FLY</span>';
    planeStage.appendChild(sheet);
    if (RM || !sheet.animate) {
      return wait(RM ? 700 : 900).then(function () { sheet.remove(); });
    }
    var a1 = sheet.animate([
      { opacity: 0, transform: 'translateY(60px) scale(.6) rotate(-6deg)' },
      { opacity: 1, transform: 'translateY(0) scale(1) rotate(-2deg)' }
    ], { duration: 620, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' });
    return a1.finished.then(function () { return wait(420); }).then(function () {
      var a2 = sheet.animate([
        { transform: 'scale(1) rotate(-2deg)', opacity: 1, borderRadius: '6px' },
        { transform: 'scale(.62,.5) rotateX(55deg) rotate(-10deg)', opacity: 1, offset: 0.45 },
        { transform: 'scale(.18,.08) rotate(-24deg)', opacity: 0, borderRadius: '40px' }
      ], { duration: 520, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
      return a2.finished;
    }).then(function () {
      sheet.remove();
      var W = planeStage.clientWidth;
      var svgNS = 'http://www.w3.org/2000/svg';
      var trail = document.createElementNS(svgNS, 'svg');
      trail.setAttribute('class', 'trail');
      var path = document.createElementNS(svgNS, 'path');
      trail.appendChild(path);
      planeStage.appendChild(trail);
      var holder = document.createElement('div');
      holder.innerHTML = PLANE_SVG;
      var plane = holder.firstChild;
      planeStage.appendChild(plane);
      var m = mobile();
      var P = [
        [x0, y0],
        [x0 - (m ? 150 : 260), y0 + (m ? 110 : 150)],
        [x0 + (m ? 140 : 260), y0 - (m ? 120 : 200)],
        [W + 160, y0 - vh * 0.85]
      ];
      function bz(t, i) {
        var u = 1 - t;
        return u * u * u * P[0][i] + 3 * u * u * t * P[1][i] + 3 * u * t * t * P[2][i] + t * t * t * P[3][i];
      }
      function dbz(t, i) {
        var u = 1 - t;
        return 3 * u * u * (P[1][i] - P[0][i]) + 6 * u * t * (P[2][i] - P[1][i]) + 3 * t * t * (P[3][i] - P[2][i]);
      }
      var pts = [];
      var dur = 1500, t0 = performance.now();
      return new Promise(function (resolve) {
        function step(now) {
          var k = Math.min(1, (now - t0) / dur);
          var t = easeIO(k) * 0.55 + k * 0.45;
          var x = bz(t, 0), y = bz(t, 1);
          var ang = Math.atan2(dbz(t, 1), dbz(t, 0)) * 180 / Math.PI + 16.3;
          var sc = 0.45 + Math.min(1, k * 4) * 0.55 - Math.max(0, k - 0.7) * 0.6;
          plane.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) rotate(' + ang.toFixed(1) + 'deg) scale(' + sc.toFixed(3) + ')';
          plane.style.opacity = String(Math.min(1, k * 6));
          pts.push(x.toFixed(1) + ' ' + y.toFixed(1));
          path.setAttribute('d', 'M' + pts.join(' L'));
          if (k < 1) requestAnimationFrame(step);
          else {
            plane.remove();
            trail.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 900, easing: 'ease-out', fill: 'forwards' })
              .finished.then(function () { trail.remove(); });
            resolve();
          }
        }
        requestAnimationFrame(step);
      });
    });
  }

  /* start the conversation when the chat scrolls into view */
  var chatIO = new IntersectionObserver(function (entries) {
    if (entries[0].isIntersecting && !chatStarted) {
      chatStarted = true;
      chatIO.disconnect();
      ask(0);
    }
  }, { threshold: 0.25 });
  chatIO.observe(chat);

  var worksEl = $('#works'), worksTopDoc = 0, wClip = null;
  function worksEdge(y) {
    if (RM) return;
    var top = worksTopDoc - y;
    var R = (mobile() ? 36 : 56) * clamp((top - vh * 0.06) / (vh * 0.9), 0, 1);
    var v = R > 0.5 ? 'inset(0 round ' + R.toFixed(1) + 'px ' + R.toFixed(1) + 'px 0 0)' : '';
    if (v !== wClip) { wClip = v; worksEl.style.clipPath = v; }
  }
  var stars = $$('.contact__stars i'), STAR_F = [0.16, 0.09, 0.035], contactTopDoc = 0, contactH = 0;
  function starsUpdate(y) {
    if (RM || !stars.length) return;
    var top = contactTopDoc - y;
    if (top > vh || top + contactH < 0) return;
    var c = top + contactH / 2 - vh / 2;
    for (var i = 0; i < stars.length; i++) stars[i].style.transform = 'translate3d(0,' + (-c * STAR_F[i]).toFixed(1) + 'px,0)';
  }
  var ftMark = $('.ft__mark'), ftChars = [], ftTopDoc = 0, ftLast = -1;
  $$('span', ftMark).forEach(function (sp) {
    if (sp.classList.contains('logo__2')) { sp.classList.add('ch'); ftChars.push(sp); return; }
    sp.innerHTML = sp.textContent.split('').map(function (ch) { return '<span class="ch">' + esc(ch) + '</span>'; }).join('');
    ftChars = ftChars.concat($$('.ch', sp));
  });
  function footerUpdate(y) {
    if (RM) return;
    var top = ftTopDoc - y;
    var travel = vh - (ftTopDoc - docMax);
    var end = Math.max(80, Math.min(vh * 0.55, travel - 24));
    var p = range(vh - top, 0, end);
    if (Math.abs(p - ftLast) < 0.0005) return;
    ftLast = p;
    for (var i = 0; i < ftChars.length; i++) {
      var q = easeOut(range(p, i * 0.065, i * 0.065 + 0.5));
      ftChars[i].style.transform = q >= 1 ? 'none' : 'translate3d(0,' + ((1 - q) * 120).toFixed(2) + '%,0)';
    }
  }
  function splitLines(el) {
    if (el._src == null) el._src = el.innerHTML;
    el.innerHTML = el._src;
    var units = [], gap = false;
    Array.prototype.slice.call(el.childNodes).forEach(function (n) {
      if (n.nodeType === 3) {
        var frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { gap = true; frag.appendChild(document.createTextNode(' ')); return; }
          var w = document.createElement('span');
          w.className = 'w';
          w.textContent = part;
          frag.appendChild(w);
          units.push({ el: w, gap: gap, text: true });
          gap = false;
        });
        el.replaceChild(frag, n);
      } else if (n.nodeType === 1) {
        if (n.tagName === 'BR') gap = false;
        else { units.push({ el: n, gap: gap, text: false }); gap = false; }
      }
    });
    var lines = [], cur = null, lastTop = 0;
    units.forEach(function (u) {
      var t = u.el.offsetTop;
      if (!cur || Math.abs(t - lastTop) > 3) { cur = []; lines.push(cur); lastTop = t; }
      cur.push((cur.length && u.gap ? ' ' : '') + (u.text ? esc(u.el.textContent) : u.el.outerHTML));
    });
    el.innerHTML = lines.map(function (ln, i) {
      return '<span class="ln"><span class="ln__i" style="--i:' + i + '">' + ln.join('') + '</span></span>';
    }).join('');
    el.classList.add('split');
  }
  function splitAll() {
    $$('.works__title,.about__title,.contact__title,.flight__title,.takeoff__line,.takeoff__credit').forEach(splitLines);
    $$('.takeoff__line,.takeoff__credit').forEach(function (el) { el.classList.add('split--scrub'); });
    toLines = $$('.takeoff__end .ln__i');
    dirty = true;
  }
  function measureLayout() {
    var y = window.scrollY;
    worksTopDoc = worksEl.getBoundingClientRect().top + y;
    var cr = contact.getBoundingClientRect();
    contactTopDoc = cr.top + y; contactH = cr.height;
    ftTopDoc = ftMark.getBoundingClientRect().top + y;
    docMax = Math.max(0, html.scrollHeight - window.innerHeight);
    measureMq();
    ftLast = -1;
    dirty = true;
  }
  $$('.eyebrow').forEach(function (el) { el.innerHTML = '<span class="eb"><span>' + el.innerHTML + '</span></span>'; });
  $$('.hd__nav a').forEach(function (a) {
    var t = esc(a.textContent);
    a.innerHTML = '<span class="roll"><span>' + t + '</span><span aria-hidden="true">' + t + '</span></span>';
  });
  [$('.kakao-btn'), moreBtn].forEach(function (b) {
    var w = document.createElement('b');
    w.className = 'mag-in';
    while (b.firstChild) w.appendChild(b.firstChild);
    b.appendChild(w);
  });

  /* ---------------------------------------------------------------- main loop */
  var lastScroll = -1, dirty = true, lastNow = 0, prevY = window.scrollY, svS = 0;
  function onScrollFrame(y) {
    headerUpdate(y);
    takeoffUpdate();
    flightUpdate();
    tabsUpdate();
    reelParallax();
    worksEdge(y);
    starsUpdate(y);
    footerUpdate(y);
  }
  function frame(now) {
    var dt = lastNow ? clamp((now - lastNow) / 1000, 0.001, 0.05) : 1 / 60;
    lastNow = now;
    ssFrame(dt);
    var y = window.scrollY;
    svS += ((y - prevY) / dt - svS) * lerpK(0.18, dt);
    prevY = y;
    if (y !== lastScroll || dirty) {
      onScrollFrame(y);
      lastScroll = y; dirty = false;
    }
    if (gl && toVisible) drawFog(now);
    if (flVisible && !RM) updateTimecode(now);
    pointerFrame(dt);
    aimFrame(dt);
    magFrame(dt);
    marqueeFrame(dt);
    requestAnimationFrame(frame);
  }

  var rzT = 0, lastW = window.innerWidth;
  window.addEventListener('resize', function () {
    clearTimeout(rzT);
    rzT = setTimeout(function () {
      var wasMobile = mobile();
      vw = window.innerWidth; vh = window.innerHeight;
      resizeFog();
      movePill();
      if (vw !== lastW) { lastW = vw; splitAll(); }
      measureLayout();
      if (wasMobile !== mobile()) { /* breakpoint crossing: keep content, re-measure only */ }
      dirty = true;
    }, 120);
  });

  /* ---------------------------------------------------------------- boot */
  initFog();
  renderAll();
  movePill();
  splitAll();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { movePill(); splitAll(); measureLayout(); });
  if (RM) {
    toStick.style.setProperty('--sky', '0');
    flCopy.classList.add('is-live');
  }
  var hashCat = (location.hash.match(/^#works-(\w+)/) || [])[1];
  if (hashCat) setFilter(hashCat, false);
  measureLayout();
  if (window.ResizeObserver) new ResizeObserver(function () { measureLayout(); }).observe(body);
  requestAnimationFrame(frame);
})();
