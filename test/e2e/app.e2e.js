// 画面の自動テスト：docs/index.html を実際のブラウザで操作して確かめる
// 実行: npm run e2e（先にビルドしてから実行される）
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..', 'docs');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
let server, base, browser;

test.before(async () => {
  server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(ROOT, url === '/' ? 'index.html' : url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://localhost:${server.address().port}/`;
  const opts = {};
  if (process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync('/opt/pw-browsers/chromium')) opts.executablePath = '/opt/pw-browsers/chromium';
  browser = await chromium.launch(opts);
});
test.after(async () => {
  await browser?.close();
  server?.close();
});

// 速い設定・音なし・動きを減らした状態で開く。ページのエラーを集める
async function open(t, ctxOpts = {}, settings = {}) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 760 }, reducedMotion: 'reduce' }, ctxOpts));
  await ctx.addInitScript((s) => {
    if (!sessionStorage.getItem('e2e-init')) {
      sessionStorage.setItem('e2e-init', '1');
      localStorage.setItem('mancala-settings', JSON.stringify(s));
    }
  }, Object.assign({ speed: 'fast', sound: false }, settings));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    // Googleフォントなど外部の読み込み失敗は対象外
    if (m.type() === 'error' && !/Failed to load resource|ERR_/.test(m.text())) errors.push(m.text());
  });
  t.after(async () => {
    await ctx.close();
    assert.deepEqual(errors, [], 'ページでエラーが起きた');
  });
  await page.goto(base);
  await page.waitForSelector('#menu:not([hidden])');
  return page;
}

const counts = (page) => page.$$eval('#board .count', (els) => els.map((e) => Number(e.textContent)));
const sum = (a) => a.reduce((x, y) => x + y, 0);
async function waitStatus(page, text, timeout = 30000) {
  await page.waitForFunction((t) => document.querySelector('#status').textContent.includes(t), text, { timeout });
}
async function hintedPit(page) {
  await page.waitForSelector('.pit.hinted', { timeout: 15000 });
  return page.$eval('.pit.hinted', (e) => Number(e.dataset.i));
}

test('メニュー：ルール設定は折りたたまれていて、選ぶと要約が変わる', async (t) => {
  const page = await open(t);
  assert.equal(await page.$eval('#rules-fold', (d) => d.open), false);
  assert.match(await page.textContent('#rule-note'), /各穴4個（合計48個）・横取りあり・標準/);
  assert.equal(await page.isVisible('#rs-5 + label'), false);
  await page.click('#rules-fold summary');
  await page.click('#rs-5 + label');
  await page.click('#rc-off + label');
  assert.match(await page.textContent('#rule-note'), /各穴5個（合計60個）・横取りなし/);
  await page.reload();
  assert.match(await page.textContent('#rule-note'), /各穴5個/);
});

