#!/usr/bin/env node
// Read-only content audit: inventory, SEO master matrix, cannibalization, topical coverage,
// entity map (knowledge graph), internal links and an upgrade backlog, from the repository
// (content, plan, factory drafts, generated HTML, sitemap). Nothing in the site is changed;
// results go to docs/audit/. Live HTTP status and Search Console data are NOT read here
// (see the SEO Monitor workflow); the report says so instead of guessing.
//   node scripts/audit-content.mjs
import fs from 'node:fs';
import path from 'node:path';
import { readJSON, listFiles, rel, normalize, wordCount, todayISO } from './lib/util.mjs';
import { loadModel } from './lib/model.mjs';
import { buildTokens, plain } from './lib/text.mjs';
import { intentFingerprint, jaccard } from './lib/intent.mjs';
import { runGuard } from './lib/guard.mjs';

const OUT = 'docs/audit';
const model = loadModel();
const plan = model.plan;
const topicById = new Map(plan.topics.map((t) => [t.id, t]));
const ctx = { tokens: buildTokens(model.data), where: 'audit' };
const txt = (s) => {
  try {
    return plain(String(s ?? ''), ctx);
  } catch {
    return String(s ?? '');
  }
};
const bodyText = (a) =>
  [a.summary, ...(a.intro || []), ...(a.key_points || []), ...(a.sections || []).flatMap((s) => [s.h2, ...(s.body || []).flatMap((b) => (typeof b === 'string' ? [b] : [b.p, b.h3, b.note, ...(b.ul || []), ...(b.ol || []), ...(b.checklist || []), ...(b.steps || []).flatMap((x) => [x.title, x.text]), ...(b.table ? [b.table.caption, ...(b.table.rows || []).flat()] : [])]))]), ...(a.faq || []).flatMap((f) => [f.q, f.a])]
    .filter((x) => typeof x === 'string')
    .map(txt)
    .join(' ');
