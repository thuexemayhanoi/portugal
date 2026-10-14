#!/usr/bin/env node
// Content Factory 300 — batch processor.
//   node scripts/factory.mjs status
//   node scripts/factory.mjs pause | resume
//   node scripts/factory.mjs refresh-queue
//   node scripts/factory.mjs process [--no-build]     → QA up to batch_size drafts from _factory/inbox
//   node scripts/factory.mjs approve PT-0001 [...]    → publish reviewed drafts (re-runs QA)
//   node scripts/factory.mjs reject PT-0001 "motivo"  → send a reviewed draft back to the writer
//   node scripts/factory.mjs write                    → optional Claude writer (paid API, opt-in)
// Publishing is transactional: if the site build or the site QA fails, the batch is rolled back.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { readJSON, writeJSON, listFiles, rel, todayISO, normalize } from './lib/util.mjs';
import { createValidator } from './qa-factory.mjs';
import { runGuard } from './lib/guard.mjs';
import { intentFingerprint } from './lib/intent.mjs';
import { roomLeft } from './lib/pace.mjs';

const STATE = 'data/factory-state.json';
const QUEUE = 'data/writer-queue.json';
const LOG = 'reports/publication-log.json';
const LAST = 'reports/factory-last-run.json';
const [command = 'status', ...args] = process.argv.slice(2);
const noBuild = args.includes('--no-build');

const run = (script, ...a) => {
  const r = spawnSync(process.execPath, [rel(script), ...a], { stdio: 'inherit' });
  return r.status === 0;
};
const readState = () => readJSON(STATE);
const saveState = (s) => writeJSON(STATE, { ...s, updated_at: todayISO() });
const draftFiles = (dir) => listFiles(dir, '.json').filter((f) => !f.endsWith('.qa.json') && /^PT-\d{4}\.json$/.test(f));

function refreshQueue() {
  run('scripts/plan.mjs', '--write');
  const plan = readJSON('data/editorial-plan.json');
  const config = readJSON('data/factory-config.json');
  const state = readState();
  const busy = new Set([...draftFiles('_factory/inbox'), ...draftFiles('_factory/review')].map((f) => f.slice(0, 7)));
  const { model } = createValidator();
  const live = [...model.byUrl.values()].map((p) => ({ url: p.url, title: p.navLabel || p.h1 }));
  const liveSet = new Set(live.map((l) => l.url));
  // Priority first; inside each priority, alternate between parent categories for topical breadth.
  // Collision guard before writing: only real gaps reach the writers; the rest wait for a person.
  const guard = new Map(runGuard(model, { all: true }).map((r) => [r.id, r]));
  const held = [...guard.values()].filter((r) => r.decision !== 'ALLOW_CREATE');
  const eligible = plan.topics.filter((t) => ['PLANNED', 'QUEUED', 'REWRITE_REQUIRED'].includes(t.editorial_qa_status) && !busy.has(t.id) && guard.get(t.id)?.decision !== 'REVIEW_COLLISION' && !['UPGRADE_EXISTING', 'REJECT_DUPLICATE'].includes(guard.get(t.id)?.decision));
  const ordered = [];
  for (const prio of [1, 2, 3]) {
    const byParent = new Map();
    for (const t of eligible.filter((x) => x.priority === prio).sort((a, b) => a.order - b.order)) {
      if (!byParent.has(t.parent_category)) byParent.set(t.parent_category, []);
      byParent.get(t.parent_category).push(t);
    }
    const lanes = [...byParent.values()];
    while (lanes.some((l) => l.length)) for (const l of lanes) if (l.length) ordered.push(l.shift());
  }
  const items = ordered
    .slice(0, config.queue_size)
    .map((t) => ({
      id: t.id,
      working_title: t.working_title,
      slug: t.slug,
      target_url: t.target_url,
      parent_category: t.parent_category,
      child_category: t.child_category,
      primary_keyword: t.primary_keyword,
      secondary_keywords: t.secondary_keywords,
      search_intent: t.search_intent,
      funnel_stage: t.funnel_stage,
      content_brief: t.content_brief,
      target_words: t.target_words,
      source_requirements: t.source_requirements,
      pillar_url: t.pillar_url,
      required_links: [t.pillar_url, ...t.internal_links_out].filter((u, i, a) => liveSet.has(u) && a.indexOf(u) === i),
      planned_links_not_live_yet: t.internal_links_out.filter((u) => !liveSet.has(u)),
      rewrite_reason: state.rejected_ids.includes(t.id) ? 'Rascunho anterior rejeitado: ver _factory/rejected/' + t.id + '.qa.json' : null
    }));
  writeJSON(QUEUE, {
    $comment: 'Fila gerada por `node scripts/factory.mjs refresh-queue`. Não editar à mão. Os escritores produzem apenas IDs desta fila, segundo factory/WRITER-CONTRACT.md.',
    contract_version: config.contract_version,
    generated_at: todayISO(),
    factory_status: state.status,
    held_by_guard: held.map((r) => ({ id: r.id, decision: r.decision, reasons: r.reasons })),
    live_pages: live,
    items
  });
  run('scripts/plan.mjs', '--write');
  console.log(`Queue refreshed: ${items.length} topics (${items.map((i) => i.id).join(', ')})`);
  return items;
}

