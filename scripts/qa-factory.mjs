#!/usr/bin/env node
// Article QA validator for the Content Factory (Writer Contract v1).
//   node scripts/qa-factory.mjs                 → validate every draft in _factory/inbox and _factory/review
//   node scripts/qa-factory.mjs path/to.json    → validate one file
//   node scripts/qa-factory.mjs --published     → re-validate published articles (regression check)
//   add --online to verify that every source URL answers (used in GitHub Actions)
// Exit code 1 when any file has errors. The factory imports validateArticle() from here.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readJSON, listFiles, rel, normalize, wordCount, isISODate, todayISO } from './lib/util.mjs';
import { SOURCE_CODES } from './plan.mjs';
import { loadModel } from './lib/model.mjs';
import { buildTokens, inline, plain, blocksToText } from './lib/text.mjs';
import { findBrazilianisms, findRiskyClaims, findStyleIssues, findForeignText, readability } from './lib/language.mjs';
import { intentFingerprint, jaccard } from './lib/intent.mjs';
import { bodyText, pageText, shingles, OVERLAP_THRESHOLDS } from './lib/overlap.mjs';

const BLOCK_KEYS = new Set(['p', 'h3', 'ul', 'ol', 'checklist', 'steps', 'dl', 'table', 'note', 'component']);
const PHONE_LITERAL = /(?:\+?84[\s.]?)?0?942[\s.]?467[\s.]?674/;
const VND_LITERAL = /\d{1,3}(?:[.\s]\d{3})+\s?(?:VND|vnd|₫|dong|dongs)/;
const RAW_HTML = /<\/?[a-z][^>]*>/i;
// Mentions that make a text "legal": they require a legal-database or official source.
const LEGAL_TRIGGERS = /(?<![\p{L}])(decreto|lei\s+n\.?º|artigo\s+\d+|coimas?|multas?|sanç(?:ão|ões)|infraç(?:ão|ões)|idade\s+mínima|alcoolemia|licença\s+internacional\s+de\s+condução)(?![\p{L}])/iu;
const OFFICIAL_PT = /(?:^|\.)(gov\.pt|imt-ip\.pt|mne\.gov\.pt)$/;
const PREFERRED_DOMAINS = {
  M: /(?:^|\.)(honda\.com\.vn|yamaha-motor\.com\.vn|honda\.com|global\.yamaha-motor\.com)$/,
  W: /(?:^|\.)(nchmf\.gov\.vn|gov\.vn|wmo\.int)$/,
  H: /(?:^|\.)(who\.int|moh\.gov\.vn)$/,
  X: /(?:^|\.)(gov\.vn|hanoimetro\.net\.vn|vr\.com\.vn|dsvn\.vn|vietnamairport\.vn)$/
};

