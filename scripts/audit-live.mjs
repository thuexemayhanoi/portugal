#!/usr/bin/env node
// Live SEO audit of the DEPLOYED site. Runs in GitHub Actions (workflow "SEO Monitor"), independent of
// the content factory: one system produces articles, this one watches the quality of the whole site.
//   node scripts/audit-live.mjs                     → audit site.baseUrl (https://pt.rentbikehanoi.com)
//   --base URL         audit another origin (e.g. http://127.0.0.1:8080 for a local preview)
//   --wait SECONDS     first wait until the live files listed in --probe match the repository (after a deploy)
//   --probe a,b        repository paths to compare byte for byte (default: sitemap.xml,index.html)
//   --external         also check external links (sources, Google Maps, Zalo, main website)
//   --report FILE      write the JSON report     --summary FILE   append a Markdown summary (GITHUB_STEP_SUMMARY)
// Checks: HTTPS and http→https, github.io redirect, robots.txt, sitemap.xml, every sitemap URL and every
// internal link (status, redirects, canonical, robots/X-Robots-Tag, title, description, H1, lang, JSON-LD
// with the official NAP), assets, mixed content, soft 404, trailing-slash duplicates, compression, page
// weight and response time, live vs repository content, source freshness. Exit code 1 on errors.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { readJSON, rel, writeJSON, stripTags } from './lib/util.mjs';
import { businessProblems } from './lib/nap.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback = null) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};
const data = readJSON('site/data.json');
const PROD = data.site.baseUrl.replace(/\/$/, '');
const BASE = (opt('--base') || PROD).replace(/\/$/, '');
const IS_PROD = BASE === PROD;
const UA = 'Mozilla/5.0 (compatible; pt-rentbikehanoi-seo-monitor/1.0; +https://github.com/thuexemayhanoi/portugal)';
const PAGE_LIMIT = 2000;