function writeQaReport(dir, id, result) {
  writeJSON(`${dir}/${id}.qa.json`, { id, checked_at: todayISO(), errors: result.errors, warnings: result.warnings, stats: result.stats });
}

function move(from, to) {
  fs.mkdirSync(rel(to.split('/').slice(0, -1).join('/')), { recursive: true });
  fs.renameSync(rel(from), rel(to));
}

function removeQa(dir, id) {
  const f = rel(`${dir}/${id}.qa.json`);
  if (fs.existsSync(f)) fs.rmSync(f);
}

// Publishes drafts as one transaction (build + site QA must pass).
// Updates (drafts with "revision") keep the original publication date and add to the revision history.
function publishBatch(entries, mode) {
  const state = readState();
  const backup = { state: fs.readFileSync(rel(STATE), 'utf8'), plan: fs.readFileSync(rel('data/editorial-plan.json'), 'utf8') };
  const today = todayISO();
  const written = [];
  for (const { draft, result, sourceFile } of entries) {
    const file = rel(`content/articles/${draft.id}.json`);
    const previousText = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    const previous = previousText ? JSON.parse(previousText) : null;
    const isUpdate = Boolean(draft.revision && previous);
    const { revision, ...body } = draft;
    const article = {
      ...body,
      status: 'PUBLISHED',
      date_published: isUpdate ? previous.date_published : today,
      date_modified: today,
      editorial: {
        qa_score: result.stats.score,
        qa_warnings: result.warnings,
        words: result.stats.words,
        publish_mode: mode,
        approved_at: today,
        revisions: [...(previous?.editorial?.revisions || []), ...(isUpdate ? [{ date: today, reason: revision.reason }] : [])]
      }
    };
    writeJSON(`content/articles/${draft.id}.json`, article);
    written.push({ id: draft.id, sourceFile, previousText, isUpdate });
    state.published_ids = [...new Set([...state.published_ids, draft.id])].sort();
    state.review_ids = state.review_ids.filter((x) => x !== draft.id);
    state.rejected_ids = state.rejected_ids.filter((x) => x !== draft.id);
  }
  saveState(state);
  const ok = noBuild || (run('scripts/plan.mjs', '--write') && run('scripts/build.mjs') && run('scripts/qa-site.mjs'));
  if (!ok) {
    console.error('Site build/QA failed after publishing — rolling back this batch.');
    fs.writeFileSync(rel(STATE), backup.state);
    fs.writeFileSync(rel('data/editorial-plan.json'), backup.plan);
    for (const w of written) {
      if (w.previousText) fs.writeFileSync(rel(`content/articles/${w.id}.json`), w.previousText);
      else fs.rmSync(rel(`content/articles/${w.id}.json`));
    }
    run('scripts/build.mjs');
    return { published: [], failed: written.map((w) => w.id) };
  }
  for (const w of written) {
    if (w.sourceFile && fs.existsSync(rel(w.sourceFile))) fs.rmSync(rel(w.sourceFile));
    removeQa('_factory/review', w.id);
    removeQa('_factory/inbox', w.id);
  }
  const log = fs.existsSync(rel(LOG)) ? readJSON(LOG) : { entries: [] };
  const planTopics = readJSON('data/editorial-plan.json').topics;
  for (const { draft, result } of entries) {
    const w = written.find((x) => x.id === draft.id);
    log.entries.push({ id: draft.id, url: planTopics.find((t) => t.id === draft.id).target_url, title: draft.title, words: result.stats.words, qa_score: result.stats.score, writer: draft.writer?.type, mode, type: w.isUpdate ? 'update' : 'new', ...(w.isUpdate ? { reason: draft.revision.reason } : {}), date: today });
  }
  writeJSON(LOG, log);
  return { published: written.map((w) => w.id), failed: [] };
}

// Publishing pace: at most publishing.max_new_per_7_days new articles in any 7-day window (updates excluded).
function publishingRoom(config) {
  const log = fs.existsSync(rel(LOG)) ? readJSON(LOG) : { entries: [] };
  return roomLeft(log.entries, config.publishing?.max_new_per_7_days, todayISO());
}

