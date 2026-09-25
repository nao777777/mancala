/* マンカラCPU — やさしい / ふつう / むずかしい */
(function (root) {
  'use strict';
  const E = root.MancalaEngine || (typeof require !== 'undefined' ? require('./engine.js') : null);

  const ABORT = { abort: true };
  const WIN = 1000;

  function evaluate(s, me) {
    const opp = 1 - me;
    if (s.over) {
      const d = s.pits[E.storeOf(me)] - s.pits[E.storeOf(opp)];
      return d > 0 ? WIN + d : d < 0 ? -WIN + d : 0;
    }
    const storeDiff = s.pits[E.storeOf(me)] - s.pits[E.storeOf(opp)];
    const sideDiff = E.sideSum(s.pits, me) - E.sideSum(s.pits, opp);
    return storeDiff + 0.15 * sideDiff;
  }

  // もう1回の手 → 横取り → 右寄り（ゴールに近い）の順に並べる
  function orderedMoves(s) {
    const p = s.turn;
    const store = E.storeOf(p);
    return E.legalMoves(s)
      .map((m) => {
        const land = E.predictLanding(s, m);
        let k = 0;
        if (land === store) k = 100;
        else if (!(s.rules && s.rules.capture === false) && E.sideOf(land) === p && s.pits[land] === 0 && s.pits[m] < 13 && s.pits[E.opposite(land)] > 0) {
          k = 50 + s.pits[E.opposite(land)];
        }
        return { m, k: k + (p === 0 ? m : m - 7) * 0.1 };
      })
      .sort((a, b) => b.k - a.k)
      .map((x) => x.m);
  }

  function search(s, depth, alpha, beta, me, ctx) {
    if (ctx.deadline && (++ctx.nodes & 511) === 0 && Date.now() > ctx.deadline) throw ABORT;
    if (s.over || depth <= 0) return evaluate(s, me);
    const moves = orderedMoves(s);
    if (s.turn === me) {
      let best = -Infinity;
      for (const m of moves) {
        const v = search(E.applyMove(s, m, false).state, depth - 1, alpha, beta, me, ctx);
        if (v > best) best = v;
        if (best > alpha) alpha = best;
        if (alpha >= beta) break;
      }
      return best;
    }
    let best = Infinity;
    for (const m of moves) {
      const v = search(E.applyMove(s, m, false).state, depth - 1, alpha, beta, me, ctx);
      if (v < best) best = v;
      if (best < beta) beta = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  // 各ルート手を全幅で評価（ふつう用。2番目の手を選べるように正確な値を出す）
  function scoreRoot(s, depth) {
    const me = s.turn;
    const ctx = { nodes: 0 };
    return orderedMoves(s)
      .map((m) => ({ m, v: search(E.applyMove(s, m, false).state, depth - 1, -Infinity, Infinity, me, ctx) }))
      .sort((a, b) => b.v - a.v);
  }

  function greedyGain(s, m) {
    const r = E.applyMove(s, m, false);
    const st = E.storeOf(s.turn);
    return r.state.pits[st] - s.pits[st] + (r.extraTurn ? 2 : 0);
  }

  function chooseEasy(s, rng) {
    const moves = E.legalMoves(s);
    if (rng() < 0.3) {
      let best = moves[0], bv = -Infinity;
      for (const m of moves) {
        const v = greedyGain(s, m);
        if (v > bv) { bv = v; best = m; }
      }
      return best;
    }
    return moves[Math.floor(rng() * moves.length)];
  }

  function chooseNormal(s, rng) {
    const scored = scoreRoot(s, 3);
    if (scored.length > 1 && rng() < 0.2) return scored[1].m;
    return scored[0].m;
  }

  function chooseHard(s, timeMs) {
    const moves = orderedMoves(s);
    if (moves.length === 1) return { move: moves[0], depth: 0 };
    const me = s.turn;
    const ctx = { nodes: 0, deadline: Date.now() + timeMs };
    let bestMove = moves[0];
    let order = moves.slice();
    let reached = 0;
    for (let depth = 1; depth <= 40; depth++) {
      try {
        let alpha = -Infinity, curBest = order[0], results = [];
        for (const m of order) {
          const v = search(E.applyMove(s, m, false).state, depth - 1, alpha, Infinity, me, ctx);
          results.push({ m, v });
          if (v > alpha) { alpha = v; curBest = m; }
        }
        bestMove = curBest;
        reached = depth;
        order = [curBest].concat(order.filter((m) => m !== curBest));
        if (Math.abs(alpha) >= WIN) break; // 勝敗が読み切れた
      } catch (e) {
        if (e === ABORT) break;
        throw e;
      }
    }
    return { move: bestMove, depth: reached };
  }

  function chooseMove(s, level, opts) {
    const o = opts || {};
    const rng = o.rng || Math.random;
    if (E.legalMoves(s).length === 0) return null;
    if (level === 'easy') return chooseEasy(s, rng);
    if (level === 'normal') return chooseNormal(s, rng);
    return chooseHard(s, o.timeMs || 600).move;
  }

  /* ---------- 振り返り用の分析 ---------- */
  // 盤上の石が少ない終盤ほど深く読む（読み筋が短く、計算が軽いため）
  function analysisDepth(s) {
    const onBoard = E.sideSum(s.pits, 0) + E.sideSum(s.pits, 1);
    if (onBoard <= 12) return 20;
    if (onBoard <= 20) return 14;
    return 11;
  }
  function analyzePosition(s) {
    return scoreRoot(s, analysisDepth(s));
  }

  // 1手の評価。loss は最善手との差（ゴールの石の差に換算）。
  // 序盤は読みが不確かなので判定をゆるめる。勝ち負けが変わる手は別扱い。
  const GRADE_TEXT = {
    only: 'この手しかない', best: '最善手', good: 'まずまず', dubious: '疑問手', bad: '悪手',
    missWin: '勝ちを逃す手', lose: '負けが決まる手',
  };
  function gradeMove(s, scored, move) {
    const best = scored[0];
    const mine = scored.find((x) => x.m === move) || best;
    const loss = Math.max(0, best.v - mine.v);
    let key;
    if (scored.length <= 1) key = 'only';
    else if (best.v >= WIN && mine.v < WIN) key = 'missWin';
    else if (mine.v <= -WIN && best.v > -WIN) key = 'lose';
    else {
      const onBoard = E.sideSum(s.pits, 0) + E.sideSum(s.pits, 1);
      const total = E.total(s.pits);
      const k = onBoard > total * 0.75 ? 1.5 : 1;
      const d = Math.abs(loss) >= WIN ? loss % WIN : loss;
      key = d < 1 * k ? 'best' : d < 2.5 * k ? 'good' : d < 5 * k ? 'dubious' : 'bad';
    }
    return { key, text: GRADE_TEXT[key], loss, best: best.m };
  }

  const api = { chooseMove, chooseHard, evaluate, orderedMoves, scoreRoot, analyzePosition, gradeMove, WIN };
  root.MancalaAI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