const errors = [];
const warnings = [];
const notes = [];
const pages = new Map();
const assets = new Map();
const external = new Set();
let locs = [];
let sitemapPaths = new Set();
const E = (where, msg) => errors.push(`${where}: ${msg}`);
const W = (where, msg) => warnings.push(`${where}: ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

async function fetchOnce(url, { redirect, timeout }) {
  const t0 = performance.now();
  try {
    const res = await fetch(url, { redirect, headers: { 'user-agent': UA, 'accept-language': 'pt-PT,pt;q=0.9', 'accept-encoding': 'gzip, br' }, signal: AbortSignal.timeout(timeout) });
    const body = Buffer.from(await res.arrayBuffer());
    return { url, status: res.status, headers: res.headers, body, text: body.toString('utf8'), ms: Math.round(performance.now() - t0), location: res.headers.get('location') };
  } catch (e) {
    return { url, status: 0, error: e.cause?.code || e.cause?.message || e.name || String(e), ms: Math.round(performance.now() - t0) };
  }
}

// GitHub Pages can answer 5xx for a few seconds while a deploy propagates through its CDN. Such
// answers (and connection errors other than a timeout) are retried with a short back-off before they
// count, so a red run means the site is really broken and not that the audit raced the deploy.
const RETRIES = Math.max(0, Number(opt('--retries', 2)) || 0);
let retried = 0;
async function get(url, { redirect = 'manual', timeout = 20000, retries = RETRIES } = {}) {
  for (let attempt = 0; ; attempt++) {
    const r = await fetchOnce(url, { redirect, timeout });
    const transient = r.status >= 500 || (r.status === 0 && r.error !== 'TimeoutError');
    if (!transient || attempt >= retries) return attempt ? { ...r, retries: attempt } : r;
    retried++;
    await sleep(3000 * (attempt + 1));
  }
}

async function pool(items, size, fn) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const item = items[i++];
        out.push(await fn(item));
      }
    })
  );
  return out;
}

// URL path ↔ repository file
const fileOf = (path) => (path === '/' ? 'index.html' : path.endsWith('/') ? `${path.slice(1)}index.html` : path.slice(1));
const pathOf = (file) => (file === 'index.html' ? '/' : file.endsWith('/index.html') ? `/${file.slice(0, -'index.html'.length)}` : `/${file}`);
const localBytes = (path) => {
  const f = rel(fileOf(path));
  return fs.existsSync(f) && fs.statSync(f).isFile() ? fs.readFileSync(f) : null;
};
const locsOf = (xml) => [...String(xml).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
const attr = (html, re) => (re.exec(html) || [])[1];

// ---- 0. wait until the deploy is visible (byte-for-byte comparison of the probed files)
async function waitForDeploy(seconds, probes) {
  const deadline = Date.now() + seconds * 1000;
  for (let attempt = 1; ; attempt++) {
    const pending = [];
    for (const path of probes) {
      const local = localBytes(path);
      if (!local) continue;
      const r = await get(`${BASE}${path}?deploy-check=${Date.now()}`);
      if (r.status !== 200 || sha(r.body) !== sha(local)) pending.push(path);
    }
    if (!pending.length) {
      notes.push(`deploy visible after ${attempt} check(s)`);
      return;
    }
    if (Date.now() > deadline) {
      W('deploy', `after ${seconds}s the live site still differs from the repository: ${pending.join(', ')}`);
      return;
    }
    await sleep(20000);
  }
}

const probeArg = opt('--probe');
const probes = (probeArg ? probeArg.split(',') : ['sitemap.xml', 'index.html'])
  .map((s) => s.trim())
  .filter((s) => s && !/^(content|data|docs|factory|_factory|reports|scripts|site|src|\.github)\//.test(s))
  .map(pathOf);
const waitSeconds = Number(opt('--wait', 0));
if (waitSeconds > 0) await waitForDeploy(waitSeconds, probes);

// ---- 1. origin, HTTPS and duplicate hosts
const home = await get(`${BASE}/`);
if (home.status !== 200) {
  E('/', `site not reachable: ${home.status ? `HTTP ${home.status}` : home.error} — check DNS (CNAME pt → thuexemayhanoi.github.io) and GitHub Pages`);
  finish();
}
const host = new URL(BASE).host;
if (IS_PROD) {
  const plain = await get(`http://${host}/`);
  if (plain.status === 200) E('http://', 'HTTP answers without redirecting to HTTPS: enable "Enforce HTTPS" in Settings → Pages');
  else if ([301, 308].includes(plain.status) && String(plain.location).startsWith(`https://${host}`)) notes.push('http → https: 301');
  else W('http://', `unexpected answer on port 80: ${plain.status || plain.error}`);
  const repo = /github\.com\/([^/]+)\/([^/]+)/.exec(data.site.repository || '');
  if (repo) {
    const gh = await get(`https://${repo[1].toLowerCase()}.github.io/${repo[2]}/`);
    if (gh.status === 200) W('github.io', `https://${repo[1].toLowerCase()}.github.io/${repo[2]}/ serves the site without redirecting to ${PROD} (duplicate host)`);
    else if ([301, 308].includes(gh.status) && String(gh.location).startsWith(PROD)) notes.push('github.io → custom domain: 301');
    else if (gh.status) notes.push(`github.io answered ${gh.status}`);
  }
}

