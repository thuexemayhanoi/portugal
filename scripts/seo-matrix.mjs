#!/usr/bin/env node
// SEO Master Matrix: one row per generated URL, scored from the built HTML, the sitemap,
// llms.txt and the content model. Read-only: it changes nothing in the site.
//   node scripts/seo-matrix.mjs            → docs/audit/seo-master-matrix.csv + seo-matrix-summary.json
// Priorities: P0 = breaks indexing, correctness or trust (fix now); P1 = clear SEO loss
// (fix in the next batch); P2 = improvement. Only measured facts: no search volumes, rankings,
// Search Console or field Core Web Vitals (not connected), and the report says so.
import fs from 'node:fs';
import { rel, normalize, todayISO, urlToFile, visibleText, wordCount } from './lib/util.mjs';
import { loadModel } from './lib/model.mjs';
import { intentTokens } from './lib/intent.mjs';

const SITE = 'https://pt.rentbikehanoi.com';
const OUT = 'docs/audit';
const model = loadModel();
const topicById = new Map(model.plan.topics.map((t) => [t.id, t]));

const decode = (s) => String(s ?? '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const strip = (s) => decode(String(s).replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const meta = (h, name) => decode((new RegExp(`<meta name="${name}" content="([^"]*)"`).exec(h) || [])[1] || '');
const csv = (rows) => rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n') + '\n';
const tokens = (s) => [...intentTokens(normalize(s))];
// Keyword coverage: every word except Portuguese function words, singular/plural folded.
const STOP = new Set(['de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 'a', 'o', 'as', 'os', 'e', 'ou', 'para', 'por', 'com', 'um', 'uma', 'ao', 'que', 'se']);
const words = (s) => normalize(s).split(' ').filter((w) => w && !STOP.has(w)).map((w) => (w.length > 3 ? w.replace(/(oes|aes|s)$/, '') : w));
const jac = (a, b) => {
  const A = new Set(a);
  const B = new Set(b);
  const i = [...A].filter((x) => B.has(x)).length;
  return A.size + B.size - i ? i / (A.size + B.size - i) : 0;
};

// --- site-wide inputs
const sitemapXml = fs.readFileSync(rel('sitemap.xml'), 'utf8');
const sitemap = new Map([...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>\s*(?:<lastmod>([^<]+)<\/lastmod>)?/g)].map((m) => [m[1].replace(SITE, ''), m[2] || '']));
const llms = fs.readFileSync(rel('llms.txt'), 'utf8');
const cannibal = fs.existsSync(rel(`${OUT}/cannibalization.csv`))
  ? fs.readFileSync(rel(`${OUT}/cannibalization.csv`), 'utf8').split('\n').slice(1).filter(Boolean).map((l) => l.slice(1, -1).split('","')).filter((c) => ['HIGH', 'MEDIUM'].includes(c[7]))
  : [];
const linksIn = (obj) => [...new Set([...JSON.stringify(obj ?? '').matchAll(/\]\((\/[^)#\s]*)/g)].map((m) => m[1]))];

// Contextual inbound links: written in page or article content (navigation, cards and footers excluded).
const contextual = new Map();
const add = (from, links) => links.forEach((u) => u !== from && contextual.set(u, new Set([...(contextual.get(u) || []), from])));
for (const p of model.pages) {
  if (p.kind === 'page') add(p.url, linksIn(p.sections));
  if (p.kind === 'article') add(p.url, linksIn(p.article));
}

// --- per-URL facts from the built HTML
const pages = [...model.byUrl.values()];
const facts = pages.map((p) => {
  const file = rel(urlToFile(p.url));
  const h = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const main = (/<main[^>]*>([\s\S]*?)<\/main>/.exec(h) || [])[1] || '';
  const ld = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => {
    try {
      return JSON.parse(m[1]);
    } catch {
      return null;
    }
  });
  const graph = ld.flatMap((x) => (x ? x['@graph'] || [x] : [{ parseError: true }]));
  const types = graph.flatMap((n) => [].concat(n['@type'] || (n.parseError ? 'PARSE_ERROR' : [])));
  const imgs = [...main.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  const levels = [...main.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
  const article = p.kind === 'article' ? p.article : null;
  const topic = p.kind === 'article' ? topicById.get(p.id) : null;
  return {
    p,
    exists: Boolean(h),
    bytes: Buffer.byteLength(h),
    lang: (/<html lang="([^"]+)"/.exec(h) || [])[1] || '',
    viewport: /<meta name="viewport"/.test(h),
    title: strip((/<title>([\s\S]*?)<\/title>/.exec(h) || [])[1] || ''),
    description: meta(h, 'description'),
    canonical: (/<link rel="canonical" href="([^"]+)"/.exec(h) || [])[1] || '',
    robots: meta(h, 'robots'),
    h1: [...main.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => strip(m[1])),
    headingJump: levels.some((l, i) => i > 0 && l > levels[i - 1] + 1),
    words: wordCount(visibleText(main)),
    answerBox: /class="answer-box"/.test(main),
    faqVisible: /class="faq-item"/.test(main),
    sourcesVisible: /id="fontes"/.test(main),
    types,
    forbidden: /"(aggregateRating|review|geo|postalCode)"/.test(ld.map((x) => JSON.stringify(x)).join('')),
    blogPosting: graph.find((n) => [].concat(n['@type']).includes('BlogPosting')) || null,
    imgsNoAlt: imgs.filter((i) => !/\balt="/.test(i)).length,
    imgsNoSize: imgs.filter((i) => !/\bwidth="/.test(i) || !/\bheight="/.test(i)).length,
    tablesBare: (main.match(/<table\b/g) || []).length - (main.match(/class="table-wrap/g) || []).length,
    outInternal: new Set([...main.matchAll(/href="(\/[^"#?]*)/g)].map((m) => m[1])).size,
    keyword: topic?.primary_keyword || p.primaryKeyword || '',
    modified: article?.date_modified || p.updated || '',
    sources: article ? (article.sources || []).length : null,
    legal: Boolean(article?.legal_note),
    faqCount: article ? (article.faq || []).length : null,
    inLlms: llms.includes(`${SITE}${p.url}`)
  };
});

// --- site-wide duplicate checks
const byTitle = new Map();
const byDesc = new Map();
for (const f of facts) {
  byTitle.set(f.title, [...(byTitle.get(f.title) || []), f.p.url]);
  byDesc.set(f.description, [...(byDesc.get(f.description) || []), f.p.url]);
}
const titleTokens = facts.map((f) => ({ url: f.p.url, t: tokens(f.title), idx: f.p.indexable }));
const nearTitle = new Map();
for (let i = 0; i < titleTokens.length; i++) {
  for (let j = i + 1; j < titleTokens.length; j++) {
    const a = titleTokens[i];
    const b = titleTokens[j];
    if (!a.idx || !b.idx) continue;
    if (jac(a.t, b.t) >= 0.75) {
      nearTitle.set(a.url, [...(nearTitle.get(a.url) || []), b.url]);
      nearTitle.set(b.url, [...(nearTitle.get(b.url) || []), a.url]);
    }
  }
}

// --- scoring
const rows = [];
for (const f of facts) {
  const { p } = f;
  const issues = { P0: [], P1: [], P2: [] };
  const I = (lvl, msg) => issues[lvl].push(msg);
  const url = `${SITE}${p.url}`;
  const indexable = /(^|,)\s*index/.test(f.robots) && !/noindex/.test(f.robots);
  const isArticle = p.kind === 'article';
  const inbound = (contextual.get(p.url) || new Set()).size;

  // Technical
  if (!f.exists) I('P0', 'ficheiro HTML em falta');
  if (f.canonical !== url && p.indexable) I('P0', `canonical ${f.canonical || 'em falta'}`);
  if (p.indexable && !indexable) I('P0', `robots "${f.robots}" numa página indexável`);
  if (indexable && !sitemap.has(p.url)) I('P0', 'indexável mas fora do sitemap');
  if (!indexable && sitemap.has(p.url)) I('P0', 'noindex no sitemap');
  if (f.lang !== 'pt-PT') I('P0', `lang="${f.lang}"`);
  if (!f.viewport) I('P0', 'sem meta viewport');
  if (indexable && sitemap.get(p.url) && f.modified && sitemap.get(p.url) !== f.modified) I('P2', `lastmod ${sitemap.get(p.url)} ≠ data de revisão ${f.modified}`);

  // On-page
  if (!f.title) I('P0', 'sem <title>');
  else if ((byTitle.get(f.title) || []).length > 1) I('P0', 'title duplicado');
  if (!f.description) I('P0', 'sem meta description');
  else if ((byDesc.get(f.description) || []).length > 1) I('P0', 'description duplicada');
  if (f.h1.length !== 1) I('P0', `${f.h1.length} H1`);
  const tl = [...f.title].length;
  const dl = [...f.description].length;
  if (tl > 70 || tl < 30) I('P1', `title com ${tl} caracteres (30–70)`);
  else if (tl > 65) I('P2', `title com ${tl} caracteres (ideal ≤ 65)`);
  if (dl > 165 || dl < 110) I('P1', `description com ${dl} caracteres (110–165)`);
  else if (dl > 160 || dl < 120) I('P2', `description com ${dl} caracteres (ideal 120–160)`);
  if (nearTitle.has(p.url)) I('P1', `title quase igual a ${nearTitle.get(p.url).slice(0, 2).join(' ')}`);
  if (f.headingJump) I('P2', 'salto de nível nos cabeçalhos');
  if (f.keyword && indexable) {
    const kw = words(f.keyword);
    const inT = kw.filter((k) => words(`${f.title} ${f.h1.join(' ')}`).includes(k)).length / (kw.length || 1);
    const inD = kw.filter((k) => words(f.description).includes(k)).length / (kw.length || 1);
    if (inT < 0.5) I('P1', `palavra-chave «${f.keyword}» quase ausente do title/H1`);
    else if (inD < 0.5) I('P2', `palavra-chave «${f.keyword}» quase ausente da description`);
  }

  // Content and E-E-A-T
  if (isArticle && f.words < 900) I('P1', `conteúdo curto (${f.words} palavras)`);
  if (!isArticle && p.kind === 'page' && f.words < 300) I('P2', `página curta (${f.words} palavras)`);
  if (isArticle && !f.sources) I('P1', 'artigo sem fontes citadas (E-E-A-T)');
  else if (isArticle && !f.sourcesVisible) I('P0', 'fontes sem secção visível');
  else if (isArticle && f.sources < 3) I('P2', `só ${f.sources} fontes`);
  if (isArticle && f.legal && f.modified && (Date.now() - Date.parse(f.modified)) / 864e5 > 365) I('P1', 'nota legal com revisão > 12 meses');

  // Schema
  if (f.types.includes('PARSE_ERROR')) I('P0', 'JSON-LD inválido');
  if (f.forbidden) I('P0', 'campo proibido no JSON-LD');
  if (!f.types.includes('BreadcrumbList') && p.url !== '/') I('P1', 'sem BreadcrumbList');
  if (isArticle && !f.blogPosting) I('P0', 'artigo sem BlogPosting');
  if (f.blogPosting && (!f.blogPosting.datePublished || !f.blogPosting.dateModified || !f.blogPosting.author)) I('P1', 'BlogPosting incompleto (datas/autor)');
  // A page may show questions marked up on /perguntas-frequentes/ (faqSchema: false): one FAQPage per question.
  if (f.faqVisible && !f.types.includes('FAQPage') && !(p.faqSchemaIds && !p.faqSchema)) I('P1', 'FAQ visível sem FAQPage');
  if (!f.faqVisible && f.types.includes('FAQPage')) I('P0', 'FAQPage sem FAQ visível');

  // Internal links
  if (isArticle && indexable && inbound === 0) I('P1', 'órfão: nenhuma ligação contextual de entrada');
  else if (isArticle && indexable && inbound === 1) I('P2', 'só 1 ligação contextual de entrada');
  if (isArticle && f.outInternal < 5) I('P2', `poucas ligações internas de saída (${f.outInternal})`);

  // Cannibalization (no merge or redirect without approval: differentiate the angle)
  for (const c of cannibal) if (c[0] === p.url || c[1] === p.url) I('P1', `canibalização ${c[7]} com ${c[0] === p.url ? c[1] : c[0]}`);

  // Mobile UX and performance proxies (field Core Web Vitals are not connected)
  if (f.imgsNoAlt) I('P1', `${f.imgsNoAlt} imagens sem alt`);
  if (f.imgsNoSize) I('P2', `${f.imgsNoSize} imagens sem width/height (CLS)`);
  if (f.tablesBare > 0) I('P1', `${f.tablesBare} tabelas sem contentor de scroll (mobile)`);
  if (f.bytes > 120000) I('P2', `HTML com ${Math.round(f.bytes / 1024)} KB`);

  // AEO / GEO
  if (indexable && isArticle && !f.answerBox) I('P1', 'sem resposta rápida (answer box)');
  if (indexable && !f.inLlms) I('P2', 'ausente do llms.txt');
  if (isArticle && (f.faqCount || 0) < 2) I('P2', 'FAQ com menos de 2 perguntas');

  const priority = issues.P0.length ? 'P0' : issues.P1.length ? 'P1' : issues.P2.length ? 'P2' : 'OK';
  rows.push({
    url: p.url,
    id: p.id || '',
    kind: p.kind,
    indexable: indexable ? 'yes' : 'no',
    priority,
    p0: issues.P0.join(' | '),
    p1: issues.P1.join(' | '),
    p2: issues.P2.join(' | '),
    title: f.title,
    title_len: tl,
    description_len: dl,
    h1: f.h1[0] || '',
    keyword: f.keyword,
    words: f.words,
    contextual_in: inbound,
    internal_out: f.outInternal,
    sources: f.sources ?? '',
    schema: [...new Set(f.types)].filter((t) => ['BlogPosting', 'WebPage', 'CollectionPage', 'AboutPage', 'ContactPage', 'FAQPage', 'BreadcrumbList', 'LocalBusiness'].includes(t)).join(' '),
    answer_box: f.answerBox ? 'yes' : 'no',
    in_sitemap: sitemap.has(p.url) ? 'yes' : 'no',
    in_llms: f.inLlms ? 'yes' : 'no',
    modified: f.modified,
    html_kb: Math.round(f.bytes / 1024)
  });
}

const order = { P0: 0, P1: 1, P2: 2, OK: 3 };
rows.sort((a, b) => order[a.priority] - order[b.priority] || a.url.localeCompare(b.url));
const cols = Object.keys(rows[0]);
fs.writeFileSync(rel(`${OUT}/seo-master-matrix.csv`), csv([cols, ...rows.map((r) => cols.map((c) => r[c]))]));

const count = (k) => rows.filter((r) => r.priority === k).length;
const issueCounts = {};
for (const r of rows) {
  for (const lvl of ['p0', 'p1', 'p2']) {
    for (const msg of r[lvl].split(' | ').filter(Boolean)) {
      const key = `${lvl.toUpperCase()} ${msg.replace(/\d+/g, 'N').replace(/«[^»]*»/g, '«…»').replace(/ (com|a) \/\S+( \/\S+)?$/, ' com …')}`;
      issueCounts[key] = (issueCounts[key] || 0) + 1;
    }
  }
}
const summary = {
  generated_at: todayISO(),
  urls: rows.length,
  indexable: rows.filter((r) => r.indexable === 'yes').length,
  priority: { P0: count('P0'), P1: count('P1'), P2: count('P2'), OK: count('OK') },
  issues: Object.fromEntries(Object.entries(issueCounts).sort((a, b) => a[0].localeCompare(b[0]))),
  not_measured: [
    'Search Console / Bing: impressões, cliques, CTR, posição e estado de indexação (ligação por configurar, ver docs/OWNER-ACTIONS.md)',
    'Core Web Vitals de campo (CrUX); Lighthouse corre no workflow SEO Monitor sobre o site real',
    'Estado HTTP do site real (workflow SEO Monitor / scripts/audit-live.mjs)'
  ]
};
fs.writeFileSync(rel(`${OUT}/seo-matrix-summary.json`), JSON.stringify(summary, null, 2) + '\n');
console.log(`SEO matrix: ${rows.length} URLs ${JSON.stringify(summary.priority)} → ${OUT}/seo-master-matrix.csv`);
for (const [k, n] of Object.entries(summary.issues)) console.log(`  ${n}× ${k}`);
