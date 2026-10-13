// AI Content Collision Guard: decides, before anything is written, whether a planned topic
// deserves a new URL. Flow: NEW TOPIC → NORMALIZE → SEARCH EXISTING CONTENT → INTENT CHECK →
// SEMANTIC CHECK → DECISION. Existing content = live pages and articles, drafts waiting in the
// factory (inbox/review) and the other open topics of the editorial plan.
//   ALLOW_CREATE      real gap: nothing live or pending answers this query
//   UPGRADE_EXISTING  a live URL already answers it: improve that URL instead of adding one
//   REVIEW_COLLISION  possible competition with a live or pending item: a person decides
//   REJECT_DUPLICATE  same query as a live URL (same keyword or near-identical intent)
// Several signals are combined (keyword, intent fingerprint, semantic overlap of the brief with
// the live content); anything uncertain goes to REVIEW, never straight to writing.
import { normalize, readJSON, listFiles } from './util.mjs';
import { plain, buildTokens } from './text.mjs';
import { intentFingerprint, intentTokens, jaccard } from './intent.mjs';

export const GUARD_THRESHOLDS = {
  reject_intent: 0.75, // near-identical title/keyword fingerprint with a live URL
  upgrade_intent: 0.6, // the QA rejects drafts at this overlap with a live page
  review_intent: 0.45, // the QA warns at this overlap
  semantic_upgrade: 0.5, // brief vs. live content (with review_intent)
  semantic_review: 0.42,
  pending_review: 0.6 // two pending items (draft/topic) answering the same query
};

// Term-frequency vector of distinctive tokens (generic words removed by intentTokens).
function vector(text) {
  const v = new Map();
  for (const w of normalize(text).replace(/\b(\d+)\s+cc\b/g, '$1cc').split(' ')) {
    if (!w) continue;
    const [t] = [...intentTokens(w)];
    if (t) v.set(t, (v.get(t) || 0) + 1);
  }
  return v;
}

