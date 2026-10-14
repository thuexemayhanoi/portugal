// Content overlap between pages (cannibalization signals), shared by scripts/audit-content.mjs and
// scripts/seo-matrix.mjs so both always score the current content the same way:
//   intent  = Jaccard of the intent fingerprints (primary keyword + title + H1)
//   overlap = Jaccard of 3-word shingles of the visible body (sources and links excluded)
import { normalize } from './util.mjs';
import { intentFingerprint, jaccard } from './intent.mjs';

// Body text of an article or draft: summary, intro, key points, sections and FAQ.
export const bodyText = (a, txt) =>
  [a.summary, ...(a.intro || []), ...(a.key_points || []), ...(a.sections || []).flatMap((s) => [s.h2, ...(s.body || []).flatMap((b) => (typeof b === 'string' ? [b] : [b.p, b.h3, b.note, ...(b.ul || []), ...(b.ol || []), ...(b.checklist || []), ...(b.steps || []).flatMap((x) => [x.title, x.text]), ...(b.table ? [b.table.caption, ...(b.table.rows || []).flat()] : [])]))]), ...(a.faq || []).flatMap((f) => [f.q, f.a])]
    .filter((x) => typeof x === 'string')
    .map(txt)
    .join(' ');

// Body text of a base page: lead plus the headings and paragraphs of its sections.
export const pageText = (p, txt) => [p.lead, ...(p.sections || []).flatMap((s) => [s.h2, ...(s.body || []).filter((b) => typeof b === 'string')])].map(txt).join(' ');

export function shingles(text) {
  const w = normalize(text).split(' ').filter(Boolean);
  const s = new Set();
  for (let i = 0; i + 3 <= w.length; i++) s.add(w.slice(i, i + 3).join(' '));
  return s;
}

export const riskLevel = ({ sameKeyword, intent, overlap }) => (sameKeyword || intent >= 0.6 || overlap >= 0.2 ? 'HIGH' : intent >= 0.45 || overlap >= 0.12 ? 'MEDIUM' : 'LOW');

// items: [{ key, keyword, title, h1, text, ...rest }] → pairs worth listing (intent ≥ 0.3, overlap ≥ 0.08
// or the same primary keyword), each with its risk level.
export function overlapPairs(items) {
  const docs = items.map((it) => ({ it, fp: intentFingerprint({ primaryKeyword: it.keyword || '', title: it.title || '', h1: it.h1 || '' }), sh: shingles(it.text || ''), kw: normalize(it.keyword || '') }));
  const pairs = [];
  for (let i = 0; i < docs.length; i++) {
    for (let j = i + 1; j < docs.length; j++) {
      const a = docs[i];
      const b = docs[j];
      const intent = jaccard(a.fp, b.fp);
      const overlap = jaccard(a.sh, b.sh);
      const sameKeyword = Boolean(a.kw) && a.kw === b.kw;
      if (intent >= 0.3 || overlap >= 0.08 || sameKeyword) pairs.push({ a: a.it, b: b.it, intent, overlap, sameKeyword, level: riskLevel({ sameKeyword, intent, overlap }) });
    }
  }
  return pairs;
}