test('メニュー：スマホ幅でも短く収まる', async (t) => {
  const page = await open(t, { viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
  const h = await page.$eval('.menu-card', (e) => e.getBoundingClientRect().height);
  assert.ok(h < 780, `メニューの高さ ${h}px`);
});

test('CPU対戦：ヒント → 途中でやめる確認 → 続きから', async (t) => {
  const page = await open(t, {}, { level: 'normal' });
  await page.click('#btn-cpu');
  await waitStatus(page, 'あなたの番');
  await page.click('#btn-hint');
  const pit = await hintedPit(page);
  assert.match(await page.textContent('#status'), /ヒント/);
  await page.click(`.pit[data-i="${pit}"]`);
  await waitStatus(page, 'あなたの番');
  await page.click('#btn-back');
  assert.equal(await page.isVisible('#confirm'), true);
  await page.click('#confirm-ok');
  await page.waitForSelector('#btn-resume:not([hidden])');
  assert.match(await page.textContent('#resume-info'), /CPU・ふつうと対戦中/);
  await page.click('#btn-resume');
  await waitStatus(page, 'あなたの番');
  assert.equal(sum(await counts(page)), 48);
});

test('ルール設定：各穴6個なら石は72個', async (t) => {
  const page = await open(t, {}, { seeds: 6 });
  await page.click('#btn-cpu');
  await page.waitForSelector('#game:not([hidden])');
  assert.equal(sum(await counts(page)), 72);
});

test('パズル：ヒントどおりに解くとクリアが記録される', async (t) => {
  const page = await open(t);
  await page.click('#btn-puzzle');
  await page.click('.pz-card >> nth=0');
  for (let k = 0; k < 6 && !(await page.isVisible('#pz-next')); k++) {
    await page.click('#pz-hint');
    const pit = await hintedPit(page);
    await page.click(`.pit[data-i="${pit}"]`);
    await page.waitForFunction(() => !document.querySelector('.pit.hinted') && (document.querySelector('.pit.playable') || !document.querySelector('#pz-next').hidden), null, { timeout: 20000 });
  }
  assert.equal(await page.isVisible('#pz-next'), true);
  await page.click('#pz-list');
  assert.equal(await page.locator('.pz-card.done').count(), 1);
  await page.click('#puzzles-back');
  assert.match(await page.textContent('#puzzle-progress'), /クリア 1 \/ 10問/);
});

test('パズル：間違えると失敗の案内が出る', async (t) => {
  const page = await open(t);
  await page.click('#btn-puzzle');
  await page.click('.pz-card >> nth=1');
  await page.click('.pit[data-i="0"]');
  await page.waitForSelector('#pz-msg:not([hidden])', { timeout: 20000 });
  assert.match(await page.textContent('#pz-msg'), /手番が相手に移って/);
});

test('ふたりで対戦を最後まで → 振り返り（評価・グラフ・左右の配置）', { timeout: 240000 }, async (t) => {
  const page = await open(t, {}, { seeds: 3, capture: false });
  await page.click('#btn-pvp');
  for (let k = 0; k < 400 && !(await page.isVisible('#result')); k++) {
    const legal = await page.$$eval('.pit.playable', (els) => els.map((e) => Number(e.dataset.i)));
    if (legal.length) await page.click(`.pit[data-i="${legal[legal.length - 1]}"]`);
    else await page.waitForTimeout(100);
  }
  await page.waitForSelector('#result:not([hidden])', { timeout: 30000 });
  assert.match(await page.textContent('#result-kicker'), /各穴3個・横取りなし/);
  await page.click('#btn-review');
  await page.waitForFunction(() => /最善手 \d+/.test(document.querySelector('#rp-summary').textContent), null, { timeout: 30000 });
  assert.match(await page.textContent('#rp-count'), /^0 \/ \d+ 手目/);
  assert.match(await page.textContent('#rp-eval'), /評価：/);
  await page.click('#rp-next');
  await page.waitForFunction(() => document.querySelector('#rp-count').textContent.startsWith('1 /'), null, { timeout: 20000 });
  const box = await page.$eval('#rp-graph', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await page.mouse.click(box.x + box.w * 0.6, box.y + box.h / 2);
  const jumped = Number((await page.textContent('#rp-count')).split(' /')[0]);
  assert.ok(jumped > 1, `グラフを押した先 ${jumped}手目`);
  // 広い画面ではグラフが説明の右側に並ぶ
  const chart = await page.$eval('.rp-chart', (e) => e.getBoundingClientRect().left);
  const text = await page.$eval('#rp-move', (e) => e.getBoundingClientRect().left);
  assert.ok(chart > text + 300, `グラフ ${chart} / 説明 ${text}`);
  // ボードが小さくなりすぎない
  const bw = await page.$eval('#stage', (e) => e.getBoundingClientRect().width);
  assert.ok(bw > 500, `ボードの幅 ${bw}px`);
});

test('着せ替え：選ぶとすぐ反映され、次に開いても残る', async (t) => {
  const page = await open(t);
  await page.click('#btn-skins');
  await page.click('#ss-nut + label');
  await page.click('#sb-walnut + label');
  await page.click('#sr-green + label');
  const d = () => page.evaluate(() => ({ ...document.documentElement.dataset }));
  assert.deepEqual(await d(), { stone: 'nut', board: 'walnut' });
  await page.reload();
  assert.deepEqual(await d(), { stone: 'nut', board: 'walnut' });
});

test('設定：ガイドをオフにすると穴に合わせてもガイドが出ない', async (t) => {
  const page = await open(t);
  await page.click('#btn-pvp');
  await waitStatus(page, 'プレイヤー1の番');
  await page.hover('.pit[data-i="2"]');
  await page.waitForSelector('#board .guide:not([hidden])');
  await page.click('#btn-settings');
  await page.click('#sg-off + label');
  await page.click('#sp-normal + label');
  await page.click('#settings-close');
  await page.hover('.pit[data-i="3"]');
  assert.equal(await page.isVisible('#board .guide'), false);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mancala-settings')));
  assert.equal(saved.guide, false);
  assert.equal(saved.speed, 'normal');
});

test('スマホ：1回目のタップで選び、2回目で配る', async (t) => {
  const page = await open(t, { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  await page.tap('#btn-pvp');
  await waitStatus(page, 'プレイヤー1の番');
  await page.tap('.pit[data-i="2"]');
  assert.equal(await page.$eval('.pit[data-i="2"]', (e) => e.classList.contains('armed')), true);
  assert.equal((await counts(page))[2], 4);
  assert.match(await page.textContent('#status'), /もう一度タップ/);
  await page.tap('.pit[data-i="2"]');
  await page.waitForFunction(() => document.querySelectorAll('#board .count')[6].textContent === '1', null, { timeout: 20000 });
  // 横向きではボードが画面の大部分を使う
  const bw = await page.$eval('#stage', (e) => e.getBoundingClientRect().width);
  assert.ok(bw > 844 * 0.6, `ボードの幅 ${bw}px`);
});

test('チュートリアル：6ステップを最後まで進められる', { timeout: 120000 }, async (t) => {
  const page = await open(t);
  await page.click('#btn-tut');
  for (let k = 0; k < 6; k++) {
    if (await page.isHidden('#tut-next')) {
      const pit = await page.$eval('.pit.tut-target', (e) => Number(e.dataset.i));
      await page.click(`.pit[data-i="${pit}"]`);
      await page.waitForSelector('#tut-next:not([hidden])', { timeout: 20000 });
    }
    await page.click('#tut-next');
  }
  await page.waitForSelector('#result:not([hidden])');
  assert.match(await page.textContent('#result-title'), /おつかれさま/);
});
