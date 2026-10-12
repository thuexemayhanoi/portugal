#!/usr/bin/env node
// SEO Growth Matrix (data/editorial-plan.json): validation and derived fields.
//   node scripts/plan.mjs --check   → validate and fail if derived fields are stale (CI)
//   node scripts/plan.mjs --write   → recompute derived fields (target_url, pillar, links in/out,
//                                     cannibalization, source requirements, editorial status)
//   node scripts/plan.mjs --stats   → print the distribution of topics
// Authored fields (edit these by hand): working_title, slug, child_category, primary_keyword,
// secondary_keywords, search_intent, funnel_stage, priority, content_brief, source_codes,
// hold_reason, intent_reviewed. Everything else is recomputed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJSON, writeJSON, listFiles, normalize, rel, isCleanUrl, fail } from './lib/util.mjs';
import { intentTokens as tokens, jaccard } from './lib/intent.mjs';

const INTENTS = new Set(['informational', 'commercial', 'transactional', 'navigational']);
const FUNNEL = new Set(['TOFU', 'MOFU', 'BOFU']);
export const SOURCE_CODES = {
  B: 'Dados da loja apenas através de {{tokens}} (site/data.json): preços, telefone, morada e horário nunca escritos à mão.',
  L: 'Legislação vietnamita em vigor (texto da lei/decreto ou base de dados jurídica reconhecida), com data de consulta.',
  P: 'Fonte oficial portuguesa (IMT, Portal Diplomático / MNE) quando o tema envolve documentos portugueses.',
  S: 'Fonte oficial de segurança rodoviária (lei, autoridades, OMS) para afirmações sobre risco ou regras.',
  M: 'Especificações do fabricante (Honda Vietnam, Yamaha Motor Vietnam) para dados técnicos dos modelos.',
  W: 'Dados meteorológicos oficiais (Centro Nacional de Previsão Hidrometeorológica) ou climatologia reconhecida.',
  X: 'Entidade ou operador oficial (metro, autocarros, ferrovia, aeroporto, preços oficiais de combustível, bancos).',
  Z: 'Anúncio oficial da cidade de Hanói ou imprensa de referência com data; tema sensível ao tempo — verificar à data de publicação.',
  H: 'Fonte oficial de saúde (OMS, Ministério da Saúde do Vietname) para conselhos de saúde.'
};
const AUTO_HOLD = 'Risco alto de canibalização com';
function targetWords(t) {
  if (t.priority === 1 && t.search_intent !== 'navigational') return [1500, 2800];
  if (t.funnel_stage === 'BOFU') return [1100, 1800];
  if (t.funnel_stage === 'MOFU') return [1200, 2200];
  return [1000, 2000];
}

