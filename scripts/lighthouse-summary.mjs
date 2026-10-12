#!/usr/bin/env node
// Summarises Lighthouse JSON reports (mobile lab run in the SEO Monitor workflow) as Markdown.
//   node scripts/lighthouse-summary.mjs reports/lighthouse-*.json [--report reports/lighthouse.json]
// Lab numbers vary between runs and are not field data (CrUX): they never fail the workflow,
// they only warn when a page drops below the budget.
import fs from 'node:fs';
import { writeJSON } from './lib/util.mjs';

const BUDGET = { performance: 90, accessibility: 95, 'best-practices': 95, seo: 95, lcp: 2500, cls: 0.1, tbt: 200 };
const args = process.argv.slice(2);
const reportAt = args.indexOf('--report');
const files = args.filter((a, i) => !a.startsWith('--') && i !== reportAt + 1);
const rows = [];
const warnings = [];
for (const file of files) {
  let lh;
  try {
    lh = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    warnings.push(`${file}: unreadable (${e.message})`);
    continue;
  }
  if (lh.runtimeError?.code) {
    warnings.push(`${lh.requestedUrl || file}: Lighthouse error ${lh.runtimeError.code}`);
    continue;
  }
  const score = (k) => Math.round((lh.categories?.[k]?.score ?? 0) * 100);
  const metric = (k) => lh.audits?.[k]?.numericValue;
  const row = {
    url: lh.finalDisplayedUrl || lh.finalUrl || lh.requestedUrl,
    performance: score('performance'),
    accessibility: score('accessibility'),
    'best-practices': score('best-practices'),
    seo: score('seo'),
    lcp: Math.round(metric('largest-contentful-paint') ?? 0),
    cls: Number((metric('cumulative-layout-shift') ?? 0).toFixed(3)),
    tbt: Math.round(metric('total-blocking-time') ?? 0),
    fcp: Math.round(metric('first-contentful-paint') ?? 0),
    version: lh.lighthouseVersion
  };
  rows.push(row);
  for (const k of ['performance', 'accessibility', 'best-practices', 'seo']) if (row[k] < BUDGET[k]) warnings.push(`${row.url}: ${k} ${row[k]} < ${BUDGET[k]}`);
  if (row.lcp > BUDGET.lcp) warnings.push(`${row.url}: LCP ${row.lcp} ms > ${BUDGET.lcp} ms`);
  if (row.cls > BUDGET.cls) warnings.push(`${row.url}: CLS ${row.cls} > ${BUDGET.cls}`);
  if (row.tbt > BUDGET.tbt) warnings.push(`${row.url}: TBT ${row.tbt} ms > ${BUDGET.tbt} ms`);
}
if (reportAt >= 0) writeJSON(args[reportAt + 1], { budget: BUDGET, rows, warnings });
console.log(
  [
    '## Lighthouse (mobile, đo lab — không phải dữ liệu người dùng thật)',
    '',
    '| URL | Perf | A11y | BP | SEO | LCP ms | CLS | TBT ms |',
    '|---|---|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.url} | ${r.performance} | ${r.accessibility} | ${r['best-practices']} | ${r.seo} | ${r.lcp} | ${r.cls} | ${r.tbt} |`),
    '',
    ...(warnings.length ? ['Dưới ngân sách:', ...warnings.map((w) => `- ${w}`)] : ['Tất cả trang đạt ngân sách.']),
    ''
  ].join('\n')
);
