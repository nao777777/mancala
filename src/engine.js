/* マンカラ（カラハ式）ルールエンジン — 純粋関数のみ
 * pits[14]: 0〜5 手前（プレイヤー0、左→右）, 6 右ゴール(P0),
 *           7〜12 奥（プレイヤー1、右→左）, 13 左ゴール(P1)
 */
(function (root) {
  'use strict';

  const STORE = [6, 13];
  const storeOf = (p) => STORE[p];
  const pitsOf = (p) => (p === 0 ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12]);
  const opposite = (i) => 12 - i;
  function sideOf(i) {
    if (i >= 0 && i <= 5) return 0;
    if (i >= 7 && i <= 12) return 1;
    return -1;
  }

  function createState(opts) {
    const o = opts || {};
    const seeds = o.seeds == null ? 4 : o.seeds;
    const pits = new Array(14).fill(seeds);
    pits[6] = 0;
    pits[13] = 0;
    return { pits, turn: o.first || 0, over: false, winner: null };
  }

  function fromPits(pits, turn) {
    if (!Array.isArray(pits) || pits.length !== 14) throw new Error('pits must have 14 entries');
    return { pits: pits.slice(), turn: turn || 0, over: false, winner: null };
  }

  const sideSum = (pits, p) => pitsOf(p).reduce((a, i) => a + pits[i], 0);
  const total = (pits) => pits.reduce((a, b) => a + b, 0);

  function legalMoves(s) {
    if (s.over) return [];
    return pitsOf(s.turn).filter((i) => s.pits[i] > 0);
  }

  function isLegal(s, pit) {
    return !s.over && sideOf(pit) === s.turn && s.pits[pit] > 0;
  }

  function predictLanding(s, pit) {
    let n = s.pits[pit];
    let i = pit;
    const skip = storeOf(1 - s.turn);
    while (n > 0) {
      i = (i + 1) % 14;
      if (i === skip) continue;
      n--;
    }
    return i;
  }

  function winnerOf(pits) {
    if (pits[6] > pits[13]) return 0;
    if (pits[13] > pits[6]) return 1;
    return -1; // 引き分け
  }

  /* 手を適用する。withEvents=false でAI用の高速版（イベント列なし）。
   * 返り値: { state, events, extraTurn, capture, gameOver, landing } */
  function applyMove(s, pit, withEvents) {
    if (!isLegal(s, pit)) throw new Error('illegal move: ' + pit);
    const ev = withEvents === false ? null : [];
    const pits = s.pits.slice();
    const p = s.turn;
    const myStore = storeOf(p);
    const skip = storeOf(1 - p);

    let n = pits[pit];
    pits[pit] = 0;
    if (ev) ev.push({ type: 'pickup', player: p, pit, count: n });

    let i = pit;
    while (n > 0) {
      i = (i + 1) % 14;
      if (i === skip) {
        if (ev) ev.push({ type: 'skip', pit: i });
        continue;
      }
      pits[i]++;
      n--;
      if (ev) ev.push({ type: 'sow', from: pit, to: i, remaining: n });
    }
    const landing = i;

    let extraTurn = landing === myStore;
    let capture = null;
    if (!extraTurn && sideOf(landing) === p && pits[landing] === 1) {
      const opp = opposite(landing);
      if (pits[opp] > 0) {
        capture = { player: p, pit: landing, opposite: opp, taken: pits[opp], count: pits[opp] + 1, store: myStore };
        pits[myStore] += pits[opp] + 1;
        pits[landing] = 0;
        pits[opp] = 0;
        if (ev) ev.push(Object.assign({ type: 'capture' }, capture));
      }
    }

    let over = false;
    if (sideSum(pits, 0) === 0 || sideSum(pits, 1) === 0) {
      over = true;
      for (const q of [0, 1]) {
        const moved = [];
        for (const j of pitsOf(q)) {
          if (pits[j] > 0) {
            moved.push({ pit: j, count: pits[j] });
            pits[storeOf(q)] += pits[j];
            pits[j] = 0;
          }
        }
        if (ev && moved.length) ev.push({ type: 'sweep', player: q, pits: moved, store: storeOf(q) });
      }
      extraTurn = false;
    }

    const state = {
      pits,
      turn: over ? p : extraTurn ? p : 1 - p,
      over,
      winner: over ? winnerOf(pits) : null,
    };
    if (ev && over) ev.push({ type: 'end', winner: state.winner, score: [pits[6], pits[13]] });
    return { state, events: ev, extraTurn, capture, gameOver: over, landing };
  }

  const api = {
    STORE, storeOf, pitsOf, opposite, sideOf, sideSum, total,
    createState, fromPits, legalMoves, isLegal, predictLanding, applyMove, winnerOf,
  };
  root.MancalaEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
