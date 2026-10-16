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
  const isDesk = () => mq('(min-width: 900px)').matches;
  const pad2 = n => String(n).padStart(2, '0');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const body = document.body;

  const byId = Object.fromEntries(D.works.map(w => [w.id, w]));
  const catName = Object.fromEntries(D.cats.map(c => [c.key, c.name]));
  const vertical = new Set(D.featured.filter(f => f.vertical).map(f => f.id));
  const playVideo = v => { if (!v || RM) return; const p = v.play(); if (p && p.catch) p.catch(() => {}); };
  const loadVideo = v => { if (v && !v.src && v.dataset.src) { v.src = v.dataset.src; } };

  /* ---------------- lightbox ---------------- */
  const lb = $('#lb'), lbFrame = $('#lbFrame'), lbClose = $('#lbClose');
  let lastFocus = null;
  function openLB(id) {
    const w = byId[id];
    if (!w) return;
    lastFocus = document.activeElement;
    lb.classList.toggle('is-vert', vertical.has(id));
    lbFrame.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) +
      '?autoplay=1&rel=0&playsinline=1" title="' + esc(w.title) + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen"></iframe>';
    $('#lbTitle').textContent = w.title;
    $('#lbSub').textContent = [w.client, catName[w.cat], w.region].filter(Boolean).join(' · ');
    lb.hidden = false;
    body.classList.add('lb-open');
    reelV.pause();
    fpHide();
    lbClose.focus({ preventScroll: true });
  }
  function closeLB() {
    if (lb.hidden) return;
    lb.hidden = true;
    lbFrame.innerHTML = '';
    body.classList.remove('lb-open');
    if (reelVisible) playVideo(reelV);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  lbClose.addEventListener('click', closeLB);
  lb.addEventListener('click', e => { if (e.target.hasAttribute('data-close')) closeLB(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeLB(); setMenu(false); }
    if (e.key === 'Tab' && !lb.hidden) { e.preventDefault(); lbClose.focus(); }
  });
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-play]');
    if (t) { e.preventDefault(); openLB(t.getAttribute('data-play')); }
  });

  /* ---------------- loader + showreel ---------------- */
  const reel = $('#reel'), reelV = $('#reelVideo');
  const num = $('#loaderNum'), line = $('#loaderLine'), loader = $('#loader');
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
  function loaderTick(now) {
    const el = now - t0;
    let buf = 0;
    try { if (reelV.duration && reelV.buffered.length) buf = reelV.buffered.end(reelV.buffered.length - 1) / reelV.duration; } catch (_) {}
    const timeP = clamp(el / MIN, 0, 1);
    const target = ready ? timeP * 100 : Math.min(timeP * 100, 40 + buf * 52, 92);
    shown += (target - shown) * (RM ? 1 : 0.14);
    if (ready && timeP >= 1 && target - shown < 0.6) shown = 100;
    num.textContent = String(Math.floor(shown)).padStart(3, '0');
    line.style.transform = 'scaleX(' + (shown / 100) + ')';
    if (shown >= 100) return finishLoader();
    requestAnimationFrame(loaderTick);
  }
  function finishLoader() {
    if (finished) return;
    finished = true;
    try { reelV.currentTime = 0; } catch (_) {}
    playVideo(reelV);
    body.classList.add('loaded');
    body.classList.remove('is-loading');
    setTimeout(() => { loader.style.display = 'none'; }, 1300);
    fitAll();
  }
  requestAnimationFrame(loaderTick);

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
  function swapText(el, text) { el.innerHTML = '<span class="swap">' + esc(text) + '</span>'; }
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
  (function reelLoop() {
    if (reelVisible && !reelV.paused) syncReel();
    requestAnimationFrame(reelLoop);
  })();
  const openCurrent = () => openLB(segs[Math.max(cur, 0)].id);
  reelPlay.addEventListener('click', e => { e.stopPropagation(); openCurrent(); });

  // desktop PLAY cursor
  const cursor = $('#cursor');
  if (FINE) {
    let mx = -300, my = -300, cx = -300, cy = -300, cs = 0, ts = 0, seen = false;
    const inReel = () => { const r = reel.getBoundingClientRect(); return my >= r.top && my <= r.bottom && mx >= r.left && mx <= r.right; };
    reel.addEventListener('pointermove', e => {
      mx = e.clientX; my = e.clientY;
      if (!seen) { cx = mx; cy = my; seen = true; }
      ts = e.target.closest('a,button') ? 0.45 : 1;
    });
    reel.addEventListener('pointerleave', () => { ts = 0; });
    window.addEventListener('scroll', () => { if (ts && !inReel()) ts = 0; }, { passive: true });
    reel.addEventListener('click', e => { if (!e.target.closest('a,button') && finished) openCurrent(); });
    (function curLoop() {
      cx += (mx - cx) * 0.2; cy += (my - cy) * 0.2;
      const target = lb.hidden && finished ? ts : 0;
      cs += (target - cs) * 0.16;
      cursor.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0) scale(' + cs.toFixed(3) + ')';
      requestAnimationFrame(curLoop);
    })();
  } else {
    reel.addEventListener('click', e => { if (!e.target.closest('a,button') && finished && e.target === reelV) openCurrent(); });
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
  function fitAll() { $$('.fit').forEach(fit); movePill(); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAll);
  let rz;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(fitAll, 120); });

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

  /* ---------------- reveal ---------------- */
  const revIO = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); revIO.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  $$('[data-reveal]').forEach(el => revIO.observe(el));

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
        if (rect.top < 60 || rect.top > window.innerHeight * 0.45) window.scrollTo({ top: window.scrollY + rect.top - 80, behavior: RM ? 'auto' : 'smooth' });
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
      if (r.bottom > window.innerHeight || r.top < 0) window.scrollTo({ top: window.scrollY + card.getBoundingClientRect().top - 80, behavior: RM ? 'auto' : 'smooth' });
    }, 120);
  });

  // view toggle
  const tBtns = $$('.toggle button'), pill = $('.toggle__pill');
  function movePill() {
    const on = tBtns.find(b => b.classList.contains('is-on'));
    if (!on || !pill) return;
    pill.style.width = on.offsetWidth + 'px';
    pill.style.transform = 'translateX(' + on.offsetLeft + 'px)';
  }
  function setView(v) {
    worksSec.dataset.view = v;
    wlist.hidden = v !== 'list';
    wgrid.hidden = v !== 'grid';
    tBtns.forEach(b => { const on = b.dataset.view === v; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    movePill();
    fpHide();
    closeRows(null);
    closeGrid();
    observePreviews();
  }
  tBtns.forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  movePill();

  // desktop: floating preview following the cursor
  const fp = $('#fprev'), fpV = $('video', fp), fpTag = $('#fprevTag');
  let fpId = null, fpOn = false, fx = -999, fy = -999, tx = -999, ty = -999;
  function fpShow(w) {
    if (!FINE || !isDesk()) return;
    if (fpId !== w.id) {
      fpId = w.id;
      fp.classList.toggle('vert', vertical.has(w.id));
      fpV.poster = 'media/prev/' + w.id + '.jpg';
      fpV.src = 'media/prev/' + w.id + '.mp4';
      fpTag.textContent = catName[w.cat];
    }
    if (!fpOn) { fx = tx; fy = ty; }
    fpOn = true;
    fp.classList.add('on');
    playVideo(fpV);
  }
  function fpHide() {
    fpOn = false;
    fp.classList.remove('on');
    fpV.pause();
  }
  if (FINE) {
    document.addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; }, { passive: true });
    (function fpLoop() {
      if (fpOn) {
        fx += (tx - fx) * 0.15; fy += (ty - fy) * 0.15;
        const w = fp.offsetWidth, h = fp.offsetHeight;
        let x = fx + 34;
        if (x + w > window.innerWidth - 16) x = fx - w - 34;
        const y = clamp(fy - h / 2, 12, window.innerHeight - h - 12);
        fp.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
      }
      requestAnimationFrame(fpLoop);
    })();
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

  /* ---------------- archive ---------------- */
  const chips = $('#chips'), agrid = $('#agrid'), moreBtn = $('#moreBtn'), moreLeft = $('#moreLeft');
  const PAGE = isDesk() ? 16 : 10;
  let filter = 'all', limit = PAGE;
  $('#allCount').textContent = D.works.length;
  chips.innerHTML = [{ key: 'all', name: '전체', count: D.works.length }].concat(D.cats).map(c =>
    '<button class="chip' + (c.key === 'all' ? ' is-on' : '') + '" type="button" role="tab" aria-selected="' + (c.key === 'all') + '" data-cat="' + c.key + '">' + esc(c.name) + '<sup>' + c.count + '</sup></button>').join('');
  function renderAll(from) {
    const list = filter === 'all' ? D.works : D.works.filter(w => w.cat === filter);
    const start = from || 0;
    const html = list.slice(start, limit).map((w, k) =>
      '<button class="aitem" type="button" data-play="' + w.id + '" style="--d:' + k + '">' +
        '<span class="aitem__m"><img src="media/thumbs/' + w.id + '.jpg" alt="" loading="lazy" decoding="async"></span>' +
        '<b>' + esc(w.title) + '</b><em>' + metaLine(w) + '</em></button>').join('');
    if (start) agrid.insertAdjacentHTML('beforeend', html); else agrid.innerHTML = html;
    const left = list.length - limit;
    moreBtn.parentElement.hidden = left <= 0;
    moreLeft.textContent = left > 0 ? '+' + left : '';
  }
  function applyFilter(key, scroll) {
    filter = key; limit = PAGE;
    $$('.chip', chips).forEach(c => { const on = c.dataset.cat === key; c.classList.toggle('is-on', on); c.setAttribute('aria-selected', on ? 'true' : 'false'); });
    renderAll();
    const chip = $('.chip.is-on', chips);
    if (chip) chips.scrollTo({ left: chip.offsetLeft - 20, behavior: RM ? 'auto' : 'smooth' });
    if (scroll) $('#all').scrollIntoView({ behavior: RM ? 'auto' : 'smooth' });
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
      '<span class="pcard__ck" aria-hidden="true"></span>' +
      '<span class="pcard__n">' + esc(c.name) + '<small>작업 ' + c.count + '편</small></span></label>').join('');
  $$('.pcard input').forEach(i => i.addEventListener('change', () => i.parentElement.classList.toggle('is-on', i.checked)));
  $$('.opts').forEach(g => g.addEventListener('click', e => {
    const b = e.target.closest('.opt');
    if (!b) return;
    const on = !b.classList.contains('is-on');
    $$('.opt', g).forEach(o => { o.classList.remove('is-on'); o.setAttribute('aria-pressed', 'false'); });
    if (on) { b.classList.add('is-on'); b.setAttribute('aria-pressed', 'true'); }
  }));
  const phoneDigits = v => v.replace(/\D/g, '');
  form.phone.addEventListener('input', () => {
    const d = phoneDigits(form.phone.value).slice(0, 11);
    form.phone.value = d.length < 4 ? d : d.length < 8 ? d.slice(0, 3) + '-' + d.slice(3) : d.slice(0, 3) + '-' + d.slice(3, d.length - 4) + '-' + d.slice(-4);
  });
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
    $('#doneSum').innerHTML = items.map(t => '<span>' + esc(t) + '</span>').join('');
    form.hidden = true;
    done.hidden = false;
    done.focus({ preventScroll: true });
    window.scrollTo({ top: window.scrollY + $('#contact').getBoundingClientRect().top, behavior: RM ? 'auto' : 'smooth' });
  });
  $('#inqAgain').addEventListener('click', () => {
    form.reset();
    $$('.pcard').forEach(p => p.classList.remove('is-on'));
    $$('.opt.is-on').forEach(o => { o.classList.remove('is-on'); o.setAttribute('aria-pressed', 'false'); });
    done.hidden = true;
    form.hidden = false;
    $$('#inqForm [data-reveal]').forEach(el => el.classList.add('is-in'));
  });
})();
