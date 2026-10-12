#!/usr/bin/env node
// Measurement step of the SEO Monitor: Google Search Console (Search Analytics + URL Inspection) and,
// optionally, Bing Webmaster Tools, grouped by taxonomy and planned topics, with a maintenance queue
// (low CTR, almost on page 1, declining pages, cannibalization, not indexed) and demand for planned topics.
// Runs only when the owner has connected the accounts (docs/OWNER-ACTIONS.md):
//   GSC_SERVICE_ACCOUNT_JSON  secret   JSON key of a service account added as a user of the Search Console property
//   GSC_SITE_URL              variable property: "https://pt.rentbikehanoi.com/" (default) or "sc-domain:rentbikehanoi.com"
//   BING_WEBMASTER_API_KEY    secret   API key from Bing Webmaster Tools → Settings → API access
//   node scripts/seo-data.mjs [--days 28] [--inspect] [--report FILE] [--summary FILE] [--fixture FILE]
// Without credentials it explains how to connect them and exits 0: nothing is estimated or invented.
import fs from 'node:fs';
import { readJSON, writeJSON, rel, listFiles } from './lib/util.mjs';
import { analyse, signJwt, bingRows } from './lib/seo-data.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback = null) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};
const days = Number(opt('--days', 28));
const data = readJSON('site/data.json');
const base = data.site.baseUrl.replace(/\/$/, '');
const plan = readJSON('data/editorial-plan.json');
const taxonomy = readJSON('site/taxonomy.json');
const sitemapUrls = [...fs.readFileSync(rel('sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const basePages = listFiles('content/pages', '.json').map((f) => readJSON(`content/pages/${f}`));
const iso = (d) => d.toISOString().slice(0, 10);
const summaryFile = opt('--summary');
const say = (md) => (summaryFile ? fs.appendFileSync(summaryFile, `${md}\n`) : console.log(md));

async function json(url, init, label) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(60000) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status} ${text.slice(0, 300).replace(/[A-Za-z0-9_-]{30,}/g, '…')}`);
  return JSON.parse(text);
}

async function googleData() {
  const sa = JSON.parse(process.env.GSC_SERVICE_ACCOUNT_JSON);
  const site = process.env.GSC_SITE_URL || `${base}/`;
  const tokenRes = await json('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: signJwt(sa, 'https://www.googleapis.com/auth/webmasters.readonly') }) }, 'Google token');
  const auth = { authorization: `Bearer ${tokenRes.access_token}`, 'content-type': 'application/json' };
  // Search Console data is final after ~3 days.
  const end = new Date(Date.now() - 3 * 86400000);
  const start = new Date(end.getTime() - (days - 1) * 86400000);
  const prevEnd = new Date(start.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * 86400000);
  const query = async (from, to) => {
    const out = [];
    for (let startRow = 0; ; startRow += 25000) {
      const r = await json(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, { method: 'POST', headers: auth, body: JSON.stringify({ startDate: iso(from), endDate: iso(to), dimensions: ['query', 'page'], type: 'web', rowLimit: 25000, startRow }) }, 'Search Analytics');
      const rows = (r.rows || []).map((x) => ({ query: x.keys[0], page: x.keys[1], clicks: x.clicks, impressions: x.impressions, ctr: x.ctr, position: x.position }));
      out.push(...rows);
      if (rows.length < 25000) return out;
    }
  };
  const result = { site, period: { start: iso(start), end: iso(end), prevStart: iso(prevStart), prevEnd: iso(prevEnd) }, rows: await query(start, end), prevRows: await query(prevStart, prevEnd), inspections: [] };
  if (args.includes('--inspect')) {
    for (const url of sitemapUrls.slice(0, 1800)) {
      try {
        const r = await json('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', { method: 'POST', headers: auth, body: JSON.stringify({ inspectionUrl: url, siteUrl: site, languageCode: 'pt-PT' }) }, 'URL Inspection');
        result.inspections.push({ url, indexStatusResult: r.inspectionResult?.indexStatusResult || {} });
      } catch (e) {
        result.inspections.push({ url, error: e.message });
      }
      await new Promise((ok) => setTimeout(ok, 150));
    }
  }
  return result;
}

async function bingData() {
  const key = process.env.BING_WEBMASTER_API_KEY;
  const site = encodeURIComponent(`${base}/`);
  const call = (method) => json(`https://ssl.bing.com/webmaster/api.svc/json/${method}?siteUrl=${site}&apikey=${encodeURIComponent(key)}`, {}, `Bing ${method}`);
  const [q, p] = await Promise.all([call('GetQueryStats'), call('GetPageStats')]);
  const queries = bingRows(q.d, days);
  const pages = bingRows(p.d, days);
  const sum = (list, k) => list.reduce((a, r) => a + r[k], 0);
  const top = (list) => Object.values(list.reduce((acc, r) => {
    acc[r.key] ||= { key: r.key, clicks: 0, impressions: 0 };
    acc[r.key].clicks += r.clicks;
    acc[r.key].impressions += r.impressions;
    return acc;
  }, {})).sort((a, b) => b.impressions - a.impressions).slice(0, 15);
  return { clicks: sum(queries, 'clicks'), impressions: sum(queries, 'impressions'), top_queries: top(queries), top_pages: top(pages) };
}

const hasGoogle = Boolean(process.env.GSC_SERVICE_ACCOUNT_JSON);
const hasBing = Boolean(process.env.BING_WEBMASTER_API_KEY);
const fixture = opt('--fixture');
if (!fixture && !hasGoogle && !hasBing) {
  say(['## Search Console / Bing', '', 'Chưa kết nối. Để có số liệu thật theo nhóm từ khóa, chủ site thêm secret `GSC_SERVICE_ACCOUNT_JSON` (và tùy chọn `BING_WEBMASTER_API_KEY`) — xem `docs/OWNER-ACTIONS.md`. Không có số liệu nào được ước tính.', ''].join('\n'));
  process.exit(0);
}

const report = { generated_at: new Date().toISOString(), days, google: null, bing: null, problems: [] };
try {
  const g = fixture ? readJSON(fixture) : hasGoogle ? await googleData() : null;
  if (g) report.google = { site: g.site, period: g.period, ...analyse({ rows: g.rows, prevRows: g.prevRows, inspections: g.inspections, plan, taxonomy, base, sitemapUrls, basePages }) };
} catch (e) {
  report.problems.push(`Search Console: ${e.message}`);
}
try {
  if (!fixture && hasBing) report.bing = await bingData();
} catch (e) {
  report.problems.push(`Bing: ${e.message}`);
}
if (opt('--report')) writeJSON(opt('--report'), report);

const pct = (x) => `${(x * 100).toFixed(1)}%`;
const delta = (a, b) => (b ? ` (${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)}%)` : '');
const md = ['## Search Console / Bing', ''];
if (report.google) {
  const g = report.google;
  md.push(`**Google** (${g.site}, ${g.period?.start} → ${g.period?.end}): ${g.totals.clicks} cliques${delta(g.totals.clicks, g.prevTotals.clicks)} · ${g.totals.impressions} impressões${delta(g.totals.impressions, g.prevTotals.impressions)} · CTR ${pct(g.totals.ctr)} · posição média ${g.totals.position ?? '—'}`, '');
  md.push('| Nhóm | Trang | Clicks | Impr. | CTR | Vị trí |', '|---|---|---|---|---|---|', ...g.groups.map((x) => `| ${x.label} | ${x.pages} | ${x.clicks}${delta(x.clicks, x.prev_clicks)} | ${x.impressions} | ${pct(x.ctr)} | ${x.position ?? '—'} |`), '');
  if (g.maintenance.length) md.push('### Hàng đợi bảo trì nội dung', ...g.maintenance.slice(0, 25).map((m) => `- **${m.type}** ${m.id ? `${m.id} ` : ''}${m.url.replace(base, '')} — ${m.detail}`), '');
  if (g.opportunities.length) md.push('### Nhu cầu cho chủ đề chưa viết', ...g.opportunities.slice(0, 10).map((o) => `- «${o.query}» (${o.impressions} impr., vị trí ${o.position}) → ${o.topic} ${o.title} [${o.status}]`), '');
}
if (report.bing) md.push(`**Bing** (${days} ngày): ${report.bing.clicks} cliques · ${report.bing.impressions} impressões`, ...report.bing.top_queries.slice(0, 10).map((q) => `- «${q.key}»: ${q.impressions} impr., ${q.clicks} clicks`), '');
for (const p of report.problems) md.push(`- ⚠️ ${p}`);
say(md.join('\n'));
