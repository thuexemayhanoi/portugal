// Invariants of the 300-topic plan, of the article validator and of the factory runner.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readJSON, ROOT } from '../lib/util.mjs';
import { recompute } from '../plan.mjs';
import { createValidator } from '../qa-factory.mjs';

test('editorial plan: 300 topics, sequential IDs, taxonomy targets and unique URLs', () => {
  const { next, errors } = recompute();
  assert.deepEqual(errors, []);
  assert.equal(next.topics.length, 300);
  next.topics.forEach((t, i) => assert.equal(t.id, `PT-${String(i + 1).padStart(4, '0')}`));
  const taxonomy = readJSON('site/taxonomy.json');
  for (const p of taxonomy.parents) {
    for (const c of p.children) assert.equal(next.topics.filter((t) => t.child_category === c.id).length, c.target, c.id);
  }
  assert.equal(new Set(next.topics.map((t) => t.target_url)).size, 300);
  for (const t of next.topics) {
    assert.ok(t.target_url.startsWith(taxonomy.parents.find((p) => p.id === t.parent_category).url));
    assert.equal(t.metrics.search_volume, null, 'no invented search volumes');
    if (t.hold_reason) assert.equal(t.editorial_qa_status, 'HOLD_FOR_INTENT_REVIEW');
  }
});

test('validator rejects an incomplete draft and drafts with invented claims', () => {
  const { validateArticle, topics, model } = createValidator();
  // Simulated on an open topic (in memory only): once the whole plan is published there is none.
  let queued = [...topics.values()].find((t) => t.editorial_qa_status === 'QUEUED' || t.editorial_qa_status === 'PLANNED');
  if (!queued) {
    queued = Object.assign([...topics.values()][0], { editorial_qa_status: 'PLANNED' });
    model.state.published_ids = model.state.published_ids.filter((id) => id !== queued.id);
  }
  const bad = validateArticle({ id: queued.id, slug: 'errado', title: 'Curto', sections: [] });
  assert.ok(bad.errors.length >= 3);
  const claims = validateArticle({
    contract_version: 1,
    id: queued.id,
    slug: queued.slug,
    title: 'Um título de teste com extensão suficiente para o QA',
    description: 'Descrição de teste com a extensão mínima exigida pelo validador para confirmar que as regras de afirmações proibidas funcionam corretamente.',
    h1: 'Título visível de teste para o validador',
    summary: 'Oferecemos entrega gratuita e aluguer sem caução para todos os clientes que liguem para 0942 467 674.',
    key_points: ['a', 'b', 'c'],
    intro: ['Introdução.'],
    sections: [],
    faq: [],
    sources: [],
    legal_note: false,
    writer: { type: 'human', name: 'Teste' },
    status: 'READY_FOR_QA'
  });
  assert.ok(claims.errors.some((e) => e.includes('unverified business claim')));
  assert.ok(claims.errors.some((e) => e.includes('phone number written by hand')));
});

test('hold topics cannot be submitted', () => {
  const { validateArticle, topics } = createValidator();
  // Simulated on an open topic, since the plan may have no topic on hold.
  const held = [...topics.values()].find((t) => t.editorial_qa_status !== 'PUBLISHED') || [...topics.values()][0];
  held.editorial_qa_status = 'HOLD_FOR_INTENT_REVIEW';
  held.hold_reason = 'teste';
  const r = validateArticle({ id: held.id, slug: held.slug, title: 'x', description: 'y', h1: 'z', summary: 's', sections: [] });
  assert.ok(r.errors.some((e) => e.includes('HOLD_FOR_INTENT_REVIEW')));
});

