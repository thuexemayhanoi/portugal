#!/usr/bin/env node
// AI Content Collision Guard (see scripts/lib/guard.mjs) for the editorial plan.
//   node scripts/guard.mjs                 → every open topic without a draft
//   node scripts/guard.mjs PT-0001 PT-0002 → only these topics
//   node scripts/guard.mjs --all           → every open topic, drafts included
// Writes reports/collision-guard.json and prints one line per topic that is not ALLOW_CREATE.
import { writeJSON, todayISO } from './lib/util.mjs';
import { loadModel } from './lib/model.mjs';
import { runGuard, GUARD_THRESHOLDS } from './lib/guard.mjs';

const args = process.argv.slice(2);
const results = runGuard(loadModel(), { ids: args.filter((a) => /^PT-\d{4}$/.test(a)), all: args.includes('--all') });
const counts = results.reduce((m, r) => ({ ...m, [r.decision]: (m[r.decision] || 0) + 1 }), {});
// Single-topic checks (writers) print only; the full run refreshes the report.
const ids = args.filter((a) => /^PT-\d{4}$/.test(a));
if (!ids.length) writeJSON('reports/collision-guard.json', {
  $comment: 'Gerado por `node scripts/guard.mjs`. ALLOW_CREATE: lacuna real; UPGRADE_EXISTING: melhorar o URL existente; REVIEW_COLLISION: decisão humana (guard_reviewed: true no plano depois de rever); REJECT_DUPLICATE: não criar.',
  generated_at: todayISO(),
  thresholds: GUARD_THRESHOLDS,
  counts,
  results
});
for (const r of results.filter((r) => r.decision !== 'ALLOW_CREATE')) console.log(`${r.id} ${r.decision}: ${r.reasons.join('; ')} — ${r.working_title}`);
console.log(`Collision guard: ${results.length} topics ${JSON.stringify(counts)}${ids.length ? '' : ' → reports/collision-guard.json'}`);
