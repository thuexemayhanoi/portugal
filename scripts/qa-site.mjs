#!/usr/bin/env node
// Site audit on the generated output (no dependencies). Run after `node scripts/build.mjs`.
//   node scripts/qa-site.mjs            → print issues, exit 1 on errors
//   node scripts/qa-site.mjs --report   → also write reports/site-audit.json
// Checks: indexability, canonical, titles/descriptions, H1, headings, broken links and anchors,
// sitemap ↔ indexable pages, robots.txt, 404, JSON-LD validity and NAP consistency, forbidden
// claims, WhatsApp policy, pt-BR vocabulary, unresolved tokens, images, CNAME and page weight.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, rel, readJSON, writeJSON, stripTags, visibleText } from './lib/util.mjs';
import { findBrazilianisms, findRiskyClaims, findStyleIssues, findForeignText } from './lib/language.mjs';
import { businessProblems } from './lib/nap.mjs';

const SOURCE_DIRS = new Set(['.git', '.github', 'node_modules', 'content', 'data', 'docs', 'factory', '_factory', 'reports', 'scripts', 'site', 'src']);
const data = readJSON('site/data.json');
const base = data.site.baseUrl;
const errors = [];
const warnings = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`${file}: ${msg}`);


function htmlFiles() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (dir === ROOT && (SOURCE_DIRS.has(e.name) || e.name === 'assets')) continue;
        walk(full);
      } else if (e.name.endsWith('.html')) out.push(path.relative(ROOT, full).split(path.sep).join('/'));
    }
  };
  walk(ROOT);
  return out.sort();
}

const fileToUrl = (f) => (f === 'index.html' ? '/' : f === '404.html' ? '/404.html' : `/${f.replace(/index\.html$/, '')}`);
const attr = (tag, name) => {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return m ? m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'") : null;
};

const pages = new Map();
for (const file of htmlFiles()) {
  const html = fs.readFileSync(rel(file), 'utf8');
  const url = fileToUrl(file);
  const head = html.slice(0, html.indexOf('</head>'));
  const main = (/<main[^>]*>([\s\S]*)<\/main>/.exec(html) || [, ''])[1];
  const metas = [...head.matchAll(/<meta\s[^>]*>/g)].map((m) => m[0]);
  const meta = (n) => metas.filter((m) => attr(m, 'name') === n || attr(m, 'property') === n).map((m) => attr(m, 'content'));
  pages.set(url, {
    file,
    url,
    html,
    main,
    lang: (/<html lang="([^"]+)"/.exec(html) || [])[1],
    titles: [...head.matchAll(/<title>([\s\S]*?)<\/title>/g)].map((m) => stripTags(m[1])),
    description: meta('description'),
    robots: meta('robots')[0] || '',
    ogUrl: meta('og:url')[0],
    canonical: [...head.matchAll(/<link rel="canonical" href="([^"]+)">/g)].map((m) => m[1]),
    h1: (html.match(/<h1[\s>]/g) || []).length,
    ids: new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])),
    links: [...html.matchAll(/<a\s[^>]*>/g)].map((m) => attr(m[0], 'href')).filter(Boolean),
    jsonld: [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1])
  });
}