// The daily scheduled run calls "process": with nothing in the inbox it must not touch any file,
// otherwise every run would push a commit that only changes dates.
test('factory process with an empty inbox writes nothing', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pt-factory-'));
  try {
    for (const dir of ['scripts', 'site', 'content', 'data', 'factory', 'reports']) {
      fs.cpSync(path.join(ROOT, dir), path.join(tmp, dir), { recursive: true });
    }
    fs.mkdirSync(path.join(tmp, '_factory', 'inbox'), { recursive: true });
    const watched = ['data/factory-state.json', 'data/writer-queue.json', 'data/editorial-plan.json', 'reports/factory-last-run.json', 'reports/publication-log.json'];
    const snapshot = () => watched.map((f) => fs.readFileSync(path.join(tmp, f), 'utf8'));
    const before = snapshot();
    const r = spawnSync(process.execPath, [path.join(tmp, 'scripts', 'factory.mjs'), 'process'], { cwd: tmp, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Inbox empty/);
    assert.deepEqual(snapshot(), before);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('publishing pace counts only new articles in the last 7 days', async () => {
  const { roomLeft } = await import('../lib/pace.mjs');
  const entries = [
    { date: '2026-10-12', type: 'new' },
    { date: '2026-10-10', type: 'new' },
    { date: '2026-10-11', type: 'update' },
    { date: '2026-10-01', type: 'new' }
  ];
  assert.equal(roomLeft(entries, 10, '2026-10-12'), 8);
  assert.equal(roomLeft(entries, 2, '2026-10-12'), 0);
  assert.equal(roomLeft(entries, 2, '2026-10-20'), 2);
  assert.equal(roomLeft(entries, undefined, '2026-10-12'), Infinity);
});

test('a draft that answers the same query as a live page is rejected', (t) => {
  const { validateArticle, model } = createValidator();
  const published = readJSON('content/articles/PT-0066.json');
  // Any topic that is still open for writing; once the whole plan is published there is none left.
  const queued = model.plan.topics.find((x) => !['PUBLISHED', 'HOLD_FOR_INTENT_REVIEW'].includes(x.editorial_qa_status));
  if (!queued) return t.skip('every topic is published');
  // Same query as PT-0066 (in memory only), whatever topic happens to be open.
  queued.primary_keyword = model.plan.topics.find((x) => x.id === 'PT-0066').primary_keyword;
  const draft = { ...published, id: queued.id, slug: queued.slug, status: 'READY_FOR_QA' };
  delete draft.date_published;
  delete draft.date_modified;
  delete draft.editorial;
  const r = validateArticle(draft);
  assert.ok(r.errors.some((e) => /title duplicates PT-0066/.test(e)), r.errors.join('\n'));
  assert.ok(r.stats.max_intent_overlap >= 0.6, `overlap ${r.stats.max_intent_overlap}`);
  assert.ok(r.errors.some((e) => /same search intent as PT-0066/.test(e)));
});

test('a published article can be updated in place and keeps its publication date', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pt-update-'));
  try {
    for (const dir of ['scripts', 'site', 'content', 'data', 'factory', 'reports']) fs.cpSync(path.join(ROOT, dir), path.join(tmp, dir), { recursive: true });
    for (const d of ['inbox', 'review', 'rejected']) fs.mkdirSync(path.join(tmp, '_factory', d), { recursive: true });
    const article = JSON.parse(fs.readFileSync(path.join(tmp, 'content/articles/PT-0066.json'), 'utf8'));
    const { date_published: published, date_modified: _m, editorial: _e, ...draft } = article;
    draft.status = 'READY_FOR_QA';
    const run = (...args) => spawnSync(process.execPath, [path.join(tmp, 'scripts', 'factory.mjs'), ...args], { cwd: tmp, encoding: 'utf8' });

    fs.writeFileSync(path.join(tmp, '_factory/inbox/PT-0066.json'), JSON.stringify(draft));
    let r = run('process');
    assert.match(r.stdout, /PT-0066: REJECTED/, 'a published id without "revision" must be refused');

    fs.rmSync(path.join(tmp, '_factory/rejected'), { recursive: true, force: true });
    fs.writeFileSync(path.join(tmp, '_factory/inbox/PT-0066.json'), JSON.stringify({ ...draft, revision: { reason: 'Horário e morada reescritos com os dados oficiais da loja.' } }));
    r = run('process');
    assert.match(r.stdout, /PT-0066: IN_REVIEW/, r.stdout + r.stderr);
    r = run('approve', 'PT-0066', '--no-build');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const updated = JSON.parse(fs.readFileSync(path.join(tmp, 'content/articles/PT-0066.json'), 'utf8'));
    assert.equal(updated.date_published, published);
    assert.equal(updated.editorial.revisions.length, (article.editorial?.revisions?.length || 0) + 1);
    assert.equal(updated.revision, undefined);
    const log = JSON.parse(fs.readFileSync(path.join(tmp, 'reports/publication-log.json'), 'utf8'));
    assert.equal(log.entries.at(-1).type, 'update');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