// Intent fingerprints of the other drafts handled in the same run (duplicate intent inside a batch).
function peersOf(drafts, topics) {
  return drafts
    .filter((d) => d && topics.has(d.id))
    .map((d) => ({ id: d.id, intent: intentFingerprint({ primaryKeyword: topics.get(d.id).primary_keyword, title: String(d.title || ''), h1: String(d.h1 || '') }), keyword: normalize(topics.get(d.id).primary_keyword) }));
}

// Returns idle: true when nothing was done, so callers write no files (scheduled runs then never commit).
function processInbox() {
  const state = readState();
  const config = readJSON('data/factory-config.json');
  if (state.status !== 'ACTIVE') {
    console.log(`Factory is ${state.status}: nothing processed. Run "node scripts/factory.mjs resume" to activate.`);
    return { processed: [], idle: true };
  }
  const inbox = draftFiles('_factory/inbox');
  if (!inbox.length) {
    console.log('Inbox empty: nothing to process.');
    return { processed: [], idle: true };
  }
  // With the whole plan published, the factory still handles revisions of live articles;
  // a new draft can only target a published topic, which the QA refuses without "revision".
  if (state.published_ids.length >= config.target_articles) console.log('TARGET_REACHED: every planned topic is published; only revisions can be processed.');
  const { validateArticle, topics } = createValidator();
  const files = inbox
    .map((f) => ({ f, t: topics.get(f.slice(0, 7)) }))
    .sort((a, b) => (a.t?.priority ?? 9) - (b.t?.priority ?? 9) || (a.t?.order ?? 9999) - (b.t?.order ?? 9999))
    .slice(0, config.batch_size);
  const batchUrls = new Set(files.map((x) => x.t?.target_url).filter(Boolean));
  const processed = [];
  const toPublish = [];
  const drafts = new Map();
  for (const { f } of files) {
    try {
      drafts.set(f, readJSON(`_factory/inbox/${f}`));
    } catch (e) {
      drafts.set(f, null);
    }
  }
  const peers = peersOf([...drafts.values()], topics);
  let room = publishingRoom(config);
  for (const { f } of files) {
    const id = f.slice(0, 7);
    const sourceFile = `_factory/inbox/${f}`;
    const draft = drafts.get(f);
    const result = draft ? validateArticle(draft, { file: sourceFile, batchUrls, peers }) : { errors: ['invalid JSON'], warnings: [], stats: {} };
    if (draft && draft.id !== id) result.errors.unshift(`file name ${f} does not match id ${draft.id}`);
    if (result.errors.length) {
      move(sourceFile, `_factory/rejected/${f}`);
      writeQaReport('_factory/rejected', id, result);
      state.rejected_ids = [...new Set([...state.rejected_ids, id])].sort();
      processed.push({ id, result: 'REJECTED', errors: result.errors, warnings: result.warnings });
      continue;
    }
    const fitsPace = draft.revision || room > 0;
    if (config.publish_mode === 'auto' && result.warnings.length <= config.auto_publish_max_warnings && fitsPace) {
      if (!draft.revision) room--;
      toPublish.push({ draft, result, sourceFile });
      processed.push({ id, result: 'PUBLISH', warnings: result.warnings });
    } else {
      move(sourceFile, `_factory/review/${f}`);
      writeQaReport('_factory/review', id, result);
      state.review_ids = [...new Set([...state.review_ids, id])].sort();
      processed.push({ id, result: 'IN_REVIEW', warnings: result.warnings });
    }
  }
  saveState(state);
  let outcome = { published: [], failed: [] };
  if (toPublish.length) outcome = publishBatch(toPublish, 'auto');
  for (const p of processed) if (outcome.failed.includes(p.id)) p.result = 'ROLLED_BACK';
  return { processed, ...outcome };
}

function approve(ids) {
  const { validateArticle, topics } = createValidator();
  const config = readJSON('data/factory-config.json');
  const entries = [];
  const report = [];
  const batchUrls = new Set(ids.map((id) => topics.get(id)?.target_url).filter(Boolean));
  const drafts = ids.map((id) => (fs.existsSync(rel(`_factory/review/${id}.json`)) ? readJSON(`_factory/review/${id}.json`) : null));
  const peers = peersOf(drafts, topics);
  let room = publishingRoom(config);
  ids.forEach((id, i) => {
    const sourceFile = `_factory/review/${id}.json`;
    const draft = drafts[i];
    if (!draft) return report.push({ id, result: 'NOT_IN_REVIEW' });
    const result = validateArticle(draft, { file: sourceFile, batchUrls, peers });
    if (result.errors.length) return report.push({ id, result: 'QA_FAILED', errors: result.errors });
    if (!draft.revision && room <= 0) {
      return report.push({ id, result: 'PACE_LIMIT', errors: [`publishing.max_new_per_7_days = ${config.publishing.max_new_per_7_days} reached: approve again in a few days or raise the limit in data/factory-config.json`] });
    }
    if (!draft.revision) room--;
    entries.push({ draft, result, sourceFile });
    report.push({ id, result: draft.revision ? 'UPDATE' : 'PUBLISH', warnings: result.warnings });
  });
  const outcome = entries.length ? publishBatch(entries, 'review') : { published: [], failed: [] };
  return { processed: report, ...outcome };
}