// ---- per-page checks
const titleSeen = new Map();
const descSeen = new Map();
for (const p of pages.values()) {
  const f = p.file;
  const is404 = p.url === '/404.html';
  const indexable = /(^|,)index(,|$)/.test(p.robots);
  if (p.lang !== data.site.lang) err(f, `lang="${p.lang}" (expected ${data.site.lang})`);
  if (p.titles.length !== 1) err(f, `${p.titles.length} <title> tags`);
  const title = p.titles[0] || '';
  if (title.length < 25 || title.length > 70) warn(f, `title length ${title.length}: "${title}"`);
  if (titleSeen.has(title)) err(f, `duplicate title with ${titleSeen.get(title)}`);
  titleSeen.set(title, f);
  if (p.description.length !== 1) err(f, `${p.description.length} meta descriptions`);
  const d = p.description[0] || '';
  if (!is404 && (d.length < 100 || d.length > 170)) warn(f, `meta description length ${d.length}`);
  if (descSeen.has(d)) err(f, `duplicate meta description with ${descSeen.get(d)}`);
  descSeen.set(d, f);
  if (p.h1 !== 1) err(f, `${p.h1} <h1> elements (expected 1)`);
  if (is404) {
    if (indexable) err(f, '404 must be noindex');
    if (p.canonical.length) err(f, '404 must not declare a canonical');
  } else {
    if (p.canonical.length !== 1) err(f, `${p.canonical.length} canonical tags`);
    else if (indexable && p.canonical[0] !== base + p.url) err(f, `canonical ${p.canonical[0]} is not self-referencing (${base + p.url})`);
    if (p.ogUrl !== base + p.url) err(f, `og:url ${p.ogUrl} differs from the page URL`);
    if (!/\/$/.test(p.url)) err(f, `URL ${p.url} must end with /`);
  }
  if (/\{\{\s*[\w.-]+\s*\}\}/.test(p.html)) err(f, 'unresolved {{token}} in output');

  // headings order inside <main>
  let last = 1;
  for (const m of p.main.matchAll(/<h([1-6])[\s>]/g)) {
    const level = Number(m[1]);
    if (level > last + 1) warn(f, `heading jumps from h${last} to h${level}`);
    last = level;
  }

  // images
  for (const m of p.html.matchAll(/<img\s[^>]*>/g)) {
    for (const a of ['alt', 'width', 'height']) if (attr(m[0], a) === null) err(f, `<img> without ${a}`);
  }

  // links
  for (const href of p.links) {
    if (href.startsWith('http://')) err(f, `insecure link ${href}`);
    if (!href.startsWith('/') && !href.startsWith('#')) continue;
    const [pathPart, hash] = href.split('#');
    const target = pathPart === '' ? p : pages.get(pathPart) || null;
    if (pathPart) {
      const file = pathPart.endsWith('/') ? `${pathPart.slice(1)}index.html` : pathPart.slice(1);
      if (!fs.existsSync(rel(file.split('?')[0]))) {
        err(f, `broken internal link ${href}`);
        continue;
      }
    }
    if (hash && target && !target.ids.has(decodeURIComponent(hash))) err(f, `missing anchor #${hash} on ${pathPart || p.url}`);
  }

  // WhatsApp policy
  if (!(data.business.whatsapp.enabled && data.business.whatsapp.verified) && /wa\.me|api\.whatsapp|whatsapp:\/\//i.test(p.html)) {
    err(f, 'WhatsApp link present while business.whatsapp is not enabled+verified');
  }
  // NAP present on every page (header, footer, floating call): official phone link, address and hours
  const biz = data.business;
  if (!p.html.includes(`href="${biz.phone.tel}"`)) err(f, `missing ${biz.phone.tel} link`);
  if (!p.html.includes(biz.address.display)) err(f, 'Portuguese display address not found on page');
  if (!p.html.includes(biz.hours.display)) err(f, 'official opening hours text not found on page');
  for (const [, tel] of p.html.matchAll(/href="(tel:[^"]*)"/g)) if (tel !== biz.phone.tel) err(f, `tel link ${tel} differs from ${biz.phone.tel}`);

  // JSON-LD
  const nodes = [];
  for (const raw of p.jsonld) {
    try {
      const j = JSON.parse(raw);
      nodes.push(...(j['@graph'] || [j]));
    } catch (e) {
      err(f, `invalid JSON-LD: ${e.message}`);
    }
  }
  const all = JSON.stringify(nodes);
  if (/aggregateRating|"review"|"Review"/.test(all)) err(f, 'JSON-LD contains ratings/reviews (not allowed without verified data)');
  if (!is404) {
    const typesOf = (n) => [].concat(n['@type'] || []);
    const types = nodes.flatMap(typesOf);
    for (const t of ['LocalBusiness', 'Organization', 'WebSite']) if (!types.includes(t)) err(f, `JSON-LD missing ${t}`);
    const businesses = nodes.filter((n) => typesOf(n).includes('LocalBusiness') || typesOf(n).includes('Organization'));
    if (businesses.length > 1) err(f, `${businesses.length} business/organization nodes: the shop must be a single entity (#business)`);
    const lb = businesses[0];
    if (lb) for (const problem of businessProblems(lb, data.business)) err(f, `LocalBusiness: ${problem}`);
    const visibleFaq = (p.main.match(/class="faq-item"/g) || []).length;
    if (types.includes('FAQPage') && visibleFaq < 2) err(f, 'FAQPage schema without visible FAQ');
    if (p.url !== '/') {
      const bc = nodes.find((n) => n['@type'] === 'BreadcrumbList');
      const visible = ((/<nav class="breadcrumb"[\s\S]*?<\/nav>/.exec(p.html) || [''])[0].match(/<li>/g) || []).length;
      if (!bc) err(f, 'missing BreadcrumbList');
      else if (bc.itemListElement.length !== visible) err(f, `BreadcrumbList has ${bc.itemListElement.length} items, visible breadcrumb has ${visible}`);
    }
    if (p.html.includes('<article class="article">') && !types.includes('BlogPosting')) err(f, 'article page without BlogPosting schema');
  }

  // language and claims on visible Portuguese text (elements marked lang="en"/"vi" are skipped)
  const text = visibleText(p.main.replace(/<section class="sources"[\s\S]*?<\/section>/g, ' '));
  for (const hit of findBrazilianisms(text)) warn(f, `pt-BR term "${hit.term}" → prefer "${hit.pt}" (…${hit.context}…)`);
  for (const hit of findStyleIssues(text)) warn(f, `pt-PT style "${hit.term}" → prefer "${hit.pt}" (…${hit.context}…)`);
  const foreign = findForeignText(text);
  for (const hit of [...foreign.spanish, ...foreign.noAccents, ...foreign.english]) warn(f, `${hit.pt} "${hit.term}" (…${hit.context}…)`);
  for (const hit of findRiskyClaims(text)) warn(f, `claim to verify "${hit.match}" (…${hit.context}…)`);
  const kb = Buffer.byteLength(p.html) / 1024;
  if (kb > 150) warn(f, `page weight ${kb.toFixed(0)} KB`);
}

