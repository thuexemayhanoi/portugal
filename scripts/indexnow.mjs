#!/usr/bin/env node
// IndexNow: tells Bing (and Yandex, Seznam, Naver…) which URLs changed after a deploy, so they are
// re-crawled quickly. Google does not use IndexNow (it reads the sitemap).
//   node scripts/indexnow.mjs --probe "precos/index.html,sitemap.xml"   → changed repository files
//   node scripts/indexnow.mjs --all                                     → every URL of the sitemap
//   add --dry-run to print the request without sending it
// Only indexable URLs of the sitemap are sent, and only when the live key file answers with the key.
// Never fails the workflow: problems are printed as warnings.
import fs from 'node:fs';
import { readJSON, rel } from './lib/util.mjs';

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const data = readJSON('site/data.json');
const cfg = data.site.indexNow;
const base = data.site.baseUrl.replace(/\/$/, '');
if (!cfg?.enabled || !cfg.key) {
  console.log('IndexNow disabled (site.indexNow.enabled = false).');
  process.exit(0);
}
const sitemap = [...fs.readFileSync(rel('sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const changed = (opt('--probe') || '').split(',').map((s) => s.trim()).filter(Boolean);
const keyFile = `${cfg.key}.txt`;
const toUrl = (file) => (file === 'index.html' ? `${base}/` : file.endsWith('/index.html') ? `${base}/${file.slice(0, -'index.html'.length)}` : null);
const all = args.includes('--all') || changed.includes(keyFile);
const urls = all ? sitemap : [...new Set(changed.map(toUrl).filter((u) => u && sitemap.includes(u)))];
if (!urls.length) {
  console.log('IndexNow: no indexable URL changed.');
  process.exit(0);
}
const body = { host: new URL(base).host, key: cfg.key, keyLocation: `${base}/${keyFile}`, urlList: urls.slice(0, 10000) };
if (args.includes('--dry-run')) {
  console.log(JSON.stringify(body, null, 2));
  process.exit(0);
}
try {
  const live = await fetch(body.keyLocation, { signal: AbortSignal.timeout(20000) });
  const text = live.ok ? (await live.text()).trim() : '';
  if (text !== cfg.key) {
    console.log(`::warning::IndexNow: ${body.keyLocation} does not answer with the key yet (HTTP ${live.status}); nothing sent.`);
    process.exit(0);
  }
  const res = await fetch('https://api.indexnow.org/indexnow', { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  const meaning = { 200: 'accepted', 202: 'accepted, key validation pending', 400: 'bad request', 403: 'key not valid for this host', 422: 'URLs do not belong to the host', 429: 'too many requests' }[res.status] || 'unexpected answer';
  const line = `IndexNow: ${urls.length} URL(s) → HTTP ${res.status} (${meaning})`;
  console.log(res.status === 200 || res.status === 202 ? line : `::warning::${line}`);
} catch (e) {
  console.log(`::warning::IndexNow not sent: ${e.message}`);
}
