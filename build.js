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
<style>body{margin:0}[hidden]{display:none!important}img{max-width:100%}</style>
${head}
</head>
<body>${rest}
</body>
</html>
`;
fs.mkdirSync(path.join(__dirname, 'docs'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'docs', 'index.html'), page);
console.log('docs/index.html', page.length, 'bytes');