export function derivePlan(plan, { taxonomy, basePages, state, queueIds = new Set() }) {
  const errors = [];
  const children = new Map();
  for (const p of taxonomy.parents) for (const c of p.children) children.set(c.id, { ...c, parent: p });
  const reserved = new Set(basePages.map((b) => b.url));
  for (const c of children.values()) reserved.add(c.archiveUrl);

  const topics = plan.topics;
  const ids = new Set();
  const urls = new Map();
  const pks = new Map();
  topics.forEach((t, i) => {
    const expected = `PT-${String(i + 1).padStart(4, '0')}`;
    if (t.id !== expected) errors.push(`${t.id}: expected ${expected} (IDs must be sequential)`);
    if (ids.has(t.id)) errors.push(`${t.id}: duplicate id`);
    ids.add(t.id);
    for (const f of ['working_title', 'slug', 'child_category', 'primary_keyword', 'search_intent', 'funnel_stage', 'content_brief']) {
      if (!t[f]) errors.push(`${t.id}: missing ${f}`);
    }
    const child = children.get(t.child_category);
    if (!child) return errors.push(`${t.id}: unknown child_category ${t.child_category}`);
    if (!INTENTS.has(t.search_intent)) errors.push(`${t.id}: invalid search_intent ${t.search_intent}`);
    if (!FUNNEL.has(t.funnel_stage)) errors.push(`${t.id}: invalid funnel_stage ${t.funnel_stage}`);
    if (![1, 2, 3].includes(t.priority)) errors.push(`${t.id}: priority must be 1, 2 or 3`);
    for (const code of t.source_codes || []) if (!SOURCE_CODES[code]) errors.push(`${t.id}: unknown source code ${code}`);
    t.order = i + 1;
    t.parent_category = child.parent.id;
    t.target_url = `${child.parent.url}${t.slug}/`;
    if (!isCleanUrl(t.target_url)) errors.push(`${t.id}: target URL not clean (${t.target_url})`);
    if (reserved.has(t.target_url)) errors.push(`${t.id}: ${t.target_url} collides with a base page or category archive`);
    if (urls.has(t.target_url)) errors.push(`${t.id}: duplicate target URL with ${urls.get(t.target_url)}`);
    urls.set(t.target_url, t.id);
    const pk = normalize(t.primary_keyword);
    if (pks.has(pk)) errors.push(`${t.id}: duplicate primary keyword with ${pks.get(pk)}`);
    pks.set(pk, t.id);
    t.pillar_url = child.pillarUrl;
    t.target_words = targetWords(t);
    const codes = t.source_codes || [];
    t.source_requirements = {
      codes,
      min_sources: codes.some((c) => ['L', 'S', 'Z', 'H'].includes(c)) ? 2 : codes.some((c) => c !== 'B') ? 1 : 0,
      notes: codes.map((c) => SOURCE_CODES[c])
    };
    t.metrics = { search_volume: null, keyword_difficulty: null, source: 'not measured' };
  });

  // Category targets must match the taxonomy exactly.
  for (const c of children.values()) {
    const n = topics.filter((t) => t.child_category === c.id).length;
    if (n !== c.target) errors.push(`child ${c.id}: ${n} topics planned, taxonomy target is ${c.target}`);
  }
  if (topics.length !== 300) errors.push(`plan has ${topics.length} topics (expected 300)`);

  // Cannibalization: compare distinctive keyword tokens against other topics and base pages.
  const sets = topics.map((t) => tokens(t.primary_keyword));
  const baseSets = basePages.filter((b) => b.primaryKeyword).map((b) => ({ url: b.url, set: tokens(b.primaryKeyword) }));
  const highPairs = new Set();
  topics.forEach((t, i) => {
    const hits = [];
    let risk = 'low';
    const bump = (level) => {
      if (level === 'high' || (level === 'medium' && risk === 'low')) risk = level;
    };
    topics.forEach((o, j) => {
      if (i === j) return;
      const s = jaccard(sets[i], sets[j]);
      const secondaryClash = (t.secondary_keywords || []).some((k) => normalize(k) === normalize(o.primary_keyword));
      if (s >= 0.8) {
        bump('high');
        hits.push(o.id);
        highPairs.add(`${t.id}|${o.id}`);
      } else if (s >= 0.5 || secondaryClash) {
        bump('medium');
        hits.push(o.id);
      }
    });
    for (const b of baseSets) {
      const s = jaccard(sets[i], b.set);
      if (s >= 0.8) {
        bump('high');
        hits.push(b.url);
        highPairs.add(`${t.id}|${b.url}`);
      } else if (s >= 0.5) {
        bump('medium');
        hits.push(b.url);
      }
    }
    t.cannibalization_risk = risk;
    t.cannibalization_with = hits.slice(0, 8);
  });

  // Internal links: pillar, parent hub, commercial page, siblings and one cross-cluster topic.
  const CROSS = {
    'scooters-automaticas': 'aluguer-por-duracao',
    'motas-semiautomaticas': 'aluguer-por-duracao',
    'motas-50cc': 'processo-e-documentacao',
    'motas-eletricas': 'clima-e-epocas-do-ano',
    'aluguer-por-duracao': 'scooters-automaticas',
    'caucoes-e-pagamentos': 'processo-e-documentacao',
    'entrega-e-custos-adicionais': 'entrega-devolucao-e-incidentes',
    'comparacoes-de-precos': 'alternativas-de-transporte',
    'processo-e-documentacao': 'caucoes-e-pagamentos',
    'inspecao-e-seguranca': 'entrega-devolucao-e-incidentes',
    'conducao-e-utilizacao-diaria': 'bairro-antigo-e-hoan-kiem',
    'entrega-devolucao-e-incidentes': 'inspecao-e-seguranca',
    'bairro-antigo-e-hoan-kiem': 'conducao-e-utilizacao-diaria',
    'long-bien-e-gia-lam': 'entrega-e-custos-adicionais',
    'tay-ho-e-ba-dinh': 'itinerarios-urbanos',
    'estacoes-e-pontos-de-interesse': 'alternativas-de-transporte',
    'itinerarios-urbanos': 'conducao-e-utilizacao-diaria',
    'clima-e-epocas-do-ano': 'inspecao-e-seguranca',
    'alternativas-de-transporte': 'comparacoes-de-precos',
    'viagens-fora-de-hanoi': 'processo-e-documentacao'
  };
  const active = (t) => !t.hold_reason;
  for (const [i, t] of topics.entries()) {
    const child = children.get(t.child_category);
    const out = [t.pillar_url];
    if (child.parent.url !== t.pillar_url) out.push(child.parent.url);
    out.push(t.funnel_stage === 'BOFU' ? '/contactos/' : t.parent_category === 'precos-e-condicoes' || t.search_intent === 'commercial' ? '/precos/' : '/guia-de-aluguer/documentacao-e-caucao/');
    const siblings = topics.filter((o) => o.child_category === t.child_category && o !== t && active(o));
    const pos = siblings.findIndex((o) => o.order > t.order);
    const prev = pos === -1 ? siblings[siblings.length - 1] : siblings[pos - 1];
    const next = pos === -1 ? siblings[0] : siblings[pos];
    for (const s of [prev, next]) if (s) out.push(s.target_url);
    const crossCandidates = topics.filter((o) => o.child_category === CROSS[t.child_category] && active(o));
    if (crossCandidates.length) {
      const best = crossCandidates
        .map((o) => ({ o, s: jaccard(sets[i], sets[o.order - 1]) }))
        .sort((a, b) => b.s - a.s || a.o.order - b.o.order)[0].o;
      out.push(best.target_url);
    }
    t.internal_links_out = [...new Set(out)].filter((u) => u !== t.target_url);
  }
  const inbound = new Map(topics.map((t) => [t.target_url, new Set()]));
  for (const t of topics) for (const u of t.internal_links_out) if (inbound.has(u)) inbound.get(u).add(t.target_url);
  for (const t of topics) {
    const fromPillar = [t.pillar_url, children.get(t.child_category).parent.url];
    t.internal_links_in = [...new Set([...fromPillar, ...inbound.get(t.target_url)])].filter((u) => u !== t.target_url).slice(0, 12);
  }

  // Editorial status. In a high-risk pair only the later topic is held (the earlier one keeps the
  // intent), unless the earlier one is itself on hold. A clash with a base page always holds the topic.
  const published = new Set(state.published_ids || []);
  const review = new Set(state.review_ids || []);
  const rejected = new Set(state.rejected_ids || []);
  const byId = new Map(topics.map((t) => [t.id, t]));
  const authoredHold = (t) => t.hold_reason && !t.hold_reason.startsWith(AUTO_HOLD);
  for (const t of topics) {
    if (t.hold_reason && t.hold_reason.startsWith(AUTO_HOLD)) t.hold_reason = null; // recomputed below
    let autoHold = false;
    if (t.cannibalization_risk === 'high' && !t.intent_reviewed) {
      const partners = t.cannibalization_with.filter((x) => highPairs.has(`${t.id}|${x}`));
      autoHold = partners.some((x) => x.startsWith('/') || (byId.has(x) && byId.get(x).order < t.order && !authoredHold(byId.get(x))));
      if (autoHold && !t.hold_reason) t.hold_reason = `${AUTO_HOLD} ${partners.join(', ')}; rever a intenção e marcar intent_reviewed=true se for distinta.`;
    }
    if (published.has(t.id)) t.editorial_qa_status = 'PUBLISHED';
    else if (review.has(t.id)) t.editorial_qa_status = 'IN_REVIEW';
    else if (t.hold_reason) t.editorial_qa_status = 'HOLD_FOR_INTENT_REVIEW';
    else if (rejected.has(t.id)) t.editorial_qa_status = 'REWRITE_REQUIRED';
    else if (queueIds.has(t.id)) t.editorial_qa_status = 'QUEUED';
    else t.editorial_qa_status = 'PLANNED';
  }

  const count = (key) => topics.reduce((acc, t) => ((acc[t[key]] = (acc[t[key]] || 0) + 1), acc), {});
  plan.summary = {
    total: topics.length,
    by_status: count('editorial_qa_status'),
    by_intent: count('search_intent'),
    by_funnel: count('funnel_stage'),
    by_cannibalization_risk: count('cannibalization_risk'),
    by_parent: count('parent_category')
  };
  return { plan, errors };
}

