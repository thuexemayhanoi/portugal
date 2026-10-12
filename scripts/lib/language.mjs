// Language and claims heuristics shared by the site audit and the article QA.
// They flag text for human review; they do not replace an editor fluent in European Portuguese.

const B = (term) => new RegExp(`(?<![\\p{L}])${term}(?![\\p{L}])`, 'giu');

// pt-BR → pt-PT (only unambiguous cases; "habilitação", "motorista" and "você" are valid in Portugal).
const BRAZILIANISMS = [
  ['aluguel', 'aluguer'],
  ['aluguéis', 'alugueres'],
  ['ônibus', 'autocarro'],
  ['onibus', 'autocarro'],
  ['celular(?:es)?', 'telemóvel'],
  ['trem', 'comboio'],
  ['trens', 'comboios'],
  ['carteira de motorista', 'carta de condução'],
  ['carteira de habilitação', 'carta de condução'],
  ['usuári[oa]s?', 'utilizador'],
  ['registro', 'registo'],
  ['registrar', 'registar'],
  ['equipe', 'equipa'],
  ['contatos?', 'contacto'],
  ['café da manhã', 'pequeno-almoço'],
  ['banheiro', 'casa de banho'],
  ['geladeira', 'frigorífico'],
  ['pedágios?', 'portagem'],
  ['caminhão', 'camião'],
  ['caminhões', 'camiões'],
  ['freios?', 'travão / travões'],
  ['seções', 'secções'],
  ['seção', 'secção'],
  ['recepção', 'receção'],
  ['econômic[oa]s?', 'económico'],
  ['quilômetros?', 'quilómetro'],
  ['vietnã', 'Vietname'],
  ['planejar', 'planear'],
  ['planejamento', 'planeamento'],
  ['esportes?', 'desporto'],
  ['xícara', 'chávena'],
  ['a gente', 'nós'],
  ['dirigir', 'conduzir']
].map(([term, pt]) => ({ re: B(term), term, pt }));

// Progressive with gerund ("está fazendo") is typical of Brazil; Portugal uses "está a fazer".
const GERUND = /(?<![\p{L}])(estou|está|estás|estamos|estão|estava|estavam|ficar|fica|ficam|continua|continuam|anda|andam)\s+(\p{L}+ndo)(?![\p{L}])/giu;

const context = (text, index, len) => text.slice(Math.max(0, index - 40), index + len + 40).replace(/\s+/g, ' ').trim();

export function findBrazilianisms(text) {
  const hits = [];
  for (const { re, term, pt } of BRAZILIANISMS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) hits.push({ term: m[0], pt, context: context(text, m.index, m[0].length) });
  }
  GERUND.lastIndex = 0;
  let g;
  while ((g = GERUND.exec(text))) {
    if (/^(quando|onde|mundo|segundo|fundo|redondo)$/i.test(g[2])) continue;
    hits.push({ term: g[0], pt: `${g[1]} a + infinitivo`, context: context(text, g.index, g[0].length) });
  }
  return hits;
}

// Claims the business has NOT confirmed (free delivery, no deposit, no licence, 24/7, ratings,
// insurance included, guaranteed prices). Negated or interrogative sentences are ignored.
const CLAIMS = [
  /entregas?\s+(?:é\s+|são\s+)?(?:gratuitas?|grátis|sem\s+custos?)/giu,
  /(?:aluguer|alugar|mota|motas)\s+sem\s+(?:caução|depósito|garantia)/giu,
  /sem\s+(?:carta|licença)\s+de\s+condução/giu,
  /dispensa(?:m)?\s+(?:a\s+)?(?:carta|licença)/giu,
  /n[ãa]o\s+(?:é|e)\s+(?:preciso|necessári[oa])\s+(?:ter\s+|de\s+)?(?:carta|licença)/giu,
  /24\s*(?:horas|h)\s+por\s+dia|24\s*\/\s*7|aberto\s+24\s*h/giu,
  /melhor(?:es)?\s+preços?|preços?\s+mais\s+baixos?|garantimos|garantid[oa]s?/giu,
  /avaliações|estrelas|★|classificação\s+de\s+\d/giu,
  /seguro\s+(?:está\s+)?incluído|com\s+seguro\s+incluído/giu,
  /disponibilidade\s+imediata|sempre\s+disponíve(?:l|is)/giu
];
const NEGATION = /(?<![\p{L}])(não|nunca|nem|sem\s+garantir|nenhum|nenhuma|evite|cuidado|desconfie|mito|mitos)(?![\p{L}])/iu;

function sentenceAround(text, index) {
  const start = Math.max(text.lastIndexOf('.', index), text.lastIndexOf('?', index), text.lastIndexOf('!', index), text.lastIndexOf('\n', index)) + 1;
  const ends = ['.', '?', '!', '\n'].map((c) => text.indexOf(c, index)).filter((i) => i !== -1);
  const end = ends.length ? Math.min(...ends) : text.length;
  return { sentence: text.slice(start, end + 1), before: text.slice(start, index), terminator: text[end] };
}

export function findRiskyClaims(text) {
  const hits = [];
  for (const re of CLAIMS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      const { before, terminator } = sentenceAround(text, m.index);
      if (terminator === '?' || NEGATION.test(before)) continue;
      hits.push({ match: m[0], context: context(text, m.index, m[0].length) });
    }
  }
  return hits;
}