// ---- 2. robots.txt and sitemap.xml
const robots = await get(`${BASE}/robots.txt`);
if (robots.status !== 200) E('/robots.txt', `HTTP ${robots.status || robots.error}`);
else {
  if (!robots.text.includes(`Sitemap: ${PROD}/sitemap.xml`)) E('/robots.txt', 'missing "Sitemap:" line with the production sitemap URL');
  if (/User-agent:\s*\*[\s\S]*?^Disallow:\s*\/\s*$/im.test(robots.text)) E('/robots.txt', '"Disallow: /" blocks the whole site');
}
const sitemap = await get(`${BASE}/sitemap.xml`);
if (sitemap.status !== 200) E('/sitemap.xml', `HTTP ${sitemap.status || sitemap.error}`);
else {
  locs = locsOf(sitemap.text);
  if (!locs.length) E('/sitemap.xml', 'no <loc> entries');
  for (const u of locs) if (!u.startsWith(`${PROD}/`)) E('/sitemap.xml', `URL outside ${PROD}: ${u}`);
  if (new Set(locs).size !== locs.length) E('/sitemap.xml', 'duplicate <loc>');
}
const repoLocs = fs.existsSync(rel('sitemap.xml')) ? locsOf(fs.readFileSync(rel('sitemap.xml'), 'utf8')) : [];
const notLive = repoLocs.filter((u) => !locs.includes(u));
if (notLive.length) W('/sitemap.xml', `${notLive.length} URL(s) of the repository sitemap are not in the live sitemap yet: ${notLive.slice(0, 5).join(', ')}`);

// ---- 3. crawl: every sitemap URL and every internal link found
sitemapPaths = new Set([...locs, ...repoLocs].map((u) => u.replace(PROD, '')));
const queue = [...sitemapPaths];
const seen = new Set(queue);
const isAsset = (p) => /\.(css|js|png|jpe?g|webp|svg|ico|json|xml|txt|woff2?)$/i.test(p.split('?')[0]);
while (queue.length && pages.size < PAGE_LIMIT) {
  const batch = queue.splice(0, 8);
  const results = await pool(batch, 4, (path) => get(`${BASE}${path}`));
  for (const r of results) {
    const path = r.url.slice(BASE.length) || '/';
    pages.set(path, r);
    if (r.status !== 200 || !String(r.headers?.get('content-type')).includes('text/html')) continue;
    for (const [, raw] of r.text.matchAll(/\s(?:href|src)="([^"#]+)(?:#[^"]*)?"/g)) {
      let target = raw;
      if (target.startsWith(PROD)) target = target.slice(PROD.length) || '/';
      if (/^https?:\/\//.test(target)) {
        if (!target.startsWith(BASE)) external.add(target);
        continue;
      }
      if (!target.startsWith('/') || target.startsWith('//')) continue;
      if (isAsset(target)) {
        if (!assets.has(target)) assets.set(target, path);
        continue;
      }
      const clean = target.split('?')[0];
      if (!seen.has(clean)) {
        seen.add(clean);
        queue.push(clean);
      }
    }
    for (const [, img] of r.text.matchAll(/<meta property="og:image" content="([^"]+)"/g)) {
      const p = img.startsWith(PROD) ? img.slice(PROD.length) : img;
      if (p.startsWith('/') && !assets.has(p)) assets.set(p, path);
    }
  }
}