export function createValidator() {
  const model = loadModel();
  const config = readJSON('data/factory-config.json');
  const tokens = buildTokens(model.data);
  const topics = new Map(model.plan.topics.map((t) => [t.id, t]));
  const liveUrls = new Set(model.byUrl.keys());

  // Corpus for duplicate detection: base pages and published articles.
  const corpus = [];
  const shingleOf = (text) => {
    const w = normalize(text).split(' ').filter(Boolean);
    const set = new Set();
    for (let i = 0; i + 5 <= w.length; i++) set.add(w.slice(i, i + 5).join(' '));
    return set;
  };
  const trigrams = (text) => {
    const w = normalize(text).split(' ').filter(Boolean);
    const set = new Set();
    for (let i = 0; i + 3 <= w.length; i++) set.add(w.slice(i, i + 3).join(' '));
    return set;
  };
  const ctxFor = (where, links = []) => ({ tokens, where, sources: model.sources, components: {}, usedIds: new Set(), headings: [], onInternalLink: (h) => links.push(h) });
  // Body text with tokens resolved, for the matrix-equivalent overlap (3-word shingles).
  const txt = (s) => {
    try {
      return plain(String(s ?? ''), ctxFor('overlap'));
    } catch {
      return String(s ?? '');
    }
  };
  for (const p of model.pages) {
    if (p.kind === 'page') {
      const c = ctxFor(p.source);
      const text = [...(p.sections || []).map((s) => `${plain(s.h2, c)} ${blocksToText(s.body, c)}`), ...(p.faq || []).map((f) => `${plain(f.q, c)} ${plain(f.a, c)}`)].join(' ');
      corpus.push({ id: p.url, set: shingleOf(text), body: shingles(pageText(p, txt)), title: p.title, h1: p.h1, description: p.description, intent: intentFingerprint({ primaryKeyword: p.primaryKeyword || '', title: p.title, h1: p.h1 }), keyword: normalize(p.primaryKeyword || ''), answer: trigrams(plain(p.answer || p.lead || '', c)) });
    }
  }
  const articleText = (a, c) =>
    [
      ...(a.intro || []).map((x) => plain(x, c)),
      ...(a.key_points || []).map((x) => plain(x, c)),
      ...(a.sections || []).flatMap((s) => [plain(s.h2 || '', c), blocksToText(s.body, c)]),
      ...(a.faq || []).flatMap((f) => [plain(f.q || '', c), plain(f.a || '', c)])
    ].join('\n');
  for (const a of model.articles) {
    const t = topics.get(a.id);
    corpus.push({ id: a.id, set: shingleOf(articleText(a.article, ctxFor(a.source))), body: shingles(bodyText(a.article, txt)), title: a.title, h1: a.h1, description: a.description, intent: intentFingerprint({ primaryKeyword: t?.primary_keyword || '', title: a.title, h1: a.h1 }), keyword: normalize(t?.primary_keyword || ''), answer: trigrams(plain(a.article.summary || '', ctxFor(a.source))) });
  }

  function validateArticle(draft, { file = 'draft', batchUrls = new Set(), allowPublished = false, peers = [] } = {}) {
    const errors = [];
    const warnings = [];
    const E = (m) => errors.push(m);
    const W = (m) => warnings.push(m);
    const stats = {};
    if (!draft || typeof draft !== 'object') return { errors: ['not a JSON object'], warnings, stats };

    // --- identity and plan
    const topic = topics.get(draft.id);
    if (!topic) {
      E(`id "${draft.id}" is not in data/editorial-plan.json`);
      return { errors, warnings, stats };
    }
    if (topic.editorial_qa_status === 'HOLD_FOR_INTENT_REVIEW') E(`${draft.id} is HOLD_FOR_INTENT_REVIEW: ${topic.hold_reason}`);
    const published = model.state.published_ids.includes(draft.id);
    const isUpdate = Boolean(draft.revision);
    if (isUpdate) {
      if (!published) E(`${draft.id} is not published: "revision" is only for updates of published articles`);
      if (typeof draft.revision.reason !== 'string' || draft.revision.reason.trim().length < 20) E('revision.reason must explain what changed and why (at least 20 characters)');
    } else if (!allowPublished && published) {
      E(`${draft.id} is already published: send an update with "revision": { "reason": "…" }`);
    }
    stats.update = isUpdate;
    if (draft.slug !== topic.slug) E(`slug "${draft.slug}" must be "${topic.slug}" (URL ${topic.target_url})`);
    if (draft.contract_version !== config.contract_version) E(`contract_version must be ${config.contract_version}`);
    const okStatus = allowPublished ? ['READY_FOR_QA', 'PUBLISHED'] : ['READY_FOR_QA'];
    if (!okStatus.includes(draft.status)) E(`status must be ${okStatus.map((x) => `"${x}"`).join(' or ')}`);
    if (!draft.writer || !['human', 'claude', 'external-ai'].includes(draft.writer.type)) E('writer.type must be human, claude or external-ai');

    // --- required text fields
    const str = (k) => typeof draft[k] === 'string' && draft[k].trim().length > 0;
    for (const k of ['title', 'description', 'h1', 'summary']) if (!str(k)) E(`missing ${k}`);
    if (!Array.isArray(draft.sections)) E('sections must be an array');
    if (errors.length) return { errors, warnings, stats };

    const links = [];
    const ctx = ctxFor(file, links);
    const tryRender = (label, fn) => {
      try {
        return fn();
      } catch (e) {
        E(`${label}: ${e.message}`);
        return '';
      }
    };
    const safePlain = (v) => {
      try {
        return plain(v, ctx);
      } catch (e) {
        E(e.message);
        return String(v ?? '');
      }
    };
    const len = (k) => safePlain(draft[k]).length;
    const range = (k, r) => {
      const n = len(k);
      if (n < r.min || n > r.max) E(`${k} length ${n} outside ${r.min}–${r.max}`);
      return n;
    };
    const tl = range('title', config.title_length);
    if (tl > config.title_length.ideal_max) W(`title ${tl} characters (ideal ≤ ${config.title_length.ideal_max})`);
    const dl = range('description', config.description_length);
    if (dl < config.description_length.ideal_min || dl > config.description_length.ideal_max) W(`description ${dl} characters (ideal ${config.description_length.ideal_min}–${config.description_length.ideal_max})`);
    range('h1', config.h1_length);
    range('summary', config.summary_length);

    // --- uniqueness of title / h1 / description
    const n = (s) => normalize(safePlain(s));
    for (const other of corpus) {
      if (other.id === draft.id) continue;
      if (n(draft.title) === normalize(other.title)) E(`title duplicates ${other.id}`);
      if (n(draft.h1) === normalize(other.h1)) E(`h1 duplicates ${other.id}`);
      if (n(draft.description) === normalize(other.description)) E(`description duplicates ${other.id}`);
    }

    // --- search intent: a draft must not answer the same query as a live page or another draft
    const myIntent = intentFingerprint({ primaryKeyword: topic.primary_keyword, title: safePlain(draft.title), h1: safePlain(draft.h1) });
    const myKeyword = normalize(topic.primary_keyword);
    let closest = { id: null, score: 0 };
    for (const other of [...corpus, ...peers]) {
      if (other.id === draft.id) continue;
      if (other.keyword && other.keyword === myKeyword) E(`primary keyword "${topic.primary_keyword}" is already the main keyword of ${other.id}`);
      const score = jaccard(myIntent, other.intent);
      if (score > closest.score) closest = { id: other.id, score };
    }
    stats.max_intent_overlap = Number(closest.score.toFixed(2));
    if (closest.score >= config.intent.error) E(`same search intent as ${closest.id} (overlap ${closest.score.toFixed(2)}): merge the topics or change the angle`);
    else if (closest.score >= config.intent.warning) W(`search intent close to ${closest.id} (overlap ${closest.score.toFixed(2)}): make the difference explicit in title and H1`);
    const myAnswer = trigrams(safePlain(draft.summary));
    for (const other of corpus) {
      if (other.id === draft.id || !other.answer?.size || !myAnswer.size) continue;
      const score = jaccard(myAnswer, other.answer);
      if (score >= config.intent.answer_warning) W(`quick answer repeats ${other.id} (overlap ${score.toFixed(2)})`);
    }

    // --- raw HTML and literal business facts
    const allStrings = [];
    const collect = (v) => {
      if (typeof v === 'string') allStrings.push(v);
      else if (Array.isArray(v)) v.forEach(collect);
      else if (v && typeof v === 'object') Object.values(v).forEach(collect);
    };
    collect({ ...draft, sources: undefined, writer: undefined, editorial: undefined });
    for (const s of allStrings) {
      if (RAW_HTML.test(s)) E(`raw HTML is not allowed: "${s.slice(0, 60)}"`);
      if (PHONE_LITERAL.test(s)) E('phone number written by hand — use {{phone}} or {{phone.local}}');
      if (VND_LITERAL.test(s)) W(`literal VND amount "${VND_LITERAL.exec(s)[0]}": business prices must use {{price.*}} tokens (legal amounts are fine with a source)`);
    }

    // --- structure
    if (!Array.isArray(draft.key_points) || draft.key_points.length < config.key_points.min || draft.key_points.length > config.key_points.max) {
      E(`key_points must have ${config.key_points.min}–${config.key_points.max} items`);
    }
    if (!Array.isArray(draft.intro) || !draft.intro.length) E('intro must have at least one paragraph');
    if (draft.sections.length < config.min_sections) E(`at least ${config.min_sections} H2 sections required (found ${draft.sections.length})`);
    const h2seen = new Set();
    draft.sections.forEach((s, i) => {
      if (!s || typeof s.h2 !== 'string' || !s.h2.trim()) return E(`section ${i + 1} without h2`);
      const key = normalize(s.h2);
      if (h2seen.has(key)) E(`duplicate H2 "${s.h2}"`);
      h2seen.add(key);
      if (!Array.isArray(s.body) || !s.body.length) return E(`section "${s.h2}" has no body`);
      for (const b of s.body) {
        if (typeof b === 'string') continue;
        const keys = Object.keys(b || {});
        if (!keys.length || !keys.every((k) => BLOCK_KEYS.has(k) || ['tone', 'title', 'category', 'caption'].includes(k))) E(`section "${s.h2}": unknown block ${JSON.stringify(keys)}`);
        if (b.component && !config.allowed_components.includes(b.component)) E(`component "${b.component}" not allowed in articles`);
        if (b.component && b.category && !model.data.pricing.categories[b.category]) E(`unknown pricing category "${b.category}"`);
      }
    });

    // --- render every inline string (validates tokens and link syntax) and collect links
    tryRender('summary', () => inline(draft.summary, ctx));
    for (const p of draft.intro || []) tryRender('intro', () => inline(p, ctx));
    for (const k of draft.key_points || []) tryRender('key_points', () => inline(k, ctx));
    for (const s of draft.sections) {
      tryRender(`h2 "${s.h2}"`, () => inline(s.h2, ctx));
      for (const b of s.body || []) {
        const parts = typeof b === 'string' ? [b] : [b.p, b.h3, b.note, b.title, ...(b.ul || []), ...(b.ol || []), ...(b.checklist || []), ...(b.steps || []).flatMap((x) => [x.title, x.text]), ...(b.table ? [b.table.caption, ...(b.table.head || []), ...(b.table.rows || []).flat()] : [])];
        for (const part of parts.filter((x) => typeof x === 'string')) tryRender(`section "${s.h2}"`, () => inline(part, ctx));
      }
    }

    // --- FAQ
    const faq = draft.faq || [];
    if (faq.length && (faq.length < config.faq.min || faq.length > config.faq.max)) E(`faq must have ${config.faq.min}–${config.faq.max} items (or none)`);
    for (const f of faq) {
      if (!f || typeof f.q !== 'string' || typeof f.a !== 'string') {
        E('faq items need q and a');
        continue;
      }
      if (!f.q.trim().endsWith('?')) E(`FAQ question must end with "?": ${f.q}`);
      const al = safePlain(f.a).length;
      if (al < 40 || al > 700) E(`FAQ answer length ${al} outside 40–700: ${f.q}`);
      tryRender('faq', () => inline(f.q, ctx) + inline(f.a, ctx));
    }
    if (!faq.length && topic.funnel_stage !== 'BOFU') W('no FAQ: consider 2–4 real questions for this intent');

    // --- internal links
    // A parent hub without a base page is generated together with its first article, so the
    // draft can (and must) link to its own parent hub even before that hub is live.
    const parent = model.parents.get(topic.parent_category);
    const ownHub = parent && !parent.basePage ? parent.url : null;
    const reachable = (u) => liveUrls.has(u) || batchUrls.has(u) || u === ownHub;
    const internal = links.map((h) => h.split('#')[0]);
    const broken = internal.filter((u) => !reachable(u));
    for (const u of new Set(broken)) E(`internal link to a page that is not live: ${u}`);
    const uniqueLive = new Set(internal.filter(reachable));
    stats.internal_links = uniqueLive.size;
    if (uniqueLive.size < config.min_internal_links) E(`at least ${config.min_internal_links} distinct internal links required (found ${uniqueLive.size})`);
    if (reachable(topic.pillar_url) && !uniqueLive.has(topic.pillar_url)) E(`must link to the pillar page ${topic.pillar_url}`);
    if (internal.includes(topic.target_url)) E('article links to itself');

    // --- sources
    const sources = draft.sources || [];
    const seen = new Set();
    let valid = 0;
    for (const s of sources) {
      if (typeof s === 'string') {
        if (!model.sources.has(s)) E(`unknown source id "${s}" (site/sources.json)`);
        else valid++;
        if (seen.has(s)) E(`duplicate source ${s}`);
        seen.add(s);
        continue;
      }
      if (!s || !/^https:\/\//.test(s.url || '') || !s.title || !s.publisher || !isISODate(s.accessed)) {
        E(`source objects need https url, title, publisher and accessed (YYYY-MM-DD): ${JSON.stringify(s).slice(0, 120)}`);
        continue;
      }
      if (seen.has(s.url)) E(`duplicate source ${s.url}`);
      seen.add(s.url);
      // Titles are shown on the page: no editor notes, no titles rebuilt from a URL slug.
      if (/\[(?:página|notícia|perguntas|segundo|título|nota|fonte|ficha|url|pdf)|segundo o url|^slide image\b|^untitled\b|^\d+\.\s+\S+\.(?:com|net|org|vn|info)\b|^xuất bản ngày|^(?:home|trang chủ|thông tin văn bản|tieng anh)$|^\d+ vbhn\b/i.test(s.title)) E(`source title looks like a note or placeholder, use the real title: "${s.title}"`);
      else if (/^vi/i.test(s.lang || '') && /^[a-z0-9 ,.:;'"?!/-]+$/.test(s.title) && s.title.trim().split(/\s+/).length >= 5) E(`Vietnamese source title without diacritics (rebuilt from the URL?): "${s.title}"`);
      valid++;
    }
    stats.sources = valid;
    if (valid < topic.source_requirements.min_sources) E(`at least ${topic.source_requirements.min_sources} verifiable sources required for this topic (${topic.source_requirements.codes.join(', ')})`);
    if (topic.source_requirements.codes.includes('L') && !draft.legal_note) W('legal topic without legal_note: true');

    // --- length, language, claims, keyword use, similarity
    let text = '';
    try {
      text = articleText(draft, ctx);
    } catch (e) {
      E(e.message);
    }
    const words = wordCount(text);
    stats.words = words;
    if (words < config.word_count.min || words > config.word_count.max) E(`word count ${words} outside ${config.word_count.min}–${config.word_count.max}`);
    const [tmin, tmax] = topic.target_words;
    if (words < tmin || words > tmax) W(`word count ${words} outside the topic target ${tmin}–${tmax}`);
    const fullText = [safePlain(draft.title), safePlain(draft.h1), safePlain(draft.summary), text].join('\n');
    for (const hit of findBrazilianisms(fullText)) {
      const msg = `pt-BR "${hit.term}" → "${hit.pt}" (…${hit.context}…)`;
      if (hit.level === 'warning') W(msg);
      else E(msg);
    }
    for (const hit of findStyleIssues(fullText)) W(`pt-PT style "${hit.term}" → "${hit.pt}" (…${hit.context}…)`);
    const foreign = findForeignText(fullText);
    const report = (hits, min, what) => {
      const terms = [...new Set(hits.map((h) => h.term.toLowerCase()))];
      if (hits.length >= min) E(`${what}: ${terms.join(', ')} — the text looks copied or machine-translated`);
      else for (const h of hits) W(`${what} "${h.term}" (…${h.context}…)`);
    };
    report(foreign.spanish, 2, 'Spanish words');
    report(foreign.noAccents, 3, 'Portuguese words without diacritics');
    report(foreign.english, 3, 'English sentences');
    const read = readability(text);
    stats.avg_sentence_words = read.avg;
    if (read.avg > 26) W(`long sentences on average (${read.avg} words): split them for mobile readers`);
    for (const sentence of read.long.slice(0, 3)) W(`sentence over 50 words: "${sentence}…"`);
    if (read.voce_per_1000 > 5) W(`"você" ${read.voce_per_1000}× per 1000 words: European Portuguese usually omits the subject`);
    for (const hit of findRiskyClaims(fullText)) E(`unverified business claim "${hit.match}" (…${hit.context}…)`);

    // --- sources cross-check: legal content needs legal/official sources, sources must be recent
    const resolved = sources.map((x) => (typeof x === 'string' ? model.sources.get(x) : x)).filter((x) => x && x.url);
    const host = (u) => {
      try {
        return new URL(u).hostname.replace(/^www\./, '');
      } catch {
        return '';
      }
    };
    const ageDays = (d) => Math.round((Date.parse(todayISO()) - Date.parse(d)) / 86400000);
    for (const x of resolved) {
      const age = ageDays(x.accessed);
      if (age < 0) E(`source "accessed" date is in the future: ${x.url}`);
      else if (age > config.sources.max_age_days_error) E(`source consulted ${age} days ago — check it again: ${x.url}`);
      else if (age > config.sources.max_age_days_warning) W(`source consulted ${age} days ago — confirm it is still current: ${x.url}`);
      if (!x.type) W(`source without "type" (${config.sources.types.join(', ')}): ${x.url}`);
      else if (!config.sources.types.includes(x.type)) E(`source type "${x.type}" not allowed (${config.sources.types.join(', ')}): ${x.url}`);
    }
    const codes = topic.source_requirements.codes;
    const legalText = LEGAL_TRIGGERS.test(fullText);
    stats.legal_text = legalText;
    if ((codes.includes('L') || legalText) && !resolved.some((x) => ['legal-database', 'official'].includes(x.type))) {
      E('laws, fines or licence rules are mentioned: cite at least one legal-database or official source');
    }
    if (legalText && !draft.legal_note) W('the text mentions laws, fines or licences: set legal_note: true');
    if (codes.includes('P') && !resolved.some((x) => OFFICIAL_PT.test(host(x.url)))) E('topic needs an official Portuguese source (IMT, Portal Diplomático, gov.pt)');
    for (const [code, re] of Object.entries(PREFERRED_DOMAINS)) {
      if (codes.includes(code) && !resolved.some((x) => re.test(host(x.url)))) W(`source code ${code}: ${SOURCE_CODES[code]}`);
    }

    const pkTokens = normalize(topic.primary_keyword).split(' ').filter((w) => w.length > 3 && !['aluguer', 'hanoi', 'mota', 'motas'].includes(w));
    const head = normalize(`${safePlain(draft.title)} ${safePlain(draft.h1)}`);
    if (pkTokens.length && !pkTokens.some((w) => head.includes(w))) W(`primary keyword "${topic.primary_keyword}" not reflected in title/H1`);
    const opening = normalize(`${safePlain(draft.summary)} ${(draft.intro || []).map((p) => safePlain(p)).join(' ')}`);
    if (pkTokens.length && !pkTokens.some((w) => opening.includes(w))) W('summary/intro does not address the primary keyword directly');
    const phrase = normalize(topic.primary_keyword);
    const occurrences = (normalize(text).match(new RegExp(`\\b${phrase.replace(/ /g, '\\s')}\\b`, 'g')) || []).length;
    if (words && (occurrences / words) * 1000 > 6) W(`possible keyword stuffing: "${topic.primary_keyword}" ${occurrences}× in ${words} words`);

    const mine = shingleOf(text);
    let worst = { id: null, score: 0 };
    for (const other of corpus) {
      if (other.id === draft.id || !mine.size || !other.set.size) continue;
      let inter = 0;
      for (const x of mine) if (other.set.has(x)) inter++;
      const score = inter / (mine.size + other.set.size - inter);
      if (score > worst.score) worst = { id: other.id, score };
    }
    stats.max_similarity = Number(worst.score.toFixed(3));
    if (worst.score > config.similarity.error) E(`near-duplicate of ${worst.id} (similarity ${worst.score.toFixed(2)})`);
    else if (worst.score > config.similarity.warning) W(`high overlap with ${worst.id} (similarity ${worst.score.toFixed(2)})`);
    // Same measure as the SEO matrix and the content audit: repeated generic passages (parking,
    // bridge status, low-emission zone…) make two URLs compete even when they are not copies.
    const body = shingles(bodyText(draft, txt));
    let worstBody = { id: null, score: 0 };
    for (const other of corpus) {
      if (other.id === draft.id || !body.size || !other.body?.size) continue;
      const score = jaccard(body, other.body);
      if (score > worstBody.score) worstBody = { id: other.id, score };
    }
    stats.content_overlap = Number(worstBody.score.toFixed(3));
    if (worstBody.score >= OVERLAP_THRESHOLDS.high) E(`content overlap ${worstBody.score.toFixed(2)} with ${worstBody.id}: rewrite the shared passages in your own words and link to the reference guide (HIGH in the SEO matrix)`);
    else if (worstBody.score >= OVERLAP_THRESHOLDS.medium) W(`content overlap ${worstBody.score.toFixed(2)} with ${worstBody.id}: repeated passages, prefer a sentence of your own plus a link (MEDIUM in the SEO matrix)`);

    stats.score = Math.max(0, 100 - errors.length * 10 - warnings.length * 2);
    return { errors, warnings, stats };
  }

  return { validateArticle, model, config, topics };
}

export async function checkSourcesOnline(draft, registry) {
  const urls = (draft.sources || []).map((s) => (typeof s === 'string' ? registry.get(s)?.url : s.url)).filter(Boolean);
  const problems = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'pt.rentbikehanoi.com source check' } });
      if (res.status >= 400) problems.push(`${url} → HTTP ${res.status}`);
    } catch (e) {
      problems.push(`${url} → ${e.name === 'TimeoutError' ? 'timeout' : e.message}`);
    }
  }
  return problems;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const args = process.argv.slice(2);
  const online = args.includes('--online');
  const { validateArticle, model } = createValidator();
  let files = args.filter((a) => !a.startsWith('--'));
  let allowPublished = false;
  if (args.includes('--published')) {
    files = model.state.published_ids.map((id) => `content/articles/${id}.json`);
    allowPublished = true;
  } else if (!files.length) {
    files = [...listFiles('_factory/inbox', '.json').map((f) => `_factory/inbox/${f}`), ...listFiles('_factory/review', '.json').filter((f) => !f.endsWith('.qa.json')).map((f) => `_factory/review/${f}`)];
  }
  let failed = 0;
  for (const file of files) {
    let draft;
    try {
      draft = JSON.parse(fs.readFileSync(rel(file), 'utf8'));
    } catch (e) {
      console.error(`✗ ${file}: invalid JSON (${e.message})`);
      failed++;
      continue;
    }
    const r = validateArticle(draft, { file, allowPublished });
    if (online) for (const p of await checkSourcesOnline(draft, model.sources)) r.errors.push(`source not reachable: ${p}`);
    const mark = r.errors.length ? '✗' : '✓';
    console.log(`${mark} ${file}: ${r.errors.length} errors, ${r.warnings.length} warnings ${JSON.stringify(r.stats)}`);
    for (const e of r.errors) console.log(`   ERROR ${e}`);
    for (const w of r.warnings) console.log(`   WARN  ${w}`);
    if (r.errors.length) failed++;
  }
  if (!files.length) console.log('No drafts to validate.');
  process.exit(failed ? 1 : 0);
}