const linksIn = (obj) => [...new Set([...JSON.stringify(obj).matchAll(/\]\((\/[^)#\s]*)/g)].map((m) => m[1]))];
const csv = (rows) => rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n') + '\n';

// --- generated HTML facts (canonical, robots) and sitemap
const sitemap = new Set([...fs.readFileSync(rel('sitemap.xml'), 'utf8').matchAll(/<loc>https:\/\/pt\.rentbikehanoi\.com([^<]*)<\/loc>/g)].map((m) => m[1]));
const htmlFacts = (url) => {
  const file = rel(path.join(url.replace(/^\//, ''), 'index.html'));
  if (!fs.existsSync(file)) return { canonical: '', robots: 'MISSING FILE' };
  const h = fs.readFileSync(file, 'utf8');
  return { canonical: (/<link rel="canonical" href="([^"]+)"/.exec(h) || [])[1] || '', robots: (/<meta name="robots" content="([^"]+)"/.exec(h) || [])[1] || '' };
};

// --- inventory: base pages, generated hubs/archives, articles, drafts, planned topics
const rows = [];
const inbound = new Map();
const addInbound = (from, links) => links.forEach((u) => u !== from && inbound.set(u, [...(inbound.get(u) || []), from]));
for (const p of model.pages) {
  if (p.kind === 'page') addInbound(p.url, linksIn(p.sections || []));
}
for (const a of model.articles) addInbound(a.url, linksIn(a.article));
const roleOf = (p) => (p.url === '/' ? 'HOMEPAGE' : p.kind === 'hub' ? 'HUB' : p.kind === 'archive' ? 'SILO' : p.kind === 'article' ? 'SUPPORT' : model.parents.has(p.parent) && model.parents.get(p.parent).url === p.url ? 'PILLAR' : ['/contactos/', '/sobre-nos/', '/politica-de-privacidade/', '/termos-e-condicoes/'].includes(p.url) ? 'UTILITY' : 'PILLAR');
const drafts = [];
for (const dir of ['_factory/inbox', '_factory/review']) {
  for (const f of listFiles(dir, '.json').filter((f) => /^PT-\d{4}\.json$/.test(f))) drafts.push({ dir, ...readJSON(`${dir}/${f}`) });
}
for (const p of [...model.byUrl.values()]) {
  const t = p.kind === 'article' ? p.topic : null;
  const facts = htmlFacts(p.url);
  const text = p.kind === 'article' ? bodyText(p.article) : p.kind === 'page' ? [p.lead, ...(p.sections || []).flatMap((s) => [s.h2, ...(s.body || []).filter((b) => typeof b === 'string')])].map(txt).join(' ') : '';
  rows.push({
    url: p.url,
    id: p.id || '',
    status: 'PUBLISHED',
    kind: p.kind,
    role: roleOf(p),
    parent: p.parent || t?.parent_category || '',
    child: p.child || t?.child_category || '',
    title: p.title,
    h1: p.h1,
    description: p.description,
    primary_keyword: t?.primary_keyword || p.primaryKeyword || '',
    secondary_keywords: (t?.secondary_keywords || []).join(' | '),
    search_intent: t?.search_intent || '',
    words: text ? wordCount(text) : '',
    published: p.published || '',
    modified: p.updated || '',
    canonical: facts.canonical,
    robots: facts.robots,
    in_sitemap: sitemap.has(p.url) ? 'yes' : 'no',
    links_out: p.kind === 'article' ? linksIn(p.article).length : p.kind === 'page' ? linksIn(p.sections || []).length : '',
    contextual_links_in: (inbound.get(p.url) || []).length,
    sources: p.kind === 'article' ? (p.article.sources || []).length : (p.sources || []).length,
    legal_note: p.kind === 'article' ? Boolean(p.article.legal_note) : '',
    revisions: p.kind === 'article' ? (p.article.editorial?.revisions || []).length : '',
    _text: text
  });
}
for (const d of drafts) {
  const t = topicById.get(d.id);
  rows.push({ url: t?.target_url || '', id: d.id, status: d.revision ? 'REVISION_DRAFT' : 'DRAFT', kind: 'draft', role: 'SUPPORT', parent: t?.parent_category, child: t?.child_category, title: d.title, h1: d.h1, description: d.description, primary_keyword: t?.primary_keyword, secondary_keywords: (t?.secondary_keywords || []).join(' | '), search_intent: t?.search_intent, words: wordCount(bodyText(d)), published: '', modified: '', canonical: '', robots: '', in_sitemap: 'no', links_out: linksIn(d).length, contextual_links_in: '', sources: (d.sources || []).length, legal_note: Boolean(d.legal_note), revisions: '', _text: bodyText(d) });
}
const draftIds = new Set(drafts.filter((d) => !d.revision).map((d) => d.id));
for (const t of plan.topics.filter((t) => t.editorial_qa_status !== 'PUBLISHED' && !draftIds.has(t.id))) {
  rows.push({ url: t.target_url, id: t.id, status: t.editorial_qa_status, kind: 'planned', role: 'SUPPORT', parent: t.parent_category, child: t.child_category, title: t.working_title, h1: '', description: '', primary_keyword: t.primary_keyword, secondary_keywords: (t.secondary_keywords || []).join(' | '), search_intent: t.search_intent, words: '', published: '', modified: '', canonical: '', robots: '', in_sitemap: 'no', links_out: '', contextual_links_in: '', sources: '', legal_note: '', revisions: '', _text: '' });
}

// --- collision guard for open topics, and actions
const guard = new Map(runGuard(model, { all: true }).map((r) => [r.id, r]));
const backlog = [];
const actionOf = (r) => {
  if (r.kind === 'planned' || r.kind === 'draft') {
    if (r.status === 'REVISION_DRAFT') return 'UPGRADE';
    const g = guard.get(r.id);
    return !g ? 'REVIEW' : g.decision === 'ALLOW_CREATE' ? 'CREATE' : g.decision === 'UPGRADE_EXISTING' ? 'UPGRADE' : 'REVIEW';
  }
  if (r.kind !== 'article' && r.kind !== 'page') return 'KEEP';
  return null; // decided below
};

// --- cannibalization among published articles and drafts (intent + content overlap)
const shingles = (text) => {
  const w = normalize(text).split(' ').filter(Boolean);
  const s = new Set();
  for (let i = 0; i + 3 <= w.length; i++) s.add(w.slice(i, i + 3).join(' '));
  return s;
};
const content = rows.filter((r) => ['article', 'page', 'draft'].includes(r.kind) && r._text && r.status !== 'REVISION_DRAFT');
for (const r of content) {
  r._fp = intentFingerprint({ primaryKeyword: r.primary_keyword || '', title: r.title || '', h1: r.h1 || '' });
  r._sh = shingles(r._text);
}
const pairs = [];
for (let i = 0; i < content.length; i++) {
  for (let j = i + 1; j < content.length; j++) {
    const a = content[i];
    const b = content[j];
    const intent = jaccard(a._fp, b._fp);
    const overlap = jaccard(a._sh, b._sh);
    const sameKw = a.primary_keyword && normalize(a.primary_keyword) === normalize(b.primary_keyword || '');
    if (intent >= 0.3 || overlap >= 0.08 || sameKw) {
      const level = sameKw || intent >= 0.6 || overlap >= 0.2 ? 'HIGH' : intent >= 0.45 || overlap >= 0.12 ? 'MEDIUM' : 'LOW';
      pairs.push([a.url || a.id, b.url || b.id, a.status, b.status, intent.toFixed(2), overlap.toFixed(3), sameKw ? 'yes' : 'no', level, level === 'LOW' ? 'KEEP (intenções distintas)' : 'REVIEW']);
    }
  }
}
const reviewUrls = new Set(pairs.filter((p) => p[7] !== 'LOW').flatMap((p) => [p[0], p[1]]));

for (const r of rows) {
  let action = actionOf(r);
  if (!action) {
    const reasons = [];
    if (r.kind === 'article' && r.contextual_links_in === 0) reasons.push('sem ligações contextuais de entrada');
    if (r.kind === 'article' && typeof r.words === 'number' && r.words < 1200) reasons.push(`curto (${r.words} palavras)`);
    if (reviewUrls.has(r.url)) action = 'REVIEW';
    else if (reasons.length) {
      action = 'UPGRADE';
      backlog.push([r.url, r.id, 'P2', reasons.join('; '), 'Acrescentar ligações/contexto em revisão']);
    } else action = 'KEEP';
  }
  r.action = action;
}

// --- topical coverage per child category
const coverage = [];
for (const parent of model.parents.values()) {
  for (const c of parent.children) {
    const inChild = rows.filter((r) => r.child === c.id);
    const pub = inChild.filter((r) => r.status === 'PUBLISHED' && r.kind === 'article').length;
    const dr = inChild.filter((r) => r.status === 'DRAFT').length;
    const pl = inChild.filter((r) => r.kind === 'planned').length;
    const target = c.target || plan.topics.filter((t) => t.child_category === c.id).length;
    coverage.push([parent.id, c.id, c.label, target, pub, dr, pl, `${Math.round((100 * pub) / (target || 1))}%`, guardSummary(c.id)]);
  }
}
function guardSummary(childId) {
  const g = plan.topics.filter((t) => t.child_category === childId && t.editorial_qa_status !== 'PUBLISHED').map((t) => guard.get(t.id)?.decision || '—');
  const n = (d) => g.filter((x) => x === d).length;
  return `CREATE ${n('ALLOW_CREATE')} · REVIEW ${n('REVIEW_COLLISION')} · UPGRADE ${n('UPGRADE_EXISTING')} · REJECT ${n('REJECT_DUPLICATE')}`;
}

// --- entity map (knowledge graph edges: entity → URL)
const ENTITIES = {
  'Honda Vision': /\bvision\b/i, 'Honda Air Blade': /air blade/i, 'Honda Click': /\bclick\b/i, 'Honda Wave': /\bwave\b/i, 'Yamaha Sirius': /\bsirius\b/i, 'Yamaha Mio': /\bmio\b/i, 'Mota 50 cc': /50\s?cc|50 cm³/i, 'Mota elétrica': /el[ée]tric/i,
  'Licença Internacional de Condução': /licença internacional|\bLIC\b|\bIDP\b/i, 'Carta A1/A': /\bA1\b|categoria A\b/i, 'Lei 36/2024': /36\/2024/, 'Decreto 168/2024': /168\/2024/, 'Resolução 56/2026 (Hanói)': /56\/2026/, 'Seguro obrigatório': /seguro obrigatório/i, 'Capacete': /capacete/i, 'Caução': /caução/i, 'Combustível': /combustível|gasolina/i, 'Multas por câmara (phạt nguội)': /phạt nguội|multas? por câmara/i, 'Zona de baixas emissões': /baixas emissões/i,
  'Bairro Antigo': /bairro antigo/i, 'Lago Hoàn Kiếm': /hoàn kiếm/i, 'Long Biên': /long biên/i, 'Ponte Long Biên': /ponte long biên/i, 'Lago Oeste (Tây Hồ)': /lago oeste|tây hồ/i, 'Ba Đình': /ba đình/i, 'Aeroporto de Nội Bài': /nội bài/i, 'Metro de Hanói': /\bmetro\b/i, 'Autoestrada (cao tốc)': /autoestrada|cao tốc/i, 'Tết': /\btết\b/i, 'Época das chuvas': /época das chuvas|chuva forte/i
};
const entityRows = [];
for (const [name, re] of Object.entries(ENTITIES)) {
  const urls = rows.filter((r) => r.status === 'PUBLISHED' && r._text && re.test(`${r.title} ${r._text}`)).map((r) => r.url);
  const drafted = rows.filter((r) => r.status === 'DRAFT' && re.test(`${r.title} ${r._text}`)).map((r) => r.id);
  entityRows.push([name, urls.length, drafted.length, urls.slice(0, 40).join(' ')]);
}

// --- internal links matrix
const linkRows = rows.filter((r) => r.status === 'PUBLISHED').map((r) => [r.url, r.role, r.links_out, r.contextual_links_in, (inbound.get(r.url) || []).slice(0, 12).join(' ')]);

// --- write
fs.mkdirSync(rel(OUT), { recursive: true });
const cols = ['url', 'id', 'status', 'kind', 'role', 'action', 'parent', 'child', 'title', 'h1', 'description', 'primary_keyword', 'secondary_keywords', 'search_intent', 'words', 'published', 'modified', 'canonical', 'robots', 'in_sitemap', 'links_out', 'contextual_links_in', 'sources', 'legal_note', 'revisions'];
fs.writeFileSync(rel(`${OUT}/inventory.csv`), csv([cols, ...rows.map((r) => cols.map((c) => r[c]))]));
fs.writeFileSync(rel(`${OUT}/cannibalization.csv`), csv([['url_a', 'url_b', 'status_a', 'status_b', 'intent_jaccard', 'content_overlap', 'same_keyword', 'risk', 'action'], ...pairs.sort((x, y) => y[4] - x[4])]));
fs.writeFileSync(rel(`${OUT}/coverage.csv`), csv([['parent', 'child', 'label', 'planned_target', 'published', 'drafts', 'planned_open', 'published_share', 'guard_open_topics'], ...coverage]));
fs.writeFileSync(rel(`${OUT}/entities.csv`), csv([['entity', 'published_urls', 'drafts', 'urls'], ...entityRows]));
fs.writeFileSync(rel(`${OUT}/internal-links.csv`), csv([['url', 'role', 'links_out', 'contextual_links_in', 'linked_from'], ...linkRows]));
fs.writeFileSync(rel(`${OUT}/upgrade-backlog.csv`), csv([['url', 'id', 'priority', 'evidence', 'action'], ...backlog]));
const count = (f) => rows.filter(f).length;
const summary = {
  generated_at: todayISO(),
  published_urls: count((r) => r.status === 'PUBLISHED'),
  published_articles: count((r) => r.status === 'PUBLISHED' && r.kind === 'article'),
  drafts: count((r) => r.status === 'DRAFT'),
  revision_drafts: count((r) => r.status === 'REVISION_DRAFT'),
  planned_without_draft: count((r) => r.kind === 'planned'),
  roles: Object.fromEntries(['HOMEPAGE', 'PILLAR', 'HUB', 'SILO', 'SUPPORT', 'UTILITY'].map((k) => [k, count((r) => r.status === 'PUBLISHED' && r.role === k)])),
  actions: Object.fromEntries(['KEEP', 'UPGRADE', 'REVIEW', 'CREATE'].map((k) => [k, count((r) => r.action === k)])),
  indexable_not_in_sitemap: rows.filter((r) => r.status === 'PUBLISHED' && /^index/.test(r.robots) && r.in_sitemap === 'no').map((r) => r.url),
  canonical_mismatch: rows.filter((r) => r.status === 'PUBLISHED' && r.canonical && r.canonical !== `https://pt.rentbikehanoi.com${r.url}`).map((r) => r.url),
  articles_without_contextual_inbound: rows.filter((r) => r.kind === 'article' && r.contextual_links_in === 0).map((r) => r.url),
  cannibalization_pairs: { HIGH: pairs.filter((p) => p[7] === 'HIGH').length, MEDIUM: pairs.filter((p) => p[7] === 'MEDIUM').length, LOW: pairs.filter((p) => p[7] === 'LOW').length },
  guard: [...guard.values()].reduce((m, r) => ({ ...m, [r.decision]: (m[r.decision] || 0) + 1 }), {}),
  not_measured: ['HTTP status do site real (ver workflow SEO Monitor)', 'Search Console: cliques, impressões, CTR, posição (não ligado)', 'Core Web Vitals de campo']
};
fs.writeFileSync(rel(`${OUT}/summary.json`), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 1));
