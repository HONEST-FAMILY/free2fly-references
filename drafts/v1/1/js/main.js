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
    requestAnimationFrame(function () { html.classList.add('is-loaded'); });
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
    window.scrollTo({ top: top, behavior: RM ? 'auto' : 'smooth' });
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

  function takeoffUpdate() {
    toVisible = inView(takeoff);
    if (RM || !toVisible) return;
    var p = sceneProgress(takeoff);
    toProg = p;
    var s = toStick.style;
    var m = range(p, 0.08, 0.56);
    fogDensity = 1 - easeOut(range(p, 0.04, 0.72));
    s.setProperty('--sky', (0.4 * (1 - easeOut(range(p, 0, 0.5)))).toFixed(3));
    s.setProperty('--ms', (1 + m * 0.6).toFixed(3));
    s.setProperty('--mo', (1 - easeOut(m)).toFixed(3));
    s.setProperty('--mb', (m * 20).toFixed(1) + 'px');
    s.setProperty('--ls', (-0.012 + m * 0.14).toFixed(3) + 'em');
    s.setProperty('--vs', (1.24 - 0.24 * easeOut(p)).toFixed(3));
    s.setProperty('--eyo', (1 - range(p, 0, 0.16)).toFixed(3));
    s.setProperty('--cueo', (1 - range(p, 0, 0.07)).toFixed(3));
    s.setProperty('--eo', easeOut(range(p, 0.6, 0.86)).toFixed(3));
    s.setProperty('--fogo', fogDensity.toFixed(3));
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
  var flVisible = false, lastAlt = -1;
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
    var p = sceneProgress(flight);
    var s = flStick.style;
    var e = easeIO(range(p, 0.04, 0.56));
    var it0 = mobile() ? 27 : 28.5, ix0 = mobile() ? 6.5 : 23;
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
      '<div class="card__meta"><span class="card__no">' + pad2(i + 1) + '</span>' +
      '<div><h3>' + esc(w.title) + '</h3><p>' + esc(w.client) + '</p></div>' +
      '<span class="card__region">' + esc(w.region || '—') + '</span>' +
      '<span class="card__cat">' + cat + '</span></div></article>';
  }

  var revealCardIO = new IntersectionObserver(function (entries) {
    var k = 0;
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var el = en.target;
      el.style.transitionDelay = RM ? '0ms' : (k++ % 4) * 70 + 'ms';
      el.classList.add('is-in');
      revealCardIO.unobserve(el);
      setTimeout(function () { el.style.transitionDelay = ''; }, 1200);
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

  function setFilter(cat, scrollIntoGrid) {
    if (!catName[cat] && cat !== 'all') cat = 'all';
    filter = cat;
    $$('.tab', tabsIn).forEach(function (b) {
      var on = b.getAttribute('data-cat') === cat;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', String(on));
      if (on) tabsIn.scrollTo({ left: b.offsetLeft - (tabsIn.clientWidth - b.offsetWidth) / 2, behavior: RM ? 'auto' : 'smooth' });
    });
    grid.classList.add('is-swapping');
    setTimeout(function () {
      renderAll();
      grid.classList.remove('is-swapping');
      if (scrollIntoGrid) {
        var gTop = grid.getBoundingClientRect().top;
        var stickH = tabsBox.offsetHeight + (hdHidden ? 0 : hd.offsetHeight);
        if (gTop < stickH) window.scrollTo({ top: window.scrollY + gTop - stickH - 18, behavior: RM ? 'auto' : 'smooth' });
      }
    }, RM ? 0 : 220);
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
    grid.classList.add('is-swapping');
    setTimeout(function () {
      grid.setAttribute('data-view', view);
      renderMore();
      $$('.card', grid).forEach(function (c) { c.classList.add('is-in'); });
      grid.classList.remove('is-swapping');
    }, RM ? 0 : 200);
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
    openLB(byId[card.getAttribute('data-id')]);
  });

  /* custom cursor (desktop grid) + list peek (desktop list) */
  var cursor = $('#cursor'), peek = $('#peek'), peekImg = $('img', peek);
  var mx = -300, my = -300, cx = -300, cy = -300, px = -300, py = -300, peekS = 0.8, peekOn = false, peekId = '';
  if (FINE) {
    window.addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY;
      var t = e.target;
      var overMedia = view === 'grid' && t.closest && t.closest('#grid .card__media');
      cursor.classList.toggle('is-on', !!overMedia && !lbOpen);
      var row = view === 'list' && t.closest && t.closest('#grid .card');
      if (row) {
        var id = row.getAttribute('data-id');
        if (id !== peekId) { peekId = id; peekImg.src = 'media/thumbs/' + id + '.jpg'; }
        if (!peekOn) { px = mx; py = my; }
        peekOn = true;
      } else peekOn = false;
      peek.classList.toggle('is-on', peekOn && !lbOpen);
    }, { passive: true });
    document.addEventListener('mouseleave', function () { cursor.classList.remove('is-on'); peek.classList.remove('is-on'); peekOn = false; });
  }
  function pointerFrame() {
    if (!FINE) return;
    cx += (mx - cx) * 0.22; cy += (my - cy) * 0.22;
    cursor.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
    if (peekOn || peekS > 0.81) {
      px += (mx - px) * 0.14; py += (my - py) * 0.14;
      peekS += ((peekOn ? 1 : 0.8) - peekS) * 0.15;
      peek.style.transform = 'translate3d(' + (px + 40).toFixed(1) + 'px,' + py.toFixed(1) + 'px,0) translate(0,-50%) scale(' + peekS.toFixed(3) + ')';
    }
  }

  /* sticky tabs state */
  function tabsUpdate() {
    var top = tabsBox.getBoundingClientRect().top;
    var stuckAt = hdHidden ? 0 : hd.offsetHeight;
    tabsBox.classList.toggle('is-stuck', top <= stuckAt + 1 && grid.getBoundingClientRect().bottom > stuckAt + 60);
  }

  /* ---------------------------------------------------------------- lightbox */
  var lb = $('#lb'), lbPlayer = $('#lbPlayer');
  var lbOpen = false, lbPushed = false, lbLastFocus = null, lbTimer = 0;
  function openLB(w) {
    if (!w) return;
    clearTimeout(lbTimer);
    lbLastFocus = document.activeElement;
    stopAllPreviews();
    cursor.classList.remove('is-on'); peek.classList.remove('is-on');
    lbPlayer.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(w.id) +
      '?autoplay=1&rel=0&playsinline=1&modestbranding=1" title="' + esc(w.title) +
      '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen"></iframe>';
    $('#lbCat').textContent = catName[w.cat] || '';
    $('#lbTitle').textContent = w.title;
    $('#lbClient').textContent = w.client + (w.region ? ' · ' + w.region : '');
    $('#lbYt').href = 'https://www.youtube.com/watch?v=' + w.id;
    lb.hidden = false;
    body.classList.add('is-locked');
    lbOpen = true;
    requestAnimationFrame(function () { requestAnimationFrame(function () { lb.classList.add('is-open'); }); });
    try { history.pushState({ f2fLb: 1 }, ''); lbPushed = true; } catch (e) { lbPushed = false; }
    setTimeout(function () { var x = $('.lb__x', lb); if (x) x.focus({ preventScroll: true }); }, 60);
  }
  function closeLB(fromPop) {
    if (!lbOpen) return;
    lbOpen = false;
    lb.classList.remove('is-open');
    body.classList.remove('is-locked');
    lbTimer = setTimeout(function () { if (!lbOpen) { lb.hidden = true; lbPlayer.innerHTML = ''; } }, RM ? 0 : 480);
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
    reels.forEach(function (fig) {
      var r = reelBox.getBoundingClientRect();
      var c = r.top + r.height / 2 - vh / 2;
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
      if (en.isIntersecting) { en.target.classList.add('is-in'); revealIO.unobserve(en.target); }
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
      '<button class="btn-send" type="submit"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6l-.02 6.53L15 12 3.38 13.87z"/></svg>보내기</button>' +
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
      chatInput.innerHTML = '<div class="done"><a class="btn-kakao" href="' + KAKAO + '" target="_blank" rel="noopener">' + KAKAO_SVG + '카카오톡으로 바로 이어서</a>' +
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

  /* ---------------------------------------------------------------- main loop */
  var lastScroll = -1, dirty = true;
  function onScrollFrame(y) {
    headerUpdate(y);
    takeoffUpdate();
    flightUpdate();
    tabsUpdate();
    reelParallax();
  }
  function frame(now) {
    var y = window.scrollY;
    if (y !== lastScroll || dirty) {
      onScrollFrame(y);
      lastScroll = y; dirty = false;
    }
    if (gl && toVisible) drawFog(now);
    if (flVisible && !RM) updateTimecode(now);
    pointerFrame();
    requestAnimationFrame(frame);
  }

  var rzT = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rzT);
    rzT = setTimeout(function () {
      var wasMobile = mobile();
      vw = window.innerWidth; vh = window.innerHeight;
      resizeFog();
      movePill();
      if (wasMobile !== mobile()) { /* breakpoint crossing: keep content, re-measure only */ }
      dirty = true;
    }, 120);
  });

  /* ---------------------------------------------------------------- boot */
  initFog();
  renderAll();
  movePill();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(movePill);
  if (RM) {
    toStick.style.setProperty('--sky', '0');
    flCopy.classList.add('is-live');
  }
  var hashCat = (location.hash.match(/^#works-(\w+)/) || [])[1];
  if (hashCat) setFilter(hashCat, false);
  requestAnimationFrame(frame);
})();
