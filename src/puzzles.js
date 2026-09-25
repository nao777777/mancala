/* マンカラ パズル — 自分の番のうちに目標を達成する（相手は動かない）
 * goal.type:
 *   chain   … このターンで「もう一回」を n 回以上
 *   store   … このターンで自分のゴールに n 個以上入れる
 *   capture … 1回の横取りで n 個以上取る
 *   win     … このターンでゲームを終わらせて勝つ
 */
(function (root) {
  'use strict';
  const E = root.MancalaEngine || (typeof require !== 'undefined' ? require('./engine.js') : null);

  const PUZZLES = [
    {
      title: 'ぴったりゴール',
      stars: 1,
      text: '最後の1個がちょうどゴールに入る穴を探して、「もう一回」を2回続けましょう。',
      pits: [4, 0, 4, 0, 2, 4, 9, 4, 4, 2, 0, 5, 0, 10],
      goal: { type: 'chain', n: 2 },
    },
    {
      title: 'はじめての横取り',
      stars: 1,
      text: '空っぽの穴に最後の1個を入れて、向かいの石をまとめて取りましょう。',
      pits: [4, 1, 0, 0, 4, 0, 2, 9, 8, 3, 9, 5, 0, 3],
      goal: { type: 'capture', n: 10 },
    },
    {
      title: '順番が大事',
      stars: 2,
      text: '同じ穴でも、動かす順番で結果が変わります。「もう一回」を3回続けましょう。',
      pits: [5, 0, 4, 2, 0, 3, 10, 4, 4, 0, 1, 2, 3, 10],
      goal: { type: 'chain', n: 3 },
    },
    {
      title: 'ためてから取る',
      stars: 2,
      text: '「もう一回」で手番を続けてから横取りすると、もっとたくさん取れます。',
      pits: [1, 2, 0, 3, 0, 0, 3, 8, 7, 5, 7, 3, 5, 4],
      goal: { type: 'capture', n: 9 },
    },
    {
      title: '階段のしかけ',
      stars: 3,
      text: '右から1個・2個・3個…と階段に並んでいます。「もう一回」を11回続けましょう。',
      pits: [0, 5, 4, 3, 2, 1, 4, 3, 2, 4, 3, 2, 5, 10],
      goal: { type: 'chain', n: 11 },
    },
    {
      title: 'ゴールに11個',
      stars: 2,
      text: 'このターンのうちに、自分のゴールへ石を11個以上入れましょう。',
      pits: [5, 5, 1, 0, 3, 0, 4, 8, 0, 2, 0, 8, 8, 4],
      goal: { type: 'store', n: 11 },
    },
    {
      title: 'ひと回りの一撃',
      stars: 2,
      text: '石が13個あると、ぐるっと一周して元の穴に戻ってきます。それで横取りしましょう。',
      pits: [0, 13, 1, 1, 0, 2, 8, 1, 2, 4, 2, 5, 0, 9],
      goal: { type: 'capture', n: 7 },
    },
    {
      title: 'とどめの一手',
      stars: 2,
      text: '自分の陣地を空にするとゲーム終了です。このターンで終わらせて、勝ちを決めましょう。',
      pits: [1, 0, 0, 0, 2, 1, 17, 2, 2, 2, 0, 4, 0, 17],
      goal: { type: 'win' },
    },
    {
      title: '大量得点',
      stars: 3,
      text: '「もう一回」と横取りを組み合わせて、ゴールに17個以上入れましょう。',
      pits: [1, 5, 0, 3, 2, 0, 9, 1, 8, 5, 1, 2, 2, 9],
      goal: { type: 'store', n: 17 },
    },
    {
      title: '逆転の読み',
      stars: 3,
      text: 'いまは12対18で負けています。このターンでゲームを終わらせて逆転勝ちしましょう。',
      pits: [0, 0, 4, 3, 2, 0, 12, 4, 4, 1, 0, 0, 0, 18],
      goal: { type: 'win' },
    },
  ];

  function goalText(goal) {
    if (goal.type === 'chain') return `「もう一回」を${goal.n}回続ける`;
    if (goal.type === 'store') return `このターンでゴールに${goal.n}個以上入れる`;
    if (goal.type === 'capture') return `1回の横取りで${goal.n}個以上取る`;
    return 'このターンで勝ちを決める';
  }

  function newProgress(state) {
    return { chain: 0, gain: 0, capture: 0, won: false, startStore: state.pits[6] };
  }
  function step(progress, res) {
    const p = Object.assign({}, progress);
    if (res.extraTurn) p.chain++;
    if (res.capture) p.capture = Math.max(p.capture, res.capture.count);
    p.gain = res.state.pits[6] - p.startStore;
    p.won = res.gameOver && res.state.winner === 0;
    return p;
  }
  function met(goal, p) {
    if (goal.type === 'chain') return p.chain >= goal.n;
    if (goal.type === 'store') return p.gain >= goal.n;
    if (goal.type === 'capture') return p.capture >= goal.n;
    return p.won;
  }
  const turnOver = (s) => s.over || s.turn !== 0;
  function valueOf(goal, p) {
    if (goal.type === 'chain') return p.chain;
    if (goal.type === 'store') return p.gain;
    if (goal.type === 'capture') return p.capture;
    return p.won ? 1 : 0;
  }

  // 目標を達成する手順を1つ探す（見つからなければ null）
  function solve(state, goal, progress) {
    const p0 = progress || newProgress(state);
    if (met(goal, p0)) return [];
    if (turnOver(state)) return null;
    for (const m of E.legalMoves(state)) {
      const r = E.applyMove(state, m, false);
      const p = step(p0, r);
      if (met(goal, p)) return [m];
      if (!turnOver(r.state)) {
        const rest = solve(r.state, goal, p);
        if (rest) return [m].concat(rest);
      }
    }
    return null;
  }

  // このターンで到達できる最大値（問題づくりとテスト用）
  function best(state, goal, progress) {
    const p0 = progress || newProgress(state);
    let bestV = valueOf(goal, p0);
    if (turnOver(state)) return bestV;
    for (const m of E.legalMoves(state)) {
      const r = E.applyMove(state, m, false);
      const p = step(p0, r);
      const v = turnOver(r.state) ? valueOf(goal, p) : best(r.state, goal, p);
      if (v > bestV) bestV = v;
    }
    return bestV;
  }

  const api = { PUZZLES, goalText, newProgress, step, met, turnOver, solve, best };
  root.MancalaPuzzles = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
