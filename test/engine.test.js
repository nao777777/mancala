const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/engine.js');
const AI = require('../src/ai.js');

function mulberry(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('初期配置は各穴4個・合計48個', () => {
  const s = E.createState();
  assert.deepEqual(s.pits, [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0]);
  assert.equal(E.total(s.pits), 48);
  assert.deepEqual(E.legalMoves(s), [0, 1, 2, 3, 4, 5]);
});

test('ランダム対局で石の総数は変わらず、負の数にならない', () => {
  const rng = mulberry(42);
  for (let g = 0; g < 400; g++) {
    let s = E.createState({ first: g % 2 });
    let guard = 0;
    while (!s.over) {
      const moves = E.legalMoves(s);
      assert.ok(moves.length > 0);
      const r = E.applyMove(s, moves[Math.floor(rng() * moves.length)]);
      assert.equal(E.total(r.state.pits), 48);
      assert.ok(r.state.pits.every((x) => x >= 0));
      // イベント列を再生しても同じ盤面になる
      const replay = s.pits.slice();
      for (const e of r.events) {
        if (e.type === 'pickup') replay[e.pit] -= e.count;
        if (e.type === 'sow') replay[e.to]++;
        if (e.type === 'capture') { replay[e.store] += replay[e.pit] + replay[e.opposite]; replay[e.pit] = 0; replay[e.opposite] = 0; }
        if (e.type === 'sweep') for (const x of e.pits) { replay[e.store] += x.count; replay[x.pit] -= x.count; }
      }
      assert.deepEqual(replay, r.state.pits);
      s = r.state;
      assert.ok(++guard < 500);
    }
    assert.equal(E.sideSum(s.pits, 0) + E.sideSum(s.pits, 1), 0);
  }
});

test('配り方：反時計回りに1個ずつ', () => {
  const r = E.applyMove(E.createState(), 1);
  assert.deepEqual(r.state.pits, [4, 0, 5, 5, 5, 5, 0, 4, 4, 4, 4, 4, 4, 0]);
  assert.equal(r.state.turn, 1);
  assert.equal(r.extraTurn, false);
  assert.deepEqual(r.events.filter((e) => e.type === 'sow').map((e) => e.to), [2, 3, 4, 5]);
});

test('ゴールにぴったり入るともう1回', () => {
  const r = E.applyMove(E.createState(), 2);
  assert.equal(r.extraTurn, true);
  assert.equal(r.state.turn, 0);
  assert.equal(r.state.pits[6], 1);
  // プレイヤー1側も同様
  const s1 = E.createState({ first: 1 });
  const r1 = E.applyMove(s1, 9);
  assert.equal(r1.landing, 13);
  assert.equal(r1.extraTurn, true);
  assert.equal(r1.state.turn, 1);
});

test('横取り：自分の空の穴に最後の1個 → 向かいと一緒にゴールへ', () => {
  const s = E.fromPits([3, 2, 0, 0, 4, 1, 10, 2, 3, 6, 4, 1, 2, 10], 0);
  const r = E.applyMove(s, 1);
  assert.ok(r.capture);
  assert.equal(r.capture.pit, 3);
  assert.equal(r.capture.opposite, 9);
  assert.equal(r.capture.count, 7);
  assert.equal(r.state.pits[6], 17);
  assert.equal(r.state.pits[3], 0);
  assert.equal(r.state.pits[9], 0);
  assert.equal(r.state.pits[2], 1);
  assert.equal(E.total(r.state.pits), 48);
});

test('向かいが空なら横取りしない', () => {
  const s = E.fromPits([0, 1, 0, 4, 4, 4, 0, 4, 4, 4, 4, 0, 4, 11], 0);
  const r = E.applyMove(s, 1); // → 2（空）, 向かい10は4 → 横取り
  assert.ok(r.capture);
  const s2 = E.fromPits([0, 1, 0, 4, 4, 4, 0, 4, 4, 0, 8, 0, 4, 11], 0);
  const r2 = E.applyMove(s2, 1); // → 2, 向かい10は8 → 横取り
  assert.ok(r2.capture);
  const s3 = E.fromPits([1, 0, 0, 4, 4, 4, 0, 4, 4, 8, 4, 0, 4, 9], 0);
  const r3 = E.applyMove(s3, 0); // → 1, 向かい11は0 → 横取りなし
  assert.equal(r3.capture, null);
  assert.equal(r3.state.pits[1], 1);
});

test('プレイヤー1の横取り', () => {
  const s = E.fromPits([4, 4, 5, 4, 4, 4, 0, 0, 0, 1, 4, 4, 4, 10], 1);
  const r = E.applyMove(s, 9); // → 10? いいえ: 9の1個は10へ（非空）
  assert.equal(r.capture, null);
  const s2 = E.fromPits([4, 4, 5, 4, 4, 4, 0, 1, 0, 4, 4, 4, 4, 10], 1);
  const r2 = E.applyMove(s2, 7); // → 8（空）, 向かい4は4個
  assert.ok(r2.capture);
  assert.equal(r2.capture.opposite, 4);
  assert.equal(r2.state.pits[13], 15);
});

test('相手のゴールは飛ばす', () => {
  const s = E.fromPits([2, 1, 3, 2, 1, 10, 7, 3, 2, 2, 1, 4, 2, 8], 0);
  const r = E.applyMove(s, 5);
  const tos = r.events.filter((e) => e.type === 'sow').map((e) => e.to);
  assert.deepEqual(tos, [6, 7, 8, 9, 10, 11, 12, 0, 1, 2]);
  assert.ok(r.events.some((e) => e.type === 'skip' && e.pit === 13));
  assert.equal(r.state.pits[13], 8);
  assert.equal(r.landing, 2);
  // 13個以上で一周して元の穴にも入る
  const big = E.fromPits([0, 0, 0, 0, 0, 13, 0, 1, 1, 1, 1, 1, 1, 29], 0);
  const rb = E.applyMove(big, 5);
  assert.equal(rb.state.pits[13], 29); // 相手ゴールは増えない（終了処理を除く）
  assert.equal(E.total(rb.state.pits), 48);
});

test('終了：自陣が空になったら残りは持ち主のゴールへ', () => {
  const s = E.fromPits([0, 0, 0, 0, 0, 1, 24, 1, 1, 0, 3, 1, 2, 15], 0);
  const r = E.applyMove(s, 5);
  assert.equal(r.gameOver, true);
  assert.equal(r.extraTurn, false);
  assert.equal(r.state.pits[6], 25);
  assert.equal(r.state.pits[13], 23);
  assert.equal(r.state.winner, 0);
  const sweep = r.events.find((e) => e.type === 'sweep');
  assert.equal(sweep.player, 1);
  assert.equal(E.legalMoves(r.state).length, 0);
  // 相手側が空になっても終了
  const s2 = E.fromPits([1, 0, 0, 0, 0, 2, 20, 0, 0, 0, 0, 0, 1, 24], 1);
  const r2 = E.applyMove(s2, 12);
  assert.equal(r2.gameOver, true);
  assert.equal(r2.state.pits[6], 23);
  assert.equal(r2.state.pits[13], 25);
  assert.equal(r2.state.winner, 1);
});

test('引き分け', () => {
  const s = E.fromPits([0, 0, 0, 0, 0, 1, 23, 0, 0, 0, 0, 0, 0, 24], 0);
  const r = E.applyMove(s, 5);
  assert.equal(r.state.winner, -1);
});

test('不正な手は例外', () => {
  const s = E.createState();
  assert.throws(() => E.applyMove(s, 6));
  assert.throws(() => E.applyMove(s, 8));
  assert.throws(() => E.applyMove(E.fromPits([0, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 4], 0), 0));
});

test('予測着地点はapplyMoveと一致', () => {
  const rng = mulberry(7);
  let s = E.createState();
  for (let k = 0; k < 2000; k++) {
    if (s.over) s = E.createState({ first: k % 2 });
    const moves = E.legalMoves(s);
    const m = moves[Math.floor(rng() * moves.length)];
    const land = E.predictLanding(s, m);
    const r = E.applyMove(s, m);
    assert.equal(land, r.landing);
    s = r.state;
  }
});

test('AIは常に合法手を返す', () => {
  const rng = mulberry(3);
  for (const level of ['easy', 'normal', 'hard']) {
    let s = E.createState();
    let n = 0;
    while (!s.over && n < 30) {
      const m = AI.chooseMove(s, level, { rng, timeMs: 40 });
      assert.ok(E.isLegal(s, m), level + ' illegal ' + m);
      s = E.applyMove(s, m).state;
      n++;
    }
  }
});

test('むずかしい：もう1回と横取りを見逃さない', () => {
  // 初期盤面ではもう1回（穴2）が最善候補
  assert.equal(AI.orderedMoves(E.createState())[0], 2);
  // 大きな横取りがある局面
  const s = E.fromPits([1, 0, 5, 5, 5, 5, 5, 1, 1, 1, 1, 12, 1, 5], 0);
  assert.equal(AI.chooseMove(s, 'hard', { timeMs: 200 }), 0);
  assert.equal(AI.chooseMove(s, 'normal', { rng: () => 0.9 }), 0);
});

function playMatch(levelA, levelB, first, rng) {
  let s = E.createState({ first });
  const lv = [levelA, levelB];
  while (!s.over) s = E.applyMove(s, AI.chooseMove(s, lv[s.turn], { rng, timeMs: 30 })).state;
  return s.winner;
}

test('強さの順：むずかしい > ふつう > やさしい', () => {
  const rng = mulberry(11);
  let hardWins = 0, normalWins = 0;
  for (let g = 0; g < 12; g++) {
    if (playMatch('hard', 'easy', g % 2, rng) === 0) hardWins++;
    if (playMatch('normal', 'easy', g % 2, rng) === 0) normalWins++;
  }
  assert.ok(hardWins >= 10, 'hard vs easy: ' + hardWins);
  assert.ok(normalWins >= 8, 'normal vs easy: ' + normalWins);
  let hn = 0;
  for (let g = 0; g < 10; g++) if (playMatch('hard', 'normal', g % 2, rng) === 0) hn++;
  assert.ok(hn >= 6, 'hard vs normal: ' + hn);
});

test('ルール設定：石の数を変えられる', () => {
  for (const seeds of [3, 4, 5, 6]) {
    let s = E.createState({ seeds });
    assert.equal(E.total(s.pits), seeds * 12);
    const rng = mulberry(seeds);
    while (!s.over) {
      const moves = E.legalMoves(s);
      s = E.applyMove(s, moves[Math.floor(rng() * moves.length)]).state;
      assert.equal(E.total(s.pits), seeds * 12);
    }
  }
});

test('ルール設定：横取りなし', () => {
  const pits = [3, 2, 0, 0, 4, 1, 10, 2, 3, 6, 4, 1, 2, 10];
  const r = E.applyMove(E.fromPits(pits, 0, { capture: false }), 1);
  assert.equal(r.capture, null);
  assert.equal(r.state.pits[3], 1);
  assert.equal(r.state.pits[9], 6);
  assert.equal(r.state.rules.capture, false);
  // 次の手にもルールが引き継がれる
  const r2 = E.applyMove(r.state, E.legalMoves(r.state)[0]);
  assert.equal(r2.state.rules.capture, false);
  // 既定は横取りあり
  assert.ok(E.applyMove(E.fromPits(pits, 0), 1).capture);
  assert.equal(E.createState().rules.capture, true);
});

test('ルール設定：横取りなしでもAIは合法手を返す', () => {
  let s = E.createState({ seeds: 6, capture: false });
  for (const level of ['easy', 'normal', 'hard']) {
    const m = AI.chooseMove(s, level, { timeMs: 40 });
    assert.ok(E.isLegal(s, m));
  }
});

test('振り返りの評価：手が1つならこの手しかない、同じ価値なら最善手', () => {
  const s = E.fromPits([0, 0, 0, 0, 0, 3, 20, 2, 2, 2, 2, 2, 2, 13], 0);
  const sc = AI.analyzePosition(s);
  assert.equal(AI.gradeMove(s, sc, 5).key, 'only');
  const s2 = E.createState();
  const fake = [{ m: 2, v: 3 }, { m: 3, v: 3 }, { m: 0, v: 1 }];
  assert.equal(AI.gradeMove(s2, fake, 3).key, 'best');
});

test('振り返りの評価：勝ちを逃す手・負けが決まる手を見分ける', () => {
  const s = E.fromPits([0, 0, 0, 0, 1, 1, 20, 1, 0, 3, 1, 0, 1, 20], 0);
  const W = AI.WIN;
  assert.equal(AI.gradeMove(s, [{ m: 5, v: W + 2 }, { m: 4, v: 1 }], 4).key, 'missWin');
  assert.equal(AI.gradeMove(s, [{ m: 5, v: 0.5 }, { m: 4, v: -W - 3 }], 4).key, 'lose');
});

test('振り返りの評価：序盤はゆるめ、終盤は同じ差でも厳しく', () => {
  const early = E.createState();
  const late = E.fromPits([1, 0, 2, 0, 1, 1, 20, 1, 2, 0, 1, 0, 1, 18], 0);
  const sc = [{ m: 2, v: 3 }, { m: 0, v: 0.6 }];
  assert.equal(AI.gradeMove(early, sc, 0).key, 'good');
  assert.equal(AI.gradeMove(late, sc, 0).key, 'good');
  const sc2 = [{ m: 2, v: 5 }, { m: 0, v: 0.5 }];
  assert.equal(AI.gradeMove(early, sc2, 0).key, 'dubious');
  assert.equal(AI.gradeMove(late, sc2, 0).key, 'dubious');
  const sc3 = [{ m: 2, v: 6 }, { m: 0, v: 0.5 }];
  assert.equal(AI.gradeMove(early, sc3, 0).key, 'dubious');
  assert.equal(AI.gradeMove(late, sc3, 0).key, 'bad');
});

test('振り返りの評価：強いCPUほど悪手が少ない（評価の較正）', () => {
  const rate = (level) => {
    const rng = mulberry(5);
    let bad = 0, n = 0;
    for (let g = 0; g < 3; g++) {
      let s = E.createState({ first: g % 2 });
      while (!s.over) {
        const m = AI.chooseMove(s, level, { rng, timeMs: 40 });
        if (s.turn === 0) {
          const k = AI.gradeMove(s, AI.analyzePosition(s), m).key;
          if (k === 'bad' || k === 'missWin' || k === 'lose') bad++;
          n++;
        }
        s = E.applyMove(s, m).state;
      }
    }
    return bad / n;
  };
  const hard = rate('hard'), easy = rate('easy');
  assert.ok(hard < 0.08, 'hard ' + hard);
  assert.ok(easy > hard + 0.1, `easy ${easy} hard ${hard}`);
});
