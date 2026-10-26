// public/icon.svg のパスから、ホーム画面用のPNGを作る。リポジトリのルートで node tools/icons/png.cjs を実行する（Playwright を使う）
const { chromium } = require('playwright');
const fs = require('fs');
const svg = fs.readFileSync('public/icon.svg', 'utf8');
const d = svg.match(/ d="([^"]+)"/)[1];
// 角丸（rx>0）は透過の角、rx=0 は全面塗り。scale は図形の大きさ（maskable は安全領域に収める）
const make = (rx, scale) => {
  const w = 384 * scale, h = 512 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="${rx}" fill="#22c55e"/><path transform="translate(${(512 - w) / 2} ${(512 - h) / 2}) scale(${scale})" fill="#ffffff" d="${d}"/></svg>`;
};
const targets = [
  ['public/pwa-192.png', 192, make(112, 0.625), true],
  ['public/pwa-512.png', 512, make(112, 0.625), true],
  ['public/pwa-maskable-512.png', 512, make(0, 0.5), false],
  ['public/apple-touch-icon.png', 180, make(0, 0.625), false],
];
(async () => {
  const b = await chromium.launch();
  for (const [out, size, s, transparent] of targets) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<html><body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,${Buffer.from(s).toString('base64')}" width="${size}" height="${size}" style="display:block"></body></html>`);
    await p.screenshot({ path: out, omitBackground: transparent });
    await p.close();
  }
  await b.close();
})();
