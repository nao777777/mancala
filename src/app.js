(function () {
  'use strict';
  const E = window.MancalaEngine;
  const AI = window.MancalaAI;
  const $ = (s) => document.querySelector(s);
  const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ================= 設定の保存 ================= */
  const settings = { level: 'normal', order: 'first', guide: true, sound: true };
  try { Object.assign(settings, JSON.parse(localStorage.getItem('mancala-settings') || '{}')); } catch (e) { /* 使えない環境 */ }
  function saveSettings() { try { localStorage.setItem('mancala-settings', JSON.stringify(settings)); } catch (e) { /* 無視 */ } }

  /* ================= テクスチャ（SVGをdata URIで生成） ================= */
  const svgURI = (s) => 'url("data:image/svg+xml,' + encodeURIComponent(s) + '")';
  function grain(seed, w, h, fx, fy, alpha) {
    return svgURI(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><filter id="g" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${fx} ${fy}" numOctaves="4" seed="${seed}"/><feColorMatrix values="0 0 0 0 0.42  0 0 0 0 0.22  0 0 0 0 0.05  ${alpha} 0 0 0 -0.62"/></filter><rect width="${w}" height="${h}" filter="url(#g)"/></svg>`);
  }
  const rugField = svgURI(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="#a3262b"/><path d="M32 4 L60 32 L32 60 L4 32Z" fill="none" stroke="#6c1318" stroke-width="5"/><path d="M32 16 L48 32 L32 48 L16 32Z" fill="#d8b06a"/><path d="M32 22 L42 32 L32 42 L22 32Z" fill="#8f1f24"/><path d="M32 27 L37 32 L32 37 L27 32Z" fill="#26356b"/><path d="M0 0 L7 0 L0 7Z M64 0 L57 0 L64 7Z M0 64 L7 64 L0 57Z M64 64 L57 64 L64 57Z" fill="#e8d3a2"/><rect x="30" y="0" width="4" height="3" fill="#e8d3a2"/><rect x="30" y="61" width="4" height="3" fill="#e8d3a2"/><rect x="0" y="30" width="3" height="4" fill="#e8d3a2"/><rect x="61" y="30" width="3" height="4" fill="#e8d3a2"/></svg>`);
  const rugBorder = svgURI(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" fill="#5e1015"/><path d="M0 34 L8 26 L16 34 L24 26 L32 34 L40 26 L48 34" fill="none" stroke="#e8d3a2" stroke-width="3.5"/><path d="M0 18 L8 10 L16 18 L24 10 L32 18 L40 10 L48 18" fill="none" stroke="#c9493c" stroke-width="3"/><rect x="21" y="38" width="6" height="6" fill="#26356b" transform="rotate(45 24 41)"/><rect x="5" y="2" width="6" height="6" fill="#d8b06a" transform="rotate(45 8 5)"/><rect x="37" y="2" width="6" height="6" fill="#d8b06a" transform="rotate(45 40 5)"/></svg>`);
  const weave = svgURI(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><filter id="w"><feTurbulence type="fractalNoise" baseFrequency="0.9 0.35" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 0.2  0 0 0 0 0.05  0 0 0 0 0.02  0 0 0 0.8 0"/></filter><rect width="200" height="200" filter="url(#w)"/></svg>`);
  const chevron = svgURI(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="38" viewBox="0 0 40 38"><rect width="40" height="38" fill="#f1e4c4"/><rect y="4" width="40" height="2.2" fill="#2b5aa8"/><rect y="31.8" width="40" height="2.2" fill="#2b5aa8"/><path d="M0 26 L10 12 L20 26 L30 12 L40 26" fill="none" stroke="#2b5aa8" stroke-width="5" stroke-linejoin="miter"/><path d="M0 19 L10 5 L20 19" fill="none" stroke="#6f93cf" stroke-width="0" /></svg>`);
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty('--grain-a', grain(7, 500, 560, 0.0022, 0.05, 1.7));
  rootStyle.setProperty('--grain-b', grain(19, 500, 560, 0.0022, 0.05, 1.7));
  rootStyle.setProperty('--grain', grain(3, 600, 600, 0.002, 0.04, 1.5));
  rootStyle.setProperty('--table-grain', grain(11, 900, 600, 0.0015, 0.03, 1.2));
  rootStyle.setProperty('--rug-field', rugField);
  rootStyle.setProperty('--rug-border', rugBorder);
  rootStyle.setProperty('--weave', weave);
  rootStyle.setProperty('--chevron', chevron);

  /* ================= 盤面の座標（1000×560） ================= */
  const COLS = [214, 328, 442, 558, 672, 786];
  const ROW_Y = [384, 160];
  const PIT_W = 104, PIT_H = 176;
  const STORE_W = 112, STORE_H = 400, STORE_Y = 272;
  const STORE_X = { 6: 912, 13: 88 };
  const isStore = (i) => i === 6 || i === 13;

  function center(i) {
    if (isStore(i)) return { x: STORE_X[i], y: STORE_Y };
    if (i < 6) return { x: COLS[i], y: ROW_Y[0] };
    return { x: COLS[12 - i], y: ROW_Y[1] };
  }
  function countPos(i) {
    if (i === 6) return { x: 912, y: 500 };
    if (i === 13) return { x: 88, y: 44 };
    const c = center(i);
    return { x: c.x, y: i < 6 ? 500 : 44 };
  }
  const L = (x) => x / 10 + '%';
  const T = (y) => y / 5.6 + '%';

  function mulberry(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 穴ごとに固定の「石を置く位置」。層ごとにずらして積み重ねる。
  const SLOTS = [];
  for (let i = 0; i < 14; i++) SLOTS[i] = buildSlots(i);
  function buildSlots(i) {
    const c = center(i);
    const store = isStore(i);
    const r = mulberry(i * 131 + 7);
    const out = [];
    const halfW = store ? 28 : 28;
    const halfH = store ? 160 : 56;
    for (let layer = 0; layer < 7; layer++) {
      const odd = layer % 2 === 1;
      const cand = [];
      const ox = odd ? 14 : 0, oy = odd ? 14 : 0;
      for (let y = -halfH + oy; y <= halfH - oy + 0.1; y += 28) {
        for (let x = -halfW + ox; x <= halfW - ox + 0.1; x += store ? 28 : 28) {
          cand.push({ x, y, k: Math.hypot(x * 0.8, y) + r() * (store ? 90 : 14) });
        }
      }
      cand.sort((a, b) => a.k - b.k);
      for (const p of cand) {
        const jx = (r() - 0.5) * 6, jy = (r() - 0.5) * 6;
        out.push({ x: c.x + p.x + jx, y: c.y + p.y + jy - layer * 4.5, z: 10 + layer * 120 + Math.round(p.y + 60) });
      }
    }
    return out;
  }

  /* ================= アバター ================= */
  function avatarSVG(o) {
    const hair = {
      short: `<path d="M13 34 C11 16 22 9 32 9 C44 9 53 16 51 34 C48 25 42 21 32 22 C24 22 17 25 13 34Z" fill="${o.hair}"/>`,
      long: `<path d="M11 50 C8 26 16 10 32 10 C48 10 56 26 53 50 L47 50 C49 36 46 26 40 23 C32 27 22 27 17 24 C15 32 15 42 17 50Z" fill="${o.hair}"/>`,
      bob: `<path d="M12 44 C9 22 19 10 32 10 C45 10 55 22 52 44 L46 44 C47 34 45 28 42 25 L22 25 C19 28 17 34 18 44Z" fill="${o.hair}"/>`,
    }[o.style];
    const brows = o.brows === 'sharp'
      ? '<path d="M21 31 L28 33 M43 31 L36 33" stroke="#3a2412" stroke-width="2" stroke-linecap="round"/>'
      : '<path d="M21 31 Q25 29 28 31 M36 31 Q39 29 43 31" stroke="#3a2412" stroke-width="1.8" fill="none" stroke-linecap="round"/>';
    const glasses = o.glasses ? '<g fill="none" stroke="#2a2a2a" stroke-width="1.6"><circle cx="25" cy="37" r="5"/><circle cx="39" cy="37" r="5"/><path d="M30 37 H34"/></g>' : '';
    const mouth = o.mouth === 'grin' ? '<path d="M26 45 Q32 51 38 45 Z" fill="#b43c3c"/>' : o.mouth === 'flat' ? '<path d="M27 47 H37" stroke="#8a3a2a" stroke-width="2" stroke-linecap="round"/>' : '<path d="M27 46 Q32 50 37 46" stroke="#8a3a2a" stroke-width="2" fill="none" stroke-linecap="round"/>';
    return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="${o.bg}"/>
      <path d="M8 64 C10 54 20 50 32 50 C44 50 54 54 56 64Z" fill="${o.shirt}"/>
      <rect x="27" y="44" width="10" height="9" fill="${o.skin}"/>
      ${o.style === 'long' ? hair : ''}
      <ellipse cx="32" cy="35" rx="16" ry="17" fill="${o.skin}"/>
      <ellipse cx="16.5" cy="37" rx="2.5" ry="3.5" fill="${o.skin}"/><ellipse cx="47.5" cy="37" rx="2.5" ry="3.5" fill="${o.skin}"/>
      ${o.style !== 'long' ? hair : `<path d="M16 30 C17 17 25 12 32 12 C40 12 48 17 48 30 C43 23 37 21 32 22 C26 21 20 24 16 30Z" fill="${o.hair}"/>`}
      <ellipse cx="25" cy="37.5" rx="1.9" ry="2.4" fill="#2a1a0e"/><ellipse cx="39" cy="37.5" rx="1.9" ry="2.4" fill="#2a1a0e"/>
      <circle cx="21" cy="43" r="2.6" fill="#ff9aa2" opacity=".5"/><circle cx="43" cy="43" r="2.6" fill="#ff9aa2" opacity=".5"/>
      ${brows}${glasses}${mouth}</svg>`;
  }
  const AVATARS = {
    me: { bg: '#8fd0ea', skin: '#f5d0ae', hair: '#4a2c17', style: 'short', shirt: '#2b5aa8', glasses: true, mouth: 'smile' },
    p2: { bg: '#a8dca0', skin: '#f2c9a0', hair: '#1f1a17', style: 'bob', shirt: '#d9643a', mouth: 'smile' },
    easy: { bg: '#ffc2d8', skin: '#f8d6bb', hair: '#f0c64e', style: 'long', shirt: '#ff7aa8', mouth: 'grin' },
    normal: { bg: '#ffd9a0', skin: '#f5cfae', hair: '#b0542a', style: 'long', shirt: '#7a55c7', mouth: 'smile' },
    hard: { bg: '#c9b8f0', skin: '#efc6a2', hair: '#2a2240', style: 'short', shirt: '#26356b', brows: 'sharp', mouth: 'flat' },
  };

  /* ================= サウンド（WebAudio合成） ================= */
  const sfx = (function () {
    let ctx = null, noise = null;
    function ensure() {
      if (!settings.sound) return null;
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        noise = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    function tone(freq, t, dur, vol, type) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
    }
    function tick(t, vol, freq) {
      const s = ctx.createBufferSource(); s.buffer = noise;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 2.5;
      const g = ctx.createGain(); g.gain.value = vol;
      s.connect(f).connect(g).connect(ctx.destination); s.start(t);
    }
    // ガラス同士が当たる「カチッ」
    function clink(delay, vol, pitch) {
      const c = ensure(); if (!c) return;
      const t = c.currentTime + (delay || 0);
      const p = (pitch || 1) * (0.9 + Math.random() * 0.2);
      const v = vol == null ? 1 : vol;
      tone(2350 * p, t, 0.09, 0.09 * v);
      tone(3620 * p, t, 0.06, 0.05 * v);
      tone(5480 * p, t, 0.04, 0.025 * v);
      tick(t, 0.5 * v, 4200 * p);
    }
    return {
      unlock() { ensure(); },
      drop(store) {
        clink(0, store ? 0.8 : 1, store ? 0.78 : 1);
        if (store) { const c = ensure(); if (c) tone(190, c.currentTime, 0.12, 0.08, 'triangle'); }
      },
      pickup(n) { for (let k = 0; k < Math.min(n, 6); k++) clink(k * 0.028 + Math.random() * 0.02, 0.55, 1.08); },
      extra() { const c = ensure(); if (!c) return; const t = c.currentTime; [1046.5, 1318.5, 1568].forEach((f, k) => tone(f, t + k * 0.08, 0.3, 0.07, 'triangle')); },
      capture() { const c = ensure(); if (!c) return; const t = c.currentTime; [784, 1046.5, 1318.5, 1568].forEach((f, k) => tone(f, t + k * 0.06, 0.28, 0.07, 'square')); },
      win() { const c = ensure(); if (!c) return; const t = c.currentTime; [523, 659, 784, 1046.5, 784, 1046.5].forEach((f, k) => tone(f, t + k * 0.11, 0.35, 0.07, 'triangle')); },
      lose() { const c = ensure(); if (!c) return; const t = c.currentTime; [523, 466, 392, 330].forEach((f, k) => tone(f, t + k * 0.16, 0.4, 0.06, 'triangle')); },
    };
  })();

  /* ================= ボードの組み立て ================= */
  const board = $('#board');
  const pitEls = [];
  const countEls = [];
  let guideEl, guideTag, handEl, handCount;

  function el(tag, cls, parent) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }
  function pitLabel(i) {
    if (i === 6) return 'あなたのゴール';
    if (i === 13) return '相手のゴール';
    return i < 6 ? `手前・左から${i + 1}番目の穴` : `奥・左から${13 - i}番目の穴`;
  }

  function buildBoard() {
    board.textContent = '';
    for (const side of ['l', 'r']) {
      const h = el('div', 'half ' + side, board);
      el('div', 'band back', h);
      el('div', 'band front', h);
    }
    el('div', 'seam', board);
    const hinge = el('div', 'hinge', board);
    hinge.style.top = T(272);
    el('div', 'clasp l', board);
    el('div', 'clasp r', board);

    for (let i = 0; i < 14; i++) {
      const c = center(i);
      let p;
      if (isStore(i)) {
        p = el('div', 'store', board);
        p.style.width = L(STORE_W); p.style.height = T(STORE_H);
      } else {
        p = el('button', 'pit', board);
        p.type = 'button';
        p.dataset.i = i;
        p.style.width = L(PIT_W); p.style.height = T(PIT_H);
        p.addEventListener('pointerenter', () => onHover(i));
        p.addEventListener('focus', () => onHover(i));
        p.addEventListener('click', () => onPick(i));
      }
      p.style.left = L(c.x); p.style.top = T(c.y);
      pitEls[i] = p;
      const ct = el('div', 'count', board);
      const cp = countPos(i);
      ct.style.left = L(cp.x); ct.style.top = T(cp.y);
      countEls[i] = ct;
    }
    board.addEventListener('pointerleave', () => { clearGuide(); markHover(null); });

    guideEl = el('div', 'guide', board); guideEl.hidden = true;
    guideTag = el('div', 'guide-tag', board); guideTag.hidden = true;

    handEl = el('div', 'hand off', board);
    handEl.innerHTML = `<svg viewBox="0 0 100 132" aria-hidden="true">
      <defs><linearGradient id="gl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d9dde3"/></linearGradient></defs>
      <g stroke="#5b5f66" stroke-width="2.6" stroke-linejoin="round" fill="url(#gl)">
        <ellipse cx="18" cy="60" rx="9.5" ry="17" transform="rotate(-18 18 60)"/>
        <rect x="14" y="22" width="68" height="58" rx="27"/>
        <ellipse cx="75" cy="64" rx="11" ry="10"/>
        <ellipse cx="68" cy="76" rx="12" ry="10.5"/>
        <rect x="35" y="56" width="23" height="74" rx="11.5"/>
        <rect x="16" y="3" width="64" height="25" rx="10"/>
      </g>
      <path d="M22 10 H74 M22 20 H74" stroke="#c7ccd3" stroke-width="2.2"/>
      <path d="M36 36 V52 M48 34 V52 M60 36 V52" stroke="#b9bec6" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M40 70 Q46 67 52 70" stroke="#c7ccd3" stroke-width="1.8" fill="none"/>
    </svg><div class="hand-count"></div>`;
    handCount = handEl.querySelector('.hand-count');
  }

  /* ================= 石の表示 ================= */
  const COLORS = [
    ['255,110,180', '170,30,100'], // ピンク
    ['170,110,235', '90,40,160'], // 紫
    ['90,205,115', '25,120,55'], // 緑
    ['80,150,240', '25,75,170'], // 青
    ['255,145,55', '190,70,10'], // オレンジ
    ['250,212,60', '180,130,10'], // 黄
  ];
  const view = { stones: new Map(), loc: [], hand: [], handPos: { x: 500, y: 280 }, nextId: 0 };

  function makeStone() {
    const id = view.nextId++;
    const e = el('div', 'stone', board);
    const c = COLORS[id % COLORS.length];
    e.style.setProperty('--c', c[0]);
    e.style.setProperty('--d', c[1]);
    view.stones.set(id, e);
    return id;
  }

  function setupStones(pits) {
    board.classList.add('instant');
    const need = pits.reduce((a, b) => a + b, 0);
    // 色がばらけるように並べ替えてから配置
    while (view.stones.size < need) makeStone();
    const ids = Array.from(view.stones.keys());
    while (ids.length > need) { const id = ids.pop(); view.stones.get(id).remove(); view.stones.delete(id); }
    const rng = mulberry(need * 17 + pits[0] * 3 + pits[7]);
    for (let k = ids.length - 1; k > 0; k--) { const j = Math.floor(rng() * (k + 1)); [ids[k], ids[j]] = [ids[j], ids[k]]; }
    view.loc = Array.from({ length: 14 }, () => []);
    view.hand = [];
    let n = 0;
    for (let i = 0; i < 14; i++) for (let k = 0; k < pits[i]; k++) view.loc[i].push(ids[n++]);
    for (let i = 0; i < 14; i++) layoutLoc(i);
    updateCounts(false);
    handCount.textContent = '';
    void board.offsetWidth;
    board.classList.remove('instant');
  }

  function placeStone(id, x, y, z, hop) {
    const e = view.stones.get(id);
    e.style.left = L(x); e.style.top = T(y); e.style.zIndex = z;
    if (hop && !REDUCED) { e.classList.remove('hop'); void e.offsetWidth; e.classList.add('hop'); }
  }
  function layoutLoc(i) {
    view.loc[i].forEach((id, k) => {
      const s = SLOTS[i][Math.min(k, SLOTS[i].length - 1)];
      placeStone(id, s.x, s.y, s.z);
      view.stones.get(id).classList.remove('held');
    });
  }
  // 手に持った石：手のひらのまわりに集める
  function layoutHand(hop) {
    const { x, y } = view.handPos;
    view.hand.forEach((id, k) => {
      const ring = k === 0 ? 0 : k < 7 ? 1 : 2;
      const a = k * 2.399;
      const r = ring * 15;
      placeStone(id, x + 4 + Math.cos(a) * r, y - 58 + Math.sin(a) * r * 0.8, 800 + k, hop);
      view.stones.get(id).classList.add('held');
    });
    handCount.textContent = view.hand.length > 1 ? String(view.hand.length) : '';
  }

  function updateCounts(bump) {
    for (let i = 0; i < 14; i++) {
      const v = String(view.loc[i].length);
      if (countEls[i].textContent !== v) {
        countEls[i].textContent = v;
        if (bump !== false && !REDUCED) { countEls[i].classList.remove('bump'); void countEls[i].offsetWidth; countEls[i].classList.add('bump'); }
      }
      if (!isStore(i)) pitEls[i].setAttribute('aria-label', `${pitLabel(i)}、石${v}個`);
    }
  }

  /* 手袋カーソル */
  function moveHand(x, y) {
    view.handPos = { x, y };
    handEl.style.left = L(x); handEl.style.top = T(y);
    if (view.hand.length) layoutHand(false);
  }
  function handAt(i) {
    const c = center(i);
    moveHand(c.x + (isStore(i) ? 0 : 4), c.y - (isStore(i) ? 30 : 24));
  }
  function showHand(on, dim) {
    handEl.classList.toggle('off', !on);
    handEl.classList.toggle('dim', !!dim);
  }

  /* ================= アニメーション ================= */
  const CANCEL = { cancelled: true };
  let token = 0;
  const SPEED = REDUCED ? 0.5 : 1;
  function sleep(ms) {
    const t = token;
    return new Promise((res, rej) => setTimeout(() => (t === token ? res() : rej(CANCEL)), ms * SPEED));
  }

  const bannerEl = $('#banner');
  function banner(text, kind) {
    bannerEl.textContent = text;
    bannerEl.className = 'banner ' + (kind || '');
    void bannerEl.offsetWidth;
    bannerEl.classList.add('show');
  }
  function flash(i, cls, ms) {
    const e = pitEls[i];
    e.classList.remove(cls); void e.offsetWidth; e.classList.add(cls);
    setTimeout(() => e.classList.remove(cls), ms || 1000);
  }

  async function animate(res) {
    const STEP = 250;
    for (const e of res.events) {
      if (e.type === 'pickup') {
        handAt(e.pit); showHand(true);
        await sleep(240);
        view.hand = view.loc[e.pit].splice(0);
        layoutHand(true);
        updateCounts();
        sfx.pickup(e.count);
        await sleep(360);
      } else if (e.type === 'skip') {
        handAt(e.pit);
        flash(e.pit, 'skipped', 700);
        await sleep(STEP * 1.1);
      } else if (e.type === 'sow') {
        handAt(e.to);
        await sleep(90);
        const id = view.hand.shift();
        view.loc[e.to].push(id);
        const k = view.loc[e.to].length - 1;
        const s = SLOTS[e.to][Math.min(k, SLOTS[e.to].length - 1)];
        view.stones.get(id).classList.remove('held');
        placeStone(id, s.x, s.y, s.z, true);
        layoutHand(false);
        updateCounts();
        const store = isStore(e.to);
        setTimeout(() => sfx.drop(store), 230 * SPEED);
        await sleep(STEP - 90 + (e.remaining === 0 ? 180 : 0));
      } else if (e.type === 'capture') {
        flash(e.pit, 'flash'); flash(e.opposite, 'flash');
        banner('横取り！', 'capture');
        sfx.capture();
        await sleep(650);
        const moving = view.loc[e.opposite].splice(0).concat(view.loc[e.pit].splice(0));
        handAt(e.store);
        for (const id of moving) {
          view.loc[e.store].push(id);
          const k = view.loc[e.store].length - 1;
          const s = SLOTS[e.store][Math.min(k, SLOTS[e.store].length - 1)];
          placeStone(id, s.x, s.y, s.z, true);
          updateCounts();
          setTimeout(() => sfx.drop(true), 200 * SPEED);
          await sleep(75);
        }
        await sleep(500);
      } else if (e.type === 'sweep') {
        await sleep(300);
        for (const p of e.pits) {
          const moving = view.loc[p.pit].splice(0);
          for (const id of moving) {
            view.loc[e.store].push(id);
            const k = view.loc[e.store].length - 1;
            const s = SLOTS[e.store][Math.min(k, SLOTS[e.store].length - 1)];
            placeStone(id, s.x, s.y, s.z, true);
            updateCounts();
            setTimeout(() => sfx.drop(true), 200 * SPEED);
            await sleep(55);
          }
        }
        await sleep(400);
      }
    }
    handCount.textContent = '';
    if (res.extraTurn) {
      banner('もう一回！', 'extra');
      sfx.extra();
      await sleep(950);
    }
  }

  /* ================= ゲーム進行 ================= */
  const G = {
    mode: null, // 'cpu' | 'pvp' | 'tutorial'
    state: null,
    players: null, // [{type,name}, {type,name}]
    level: 'normal',
    busy: true,
    sel: null,
    allow: null, // チュートリアルで押せる穴
    lastStart: null,
  };

  const statusEl = $('#status');
  function setStatus(t) { statusEl.textContent = t; }

  function isHumanTurn() {
    return G.state && !G.state.over && G.players[G.state.turn].type === 'human';
  }
  function canPlay(i) {
    if (G.busy || !isHumanTurn() || !E.isLegal(G.state, i)) return false;
    if (G.allow && !G.allow.includes(i)) return false;
    return true;
  }
  function playableList() {
    if (!isHumanTurn() || G.busy) return [];
    const list = E.legalMoves(G.state).filter((i) => canPlay(i));
    // 画面の左→右の順
    return G.state.turn === 0 ? list : list.slice().reverse();
  }

  function refreshPits() {
    for (let i = 0; i < 14; i++) {
      if (isStore(i)) continue;
      const ok = canPlay(i);
      pitEls[i].classList.toggle('playable', ok);
      pitEls[i].tabIndex = ok ? 0 : -1;
      pitEls[i].setAttribute('aria-disabled', ok ? 'false' : 'true');
    }
  }

  function updateSeats() {
    const t = G.state ? G.state.turn : 0;
    for (const p of [0, 1]) {
      const seat = $('#seat-' + p);
      seat.classList.toggle('active', !!G.state && !G.state.over && t === p && G.mode !== 'tutorial');
      seat.classList.remove('thinking');
    }
  }

  function turnText() {
    const s = G.state;
    const pl = G.players[s.turn];
    if (G.mode === 'pvp') return `${pl.name}の番です（${s.turn === 0 ? '手前' : '奥'}の穴を選んでください）`;
    if (pl.type === 'cpu') return `${pl.name}の番です`;
    return 'あなたの番です。穴を選んでください';
  }

  function markHover(i) {
    for (let k = 0; k < 14; k++) if (!isStore(k)) pitEls[k].classList.toggle('hover', k === i);
  }

  function clearGuide() {
    guideEl.hidden = true;
    guideTag.hidden = true;
  }
  function showGuideFor(pit) {
    if (!settings.guide || !E.isLegal(G.state, pit)) { clearGuide(); return; }
    const r = E.applyMove(G.state, pit, false);
    const land = r.landing;
    const c = center(land);
    guideEl.style.left = L(c.x); guideEl.style.top = T(c.y);
    guideEl.style.width = L(isStore(land) ? STORE_W : PIT_W);
    guideEl.style.height = T(isStore(land) ? STORE_H : PIT_H);
    guideEl.hidden = false;
    let text = 'ここで終わり', cls = '';
    if (r.gameOver) text = 'ゲーム終了';
    else if (r.extraTurn) { text = 'もう一回！'; cls = 'extra'; }
    else if (r.capture) { text = `横取り ${r.capture.count}個`; cls = 'capture'; }
    guideTag.textContent = text;
    guideTag.className = 'guide-tag ' + cls;
    const top = c.y - (isStore(land) ? STORE_H : PIT_H) / 2 - 6;
    guideTag.style.left = L(c.x);
    guideTag.style.top = T(Math.max(top, 40));
    guideTag.hidden = false;
  }

  function onHover(i) {
    if (!isHumanTurn() || G.busy) return;
    if (E.sideOf(i) !== G.state.turn) return;
    G.sel = i;
    handAt(i);
    const ok = canPlay(i);
    showHand(true, !ok);
    markHover(ok ? i : null);
    if (ok) showGuideFor(i); else clearGuide();
  }

  function onPick(i) {
    sfx.unlock();
    if (!canPlay(i)) return;
    playMove(i);
  }

  async function playMove(pit) {
    G.busy = true;
    clearGuide(); markHover(null); refreshPits();
    const res = E.applyMove(G.state, pit);
    try {
      await animate(res);
    } catch (e) {
      if (e === CANCEL) return;
      throw e;
    }
    G.state = res.state;
    if (G.mode === 'tutorial') { tutorialAfterMove(res); return; }
    nextTurn();
  }

  function nextTurn() {
    updateSeats();
    const s = G.state;
    if (s.over) { finishGame(); return; }
    setStatus(turnText());
    const pl = G.players[s.turn];
    if (pl.type === 'cpu') {
      G.busy = true;
      refreshPits();
      cpuTurn().catch((e) => { if (e !== CANCEL) throw e; });
    } else {
      G.busy = false;
      refreshPits();
      const list = playableList();
      if (G.sel == null || !list.includes(G.sel)) G.sel = null;
      if (G.sel != null) onHover(G.sel);
      else if (list.length) { handAt(list[0]); showHand(true, true); }
    }
  }

  async function cpuTurn() {
    const s = G.state;
    const seat = $('#seat-' + s.turn);
    seat.classList.add('thinking');
    setStatus(`${G.players[s.turn].name}が考えています…`);
    showHand(true, true);
    await sleep(380);
    const t0 = performance.now();
    const move = AI.chooseMove(s, G.level, { timeMs: 600 });
    const spent = performance.now() - t0;
    if (spent < 350) await sleep(350 - spent);
    seat.classList.remove('thinking');
    setStatus(`${G.players[s.turn].name}の番です`);
    // 手袋が穴の上を移動してから配る
    const legal = E.legalMoves(s);
    const others = legal.filter((m) => m !== move);
    if (others.length && Math.random() < 0.7) {
      handAt(others[Math.floor(Math.random() * others.length)]);
      showHand(true);
      await sleep(420);
    }
    handAt(move);
    showHand(true);
    pitEls[move].classList.add('hover');
    await sleep(520);
    pitEls[move].classList.remove('hover');
    await playMove(move);
  }

  function finishGame() {
    G.busy = true;
    refreshPits();
    updateSeats();
    const s = G.state;
    const w = s.winner;
    const names = G.players.map((p) => p.name);
    let title;
    if (w === -1) title = '引き分け';
    else if (G.mode === 'cpu') title = w === 0 ? 'あなたの勝ち！' : `${names[1]}の勝ち`;
    else title = `${names[w]}の勝ち！`;
    setStatus('ゲーム終了 — ' + title);
    banner('ゲーム終了', 'end');
    if (G.mode === 'cpu' && w === 1) sfx.lose(); else sfx.win();
    showHand(false);
    const t = token;
    setTimeout(() => {
      if (t !== token) return;
      $('#result-title').textContent = title;
      $('#result-kicker').textContent = G.mode === 'cpu' ? `CPU（${LEVEL_NAME[G.level]}）との対戦` : 'ふたりで対戦';
      const sc = $('#scoreline');
      sc.innerHTML = '';
      [0, 1].forEach((p, k) => {
        if (k === 1) { const d = document.createElement('span'); d.className = 'dash'; d.textContent = '−'; sc.appendChild(d); }
        const box = document.createElement('div');
        box.className = 'side' + (w === p ? ' win' : '');
        box.innerHTML = `<span class="num">${s.pits[E.storeOf(p)]}</span><span class="who"></span>`;
        box.querySelector('.who').textContent = names[p];
        sc.appendChild(box);
      });
      $('#result-actions').hidden = false;
      $('#result').hidden = false;
      $('#btn-again').focus();
    }, 1300);
  }

  const LEVEL_NAME = { easy: 'やさしい', normal: 'ふつう', hard: 'むずかしい' };

  function setSeats(p0, p1, av0, av1) {
    $('#name-0').textContent = p0;
    $('#name-1').textContent = p1;
    $('#av-0').innerHTML = avatarSVG(AVATARS[av0]);
    $('#av-1').innerHTML = avatarSVG(AVATARS[av1]);
  }

  function resetTable() {
    token++;
    $('#result').hidden = true;
    bannerEl.className = 'banner';
    clearGuide();
    markHover(null);
    G.sel = null;
    G.allow = null;
    for (const p of pitEls) p.classList.remove('tut-target', 'tut-hi', 'tut-hi-opp', 'flash', 'skipped');
  }

  function startCPU() {
    resetTable();
    G.mode = 'cpu';
    G.level = settings.level;
    let first = settings.order === 'second' ? 1 : settings.order === 'random' ? (Math.random() < 0.5 ? 0 : 1) : 0;
    G.players = [{ type: 'human', name: 'あなた' }, { type: 'cpu', name: `CPU（${LEVEL_NAME[G.level]}）` }];
    setSeats('あなた', `CPU・${LEVEL_NAME[G.level]}`, 'me', G.level);
    G.state = E.createState({ first });
    G.lastStart = startCPU;
    enterGame();
  }
  function startPVP() {
    resetTable();
    G.mode = 'pvp';
    G.players = [{ type: 'human', name: 'プレイヤー1' }, { type: 'human', name: 'プレイヤー2' }];
    setSeats('プレイヤー1', 'プレイヤー2', 'me', 'p2');
    G.state = E.createState({ first: 0 });
    G.lastStart = startPVP;
    enterGame();
  }
  function enterGame() {
    $('#tut').hidden = true;
    $('#hint').hidden = false;
    showScreen('game');
    setupStones(G.state.pits);
    showHand(false);
    if (G.mode === 'cpu' && G.state.turn === 1) banner('CPUが先攻', 'end');
    G.busy = true;
    setTimeout(() => nextTurn(), G.mode === 'cpu' && G.state.turn === 1 ? 900 : 50);
  }

  /* ================= チュートリアル ================= */
  const INIT = [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0];
  const TUT = [
    {
      title: 'ボードの紹介',
      body: '手前の6つの穴があなたの陣地、奥の6つが相手の陣地です。右はしの細長い穴があなたのゴール、左はしが相手のゴール。穴のそばの数字は、中に入っている石の数です。ゴールに石を多く集めた方が勝ちです。',
      pits: INIT,
      hi: true,
    },
    {
      title: '石の配り方',
      body: '自分の穴をひとつ選ぶと、中の石を全部つかんで、右どなりの穴から1個ずつ配ります。左から2番目の穴を押してみましょう。',
      pits: INIT,
      allow: [1],
      after: '4個の石が右どなりから1個ずつ入りました。石は反時計回りに進みます。手前の列は右へ、奥の列は左へ進みます。',
    },
    {
      title: 'ぴったりゴールで、もう一回',
      body: '最後の1個がちょうど自分のゴールに入ると、続けてもう1回遊べます。左から3番目の穴には石が4個。ゴールまでちょうど4つです。押してみましょう。',
      pits: INIT,
      allow: [2],
      after: 'ぴったりゴールに入ったので「もう一回！」です。ガイドがオンなら、穴にカーソルを合わせたときに最後の1個が入る場所が光ります。',
    },
    {
      title: '横取り',
      body: '最後の1個が自分の陣地の空っぽの穴に入ると、向かいにある相手の石をまとめて横取りできます。左から2番目の穴（2個）を押すと、最後の1個は空いている4番目の穴に入ります。その向かいには相手の石が6個あります。',
      pits: [3, 2, 0, 0, 4, 1, 10, 2, 3, 6, 4, 1, 2, 10],
      allow: [1],
      after: '最後の1個と向かいの6個、合わせて7個があなたのゴールに入りました。向かいの穴が空っぽのときは横取りできません。',
    },
    {
      title: '相手のゴールは飛ばす',
      body: '石が多いと、相手の陣地までぐるっと配ります。ただし相手のゴールには入れずに飛ばします。いちばん右の穴（10個）を押してみましょう。',
      pits: [2, 1, 3, 2, 1, 10, 7, 3, 2, 2, 1, 4, 2, 8],
      allow: [5],
      after: '自分のゴールに1個入れ、相手の陣地を回ったあと、左はしの相手のゴールは飛ばして手前の列に戻ってきました。',
    },
    {
      title: 'ゲーム終了と勝ち負け',
      body: 'どちらかの陣地の石がすべてなくなったら、ゲーム終了です。残りの石は、それぞれの陣地の持ち主のゴールに入ります。いちばん右の穴の最後の1個を配ってみましょう。',
      pits: [0, 0, 0, 0, 0, 1, 24, 1, 1, 0, 3, 1, 2, 15],
      allow: [5],
      after: 'あなたの陣地が空になったので終了です。相手の陣地に残った8個は相手のゴールへ。ゴールの石はあなた25個、相手23個で、あなたの勝ちです！',
    },
  ];

  function startTutorial() {
    resetTable();
    G.mode = 'tutorial';
    G.players = [{ type: 'human', name: 'あなた' }, { type: 'none', name: 'あいて' }];
    setSeats('あなた', 'あいて', 'me', 'easy');
    G.lastStart = startTutorial;
    showScreen('game');
    $('#tut').hidden = false;
    $('#hint').hidden = true;
    G.tutStep = 0;
    loadTutStep(0);
  }

  function loadTutStep(k) {
    resetTable();
    G.tutStep = k;
    const st = TUT[k];
    G.state = E.fromPits(st.pits, 0);
    setupStones(G.state.pits);
    updateSeats();
    $('#tut-step').textContent = `ステップ ${k + 1} / ${TUT.length}`;
    $('#tut-title').textContent = st.title;
    $('#tut-body').textContent = st.body;
    $('#tut-after').hidden = true;
    $('#tut-retry').hidden = !st.allow;
    const next = $('#tut-next');
    next.textContent = k === TUT.length - 1 ? 'チュートリアルを終える' : '次へ';
    setStatus('チュートリアル — ' + st.title);
    if (st.hi) {
      for (let i = 0; i < 14; i++) {
        if (i <= 6) pitEls[i].classList.add('tut-hi');
        else pitEls[i].classList.add('tut-hi-opp');
      }
      showHand(false);
      next.hidden = false;
      G.busy = true;
      refreshPits();
      return;
    }
    next.hidden = true;
    G.allow = st.allow;
    G.busy = false;
    refreshPits();
    for (const i of st.allow) pitEls[i].classList.add('tut-target');
    handAt(st.allow[0]);
    showHand(true, true);
  }

  function tutorialAfterMove(res) {
    G.busy = true;
    refreshPits();
    for (const p of pitEls) p.classList.remove('tut-target');
    const st = TUT[G.tutStep];
    $('#tut-after').textContent = st.after;
    $('#tut-after').hidden = false;
    $('#tut-next').hidden = false;
    $('#tut-next').focus({ preventScroll: true });
    if (res.gameOver) { banner('あなたの勝ち！', 'extra'); sfx.win(); }
  }

  function tutNext() {
    sfx.unlock();
    if (G.tutStep < TUT.length - 1) { loadTutStep(G.tutStep + 1); return; }
    // 修了
    resetTable();
    G.busy = true;
    showHand(false);
    $('#result-kicker').textContent = 'チュートリアル';
    $('#result-title').textContent = 'おつかれさま！';
    $('#scoreline').innerHTML = '<p style="margin:0;line-height:1.7">配り方・もう一回・横取り・終わり方を覚えました。<br>CPUと対戦してみましょう。</p>';
    const acts = $('#result-actions');
    acts.innerHTML = '';
    const b1 = document.createElement('button');
    b1.className = 'btn btn-main'; b1.type = 'button'; b1.textContent = 'CPU（やさしい）と対戦';
    b1.onclick = () => { settings.level = 'easy'; syncMenu(); saveSettings(); restoreResultActions(); startCPU(); };
    const b2 = document.createElement('button');
    b2.className = 'btn'; b2.type = 'button'; b2.textContent = 'メニューへ';
    b2.onclick = () => { restoreResultActions(); goMenu(); };
    acts.append(b1, b2);
    $('#result').hidden = false;
    b1.focus();
  }
  function restoreResultActions() {
    const acts = $('#result-actions');
    acts.innerHTML = '';
    acts.append(btnAgain, btnToMenu);
  }

  /* ================= 画面切り替え ================= */
  function showScreen(name) {
    for (const id of ['menu', 'game', 'rules']) $('#' + id).hidden = id !== name;
  }
  function goMenu() {
    resetTable();
    G.state = null;
    G.busy = true;
    showHand(false);
    showScreen('menu');
    $('#btn-cpu').focus({ preventScroll: true });
  }

  /* ================= 入力 ================= */
  document.addEventListener('keydown', (ev) => {
    if ($('#game').hidden || !$('#result').hidden) return;
    const list = playableList();
    if (!list.length) return;
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
      ev.preventDefault();
      let idx = list.indexOf(G.sel);
      if (idx < 0) idx = ev.key === 'ArrowRight' ? -1 : list.length;
      idx = (idx + (ev.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length;
      const i = list[idx];
      pitEls[i].focus({ preventScroll: true });
      onHover(i);
    } else if ((ev.key === 'Enter' || ev.key === ' ') && G.sel != null && document.activeElement && !document.activeElement.classList.contains('pit')) {
      ev.preventDefault();
      onPick(G.sel);
    }
  });

  const btnAgain = $('#btn-again');
  const btnToMenu = $('#btn-tomenu');
  btnAgain.addEventListener('click', () => { sfx.unlock(); (G.lastStart || startCPU)(); });
  btnToMenu.addEventListener('click', goMenu);
  $('#btn-back').addEventListener('click', goMenu);
  $('#btn-cpu').addEventListener('click', () => { sfx.unlock(); startCPU(); });
  $('#btn-pvp').addEventListener('click', () => { sfx.unlock(); startPVP(); });
  $('#btn-tut').addEventListener('click', () => { sfx.unlock(); startTutorial(); });
  $('#btn-rules').addEventListener('click', () => { showScreen('rules'); $('#rules').scrollTop = 0; });
  $('#rules-back').addEventListener('click', goMenu);
  $('#rules-menu').addEventListener('click', goMenu);
  $('#rules-tut').addEventListener('click', () => { sfx.unlock(); startTutorial(); });
  $('#tut-next').addEventListener('click', tutNext);
  $('#tut-retry').addEventListener('click', () => loadTutStep(G.tutStep));

  const guideBtn = $('#btn-guide');
  const soundBtn = $('#btn-sound');
  function syncToggles() {
    guideBtn.setAttribute('aria-pressed', String(settings.guide));
    guideBtn.textContent = settings.guide ? 'ガイド オン' : 'ガイド オフ';
    soundBtn.setAttribute('aria-pressed', String(settings.sound));
    soundBtn.textContent = settings.sound ? '音 オン' : '音 オフ';
  }
  guideBtn.addEventListener('click', () => {
    settings.guide = !settings.guide; saveSettings(); syncToggles();
    if (!settings.guide) clearGuide(); else if (G.sel != null && canPlay(G.sel)) showGuideFor(G.sel);
  });
  soundBtn.addEventListener('click', () => { settings.sound = !settings.sound; saveSettings(); syncToggles(); sfx.unlock(); });

  function syncMenu() {
    const lv = document.getElementById('lv-' + settings.level);
    if (lv) lv.checked = true;
    const od = document.getElementById('od-' + settings.order);
    if (od) od.checked = true;
  }
  document.querySelectorAll('input[name="level"]').forEach((r) => r.addEventListener('change', () => { settings.level = r.value; saveSettings(); }));
  document.querySelectorAll('input[name="order"]').forEach((r) => r.addEventListener('change', () => { settings.order = r.value; saveSettings(); }));

  /* ================= 起動 ================= */
  buildBoard();
  syncMenu();
  syncToggles();
  showScreen('menu');
})();
