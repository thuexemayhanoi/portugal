// Search performance analysis (Google Search Console, Bing Webmaster Tools) grouped by the site's
// taxonomy and the 300-topic plan. Pure functions: network access lives in scripts/seo-data.mjs.
import crypto from 'node:crypto';
import { intentTokens, jaccard } from './intent.mjs';

// ---- Google service-account access token (JWT bearer, RS256) without dependencies.
export function signJwt({ client_email, private_key }, scope, now = Math.floor(Date.now() / 1000)) {
  const b64 = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: client_email, scope, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const key = String(private_key).replace(/\\n/g, '\n');
  return `${unsigned}.${crypto.createSign('RSA-SHA256').update(unsigned).sign(key).toString('base64url')}`;
}

// ---- grouping
const round = (n, d = 2) => Number(n.toFixed(d));
const add = (acc, r) => {
  acc.clicks += r.clicks;
  acc.impressions += r.impressions;
  acc.posSum += r.position * r.impressions;
  return acc;
};
const finish = (acc) => ({
  clicks: acc.clicks,
  impressions: acc.impressions,
  ctr: acc.impressions ? round(acc.clicks / acc.impressions, 4) : 0,
  position: acc.impressions ? round(acc.posSum / acc.impressions, 1) : null
});
const empty = () => ({ clicks: 0, impressions: 0, posSum: 0 });

// Expected CTR by position (conservative curve for a small site); below half of it = title/description to rewrite.
const expectedCtr = (pos) => (pos <= 1.5 ? 0.25 : pos <= 2.5 ? 0.15 : pos <= 3.5 ? 0.1 : pos <= 5.5 ? 0.06 : pos <= 10.5 ? 0.025 : 0.01);

// Maps a URL to { group, label, id } using the plan (articles) and the taxonomy (hubs, archives, base pages).
export function urlMapper({ plan, taxonomy, base }) {
  const byUrl = new Map();
  for (const p of taxonomy.parents) {
    byUrl.set(p.url, { group: p.id, label: p.label });
    for (const c of p.children) byUrl.set(c.archiveUrl, { group: `${p.id}/${c.id}`, label: `${p.label} › ${c.label}` });
  }
  const childLabel = new Map(taxonomy.parents.flatMap((p) => p.children.map((c) => [c.id, `${p.label} › ${c.label}`])));
  const topicByUrl = new Map(plan.topics.map((t) => [t.target_url, t]));
  return (url) => {
    const path = url.startsWith(base) ? url.slice(base.length) || '/' : url;
    const topic = topicByUrl.get(path);
    if (topic) return { path, id: topic.id, group: `${topic.parent_category}/${topic.child_category}`, label: childLabel.get(topic.child_category) || topic.child_category };
    if (byUrl.has(path)) return { path, ...byUrl.get(path) };
    return { path, group: 'loja', label: 'Páginas da loja (início, sobre, contactos, FAQ, legais)' };
  };
}

