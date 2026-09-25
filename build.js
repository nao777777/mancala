// src/ を1枚のHTMLに結合して dist/mancala.html を作る
const fs = require('fs');
const path = require('path');
const r = (f) => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const icon = (n) => 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'assets', `icon-${n}.png`)).toString('base64');
const out = r('template.html')
  .replace('ICON64', () => icon(64))
  .replace('ICON180', () => icon(180))
  .replace('/*STYLE*/', () => r('style.css'))
  .replace('/*ENGINE*/', () => r('engine.js'))
  .replace('/*AI*/', () => r('ai.js'))
  .replace('/*PUZZLES*/', () => r('puzzles.js'))
  .replace('/*APP*/', () => r('app.js'));
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'mancala.html'), out);
console.log('dist/mancala.html', out.length, 'bytes');

// GitHub Pages 用：単体で開けるHTML（doctype・head・bodyを付ける）
const head = out.slice(0, out.indexOf('</style>') + '</style>'.length);
const rest = out.slice(head.length);
const page = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#5b3920">
<link rel="manifest" href="manifest.webmanifest">
<style>body{margin:0}[hidden]{display:none!important}img{max-width:100%}</style>
${head}
</head>
<body>${rest}
<script>
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
</script>
</body>
</html>
`;
fs.mkdirSync(path.join(__dirname, 'docs'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'docs', 'index.html'), page);
console.log('docs/index.html', page.length, 'bytes');

// Androidなどでホーム画面にインストールするためのマニフェスト・アイコン・Service Worker
for (const n of [192, 512]) fs.copyFileSync(path.join(__dirname, 'assets', `icon-${n}.png`), path.join(__dirname, 'docs', `icon-${n}.png`));
const manifest = {
  name: 'マンカラ',
  short_name: 'マンカラ',
  description: '木のボードとガラス玉で遊ぶマンカラ（カラハ式）',
  lang: 'ja',
  start_url: './',
  scope: './',
  display: 'standalone',
  orientation: 'any',
  background_color: '#5b3920',
  theme_color: '#5b3920',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
fs.writeFileSync(path.join(__dirname, 'docs', 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');
const version = require('crypto').createHash('sha1').update(page).digest('hex').slice(0, 10);
fs.writeFileSync(path.join(__dirname, 'docs', 'sw.js'), `// オフラインでも遊べるようにする。ページは通信優先（更新をすぐ反映）、失敗したらキャッシュ。
const CACHE = 'mancala-${version}';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./')))
  );
});
`);
console.log('docs/manifest.webmanifest, docs/sw.js, icons');