const titles = new Map();
const stale = [];
let uncompressed = 0;
for (const [path, r] of pages) {
  const inSitemap = sitemapPaths.has(path);
  if (r.status === 0) {
    E(path, `request failed: ${r.error}`);
    continue;
  }
  if (r.status >= 300 && r.status < 400) {
    (inSitemap ? E : W)(path, `redirects (${r.status}) to ${r.location}${inSitemap ? ' — sitemap URLs must answer 200' : ' — link to the final URL'}`);
    continue;
  }
  if (r.status !== 200) {
    E(path, `HTTP ${r.status}${inSitemap ? ' (URL in sitemap)' : ' (linked from the site)'}`);
    continue;
  }
  const html = r.text;
  const xrobots = r.headers.get('x-robots-tag') || '';
  const robotsMeta = attr(html, /<meta name="robots" content="([^"]*)"/) || '';
  const canonical = attr(html, /<link rel="canonical" href="([^"]*)"/);
  const indexable = !/noindex/i.test(robotsMeta) && !/noindex/i.test(xrobots);
  const expected = PROD + path;
  if (inSitemap) {
    if (!indexable) E(path, `in sitemap but not indexable (robots "${robotsMeta}", X-Robots-Tag "${xrobots}")`);
    if (canonical !== expected) E(path, `canonical ${canonical || '(none)'} ≠ ${expected}`);
  } else if (indexable) W(path, 'indexable page missing from the sitemap');
  if (/noindex/i.test(xrobots)) E(path, `X-Robots-Tag: ${xrobots}`);
  const title = stripTags(attr(html, /<title>([\s\S]*?)<\/title>/) || '');
  if (!title) E(path, 'missing <title>');
  else if (indexable) {
    if (titles.has(title)) E(path, `duplicate title with ${titles.get(title)}`);
    titles.set(title, path);
  }
  if (!attr(html, /<meta name="description" content="([^"]+)"/)) E(path, 'missing meta description');
  const h1 = (html.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) E(path, `${h1} <h1> elements`);
  if (!/<html lang="pt-PT"/.test(html)) E(path, 'html lang is not pt-PT');
  const ogUrl = attr(html, /<meta property="og:url" content="([^"]*)"/);
  if (indexable && ogUrl !== expected) W(path, `og:url ${ogUrl || '(none)'} ≠ ${expected}`);
  if (/<(?:img|script|source|iframe)[^>]+src="http:\/\//i.test(html) || /<link[^>]+href="http:\/\//i.test(html)) E(path, 'mixed content (http:// resource on an https page)');
  const nodes = [];
  for (const [, raw] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const j = JSON.parse(raw);
      nodes.push(...(j['@graph'] || [j]));
    } catch (e) {
      E(path, `invalid JSON-LD: ${e.message}`);
    }
  }
  if (indexable) {
    const biz = nodes.find((n) => [].concat(n['@type'] || []).includes('LocalBusiness'));
    if (!biz) E(path, 'JSON-LD without LocalBusiness');
    else for (const p of businessProblems(biz, data.business)) E(path, `LocalBusiness ${p}`);
    if (!html.includes(data.business.address.display) || !html.includes(`href="${data.business.phone.tel}"`)) E(path, 'official address or phone link missing from the page');
  }
  const kb = r.body.length / 1024;
  if (kb > 150) W(path, `HTML weight ${kb.toFixed(0)} KB`);
  if (r.ms > 3000) W(path, `slow answer: ${r.ms} ms`);
  if (!r.headers.get('content-encoding')) uncompressed++;
  const local = localBytes(path);
  if (local && sha(local) !== sha(r.body)) stale.push(path);
}
if (stale.length) W('deploy', `${stale.length} page(s) differ from the repository build (deploy pending or stale cache): ${stale.slice(0, 8).join(', ')}`);
if (IS_PROD && uncompressed) W('compression', `${uncompressed} HTML response(s) without gzip/br`);

// ---- 4. assets, soft 404 and trailing-slash duplicates
await pool([...assets.keys()], 4, async (p) => {
  const r = await get(`${BASE}${p}`);
  if (r.status !== 200) E(p, `asset answers ${r.status || r.error} (used on ${assets.get(p)})`);
});
const missing = await get(`${BASE}/__seo-monitor-${Date.now().toString(36)}/`);
if (missing.status === 200) E('404', 'unknown URLs answer 200 (soft 404)');
else if (missing.status !== 404) W('404', `unknown URLs answer ${missing.status || missing.error}, expected 404`);
else if (IS_PROD && !/noindex/.test(missing.text)) W('404', 'the 404 page is not noindex');
const sample = [...sitemapPaths].find((p) => p !== '/' && p.endsWith('/'));
if (sample) {
  const r = await get(`${BASE}${sample.slice(0, -1)}`);
  if (r.status === 200) W(sample, 'the URL without the final slash answers 200 too (duplicate)');
  else if (![301, 308].includes(r.status) || !String(r.location).endsWith(sample)) W(sample, `without the final slash answers ${r.status} → ${r.location || ''}`);
}

