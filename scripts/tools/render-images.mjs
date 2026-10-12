#!/usr/bin/env node
// Optional tooling (not part of the build): renders the favicon PNGs and the Open Graph image
// from site/data.json using a headless Chromium via Playwright. Run only when the brand or NAP changes:
//   node scripts/tools/render-images.mjs
// Requires Playwright available locally or globally (npm i -g playwright). The PNGs are committed.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { readJSON, rel, esc } from '../lib/util.mjs';

const require = createRequire(import.meta.url);
function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    const globalRoot = execSync('npm root -g').toString().trim();
    return require(require.resolve('playwright', { paths: [globalRoot] }));
  }
}

const data = readJSON('site/data.json');
const b = data.business;
const tokens = fs.readFileSync(rel('src/css/tokens.css'), 'utf8');

const mark = (size, radius, font) => `<div style="width:${size}px;height:${size}px;border-radius:${radius}px;display:grid;place-items:center;background:var(--metal-blue);color:#fff;font:800 ${font}px/1 var(--font-sans);letter-spacing:.03em;box-shadow:inset 0 ${Math.max(1, size / 40)}px 0 rgba(255,255,255,.35),inset 0 -${Math.max(1, size / 40)}px 0 rgba(0,0,0,.25)">${esc(b.monogram)}</div>`;

const page = (body, w, h) => `<!doctype html><html><head><meta charset="utf-8"><style>${tokens}html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:transparent}</style></head><body>${body}</body></html>`;

const days = data.pricing.models.map((m) => m.day).filter((v) => typeof v === 'number');
const from = String(Math.min(...days)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const og = page(
  `<div style="position:relative;width:1200px;height:630px;box-sizing:border-box;padding:72px 80px;background:var(--brushed),var(--hero-bg);color:#fff;font-family:var(--font-sans);display:flex;flex-direction:column;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:22px">${mark(84, 22, 30)}<div><div style="font:800 34px/1.1 var(--font-sans)">${esc(b.shortName)}</div><div style="font:700 18px/1.4 var(--font-sans);letter-spacing:.14em;text-transform:uppercase;color:#9cc7ec">${esc(b.tagline)}</div></div></div>
    <div><div style="font:800 76px/1.04 var(--font-sans);letter-spacing:-.025em;max-width:900px">Aluguer de motas em Hanói</div>
    <div style="margin-top:22px;font:600 30px/1.35 var(--font-sans);color:#e2e8ee">Scooters, semiautomáticas, 50 cc e elétricas</div><div style="display:inline-block;margin-top:18px;padding:10px 20px;border-radius:999px;background:rgba(255,255,255,.1);border:1px solid rgba(201,211,220,.35);font:700 24px/1.2 var(--font-sans)">Desde ${from} VND por dia</div></div>
    <div style="display:flex;gap:34px;font:600 24px/1.3 var(--font-sans);color:#c9d3dc;border-top:1px solid rgba(201,211,220,.3);padding-top:26px"><span>${esc(b.address.streetAddress)}, ${esc(b.address.district)}</span><span>${esc(b.phone.display)}</span><span>${esc(b.hours.opens)}–${esc(b.hours.closes)}</span></div>
  </div>`,
  1200,
  630
);

const icon = (size) => page(`<div style="width:${size}px;height:${size}px;display:grid;place-items:center">${mark(size, Math.round(size * 0.22), Math.round(size * 0.42))}</div>`, size, size);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a73b8"/><stop offset=".42" stop-color="#1d5a91"/><stop offset="1" stop-color="#15406a"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#g)"/><text x="32" y="42" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif" font-size="27" font-weight="800" fill="#fff" letter-spacing="1">${esc(b.monogram)}</text></svg>\n`;

const { chromium } = loadPlaywright();
const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? {} : {});
const ctx = await browser.newContext({ deviceScaleFactor: 1 });
const shot = async (html, w, h, file, transparent = false) => {
  const p = await ctx.newPage();
  await p.setViewportSize({ width: w, height: h });
  await p.setContent(html);
  const jpeg = file.endsWith('.jpg');
  await p.screenshot({ path: rel(file), omitBackground: transparent, ...(jpeg ? { type: 'jpeg', quality: 84 } : {}) });
  await p.close();
  console.log('wrote', file);
};
fs.mkdirSync(rel('assets/img'), { recursive: true });
await shot(og, 1200, 630, 'assets/img/og-default.jpg');
await shot(icon(180), 180, 180, 'assets/img/apple-touch-icon.png', true);
await shot(icon(32), 32, 32, 'assets/img/favicon-32.png', true);
fs.writeFileSync(rel('assets/img/favicon.svg'), svg);
console.log('wrote assets/img/favicon.svg');
await browser.close();
