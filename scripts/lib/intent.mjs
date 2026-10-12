// Search-intent fingerprints shared by the plan (topic cannibalization) and the article QA
// (a new draft must not answer the same query as a page that is already live).
import { normalize } from './util.mjs';

const GENERIC = new Set(
  'a o e de da do das dos em no na nos nas um uma para por com ou os as ao aos que se como mais qual quais quanto quando onde porque deve devo pode posso vs aluguer alugar alugada alugado mota motas moto hanoi vietname vietnamita vietnam cidade guia'.split(' ')
);

// Distinctive keyword tokens: generic words removed, "50 cc" kept as one token, simple plural folding.
export function intentTokens(text) {
  const t = normalize(text).replace(/\b(\d+)\s+cc\b/g, '$1cc').split(' ');
  return new Set(t.filter((w) => w && !GENERIC.has(w)).map((w) => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w)));
}

export const jaccard = (a, b) => {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
};

// Fingerprint of what a page answers: primary keyword + title + H1.
export const intentFingerprint = ({ primaryKeyword = '', title = '', h1 = '' }) => intentTokens(`${primaryKeyword} ${title} ${h1}`);