// rows: [{ query, page, clicks, impressions, ctr, position }] for the current and the previous period.
export function analyse({ rows = [], prevRows = [], plan, taxonomy, base, inspections = [], sitemapUrls = [], basePages = [] }) {
  const map = urlMapper({ plan, taxonomy, base });
  const own = (r) => r.page && r.page.startsWith(`${base}/`);
  const cur = rows.filter(own);
  const prev = prevRows.filter(own);

  const totals = finish(cur.reduce(add, empty()));
  const prevTotals = finish(prev.reduce(add, empty()));

  const pages = new Map();
  for (const r of cur) {
    const m = map(r.page);
    if (!pages.has(r.page)) pages.set(r.page, { url: r.page, ...m, acc: empty(), prev: empty(), queries: [] });
    const p = pages.get(r.page);
    add(p.acc, r);
    p.queries.push(r);
  }
  for (const r of prev) {
    if (!pages.has(r.page)) pages.set(r.page, { url: r.page, ...map(r.page), acc: empty(), prev: empty(), queries: [] });
    add(pages.get(r.page).prev, r);
  }

  const groups = new Map();
  for (const p of pages.values()) {
    if (!groups.has(p.group)) groups.set(p.group, { group: p.group, label: p.label, acc: empty(), prev: empty(), pages: 0 });
    const g = groups.get(p.group);
    g.acc.clicks += p.acc.clicks;
    g.acc.impressions += p.acc.impressions;
    g.acc.posSum += p.acc.posSum;
    g.prev.clicks += p.prev.clicks;
    g.prev.impressions += p.prev.impressions;
    g.prev.posSum += p.prev.posSum;
    g.pages++;
  }

  const maintenance = [];
  const push = (type, page, detail, priority) => maintenance.push({ type, url: page.url, id: page.id || null, detail, priority });
  for (const p of pages.values()) {
    const now = finish(p.acc);
    const before = finish(p.prev);
    if (now.impressions >= 200 && now.position && now.ctr < expectedCtr(now.position) / 2) {
      push('LOW_CTR', p, `CTR ${(now.ctr * 100).toFixed(1)}% na posição ${now.position} (${now.impressions} impressões): reescrever título e meta description`, 1);
    }
    if (before.clicks >= 20 && now.clicks < before.clicks * 0.7) push('DECLINING', p, `cliques ${before.clicks} → ${now.clicks} face ao período anterior`, 1);
    const striking = p.queries.filter((q) => q.position >= 4 && q.position <= 15 && q.impressions >= 50).sort((a, b) => b.impressions - a.impressions);
    if (striking.length) {
      push('STRIKING_DISTANCE', p, `quase na 1.ª página: ${striking.slice(0, 3).map((q) => `«${q.query}» (pos. ${round(q.position, 1)}, ${q.impressions} impr.)`).join('; ')} — aprofundar o conteúdo e as ligações internas`, 2);
    }
  }

  // Cannibalization: one query, two or more of our URLs with a real share of the impressions.
  const byQuery = new Map();
  for (const r of cur) {
    if (!byQuery.has(r.query)) byQuery.set(r.query, []);
    byQuery.get(r.query).push(r);
  }
  const cannibalization = [];
  for (const [query, list] of byQuery) {
    const total = list.reduce((a, r) => a + r.impressions, 0);
    const competing = list.filter((r) => r.impressions / total >= 0.2);
    if (total >= 50 && competing.length >= 2) {
      cannibalization.push({ query, impressions: total, pages: competing.map((r) => ({ url: r.page, impressions: r.impressions, position: round(r.position, 1) })) });
      maintenance.push({ type: 'CANNIBALIZATION', url: competing[0].page, id: map(competing[0].page).id || null, detail: `«${query}»: ${competing.map((r) => map(r.page).path).join(' + ')} — fundir ou diferenciar a intenção`, priority: 1 });
    }
  }

  for (const i of inspections) {
    const s = i.indexStatusResult || {};
    const page = { url: i.url, id: map(i.url).id };
    if (s.verdict && s.verdict !== 'PASS') push('NOT_INDEXED', page, `${s.coverageState || s.verdict}${s.lastCrawlTime ? ` (último rastreio ${s.lastCrawlTime.slice(0, 10)})` : ''}`, 1);
    if (s.googleCanonical && s.userCanonical && s.googleCanonical !== s.userCanonical) push('CANONICAL_MISMATCH', page, `a Google escolheu ${s.googleCanonical} em vez de ${s.userCanonical}`, 1);
  }
  // Pages written to rank (articles, hubs, archives) that got no impressions while the site has data.
  if (totals.impressions >= 100) {
    for (const url of sitemapUrls) {
      const m = map(url);
      if (!pages.has(url) && m.group !== 'loja') push('NO_IMPRESSIONS', { url, id: m.id }, 'sem impressões no período: confirmar indexação e intenção', 3);
    }
  }

  // Demand for planned topics: queries with impressions whose best match is a topic not yet published
  // (when a live page or a published article matches as well or better, the query is already covered).
  const candidates = [
    ...plan.topics.map((t) => ({ live: t.editorial_qa_status === 'PUBLISHED', t, tokens: intentTokens(t.primary_keyword) })),
    ...basePages.filter((p) => p.primaryKeyword).map((p) => ({ live: true, tokens: intentTokens(p.primaryKeyword) }))
  ];
  const opportunities = [];
  for (const [query, list] of byQuery) {
    const impressions = list.reduce((a, r) => a + r.impressions, 0);
    if (impressions < 20) continue;
    const qt = intentTokens(query);
    let best = { score: 0 };
    for (const c of candidates) {
      const score = jaccard(qt, c.tokens);
      if (score > best.score || (score === best.score && c.live)) best = { score, ...c };
    }
    if (best.score >= 0.5 && !best.live) opportunities.push({ query, impressions, position: round(list.reduce((a, r) => a + r.position * r.impressions, 0) / impressions, 1), topic: best.t.id, title: best.t.working_title, status: best.t.editorial_qa_status });
  }

  const pageRows = [...pages.values()].map((p) => ({ url: p.url, id: p.id || null, group: p.group, ...finish(p.acc), prev_clicks: p.prev.clicks, top_queries: p.queries.sort((a, b) => b.impressions - a.impressions).slice(0, 5).map((q) => ({ query: q.query, clicks: q.clicks, impressions: q.impressions, position: round(q.position, 1) })) }));
  return {
    totals,
    prevTotals,
    groups: [...groups.values()].map((g) => ({ group: g.group, label: g.label, pages: g.pages, ...finish(g.acc), prev_clicks: g.prev.clicks, prev_impressions: g.prev.impressions })).sort((a, b) => b.impressions - a.impressions),
    pages: pageRows.sort((a, b) => b.impressions - a.impressions),
    cannibalization,
    maintenance: maintenance.sort((a, b) => a.priority - b.priority),
    opportunities: opportunities.sort((a, b) => b.impressions - a.impressions)
  };
}

// Bing Webmaster API rows → { query|page, clicks, impressions, position } within the last `days` days.
export function bingRows(rows, days, now = Date.now()) {
  const since = now - days * 86400000;
  return (rows || [])
    .map((r) => ({ key: r.Query || r.Page || r.Url || '', clicks: Number(r.Clicks || 0), impressions: Number(r.Impressions || 0), position: Number(r.AvgImpressionPosition || r.AvgClickPosition || 0), date: Number((/\/Date\((-?\d+)/.exec(r.Date || '') || [])[1] || 0) }))
    .filter((r) => r.key && (!r.date || r.date >= since));
}
