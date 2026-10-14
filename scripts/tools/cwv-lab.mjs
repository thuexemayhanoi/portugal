#!/usr/bin/env node
// Optional tooling (not part of the build): lab Core Web Vitals for one URL per template, measured
// in headless Chromium against a local static server (mobile 390×844, CPU ×4, ~1.6 Mbps / 150 ms RTT).
// Lab values only — field data (CrUX) and INP need real users and are not available here.
//   node scripts/tools/cwv-lab.mjs            → docs/audit/cwv-lab.json
// Requires Playwright available locally or globally (npm i -g playwright).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { rel, todayISO } from '../lib/util.mjs';

const require = createRequire(import.meta.url);
function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    const globalRoot = execSync('npm root -g').toString().trim();
    return require(require.resolve('playwright', { paths: [globalRoot] }));
  }
}

const SAMPLES = {
  home: '/',
  pillar: '/precos/',
  hub: '/zonas-de-hanoi/',
  archive: '/tipos-de-motas/semiautomaticas/',
  'article (tables)': '/precos/aluguer-semanal-de-mota/',
  'article (long)': '/zonas-de-hanoi/teatro-de-marionetas-na-agua/',
  faq: '/perguntas-frequentes/',
  contact: '/contactos/'
};
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.txt': 'text/plain', '.xml': 'application/xml' };

// Minimal static server for the generated site (gzip is not simulated: transfer sizes are upper bounds).
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = rel(url.replace(/^\//, ''));
  if (url.endsWith('/')) file = path.join(file, 'index.html');
  if (!file.startsWith(rel('')) || !fs.existsSync(file)) {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const { chromium } = loadPlaywright();
const browser = await chromium.launch();
const results = {};
for (const [name, url] of Object.entries(SAMPLES)) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(() => {
    window.__lcp = 0;
    window.__cls = 0;
    window.__tbt = 0;
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (window.__lcp = e.startTime))).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => l.getEntries().forEach((e) => !e.hadRecentInput && (window.__cls += e.value))).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (window.__tbt += Math.max(0, e.duration - 50)))).observe({ type: 'longtask', buffered: true });
  });
  let bytes = 0;
  page.on('response', async (r) => {
    try {
      bytes += (await r.body()).length;
    } catch {}
  });
  await page.goto(base + url, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    return { lcp: window.__lcp, cls: window.__cls, tbt: window.__tbt, fcp: fcp ? fcp.startTime : null, ttfb: nav.responseStart, overflow: document.documentElement.scrollWidth > window.innerWidth };
  });
  results[name] = { url, lcp_ms: Math.round(m.lcp), fcp_ms: Math.round(m.fcp), cls: Number(m.cls.toFixed(3)), tbt_ms: Math.round(m.tbt), transfer_kb: Math.round(bytes / 1024), horizontal_overflow: m.overflow };
  await context.close();
}
await browser.close();
server.close();

const budget = { lcp_ms: 2500, cls: 0.1, tbt_ms: 200 };
const report = {
  $comment: 'Medição de laboratório (Chromium headless, servidor local sem gzip, mobile 390×844, CPU ×4, ~1,6 Mbps, RTT 150 ms). Não é dado de campo (CrUX); INP não é medível aqui.',
  generated_at: todayISO(),
  budget,
  results,
  pass: Object.values(results).every((r) => r.lcp_ms <= budget.lcp_ms && r.cls <= budget.cls && r.tbt_ms <= budget.tbt_ms && !r.horizontal_overflow)
};
fs.writeFileSync(rel('docs/audit/cwv-lab.json'), JSON.stringify(report, null, 2) + '\n');
for (const [k, r] of Object.entries(results)) console.log(`${k.padEnd(17)} LCP ${r.lcp_ms} ms · CLS ${r.cls} · TBT ${r.tbt_ms} ms · ${r.transfer_kb} KB${r.horizontal_overflow ? ' · OVERFLOW' : ''}`);
console.log(`Budget LCP ≤ ${budget.lcp_ms} ms, CLS ≤ ${budget.cls}, TBT ≤ ${budget.tbt_ms} ms → ${report.pass ? 'PASS' : 'FAIL'}`);
