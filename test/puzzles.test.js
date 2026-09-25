const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/engine.js');
const P = require('../src/puzzles.js');

test('どのパズルも石は48個で、目標はちょうど最大値', () => {
  for (const q of P.PUZZLES) {
    assert.equal(E.total(q.pits), 48, q.title);
    const s = E.fromPits(q.pits, 0);
    if (q.goal.type === 'win') assert.equal(P.best(s, q.goal), 1, q.title);
    else assert.equal(P.best(s, q.goal), q.goal.n, q.title);
  }
});

test('どのパズルも解けて、解答を再生すると目標を達成する', () => {
  for (const q of P.PUZZLES) {
    let s = E.fromPits(q.pits, 0);
    const line = P.solve(s, q.goal);
    assert.ok(line && line.length > 0, q.title);
    let p = P.newProgress(s);
    for (const m of line) {
      assert.equal(s.turn, 0, q.title + ': 途中で手番が移った');
      const r = E.applyMove(s, m);
      p = P.step(p, r);
      s = r.state;
    }
    assert.ok(P.met(q.goal, p), q.title);
  }
});

test('最初に動かして成功できる穴は1つだけ（考える余地がある）', () => {
  for (const q of P.PUZZLES) {
    const s = E.fromPits(q.pits, 0);
    const ok = E.legalMoves(s).filter((m) => {
      const r = E.applyMove(s, m, false);
      const p = P.step(P.newProgress(s), r);
      return P.met(q.goal, p) || (!P.turnOver(r.state) && P.solve(r.state, q.goal, p));
    });
    assert.equal(ok.length, 1, q.title);
    assert.ok(E.legalMoves(s).length >= 3, q.title);
  }
});

test('失敗する手順では met が false', () => {
  const q = P.PUZZLES[1];
  const s = E.fromPits(q.pits, 0);
  const r = E.applyMove(s, 0);
  assert.equal(P.met(q.goal, P.step(P.newProgress(s), r)), false);
});