function reject(id, reason) {
  const from = `_factory/review/${id}.json`;
  if (!fs.existsSync(rel(from))) throw new Error(`${id} is not in _factory/review`);
  move(from, `_factory/rejected/${id}.json`);
  const qaFile = `_factory/review/${id}.qa.json`;
  const qa = fs.existsSync(rel(qaFile)) ? readJSON(qaFile) : { id, errors: [], warnings: [] };
  removeQa('_factory/review', id);
  writeJSON(`_factory/rejected/${id}.qa.json`, { ...qa, errors: [`Revisão editorial: ${reason}`, ...qa.errors], checked_at: todayISO() });
  const state = readState();
  state.review_ids = state.review_ids.filter((x) => x !== id);
  state.rejected_ids = [...new Set([...state.rejected_ids, id])].sort();
  saveState(state);
  return { processed: [{ id, result: 'REJECTED_BY_EDITOR', reason }] };
}

function status() {
  const state = readState();
  const config = readJSON('data/factory-config.json');
  const plan = readJSON('data/editorial-plan.json');
  const queue = fs.existsSync(rel(QUEUE)) ? readJSON(QUEUE) : { items: [] };
  console.log(`Factory: ${state.status} · publish_mode=${config.publish_mode} · writer=${config.writer.mode}`);
  console.log(`Published ${state.published_ids.length}/${config.target_articles} · in review ${state.review_ids.length} · rejected ${state.rejected_ids.length}`);
  console.log(`Plan: ${JSON.stringify(plan.summary?.by_status || {})}`);
  console.log(`Inbox: ${draftFiles('_factory/inbox').join(', ') || '(empty)'} · Review: ${draftFiles('_factory/review').join(', ') || '(empty)'}`);
  console.log(`Queue (${queue.items.length}): ${queue.items.map((i) => i.id).join(', ')}`);
}

function lastRun(cmd, result) {
  const state = readState();
  writeJSON(LAST, { command: cmd, run_on: todayISO(), status: state.status, published_total: state.published_ids.length, in_review: state.review_ids, ...result });
}

try {
  switch (command) {
    case 'status':
      status();
      break;
    case 'pause':
    case 'resume': {
      const s = readState();
      s.status = command === 'pause' ? 'PAUSED' : 'ACTIVE';
      saveState(s);
      refreshQueue();
      console.log(`Factory ${s.status}`);
      break;
    }
    case 'refresh-queue':
      refreshQueue();
      break;
    case 'process': {
      const r = processInbox();
      if (r.idle) break;
      refreshQueue();
      lastRun('process', r);
      for (const p of r.processed) console.log(`${p.id}: ${p.result}${p.errors ? ` — ${p.errors.length} errors` : ''}${p.warnings?.length ? ` — ${p.warnings.length} warnings` : ''}`);
      if (r.failed?.length) process.exitCode = 1;
      break;
    }
    case 'approve': {
      const ids = args.filter((a) => /^PT-\d{4}$/.test(a));
      if (!ids.length) throw new Error('Usage: node scripts/factory.mjs approve PT-0001 [PT-0002 ...]');
      const r = approve(ids);
      refreshQueue();
      lastRun('approve', r);
      for (const p of r.processed) console.log(`${p.id}: ${p.result}${p.errors ? `\n  ${p.errors.join('\n  ')}` : ''}`);
      if (r.failed?.length || r.processed.some((p) => !['PUBLISH', 'UPDATE'].includes(p.result))) process.exitCode = 1;
      break;
    }
    case 'reject': {
      const [id, ...reason] = args;
      const r = reject(id, reason.join(' ') || 'sem motivo indicado');
      refreshQueue();
      lastRun('reject', r);
      console.log(`${id}: rejected`);
      break;
    }
    case 'write': {
      const ok = run('scripts/writer-claude.mjs', ...args);
      if (!ok) process.exitCode = 1;
      break;
    }
    default:
      throw new Error(`Unknown command "${command}"`);
  }
} catch (err) {
  console.error(`FACTORY ERROR: ${err.message}`);
  process.exit(1);
}