const ORDER = ['id', 'order', 'working_title', 'slug', 'parent_category', 'child_category', 'primary_keyword', 'secondary_keywords', 'search_intent', 'funnel_stage', 'priority', 'target_url', 'pillar_url', 'content_brief', 'target_words', 'source_codes', 'source_requirements', 'internal_links_out', 'internal_links_in', 'cannibalization_risk', 'cannibalization_with', 'hold_reason', 'intent_reviewed', 'editorial_qa_status', 'metrics'];
const ordered = (t) => Object.fromEntries(ORDER.filter((k) => k in t).map((k) => [k, t[k]]));

export function loadPlanContext() {
  const taxonomy = readJSON('site/taxonomy.json');
  const basePages = listFiles('content/pages', '.json').map((f) => readJSON(`content/pages/${f}`));
  const state = readJSON('data/factory-state.json');
  const queue = fs.existsSync(rel('data/writer-queue.json')) ? readJSON('data/writer-queue.json') : { items: [] };
  return { taxonomy, basePages, state, queueIds: new Set((queue.items || []).map((q) => q.id)) };
}

export function recompute() {
  const plan = readJSON('data/editorial-plan.json');
  const original = JSON.stringify(plan, null, 2);
  const { plan: next, errors } = derivePlan(plan, loadPlanContext());
  next.topics = next.topics.map(ordered);
  return { next, errors, stale: JSON.stringify(next, null, 2) !== original };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const mode = process.argv[2] || '--check';
  try {
    const { next, errors, stale } = recompute();
    if (errors.length) {
      console.error(`PLAN ERRORS (${errors.length}):\n  ${errors.slice(0, 60).join('\n  ')}`);
      process.exit(1);
    }
    if (mode === '--write') {
      writeJSON('data/editorial-plan.json', next);
      console.log(`Plan written: ${next.topics.length} topics`, JSON.stringify(next.summary.by_status));
    } else if (mode === '--stats') {
      console.log(JSON.stringify(next.summary, null, 2));
    } else {
      if (stale) {
        console.error('Plan derived fields are stale. Run: node scripts/plan.mjs --write');
        process.exit(1);
      }
      console.log(`Plan OK: ${next.topics.length} topics`, JSON.stringify(next.summary.by_status));
    }
  } catch (err) {
    console.error(err.isBuildError ? `PLAN ERROR: ${err.message}` : err);
    process.exit(1);
  }
}
export { fail };