// ---- 5. external links and source freshness
if (args.includes('--external')) {
  const list = [...external].filter((u) => u.startsWith('https://')).sort();
  for (const u of [...external].filter((u) => u.startsWith('http://'))) W('external', `insecure link ${u}`);
  await pool(list, 4, async (u) => {
    const r = await get(u, { redirect: 'follow', timeout: 25000 });
    if (r.status === 0) W('external', `${u} → ${r.error}`);
    else if ([401, 403, 429].includes(r.status)) notes.push(`${u} blocks automated checks (${r.status}): verify by hand`);
    else if (r.status >= 400) W('external', `${u} → HTTP ${r.status}`);
  });
  notes.push(`external links checked: ${list.length}`);
}
const registry = readJSON('site/sources.json').sources;
const today = Date.now();
for (const s of registry) {
  const days = Math.round((today - Date.parse(s.accessed)) / 86400000);
  if (days > 365) W(`source ${s.id}`, `consulted ${days} days ago: check it again and update "accessed"`);
}

finish();

function finish() {
  const list = [...pages.entries()].map(([path, r]) => ({ path, status: r.status, ms: r.ms, kb: r.body ? Number((r.body.length / 1024).toFixed(1)) : 0, sitemap: sitemapPaths.has(path) }));
  const ok = list.filter((p) => p.status === 200);
  const summary = {
    base: BASE,
    checked_at: new Date().toISOString(),
    errors: errors.length,
    warnings: warnings.length,
    pages: list.length,
    sitemap_urls: locs.length,
    avg_ms: ok.length ? Math.round(ok.reduce((a, p) => a + p.ms, 0) / ok.length) : null,
    max_kb: ok.length ? Math.max(...ok.map((p) => p.kb)) : null
  };
  for (const w of warnings) console.warn(`WARN  ${w}`);
  for (const e of errors) console.error(`ERROR ${e}`);
  if (retried) notes.push(`${retried} transient answer(s) (5xx or connection error) retried before counting`);
  for (const n of notes) console.log(`note  ${n}`);
  console.log(`Live audit ${BASE}: ${summary.pages} URLs, ${summary.sitemap_urls} in sitemap — ${errors.length} errors, ${warnings.length} warnings`);
  const reportFile = opt('--report');
  if (reportFile) writeJSON(reportFile, { summary, errors, warnings, notes, pages: list });
  const summaryFile = opt('--summary');
  if (summaryFile) {
    const md = [
      `## SEO Monitor — ${BASE}`,
      '',
      errors.length ? `**❌ ${errors.length} lỗi**, ${warnings.length} cảnh báo` : `**✅ Không có lỗi** · ${warnings.length} cảnh báo`,
      '',
      `- URL đã kiểm tra: ${summary.pages} (sitemap: ${summary.sitemap_urls}) · thời gian trung bình: ${summary.avg_ms ?? '—'} ms · HTML lớn nhất: ${summary.max_kb ?? '—'} KB`,
      ...notes.map((n) => `- ${n}`),
      ...(errors.length ? ['', '### Lỗi', ...errors.map((e) => `- ${e}`)] : []),
      ...(warnings.length ? ['', '### Cảnh báo', ...warnings.map((w) => `- ${w}`)] : []),
      '',
      '<details><summary>Trang</summary>',
      '',
      '| URL | HTTP | ms | KB | sitemap |',
      '|---|---|---|---|---|',
      ...list.sort((a, b) => a.path.localeCompare(b.path)).map((p) => `| ${p.path} | ${p.status} | ${p.ms} | ${p.kb} | ${p.sitemap ? '✓' : ''} |`),
      '',
      '</details>',
      ''
    ].join('\n');
    fs.appendFileSync(summaryFile, md);
  }
  process.exit(errors.length ? 1 : 0);
}
