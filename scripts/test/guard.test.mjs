// Collision guard: decisions before a topic is written.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, judgeTopic } from '../lib/guard.mjs';

const live = { kind: 'live', id: 'PT-0067', url: '/precos/aluguer-semanal-de-mota/', keyword: 'aluguer semanal mota hanói', title: 'Aluguer semanal de mota em Hanói: preços e quando compensa', h1: 'Alugar uma mota por uma semana', text: 'tarifa semanal preço por dia compensa a partir de cinco dias combinar com a loja' };
const index = buildIndex([live, { kind: 'live', id: '/contactos/', url: '/contactos/', keyword: '', title: 'Contactos', h1: 'Contactos', text: 'telefone morada horário' }]);
const topic = (o) => ({ id: 'PT-9999', target_url: '/x/', secondary_keywords: [], content_brief: '', ...o });

test('same keyword as a live URL is a duplicate', () => {
  assert.equal(judgeTopic(topic({ primary_keyword: 'aluguer semanal mota hanói', working_title: 'Outro título' }), index).decision, 'REJECT_DUPLICATE');
});

test('a topic answered by a live URL goes to upgrade or review, never straight to writing', () => {
  const r = judgeTopic(topic({ primary_keyword: 'preço semanal mota', working_title: 'Preço semanal de mota: quando compensa a tarifa semanal' }), index);
  assert.ok(['UPGRADE_EXISTING', 'REVIEW_COLLISION', 'REJECT_DUPLICATE'].includes(r.decision), r.decision);
});

test('a real gap is allowed', () => {
  const r = judgeTopic(topic({ primary_keyword: 'museu de etnologia hanói', working_title: 'Museu de Etnologia do Vietname de mota', content_brief: 'horário estacionamento Cầu Giấy' }), index);
  assert.equal(r.decision, 'ALLOW_CREATE');
});

test('a draft parked in the hold folder keeps its topic out of the writer queue', async (t) => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { ROOT } = await import('../lib/util.mjs');
  const { loadModel } = await import('../lib/model.mjs');
  const { runGuard } = await import('../lib/guard.mjs');
  const model = loadModel();
  const open = model.plan.topics.find((x) => x.editorial_qa_status !== 'PUBLISHED');
  if (!open) return t.skip('no open topic in the plan');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hold-'));
  fs.writeFileSync(path.join(dir, `${open.id}.json`), JSON.stringify({ id: open.id, title: open.working_title, h1: open.working_title, summary: open.content_brief || '' }));
  const [r] = runGuard(model, { ids: [open.id], draftDirs: [], holdDir: path.relative(ROOT, dir) });
  fs.rmSync(dir, { recursive: true, force: true });
  assert.equal(r.decision, 'REVIEW_COLLISION');
  assert.ok(r.reasons.some((x) => /held for human review/.test(x)));
});