// ---- sitemap, robots, search index, CNAME, Jekyll config
const sitemap = fs.readFileSync(rel('sitemap.xml'), 'utf8');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const indexable = [...pages.values()].filter((p) => /(^|,)index(,|$)/.test(p.robots)).map((p) => base + p.url);
for (const loc of locs) {
  const p = pages.get(loc.replace(base, ''));
  if (!p) err('sitemap.xml', `URL without page: ${loc}`);
  else if (!/(^|,)index(,|$)/.test(p.robots)) err('sitemap.xml', `noindex page in sitemap: ${loc}`);
}
for (const u of indexable) if (!locs.includes(u)) err('sitemap.xml', `indexable page missing: ${u}`);
if (new Set(locs).size !== locs.length) err('sitemap.xml', 'duplicate <loc>');

const robots = fs.readFileSync(rel('robots.txt'), 'utf8');
if (!robots.includes(`Sitemap: ${base}/sitemap.xml`)) err('robots.txt', 'missing Sitemap line');
if (/^Disallow:\s*\/\s*$/m.test(robots)) err('robots.txt', 'Disallow: / blocks the whole site');

try {
  const index = JSON.parse(fs.readFileSync(rel('assets/search-index.json'), 'utf8'));
  for (const r of index) if (!pages.has(r.u)) err('assets/search-index.json', `unknown URL ${r.u}`);
} catch (e) {
  err('assets/search-index.json', `invalid: ${e.message}`);
}

const cname = fs.readFileSync(rel('CNAME'), 'utf8').trim();
if (cname !== 'pt.rentbikehanoi.com') err('CNAME', `must be pt.rentbikehanoi.com (found "${cname}")`);

// GitHub Pages runs Jekyll on this branch. Jekyll matches `exclude` entries by prefix (the entry
// "site" also hides "sitemap.xml"), so every public file must pass the same filter unless it is
// listed in `include`, and every source folder must be filtered out.
function jekyllLists(text) {
  const lists = { exclude: [], include: [] };
  const unquote = (s) => s.trim().replace(/^["']|["']$/g, '');
  let key = null;
  for (const line of text.split('\n')) {
    const top = /^([A-Za-z_]+):\s*(.*)$/.exec(line);
    if (top) {
      key = top[1] in lists ? top[1] : null;
      const inline = /^\[(.*)\]/.exec(top[2]);
      if (key && inline) lists[key].push(...inline[1].split(',').map(unquote).filter(Boolean));
      continue;
    }
    const item = /^\s+-\s+([^#]+)/.exec(line);
    if (key && item) lists[key].push(unquote(item[1]));
  }
  return lists;
}
const globRe = (g) => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
const jekyllMatches = (patterns, file) => patterns.some((p) => file.startsWith(p) || globRe(p).test(file));
if (!fs.existsSync(rel('_config.yml'))) err('_config.yml', 'missing: GitHub Pages would publish the source folders');
else {
  const jekyll = jekyllLists(fs.readFileSync(rel('_config.yml'), 'utf8'));
  const hidden = (f) => jekyllMatches(jekyll.exclude, f) && !jekyllMatches(jekyll.include, f);
  const assetFiles = [];
  const walkAssets = (dir) => {
    for (const e of fs.readdirSync(rel(dir), { withFileTypes: true })) {
      if (e.isDirectory()) walkAssets(`${dir}/${e.name}`);
      else assetFiles.push(`${dir}/${e.name}`);
    }
  };
  walkAssets('assets');
  const indexNowFile = data.site.indexNow?.enabled ? [`${data.site.indexNow.key}.txt`] : [];
  for (const f of ['CNAME', 'robots.txt', 'sitemap.xml', 'llms.txt', ...indexNowFile, ...htmlFiles(), ...assetFiles]) {
    if (hidden(f)) err('_config.yml', `GitHub Pages would not publish ${f}: an "exclude" entry matches it (Jekyll matches by prefix); add it to "include" or rename the entry`);
  }
  const privateEntries = [...SOURCE_DIRS].filter((d) => !/^[._]/.test(d) && d !== 'node_modules' && fs.existsSync(rel(d)));
  for (const f of [...privateEntries, 'AGENTS.md', 'README.md', 'CHANGELOG.md', 'package.json']) {
    if (!hidden(f)) err('_config.yml', `${f} is not excluded: GitHub Pages would publish it`);
  }
}

const summary = { pages: pages.size, indexable: indexable.length, sitemap_urls: locs.length, errors: errors.length, warnings: warnings.length };
for (const w of warnings) console.warn(`WARN  ${w}`);
for (const e of errors) console.error(`ERROR ${e}`);
console.log(`QA site: ${summary.pages} pages, ${summary.indexable} indexable, ${summary.sitemap_urls} in sitemap — ${errors.length} errors, ${warnings.length} warnings`);
if (process.argv.includes('--report')) writeJSON('reports/site-audit.json', { summary, errors, warnings });
process.exit(errors.length ? 1 : 0);