function cosine(a, b, idf) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [t, x] of a) {
    const w = x * (idf.get(t) || 1);
    na += w * w;
    const y = b.get(t);
    if (y) dot += w * y * (idf.get(t) || 1);
  }
  for (const [t, y] of b) {
    const w = y * (idf.get(t) || 1);
    nb += w * w;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

// items: [{ kind: 'live'|'draft'|'topic', id, url, keyword, title, h1, text }]
export function buildIndex(items) {
  const docs = items.map((it) => ({ ...it, fp: intentFingerprint({ primaryKeyword: it.keyword || '', title: it.title || '', h1: it.h1 || '' }), kw: normalize(it.keyword || ''), vec: vector(`${it.title || ''} ${it.h1 || ''} ${it.text || ''}`) }));
  const df = new Map();
  for (const d of docs) for (const t of d.vec.keys()) df.set(t, (df.get(t) || 0) + 1);
  const idf = new Map([...df].map(([t, n]) => [t, Math.log(1 + docs.length / n)]));
  return { docs, idf };
}

const round = (x) => Number(x.toFixed(2));

// topic: an editorial-plan entry. Returns { id, decision, reasons, live, pending }.
export function judgeTopic(topic, index, th = GUARD_THRESHOLDS) {
  const fp = intentFingerprint({ primaryKeyword: topic.primary_keyword, title: topic.working_title, h1: '' });
  const kw = normalize(topic.primary_keyword || '');
  const vec = vector(`${topic.primary_keyword} ${(topic.secondary_keywords || []).join(' ')} ${topic.working_title} ${topic.content_brief || ''}`);
  const scored = index.docs
    .filter((d) => d.id !== topic.id && d.url !== topic.target_url)
    .map((d) => ({ kind: d.kind, id: d.id, url: d.url, intent: jaccard(fp, d.fp), semantic: cosine(vec, d.vec, index.idf), sameKeyword: Boolean(kw) && kw === d.kw }));
  const best = (list, key) => list.reduce((m, x) => (x[key] > (m?.[key] ?? -1) ? x : m), null);
  const live = scored.filter((s) => s.kind === 'live');
  const pending = scored.filter((s) => s.kind !== 'live');
  const liveIntent = best(live, 'intent');
  const liveSemantic = best(live, 'semantic');
  const pendIntent = best(pending, 'intent');
  const reasons = [];
  let decision = 'ALLOW_CREATE';
  const sameKw = live.find((s) => s.sameKeyword);
  if (sameKw) {
    decision = 'REJECT_DUPLICATE';
    reasons.push(`same primary keyword as live ${sameKw.url}`);
  } else if (liveIntent && liveIntent.intent >= th.reject_intent) {
    decision = 'REJECT_DUPLICATE';
    reasons.push(`intent ${round(liveIntent.intent)} with live ${liveIntent.url}`);
  } else if (liveIntent && (liveIntent.intent >= th.upgrade_intent || (liveIntent.intent >= th.review_intent && liveSemantic?.url === liveIntent.url && liveSemantic.semantic >= th.semantic_upgrade))) {
    decision = 'UPGRADE_EXISTING';
    reasons.push(`live ${liveIntent.url} already answers it (intent ${round(liveIntent.intent)})`);
  } else if ((liveIntent && liveIntent.intent >= th.review_intent) || (liveSemantic && liveSemantic.semantic >= th.semantic_review)) {
    decision = 'REVIEW_COLLISION';
    if (liveIntent && liveIntent.intent >= th.review_intent) reasons.push(`intent ${round(liveIntent.intent)} with live ${liveIntent.url}`);
    if (liveSemantic && liveSemantic.semantic >= th.semantic_review) reasons.push(`semantic ${round(liveSemantic.semantic)} with live ${liveSemantic.url}`);
  } else if (pendIntent && pendIntent.intent >= th.pending_review) {
    decision = 'REVIEW_COLLISION';
    reasons.push(`intent ${round(pendIntent.intent)} with pending ${pendIntent.kind} ${pendIntent.id}`);
  }
  const top = (list, key) => (list ? { id: list.id, url: list.url, [key]: round(list[key]) } : null);
  return { id: topic.id, decision, reasons, live: { intent: top(liveIntent, 'intent'), semantic: top(liveSemantic, 'semantic') }, pending: top(pendIntent, 'intent') };
}

// Builds the guard index from the site model (live pages and articles), the factory drafts and the
// open topics of the plan, and judges the requested topics (default: open topics without a draft).
export function runGuard(model, { ids = null, all = false, draftDirs = ['_factory/inbox', '_factory/review'] } = {}) {
  const plan = model.plan;
  const ctx = { tokens: buildTokens(model.data), where: 'guard' };
  const txt = (s) => {
    try {
      return plain(String(s ?? ''), ctx);
    } catch {
      return String(s ?? '');
    }
  };
  const outline = (a) => [a.summary, ...(a.key_points || []), ...(a.sections || []).map((s) => s.h2)].map(txt).join(' ');
  const topicById = new Map(plan.topics.map((t) => [t.id, t]));
  const items = [];
  for (const p of model.pages.filter((p) => p.kind === 'page')) {
    items.push({ kind: 'live', id: p.url, url: p.url, keyword: p.primaryKeyword || '', title: p.title, h1: p.h1, text: [p.lead, p.answer, ...(p.sections || []).map((s) => s.h2)].map(txt).join(' ') });
  }
  for (const a of model.articles) {
    items.push({ kind: 'live', id: a.id, url: a.url, keyword: topicById.get(a.id)?.primary_keyword || '', title: a.title, h1: a.h1, text: outline(a.article) });
  }
  const drafted = new Set();
  for (const dir of draftDirs) {
    for (const f of listFiles(dir, '.json').filter((f) => /^PT-\d{4}\.json$/.test(f))) {
      const d = readJSON(`${dir}/${f}`);
      if (d.revision) continue; // updates of live articles are already indexed as live
      drafted.add(d.id);
      items.push({ kind: 'draft', id: d.id, url: topicById.get(d.id)?.target_url, keyword: topicById.get(d.id)?.primary_keyword || '', title: d.title, h1: d.h1, text: outline(d) });
    }
  }
  const open = plan.topics.filter((t) => t.editorial_qa_status !== 'PUBLISHED');
  for (const t of open) if (!drafted.has(t.id)) items.push({ kind: 'topic', id: t.id, url: t.target_url, keyword: t.primary_keyword, title: t.working_title, h1: '', text: t.content_brief });
  const index = buildIndex(items);
  const targets = ids?.length ? ids.map((id) => topicById.get(id)).filter(Boolean) : open.filter((t) => all || !drafted.has(t.id));
  // A reviewer can accept a collision after checking that the intents differ (guard_reviewed: true).
  return targets.map((t) => {
    const r = { ...judgeTopic(t, index), working_title: t.working_title, has_draft: drafted.has(t.id) };
    if (r.decision === 'REVIEW_COLLISION' && t.guard_reviewed) return { ...r, decision: 'ALLOW_CREATE', reasons: [...r.reasons, 'collision reviewed: distinct intent (guard_reviewed)'] };
    return r;
  });
}
