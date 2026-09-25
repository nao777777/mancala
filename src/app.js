(function () {
  'use strict';
  const E = window.MancalaEngine;
  const AI = window.MancalaAI;
  const PZ = window.MancalaPuzzles;
  const $ = (s) => document.querySelector(s);
  const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ================= 設定の保存 ================= */
  const settings = {
    level: 'normal', order: 'first', guide: true, sound: true, speed: 'normal', tap: 'double',
    seeds: 4, capture: true, skinStone: 'glass', skinBoard: 'pine', skinRug: 'red',
  };
  const store = {
    get(key, fallback) { try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
    set(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* 保存できない環境 */ } },
    del(key) { try { localStorage.removeItem(key); } catch (e) { /* 無視 */ } },
  };
  Object.assign(settings, store.get('mancala-settings', {}));
  if (![3, 4, 5, 6].includes(settings.seeds)) settings.seeds = 4;
  function saveSettings() { store.set('mancala-settings', settings); }
  const rulesNow = () => ({ seeds: settings.seeds, capture: settings.capture });
  function rulesText(r) {
    return `各穴${r.seeds}個・横取り${r.capture ? 'あり' : 'なし'}`;
  }

  /* ================= テクスチャ（SVGをdata URIで生成） ================= */
  const svgURI = (s) => 'url("data:image/svg+xml,' + encodeURIComponent(s) + '")';
  function grain(seed, w, h, fx, fy, alpha) {
    return svgURI(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><filter id="g" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${fx} ${fy}" numOctaves="4" seed="${seed}"/><feColorMatrix values="0 0 0 0 0.42  0 0 0 0 0.22  0 0 0 0 0.05  ${alpha} 0 0 0 -0.62"/></filter><rect width="${w}" height="${h}" filter="url(#g)"/></svg>`);
  }
  function kilimField(c) {
    return svgURI(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="${c.bg}"/><path d="M32 4 L60 32 L32 60 L4 32Z" fill="none" stroke="${c.line}" stroke-width="5"/><path d="M32 16 L48 32 L32 48 L16 32Z" fill="${c.gold}"/><path d="M32 22 L42 32 L32 42 L22 32Z" fill="${c.inner}"/><path d="M32 27 L37 32 L32 37 L27 32Z" fill="${c.core}"/><path d="M0 0 L7 0 L0 7Z M64 0 L57 0 L64 7Z M0 64 L7 64 L0 57Z M64 64 L57 64 L64 57Z" fill="${c.cream}"/><rect x="30" y="0" width="4" height="3" fill="${c.cream}"/><rect x="30" y="61" width="4" height="3" fill="${c.cream}"/><rect x="0" y="30" width="3" height="4" fill="${c.cream}"/><rect x="61" y="30" width="3" height="4" fill="${c.cream}"/></svg>`);
  }
  function kilimBorder(c) {
    return svgURI(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" fill="${c.edge}"/><path d="M0 34 L8 26 L16 34 L24 26 L32 34 L40 26 L48 34" fill="none" stroke="${c.cream}" stroke-width="3.5"/><path d="M0 18 L8 10 L16 18 L24 10 L32 18 L40 10 L48 18" fill="none" stroke="${c.zig}" stroke-width="3"/><rect x="21" y="38" width="6" height="6" fill="${c.core}" transform="rotate(45 24 41)"/><rect x="5" y="2" width="6" height="6" fill="${c.gold}" transform="rotate(45 8 5)"/><rect x="37" y="2" width="6" height="6" fill="${c.gold}" transform="rotate(45 40 5)"/></svg>`);
  }
  function felt(color, seed) {
    return svgURI(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="${color}"/><filter id="f"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="${seed}"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0.1  0 0 0 0 0.05  0 0 0 0.35 0"/></filter><rect width="64" height="64" filter="url(#f)"/></svg>`);
  }
  const RUGS = {
    red: { base: '#a3262b', field: kilimField({ bg: '#a3262b', line: '#6c1318', gold: '#d8b06a', inner: '#8f1f24', core: '#26356b', cream: '#e8d3a2' }), border: kilimBorder({ edge: '#5e1015', cream: '#e8d3a2', zig: '#c9493c', core: '#26356b', gold: '#d8b06a' }), size: 64 },
    blue: { base: '#253f6e', field: kilimField({ bg: '#253f6e', line: '#162a4d', gold: '#e2b765', inner: '#8f2a2e', core: '#e8d3a2', cream: '#e8d3a2' }), border: kilimBorder({ edge: '#142646', cream: '#e8d3a2', zig: '#c9493c', core: '#e2b765', gold: '#e2b765' }), size: 64 },
    green: { base: '#2f6b47', field: felt('#2f6b47', 3), border: felt('#1d4a31', 8), size: 64 },
  };
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty('--grain-a', grain(7, 500, 560, 0.0022, 0.05, 1.7));
  rootStyle.setProperty('--grain-b', grain(19, 500, 560, 0.0022, 0.05, 1.7));
  rootStyle.setProperty('--grain', grain(3, 600, 600, 0.002, 0.04, 1.5));
  rootStyle.setProperty('--table-grain', grain(11, 900, 600, 0.0015, 0.03, 1.2));
  rootStyle.setProperty('--weave', svgURI(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><filter id="w"><feTurbulence type="fractalNoise" baseFrequency="0.9 0.35" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 0.2  0 0 0 0 0.05  0 0 0 0 0.02  0 0 0 0.8 0"/></filter><rect width="200" height="200" filter="url(#w)"/></svg>`));
  rootStyle.setProperty('--chevron', svgURI(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="38" viewBox="0 0 40 38"><rect width="40" height="38" fill="#f1e4c4"/><rect y="4" width="40" height="2.2" fill="#2b5aa8"/><rect y="31.8" width="40" height="2.2" fill="#2b5aa8"/><path d="M0 26 L10 12 L20 26 L30 12 L40 26" fill="none" stroke="#2b5aa8" stroke-width="5" stroke-linejoin="miter"/></svg>`));

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
    const isSt = isStore(i);
    const r = mulberry(i * 131 + 7);
    const out = [];
    const halfW = 28;
    const halfH = isSt ? 160 : 56;
    for (let layer = 0; layer < 8; layer++) {
      const odd = layer % 2 === 1;
      const cand = [];
      const ox = odd ? 14 : 0, oy = odd ? 14 : 0;
      for (let y = -halfH + oy; y <= halfH - oy + 0.1; y += 28) {
        for (let x = -halfW + ox; x <= halfW - ox + 0.1; x += 28) {
          cand.push({ x, y, k: Math.hypot(x * 0.8, y) + r() * (isSt ? 90 : 14) });
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
  const slotOf = (i, k) => SLOTS[i][Math.min(k, SLOTS[i].length - 1)];

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
    // 石が当たる音。ガラス玉は「カチッ」、ほかの石は少し低く短く
    function clink(delay, vol, pitch) {
      const c = ensure(); if (!c) return;
      const t = c.currentTime + (delay || 0);
      const soft = settings.skinStone !== 'glass';
      const p = (pitch || 1) * (0.9 + Math.random() * 0.2) * (soft ? 0.45 : 1);
      const v = vol == null ? 1 : vol;
      tone(2350 * p, t, soft ? 0.05 : 0.09, 0.09 * v);
      tone(3620 * p, t, soft ? 0.03 : 0.06, 0.05 * v);
      if (!soft) tone(5480 * p, t, 0.04, 0.025 * v);
      tick(t, 0.5 * v, (soft ? 1800 : 4200) * p);
    }
    return {
      unlock() { ensure(); },
      drop(isSt) {
        clink(0, isSt ? 0.8 : 1, isSt ? 0.78 : 1);
        if (isSt) { const c = ensure(); if (c) tone(190, c.currentTime, 0.12, 0.08, 'triangle'); }
      },
      pickup(n) { for (let k = 0; k < Math.min(n, 6); k++) clink(k * 0.028 + Math.random() * 0.02, 0.55, 1.08); },
      extra() { const c = ensure(); if (!c) return; const t = c.currentTime; [1046.5, 1318.5, 1568].forEach((f, k) => tone(f, t + k * 0.08, 0.3, 0.07, 'triangle')); },
      capture() { const c = ensure(); if (!c) return; const t = c.currentTime; [784, 1046.5, 1318.5, 1568].forEach((f, k) => tone(f, t + k * 0.06, 0.28, 0.07, 'square')); },
      win() { const c = ensure(); if (!c) return; const t = c.currentTime; [523, 659, 784, 1046.5, 784, 1046.5].forEach((f, k) => tone(f, t + k * 0.11, 0.35, 0.07, 'triangle')); },
      lose() { const c = ensure(); if (!c) return; const t = c.currentTime; [523, 466, 392, 330].forEach((f, k) => tone(f, t + k * 0.16, 0.4, 0.06, 'triangle')); },
      hint() { const c = ensure(); if (!c) return; const t = c.currentTime; [1568, 2093].forEach((f, k) => tone(f, t + k * 0.07, 0.2, 0.05, 'sine')); },
    };
  })();

  /* ================= CPUの思考（Web Workerで画面を止めない） ================= */
  const brain = (function () {
    let worker = null, seq = 0;
    const pending = new Map();
    try {
      const src = $('#src-engine').textContent + '\n' + $('#src-ai').textContent + `
self.onmessage = function (e) {
  var d = e.data, r;
  try {
    if (d.kind === 'move') r = MancalaAI.chooseMove(d.state, d.level, { timeMs: d.timeMs });
    else r = d.items.map(function (it) { return MancalaAI.scoreRoot(it, d.depth); });
    self.postMessage({ id: d.id, r: r });
  } catch (err) { self.postMessage({ id: d.id, err: String(err) }); }
};`;
      worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      worker.onmessage = (e) => {
        const p = pending.get(e.data.id);
        if (!p) return;
        pending.delete(e.data.id);
        if (e.data.err) p.resolve(p.local()); else p.resolve(e.data.r);
      };
      worker.onerror = () => {
        worker = null;
        for (const p of pending.values()) p.resolve(p.local());
        pending.clear();
      };
    } catch (e) { worker = null; }
    // Workerが使えない環境では、少し待ってから画面側で計算する
    function run(msg, local) {
      if (!worker) return new Promise((res) => setTimeout(() => res(local()), 30));
      return new Promise((resolve) => {
        const id = ++seq;
        pending.set(id, { resolve, local });
        worker.postMessage(Object.assign({ id }, msg));
        // 応答がないときは画面側で計算する
        setTimeout(() => {
          const p = pending.get(id);
          if (p) { pending.delete(id); resolve(local()); }
        }, 5000);
      });
    }
    return {
      move: (state, level, timeMs) => run({ kind: 'move', state, level, timeMs }, () => AI.chooseMove(state, level, { timeMs })),
      analyze: (items, depth) => run({ kind: 'analyze', items, depth }, () => items.map((it) => AI.scoreRoot(it, depth))),
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
  const pitShort = (i) => (i < 6 ? `手前の左から${i + 1}番目` : `奥の左から${13 - i}番目`);

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
        p.addEventListener('pointerdown', (e) => { G.pointer = e.pointerType; });
        p.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') onHover(i); });
        p.addEventListener('focus', () => onHover(i));
        p.addEventListener('click', () => onPick(i));
      }
      p.style.left = L(c.x); p.style.top = T(c.y);
      pitEls[i] = p;
      const ct = el('div', i >= 7 ? 'count top' : 'count', board);
      const cp = countPos(i);
      ct.style.left = L(cp.x); ct.style.top = T(cp.y);
      countEls[i] = ct;
    }
    board.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'mouse' || G.hinted != null) return;
      clearGuide(); markHover(null);
    });

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

  /* ================= 石と着せ替え ================= */
  const STONE_COLORS = {
    glass: [['255,110,180', '170,30,100'], ['170,110,235', '90,40,160'], ['90,205,115', '25,120,55'], ['80,150,240', '25,75,170'], ['255,145,55', '190,70,10'], ['250,212,60', '180,130,10']],
    nut: [['176,112,52', '92,50,18'], ['150,92,42', '70,38,12'], ['198,138,74', '112,64,24'], ['128,78,38', '58,30,10'], ['170,106,58', '86,46,16'], ['142,98,54', '68,42,16']],
    shell: [['252,243,226', '198,172,132'], ['247,229,206', '192,152,112'], ['253,246,236', '206,184,152'], ['242,224,202', '182,142,102'], ['250,236,220', '196,160,124'], ['245,238,228', '188,170,146']],
    pebble: [['172,172,166', '96,96,92'], ['152,146,136', '82,76,70'], ['188,182,174', '112,106,98'], ['132,134,138', '66,68,72'], ['162,152,142', '92,84,76'], ['142,142,132', '76,76,68']],
  };
  function paintStone(e, id, kind) {
    const c = STONE_COLORS[kind || settings.skinStone][id % 6];
    e.style.setProperty('--c', c[0]);
    e.style.setProperty('--d', c[1]);
    e.style.setProperty('--rot', ((id * 67) % 360) + 'deg');
  }
  function applySkins() {
    const d = document.documentElement.dataset;
    d.stone = settings.skinStone;
    d.board = settings.skinBoard;
    const rug = RUGS[settings.skinRug] || RUGS.red;
    rootStyle.setProperty('--rug', rug.base);
    rootStyle.setProperty('--rug-field', rug.field);
    rootStyle.setProperty('--rug-border', rug.border);
    for (const [id, e] of view.stones) paintStone(e, id);
    document.querySelectorAll('#sp-pit .stone').forEach((e, k) => paintStone(e, k));
  }

  const view = { stones: new Map(), loc: [], hand: [], handPos: { x: 500, y: 280 }, nextId: 0 };

  function makeStone() {
    const id = view.nextId++;
    const e = el('div', 'stone', board);
    paintStone(e, id);
    view.stones.set(id, e);
    return id;
  }

  function setupStones(pits) {
    board.classList.add('instant');
    const need = pits.reduce((a, b) => a + b, 0);
    while (view.stones.size < need) makeStone();
    const ids = Array.from(view.stones.keys());
    while (ids.length > need) { const id = ids.pop(); view.stones.get(id).remove(); view.stones.delete(id); }
    // 色がばらけるように並べ替えてから配置
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
      const s = slotOf(i, k);
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
  function dropInto(id, to, hop) {
    view.loc[to].push(id);
    const s = slotOf(to, view.loc[to].length - 1);
    view.stones.get(id).classList.remove('held');
    placeStone(id, s.x, s.y, s.z, hop);
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
  // 奥の列では穴の下のほうを指して、穴の上の数字を隠さない
  function handAt(i) {
    const c = center(i);
    if (isStore(i)) moveHand(c.x, c.y - 30);
    else if (i >= 7) moveHand(c.x + 4, c.y + 30);
    else moveHand(c.x + 4, c.y - 24);
  }
  function showHand(on, dim) {
    handEl.classList.toggle('off', !on);
    handEl.classList.toggle('dim', !!dim);
  }

  /* ================= アニメーション ================= */
  const CANCEL = { cancelled: true };
  let token = 0;
  const speed = () => (REDUCED ? 0.5 : 1) * (settings.speed === 'fast' ? 0.45 : 1);
  function applySpeed() {
    board.style.setProperty('--mv', (0.3 * speed()).toFixed(3) + 's');
    board.style.setProperty('--hv', (0.22 * speed()).toFixed(3) + 's');
  }
  function sleep(ms) {
    const t = token;
    return new Promise((res, rej) => setTimeout(() => (t === token ? res() : rej(CANCEL)), ms * speed()));
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
        dropInto(view.hand.shift(), e.to, true);
        layoutHand(false);
        updateCounts();
        const isSt = isStore(e.to);
        setTimeout(() => sfx.drop(isSt), 230 * speed());
        await sleep(STEP - 90 + (e.remaining === 0 ? 180 : 0));
      } else if (e.type === 'capture') {
        flash(e.pit, 'flash'); flash(e.opposite, 'flash');
        banner('横取り！', 'capture');
        sfx.capture();
        await sleep(650);
        const moving = view.loc[e.opposite].splice(0).concat(view.loc[e.pit].splice(0));
        handAt(e.store);
        for (const id of moving) {
          dropInto(id, e.store, true);
          updateCounts();
          setTimeout(() => sfx.drop(true), 200 * speed());
          await sleep(75);
        }
        await sleep(500);
      } else if (e.type === 'sweep') {
        await sleep(300);
        for (const p of e.pits) {
          for (const id of view.loc[p.pit].splice(0)) {
            dropInto(id, e.store, true);
            updateCounts();
            setTimeout(() => sfx.drop(true), 200 * speed());
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
    mode: null, // 'cpu' | 'pvp' | 'tutorial' | 'puzzle' | 'replay'
    state: null,
    players: null, // [{type,name}, {type,name}]
    level: 'normal',
    rules: { seeds: 4, capture: true },
    busy: true,
    sel: null,
    armed: null, // 2回タップで選ばれている穴
    pointer: null,
    hinted: null, // ヒントで光らせている穴
    hints: 0,
    allow: null, // チュートリアルで押せる穴
    hist: [], // 振り返り用 { pits, turn, move }
    lastStart: null,
  };
  const isMatch = () => G.mode === 'cpu' || G.mode === 'pvp';

  const statusEl = $('#status');
  function setStatus(t) { statusEl.textContent = t; }

  function isHumanTurn() {
    return !!G.state && !G.state.over && G.players[G.state.turn].type === 'human';
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

  const hintBtn = $('#btn-hint');
  function refreshPits() {
    for (let i = 0; i < 14; i++) {
      if (isStore(i)) continue;
      const ok = canPlay(i);
      pitEls[i].classList.toggle('playable', ok);
      pitEls[i].tabIndex = ok ? 0 : -1;
      pitEls[i].setAttribute('aria-disabled', ok ? 'false' : 'true');
    }
    hintBtn.hidden = !isMatch();
    hintBtn.disabled = !(isMatch() && isHumanTurn() && !G.busy);
  }

  function updateSeats() {
    const t = G.state ? G.state.turn : 0;
    for (const p of [0, 1]) {
      const seat = $('#seat-' + p);
      seat.classList.toggle('active', !!G.state && !G.state.over && t === p && isMatch());
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
  function clearMarks() {
    for (const p of pitEls) p.classList.remove('armed', 'hinted');
    G.armed = null;
    G.hinted = null;
  }

  function clearGuide() {
    guideEl.hidden = true;
    guideTag.hidden = true;
  }
  function showGuideFor(pit, force) {
    if ((!settings.guide && !force) || !E.isLegal(G.state, pit)) { clearGuide(); return; }
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
    // ふたりで対戦では、奥のプレイヤーの番のラベルも相手向きに回す
    guideTag.className = 'guide-tag ' + cls + (G.mode === 'pvp' && G.state.turn === 1 ? ' flip' : '');
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
    if (ok) showGuideFor(i, G.hinted === i); else clearGuide();
  }

  function onPick(i) {
    sfx.unlock();
    const pointer = G.pointer;
    G.pointer = null;
    if (!canPlay(i)) return;
    // スマホ：1回目のタップで選んでガイドを見せ、同じ穴をもう一度タップで配る
    const touch = pointer === 'touch' || pointer === 'pen';
    if (touch && settings.tap === 'double' && G.armed !== i) {
      for (const p of pitEls) p.classList.remove('armed');
      G.armed = i;
      pitEls[i].classList.add('armed');
      onHover(i);
      setStatus('もう一度タップすると配ります');
      return;
    }
    playMove(i);
  }

  async function playMove(pit) {
    G.busy = true;
    clearGuide(); markHover(null); clearMarks(); refreshPits();
    const before = G.state;
    const res = E.applyMove(before, pit);
    if (isMatch()) G.hist.push({ pits: before.pits.slice(), turn: before.turn, move: pit });
    try {
      await animate(res);
    } catch (e) {
      if (e === CANCEL) return;
      throw e;
    }
    G.state = res.state;
    if (G.mode === 'tutorial') { tutorialAfterMove(res); return; }
    if (G.mode === 'puzzle') { puzzleAfterMove(res); return; }
    nextTurn();
  }

  function nextTurn() {
    updateSeats();
    const s = G.state;
    if (s.over) { finishGame(); return; }
    saveGame();
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
      if (G.sel != null && G.pointer !== 'touch') onHover(G.sel);
      else if (list.length) { handAt(list[0]); showHand(true, true); }
    }
  }

  async function cpuTurn() {
    const s = G.state;
    const t = token;
    const seat = $('#seat-' + s.turn);
    seat.classList.add('thinking');
    setStatus(`${G.players[s.turn].name}が考えています…`);
    showHand(true, true);
    await sleep(300);
    const t0 = performance.now();
    const move = await brain.move(s, G.level, 600);
    if (t !== token) throw CANCEL;
    const spent = performance.now() - t0;
    if (spent < 400) await sleep(400 - spent);
    seat.classList.remove('thinking');
    setStatus(`${G.players[s.turn].name}の番です`);
    // 手袋が穴の上を移動してから配る
    const others = E.legalMoves(s).filter((m) => m !== move);
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

  /* ヒント：むずかしいCPUの読みで最善手を光らせる */
  async function showHint() {
    if (!isMatch() || !isHumanTurn() || G.busy) return;
    sfx.unlock();
    const s = G.state;
    const t = token;
    hintBtn.disabled = true;
    setStatus('ヒントを考えています…');
    const m = await brain.move(s, 'hard', 700);
    if (t !== token || G.state !== s || G.busy) return;
    hintBtn.disabled = false;
    G.hints++;
    clearMarks();
    G.hinted = m;
    pitEls[m].classList.add('hinted');
    onHover(m);
    showGuideFor(m, true);
    sfx.hint();
    setStatus(`ヒント：${pitShort(m)}の穴がおすすめです`);
  }

  const LEVEL_NAME = { easy: 'やさしい', normal: 'ふつう', hard: 'むずかしい' };

  function finishGame() {
    G.busy = true;
    refreshPits();
    updateSeats();
    clearSave();
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
    G.final = s;
    const t = token;
    setTimeout(() => { if (t === token) showResult(title); }, 1300 * speed());
  }
  function showResult(title) {
    const s = G.final;
    const w = s.winner;
    const names = G.players.map((p) => p.name);
    $('#result-title').textContent = title;
    const extra = [rulesText(G.rules)];
    if (G.hints) extra.push(`ヒント${G.hints}回`);
    $('#result-kicker').textContent = (G.mode === 'cpu' ? `CPU（${LEVEL_NAME[G.level]}）との対戦` : 'ふたりで対戦') + '　' + extra.join('・');
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
    restoreResultActions();
    $('#result').hidden = false;
    $('#btn-again').focus();
  }

  function setSeats(p0, p1, av0, av1) {
    $('#name-0').textContent = p0;
    $('#name-1').textContent = p1;
    $('#av-0').innerHTML = avatarSVG(AVATARS[av0]);
    $('#av-1').innerHTML = avatarSVG(AVATARS[av1]);
  }

  function resetTable() {
    RP.id = (RP.id || 0) + 1;
    board.classList.remove('pvp');
    token++;
    stopAutoplay();
    for (const id of ['result', 'confirm']) $('#' + id).hidden = true;
    for (const id of ['tut', 'pz-panel', 'rp-panel']) $('#' + id).hidden = true;
    $('#hint').hidden = false;
    bannerEl.className = 'banner';
    clearGuide();
    markHover(null);
    clearMarks();
    G.sel = null;
    G.allow = null;
    G.hints = 0;
    for (const p of pitEls) p.classList.remove('tut-target', 'tut-hi', 'tut-hi-opp', 'flash', 'skipped', 'rp-from');
  }

  /* ---------- 保存と続きから ---------- */
  const SAVE_KEY = 'mancala-save';
  function saveGame() {
    if (!isMatch() || !G.state || G.state.over) return;
    store.set(SAVE_KEY, { v: 2, mode: G.mode, level: G.level, rules: G.rules, state: G.state, hist: G.hist, hints: G.hints });
  }
  function clearSave() { store.del(SAVE_KEY); }
  function loadSave() {
    const d = store.get(SAVE_KEY, null);
    if (d && d.v === 2 && d.state && Array.isArray(d.state.pits) && d.state.pits.length === 14 && !d.state.over && Array.isArray(d.hist)) return d;
    return null;
  }

  function setupMatch(mode, level, rules) {
    resetTable();
    G.mode = mode;
    G.rules = rules;
    G.hist = [];
    if (mode === 'cpu') {
      G.level = level;
      G.players = [{ type: 'human', name: 'あなた' }, { type: 'cpu', name: `CPU（${LEVEL_NAME[level]}）` }];
      setSeats('あなた', `CPU・${LEVEL_NAME[level]}`, 'me', level);
      G.lastStart = startCPU;
    } else {
      board.classList.add('pvp');
      G.players = [{ type: 'human', name: 'プレイヤー1' }, { type: 'human', name: 'プレイヤー2' }];
      setSeats('プレイヤー1', 'プレイヤー2', 'me', 'p2');
      G.lastStart = startPVP;
    }
  }
  function startCPU() {
    setupMatch('cpu', settings.level, rulesNow());
    const first = settings.order === 'second' ? 1 : settings.order === 'random' ? (Math.random() < 0.5 ? 0 : 1) : 0;
    G.state = E.createState({ first, seeds: G.rules.seeds, capture: G.rules.capture });
    enterGame(true);
  }
  function startPVP() {
    setupMatch('pvp', settings.level, rulesNow());
    G.state = E.createState({ first: 0, seeds: G.rules.seeds, capture: G.rules.capture });
    enterGame(true);
  }
  function resumeGame() {
    const d = loadSave();
    if (!d) { refreshMenu(); return; }
    setupMatch(d.mode, d.level || 'normal', d.rules || { seeds: 4, capture: true });
    G.state = d.state;
    G.hist = d.hist;
    G.hints = d.hints || 0;
    enterGame(false);
  }
  function enterGame(fresh) {
    showScreen('game');
    setupStones(G.state.pits);
    showHand(false);
    const cpuFirst = fresh && G.mode === 'cpu' && G.state.turn === 1;
    if (cpuFirst) banner('CPUが先攻', 'end');
    else if (!fresh) banner('続きから', 'end');
    G.busy = true;
    refreshPits();
    const t = token;
    setTimeout(() => { if (t === token) nextTurn(); }, cpuFirst || !fresh ? 900 : 50);
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
      after: 'ぴったりゴールに入ったので「もう一回！」です。ガイドがオンなら、穴を選んだときに最後の1個が入る場所が光ります。',
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
    loadTutStep(0);
  }

  function loadTutStep(k) {
    resetTable();
    $('#tut').hidden = false;
    $('#hint').hidden = true;
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
      for (let i = 0; i < 14; i++) pitEls[i].classList.add(i <= 6 ? 'tut-hi' : 'tut-hi-opp');
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
    $('#tut').hidden = false;
    G.busy = true;
    showHand(false);
    $('#result-kicker').textContent = 'チュートリアル';
    $('#result-title').textContent = 'おつかれさま！';
    $('#scoreline').innerHTML = '<p style="margin:0;line-height:1.7">配り方・もう一回・横取り・終わり方を覚えました。<br>CPUと対戦するか、パズルに挑戦してみましょう。</p>';
    setResultActions([
      ['CPU（やさしい）と対戦', true, () => { settings.level = 'easy'; syncMenu(); saveSettings(); startCPU(); }],
      ['パズルに挑戦', false, () => openPuzzleList()],
      ['メニューへ', false, () => goMenu()],
    ]);
    $('#result').hidden = false;
  }

  /* ================= パズル ================= */
  const PZ_KEY = 'mancala-puzzles';
  const pzCleared = () => new Set(store.get(PZ_KEY, []));
  function markCleared(i) { const s = pzCleared(); s.add(i); store.set(PZ_KEY, Array.from(s)); }
  const starText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

  function openPuzzleList() {
    resetTable();
    G.mode = null; G.state = null; G.busy = true;
    showHand(false);
    const grid = $('#pz-grid');
    grid.textContent = '';
    const done = pzCleared();
    PZ.PUZZLES.forEach((q, i) => {
      const b = el('button', 'pz-card' + (done.has(i) ? ' done' : ''), grid);
      b.type = 'button';
      b.innerHTML = `<span class="pz-no"></span><span class="pz-stars"></span><b class="pz-name"></b><span class="pz-goal-s"></span><span class="pz-done">クリア済み</span>`;
      b.querySelector('.pz-no').textContent = `第${i + 1}問`;
      const st = b.querySelector('.pz-stars');
      st.textContent = starText(q.stars);
      st.setAttribute('aria-label', `むずかしさ${q.stars}`);
      b.querySelector('.pz-name').textContent = q.title;
      b.querySelector('.pz-goal-s').textContent = PZ.goalText(q.goal);
      b.addEventListener('click', () => { sfx.unlock(); startPuzzle(i); });
    });
    showScreen('puzzles');
    $('#puzzles').scrollTop = 0;
  }

  function startPuzzle(i) {
    resetTable();
    const q = PZ.PUZZLES[i];
    G.mode = 'puzzle';
    G.pz = { i, progress: null, done: false };
    G.players = [{ type: 'human', name: 'あなた' }, { type: 'none', name: 'あいて' }];
    setSeats('あなた', 'あいて', 'me', 'normal');
    showScreen('game');
    $('#pz-panel').hidden = false;
    $('#hint').hidden = true;
    G.state = E.fromPits(q.pits, 0);
    G.pz.progress = PZ.newProgress(G.state);
    setupStones(G.state.pits);
    updateSeats();
    $('#pz-step').textContent = `パズル 第${i + 1}問 / ${PZ.PUZZLES.length}　${starText(q.stars)}`;
    $('#pz-title').textContent = q.title;
    $('#pz-text').textContent = q.text;
    $('#pz-goal').textContent = PZ.goalText(q.goal);
    $('#pz-msg').hidden = true;
    $('#pz-next').hidden = true;
    $('#pz-hint').hidden = false;
    updatePuzzleNow();
    setStatus(`パズル — ${q.title}`);
    G.busy = false;
    refreshPits();
    const list = playableList();
    if (list.length) { handAt(list[0]); showHand(true, true); }
  }

  function updatePuzzleNow() {
    const q = PZ.PUZZLES[G.pz.i];
    const p = G.pz.progress;
    let t;
    if (q.goal.type === 'chain') t = `いま：もう一回 ${p.chain}回`;
    else if (q.goal.type === 'store') t = `いま：このターンでゴールに ${p.gain}個`;
    else if (q.goal.type === 'capture') t = `いま：いちばん多い横取り ${p.capture}個`;
    else t = `いま：ゴールの石 あなた ${G.state.pits[6]}個・あいて ${G.state.pits[13]}個`;
    $('#pz-now').textContent = t;
  }

  function puzzleAfterMove(res) {
    G.pz.progress = PZ.step(G.pz.progress, res);
    updatePuzzleNow();
    const q = PZ.PUZZLES[G.pz.i];
    const msg = $('#pz-msg');
    if (PZ.met(q.goal, G.pz.progress)) {
      G.pz.done = true;
      G.busy = true;
      refreshPits();
      markCleared(G.pz.i);
      banner('クリア！', 'extra');
      sfx.win();
      msg.textContent = G.pz.i < PZ.PUZZLES.length - 1 ? 'クリアしました！ 次のパズルに進みましょう。' : 'クリアしました！ これで全問です。おつかれさま！';
      msg.hidden = false;
      $('#pz-next').hidden = G.pz.i >= PZ.PUZZLES.length - 1;
      $('#pz-hint').hidden = true;
      setStatus('クリア！');
      showHand(false);
      return;
    }
    if (PZ.turnOver(res.state)) {
      G.busy = true;
      refreshPits();
      banner('ざんねん', 'end');
      msg.textContent = '手番が相手に移ってしまいました。「やり直す」でもう一度挑戦しましょう。';
      msg.hidden = false;
      setStatus('目標に届きませんでした');
      showHand(false);
      return;
    }
    msg.hidden = true;
    G.busy = false;
    refreshPits();
    setStatus('続けてもう1回動かせます');
    const list = playableList();
    if (list.length) { handAt(list[0]); showHand(true, true); }
  }

  function puzzleHint() {
    if (G.mode !== 'puzzle' || G.busy || !isHumanTurn()) return;
    const q = PZ.PUZZLES[G.pz.i];
    const line = PZ.solve(G.state, q.goal, G.pz.progress);
    const msg = $('#pz-msg');
    if (!line || !line.length) {
      msg.textContent = 'この盤面からは目標に届きません。「やり直す」を押しましょう。';
      msg.hidden = false;
      return;
    }
    clearMarks();
    G.hinted = line[0];
    pitEls[line[0]].classList.add('hinted');
    onHover(line[0]);
    showGuideFor(line[0], true);
    sfx.hint();
    msg.textContent = `ヒント：${pitShort(line[0])}の穴から動かしてみましょう。`;
    msg.hidden = false;
  }

  /* ================= 振り返り ================= */
  const RP = { k: 0, busy: false, auto: null, analysis: null, diffs: [], states: [] };

  function stateAt(k) {
    if (k >= G.hist.length) return G.final;
    const h = G.hist[k];
    return E.fromPits(h.pits, h.turn, G.rules);
  }

  function startReplay() {
    if (!G.hist.length) return;
    const keepFinal = G.final;
    const hist = G.hist;
    const names = G.players.map((p) => p.name);
    token++;
    stopAutoplay();
    $('#result').hidden = true;
    bannerEl.className = 'banner';
    clearGuide(); markHover(null); clearMarks();
    G.hist = hist;
    G.final = keepFinal;
    G.replayOf = G.mode;
    G.mode = 'replay';
    G.busy = true;
    refreshPits();
    showHand(false);
    $('#rp-panel').hidden = false;
    $('#hint').hidden = true;
    RP.names = names;
    RP.states = [];
    for (let k = 0; k <= hist.length; k++) RP.states.push(stateAt(k));
    RP.diffs = RP.states.map((s) => s.pits[6] - s.pits[13]);
    RP.analysis = null;
    $('#rp-summary').textContent = '手の良し悪しを分析しています…';
    setStatus('対局の振り返り');
    jumpTo(0);
    drawGraph();
    // 各手を深く読み、最善手との差を出す（Workerで計算）
    const id = (RP.id = (RP.id || 0) + 1);
    brain.analyze(hist.map((h) => E.fromPits(h.pits, h.turn, G.rules)), 8).then((all) => {
      if (RP.id !== id || G.mode !== 'replay') return;
      RP.analysis = all.map((scored, k) => {
        const mv = hist[k].move;
        const best = scored[0];
        const mine = scored.find((x) => x.m === mv) || best;
        const loss = Math.max(0, best.v - mine.v);
        return { best: best.m, loss, grade: grade(loss, scored.length) };
      });
      writeSummary();
      showReplayMove();
      drawGraph();
    });
  }
  function grade(loss, n) {
    if (n <= 1) return { key: 'only', text: 'この手しかない' };
    if (loss < 0.5) return { key: 'best', text: '最善手' };
    if (loss < 2) return { key: 'good', text: 'まずまず' };
    if (loss < 5) return { key: 'dubious', text: '疑問手' };
    return { key: 'bad', text: '悪手' };
  }
  function writeSummary() {
    const A = RP.analysis;
    const who = G.replayOf === 'cpu' ? [0] : [0, 1];
    const parts = who.map((p) => {
      const ks = G.hist.map((h, k) => k).filter((k) => G.hist[k].turn === p);
      const best = ks.filter((k) => ['best', 'only'].includes(A[k].grade.key)).length;
      const bad = ks.filter((k) => A[k].grade.key === 'bad').length;
      return `${RP.names[p]}：最善手 ${best} / ${ks.length}手・悪手 ${bad}回`;
    });
    let worst = -1, wl = 0;
    A.forEach((a, k) => { if (who.includes(G.hist[k].turn) && a.loss > wl) { wl = a.loss; worst = k; } });
    const s = $('#rp-summary');
    s.textContent = parts.join('　');
    if (worst >= 0 && wl >= 2) {
      const b = el('button', 'linkish', s);
      b.type = 'button';
      b.textContent = `いちばん差がついた手（${worst + 1}手目）を見る`;
      b.addEventListener('click', () => { stopAutoplay(); jumpTo(worst); });
    }
  }

  function jumpTo(k) {
    token++;
    RP.busy = false;
    RP.k = Math.max(0, Math.min(k, G.hist.length));
    G.state = RP.states[RP.k];
    setupStones(G.state.pits);
    showHand(false);
    clearGuide();
    showReplayMove();
    drawGraph();
  }

  async function stepForward() {
    if (RP.busy || RP.k >= G.hist.length) return false;
    RP.busy = true;
    const h = G.hist[RP.k];
    const s = RP.states[RP.k];
    const res = E.applyMove(s, h.move);
    for (const p of pitEls) p.classList.remove('rp-from');
    try {
      await animate(res);
    } catch (e) {
      if (e === CANCEL) return false;
      throw e;
    }
    RP.k++;
    G.state = RP.states[RP.k];
    RP.busy = false;
    showHand(false);
    showReplayMove();
    drawGraph();
    return true;
  }

  function showReplayMove() {
    const n = G.hist.length;
    const k = RP.k;
    $('#rp-count').textContent = `${k} / ${n} 手目`;
    for (const p of pitEls) p.classList.remove('rp-from');
    const ev = $('#rp-eval');
    ev.className = 'rp-eval';
    if (k >= n) {
      const s = G.final;
      $('#rp-move').textContent = `終局：${RP.names[0]} ${s.pits[6]}個 − ${s.pits[13]}個 ${RP.names[1]}`;
      ev.textContent = '';
      clearGuide();
    } else {
      const h = G.hist[k];
      const r = E.applyMove(RP.states[k], h.move, false);
      const what = r.gameOver ? 'ゲーム終了' : r.extraTurn ? 'もう一回' : r.capture ? `横取り ${r.capture.count}個` : '';
      $('#rp-move').textContent = `次の手（${k + 1}手目）：${RP.names[h.turn]}が${pitShort(h.move)}の穴${what ? ' → ' + what : ''}`;
      pitEls[h.move].classList.add('rp-from');
      if (RP.analysis) {
        const a = RP.analysis[k];
        ev.classList.add('g-' + a.grade.key);
        let t = `評価：${a.grade.text}`;
        if (a.best !== h.move && a.grade.key !== 'best') {
          const rb = E.applyMove(RP.states[k], a.best, false);
          const bw = rb.gameOver ? 'ゲーム終了' : rb.extraTurn ? 'もう一回' : rb.capture ? `横取り ${rb.capture.count}個` : '';
          t += `　おすすめは${pitShort(a.best)}の穴${bw ? '（' + bw + '）' : ''}`;
        }
        ev.textContent = t;
      } else ev.textContent = '評価：分析中…';
    }
    $('#rp-prev').disabled = k === 0;
    $('#rp-first').disabled = k === 0;
    $('#rp-next').disabled = k >= n;
    $('#rp-last').disabled = k >= n;
    $('#rp-play').textContent = RP.auto ? '一時停止' : k >= n ? '最初から再生' : '自動再生';
  }

  // ゴールの差（手前 − 奥）の折れ線。0の線を基準に、上が手前のプレイヤーのリード
  function drawGraph() {
    const svg = $('#rp-graph');
    const d = RP.diffs;
    const n = d.length - 1;
    const W = 320, H = 110, pl = 30, pr = 8, pt = 12, pb = 14;
    const m = Math.max(4, Math.ceil(Math.max(...d.map(Math.abs)) / 2) * 2);
    const x = (k) => pl + (n ? (k / n) * (W - pl - pr) : 0);
    const y = (v) => pt + ((m - v) / (2 * m)) * (H - pt - pb);
    const path = d.map((v, k) => `${k ? 'L' : 'M'}${x(k).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
    let marks = '';
    if (RP.analysis) {
      RP.analysis.forEach((a, k) => {
        if (a.grade.key === 'bad') marks += `<circle cx="${x(k + 1).toFixed(1)}" cy="${y(d[k + 1]).toFixed(1)}" r="3.2" class="g-badpt"/>`;
      });
    }
    svg.innerHTML = `
      <line x1="${pl}" x2="${W - pr}" y1="${y(m)}" y2="${y(m)}" class="g-grid"/>
      <line x1="${pl}" x2="${W - pr}" y1="${y(-m)}" y2="${y(-m)}" class="g-grid"/>
      <line x1="${pl}" x2="${W - pr}" y1="${y(0)}" y2="${y(0)}" class="g-zero"/>
      <text x="${pl - 5}" y="${y(m) + 3}" class="g-lab" text-anchor="end">+${m}</text>
      <text x="${pl - 5}" y="${y(0) + 3}" class="g-lab" text-anchor="end">0</text>
      <text x="${pl - 5}" y="${y(-m) + 3}" class="g-lab" text-anchor="end">−${m}</text>
      <text x="${pl + 2}" y="${pt - 3}" class="g-lab">↑ ${RP.names[0]}がリード</text>
      <text x="${pl + 2}" y="${H - 3}" class="g-lab">↓ ${RP.names[1]}がリード</text>
      <path d="${path}" class="g-line"/>
      ${marks}
      <line x1="${x(RP.k)}" x2="${x(RP.k)}" y1="${pt}" y2="${H - pb}" class="g-cursor"/>
      <circle cx="${x(RP.k)}" cy="${y(d[RP.k])}" r="4.5" class="g-now"/>
      <rect x="${pl}" y="0" width="${W - pl - pr}" height="${H}" fill="transparent" class="g-hit"/>`;
    svg.dataset.n = n;
  }
  function graphIndex(ev) {
    const svg = $('#rp-graph');
    const r = svg.getBoundingClientRect();
    const n = Number(svg.dataset.n) || 0;
    const px = ((ev.clientX - r.left) / r.width) * 320;
    return Math.max(0, Math.min(n, Math.round(((px - 30) / (320 - 38)) * n)));
  }
  function graphTip(ev) {
    const k = graphIndex(ev);
    const tip = $('#rp-tip');
    const v = RP.diffs[k];
    let t = k === 0 ? '開始' : `${k}手目 ${RP.names[G.hist[k - 1].turn]}`;
    t += `　差 ${v > 0 ? '+' : ''}${v}`;
    if (k > 0 && RP.analysis) t += `　${RP.analysis[k - 1].grade.text}`;
    tip.textContent = t;
    const wrap = tip.parentElement.getBoundingClientRect();
    tip.style.left = Math.min(Math.max(ev.clientX - wrap.left, 50), wrap.width - 50) + 'px';
    tip.hidden = false;
  }

  function stopAutoplay() {
    if (RP.auto) { RP.auto = null; }
  }
  async function autoplay() {
    if (RP.auto) { stopAutoplay(); showReplayMove(); return; }
    if (RP.k >= G.hist.length) jumpTo(0);
    const me = {};
    RP.auto = me;
    showReplayMove();
    while (RP.auto === me && RP.k < G.hist.length) {
      const ok = await stepForward();
      if (!ok) break;
      try { await sleep(350); } catch (e) { break; }
    }
    if (RP.auto === me) RP.auto = null;
    if (G.mode === 'replay') showReplayMove();
  }

  /* ================= 画面切り替え ================= */
  function showScreen(name) {
    for (const id of ['menu', 'game', 'rules', 'puzzles', 'skins']) $('#' + id).hidden = id !== name;
  }
  function refreshMenu() {
    const d = loadSave();
    const b = $('#btn-resume');
    b.hidden = !d;
    if (d) {
      const who = d.mode === 'cpu' ? `CPU・${LEVEL_NAME[d.level] || 'ふつう'}と対戦中` : 'ふたりで対戦中';
      $('#resume-info').textContent = `${who}（${rulesText(d.rules || { seeds: 4, capture: true })}）・${d.hist.length}手目まで`;
    }
    $('#puzzle-progress').textContent = `クリア ${pzCleared().size} / ${PZ.PUZZLES.length}問`;
  }
  function goMenu() {
    resetTable();
    G.mode = null;
    G.state = null;
    G.busy = true;
    showHand(false);
    refreshMenu();
    showScreen('menu');
    $('#btn-cpu').focus({ preventScroll: true });
  }

  function confirmBox(title, body, okText, cancelText) {
    return new Promise((resolve) => {
      const m = $('#confirm');
      $('#confirm-title').textContent = title;
      $('#confirm-body').textContent = body;
      const ok = $('#confirm-ok'), cancel = $('#confirm-cancel');
      ok.textContent = okText; cancel.textContent = cancelText;
      const done = (v) => { m.hidden = true; ok.onclick = cancel.onclick = null; resolve(v); };
      ok.onclick = () => done(true);
      cancel.onclick = () => done(false);
      m.hidden = false;
      cancel.focus();
    });
  }

  async function onBack() {
    if (G.mode === 'puzzle') { openPuzzleList(); return; }
    if (isMatch() && G.state && !G.state.over && G.hist.length > 0) {
      const ok = await confirmBox('対局をやめますか？', 'いまの対局は保存されます。メニューの「続きから遊ぶ」で再開できます。', 'メニューへ', '対局を続ける');
      if (!ok) return;
    }
    goMenu();
  }

  const btnAgain = $('#btn-again');
  const btnReview = $('#btn-review');
  const btnToMenu = $('#btn-tomenu');
  function restoreResultActions() {
    const acts = $('#result-actions');
    acts.textContent = '';
    acts.append(btnAgain, btnReview, btnToMenu);
    btnReview.hidden = !G.hist.length;
  }
  function setResultActions(list) {
    const acts = $('#result-actions');
    acts.textContent = '';
    list.forEach(([text, main, fn], k) => {
      const b = el('button', main ? 'btn btn-main' : 'btn', acts);
      b.type = 'button';
      b.textContent = text;
      b.addEventListener('click', fn);
      if (k === 0) setTimeout(() => b.focus(), 0);
    });
  }

  /* ================= 設定・着せ替え ================= */
  function syncSettingsForm() {
    const val = { guide: settings.guide ? 'on' : 'off', sound: settings.sound ? 'on' : 'off', speed: settings.speed, tap: settings.tap };
    document.querySelectorAll('input[data-setting]').forEach((r) => { r.checked = val[r.dataset.setting] === r.value; });
  }
  document.querySelectorAll('input[data-setting]').forEach((r) => r.addEventListener('change', () => {
    const k = r.dataset.setting;
    if (k === 'guide') settings.guide = r.value === 'on';
    else if (k === 'sound') settings.sound = r.value === 'on';
    else settings[k] = r.value;
    saveSettings();
    applySpeed();
    if (k === 'sound') sfx.unlock();
    if (k === 'guide' && !settings.guide) clearGuide();
  }));
  function openSettings() {
    syncSettingsForm();
    $('#settings').hidden = false;
    $('#settings-close').focus();
  }
  $('#settings-close').addEventListener('click', () => {
    $('#settings').hidden = true;
    if (G.mode && G.sel != null && canPlay(G.sel) && settings.guide) showGuideFor(G.sel);
  });

  // 全画面（対応ブラウザのみ）。全画面にしたら横向きに固定を試みる
  const fullBtn = $('#btn-full');
  const docEl = document.documentElement;
  fullBtn.hidden = !(document.fullscreenEnabled && docEl.requestFullscreen);
  function syncFull() { fullBtn.textContent = document.fullscreenElement ? '全画面を終了' : '全画面にする'; }
  fullBtn.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) { await document.exitFullscreen(); return; }
      await docEl.requestFullscreen({ navigationUI: 'hide' });
      if (screen.orientation && screen.orientation.lock && matchMedia('(pointer: coarse)').matches) {
        await screen.orientation.lock('landscape').catch(() => {});
      }
    } catch (e) { /* 全画面にできない環境では何もしない */ }
  });
  document.addEventListener('fullscreenchange', syncFull);
  syncFull();

  function buildSkinScreen() {
    const pit = $('#sp-pit');
    pit.textContent = '';
    for (let k = 0; k < 6; k++) paintStone(el('div', 'stone', pit), k);
    document.querySelectorAll('.sw-stone').forEach((sw) => {
      sw.textContent = '';
      const kind = sw.dataset.kind;
      for (let k = 0; k < 3; k++) paintStone(el('span', 'stone k k-' + kind, sw), k * 2, kind);
    });
    document.querySelectorAll('.sw-board').forEach((sw) => { sw.classList.add('k-' + sw.dataset.kind); });
    document.querySelectorAll('.sw-rug').forEach((sw) => {
      const r = RUGS[sw.dataset.kind];
      sw.style.backgroundColor = r.base;
      sw.style.backgroundImage = r.field;
    });
  }
  function syncSkinForm() {
    for (const [name, v] of [['skinStone', settings.skinStone], ['skinBoard', settings.skinBoard], ['skinRug', settings.skinRug]]) {
      document.querySelectorAll(`input[name="${name}"]`).forEach((r) => { r.checked = r.value === v; });
    }
  }
  ['skinStone', 'skinBoard', 'skinRug'].forEach((name) => {
    document.querySelectorAll(`input[name="${name}"]`).forEach((r) => r.addEventListener('change', () => {
      settings[name] = r.value;
      saveSettings();
      applySkins();
      if (name === 'skinStone') sfx.drop(false);
    }));
  });

  /* ================= メニューの選択 ================= */
  function syncMenu() {
    const pick = (id) => { const e = document.getElementById(id); if (e) e.checked = true; };
    pick('lv-' + settings.level);
    pick('od-' + settings.order);
    pick('rs-' + settings.seeds);
    pick(settings.capture ? 'rc-on' : 'rc-off');
    $('#rule-note').textContent = rulesText(rulesNow()).replace('各穴' + settings.seeds + '個', `各穴${settings.seeds}個（合計${settings.seeds * 12}個）`) +
      (settings.seeds === 4 && settings.capture ? '（標準ルール）' : '');
  }
  document.querySelectorAll('input[name="level"]').forEach((r) => r.addEventListener('change', () => { settings.level = r.value; saveSettings(); }));
  document.querySelectorAll('input[name="order"]').forEach((r) => r.addEventListener('change', () => { settings.order = r.value; saveSettings(); }));
  document.querySelectorAll('input[name="seeds"]').forEach((r) => r.addEventListener('change', () => { settings.seeds = Number(r.value); saveSettings(); syncMenu(); }));
  document.querySelectorAll('input[name="capture"]').forEach((r) => r.addEventListener('change', () => { settings.capture = r.value === 'on'; saveSettings(); syncMenu(); }));

  /* ================= 入力 ================= */
  const modalOpen = () => !!document.querySelector('.modal:not([hidden])');
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      if (!$('#settings').hidden) { $('#settings-close').click(); return; }
      if (!$('#confirm').hidden) { $('#confirm-cancel').click(); return; }
    }
    if ($('#game').hidden || modalOpen()) return;
    G.pointer = null;
    if (G.mode === 'replay') {
      if (ev.key === 'ArrowRight') { ev.preventDefault(); stopAutoplay(); stepForward(); }
      else if (ev.key === 'ArrowLeft') { ev.preventDefault(); stopAutoplay(); jumpTo(RP.k - 1); }
      return;
    }
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

  btnAgain.addEventListener('click', () => { sfx.unlock(); (G.lastStart || startCPU)(); });
  btnReview.addEventListener('click', startReplay);
  btnToMenu.addEventListener('click', goMenu);
  $('#btn-back').addEventListener('click', onBack);
  hintBtn.addEventListener('click', showHint);
  $('#btn-settings').addEventListener('click', openSettings);
  $('#btn-settings-menu').addEventListener('click', openSettings);
  $('#btn-resume').addEventListener('click', () => { sfx.unlock(); resumeGame(); });
  $('#btn-cpu').addEventListener('click', async () => {
    sfx.unlock();
    if (loadSave()) {
      const ok = await confirmBox('新しい対局をはじめますか？', '保存されている対局は消えます。', 'はじめる', 'やめる');
      if (!ok) return;
    }
    startCPU();
  });
  $('#btn-pvp').addEventListener('click', async () => {
    sfx.unlock();
    if (loadSave()) {
      const ok = await confirmBox('新しい対局をはじめますか？', '保存されている対局は消えます。', 'はじめる', 'やめる');
      if (!ok) return;
    }
    startPVP();
  });
  $('#btn-tut').addEventListener('click', () => { sfx.unlock(); startTutorial(); });
  $('#btn-puzzle').addEventListener('click', () => { sfx.unlock(); openPuzzleList(); });
  $('#btn-rules').addEventListener('click', () => { showScreen('rules'); $('#rules').scrollTop = 0; });
  $('#btn-skins').addEventListener('click', () => { syncSkinForm(); showScreen('skins'); $('#skins').scrollTop = 0; });
  for (const id of ['#rules-back', '#rules-menu', '#puzzles-back', '#skins-back', '#skins-done']) $(id).addEventListener('click', goMenu);
  $('#rules-tut').addEventListener('click', () => { sfx.unlock(); startTutorial(); });
  $('#tut-next').addEventListener('click', tutNext);
  $('#tut-retry').addEventListener('click', () => loadTutStep(G.tutStep));
  $('#pz-list').addEventListener('click', openPuzzleList);
  $('#pz-retry').addEventListener('click', () => startPuzzle(G.pz.i));
  $('#pz-next').addEventListener('click', () => startPuzzle(G.pz.i + 1));
  $('#pz-hint').addEventListener('click', puzzleHint);
  $('#rp-first').addEventListener('click', () => { stopAutoplay(); jumpTo(0); });
  $('#rp-prev').addEventListener('click', () => { stopAutoplay(); jumpTo(RP.k - 1); });
  $('#rp-next').addEventListener('click', () => { stopAutoplay(); stepForward(); });
  $('#rp-last').addEventListener('click', () => { stopAutoplay(); jumpTo(G.hist.length); });
  $('#rp-play').addEventListener('click', autoplay);
  const graph = $('#rp-graph');
  graph.addEventListener('pointermove', graphTip);
  graph.addEventListener('pointerleave', () => { $('#rp-tip').hidden = true; });
  graph.addEventListener('click', (e) => { stopAutoplay(); jumpTo(graphIndex(e)); });

  /* ================= 起動 ================= */
  buildBoard();
  buildSkinScreen();
  applySkins();
  applySpeed();
  syncMenu();
  refreshMenu();
  showScreen('menu');
})();
