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
  const { validateArticle, topics } = createValidator();
  const queued = [...topics.values()].find((t) => t.editorial_qa_status === 'QUEUED' || t.editorial_qa_status === 'PLANNED');
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
  const held = [...topics.values()].find((t) => t.editorial_qa_status === 'HOLD_FOR_INTENT_REVIEW');
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
