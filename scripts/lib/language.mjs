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
  ['CNH', 'carta de condução'],
  ['Permissão Internacional para Dirigir', 'Licença Internacional de Condução'],
  ['usuári[oa]s?', 'utilizador'],
  ['registro', 'registo'],
  ['registrar', 'registar'],
  ['cadastr(?:o|os|ar|ado|ada)', 'registo / registar'],
  ['equipe', 'equipa'],
  ['contatos?', 'contacto'],
  ['de fato', 'de facto'],
  ['café da manhã', 'pequeno-almoço'],
  ['banheiro', 'casa de banho'],
  ['geladeira', 'frigorífico'],
  ['sorvete', 'gelado'],
  ['suco', 'sumo'],
  ['pedágios?', 'portagem'],
  ['caminhão', 'camião'],
  ['caminhões', 'camiões'],
  ['freios?', 'travão / travões'],
  ['acostamento', 'berma'],
  ['faixa de pedestres', 'passadeira'],
  ['pedestres?', 'peão / peões'],
  ['carona', 'boleia'],
  ['metrô', 'metro'],
  ['bonde', 'elétrico'],
  ['locadoras?', 'empresa de aluguer'],
  ['seções', 'secções'],
  ['seção', 'secção'],
  ['recepção', 'receção'],
  ['econômic[oa]s?', 'económico'],
  ['eletrônic[oa]s?', 'eletrónico'],
  ['telefônic[oa]s?', 'telefónico'],
  ['cômod[oa]s?', 'cómodo'],
  ['fenômenos?', 'fenómeno'],
  ['quilômetros?', 'quilómetro'],
  ['gêneros?', 'género'],
  ['prêmios?', 'prémio'],
  ['bebês?', 'bebé'],
  ['tênis', 'ténis'],
  ['vietnã', 'Vietname'],
  ['planejar', 'planear'],
  ['planejamento', 'planeamento'],
  ['esportes?', 'desporto'],
  ['xícara', 'chávena'],
  ['a gente', 'nós'],
  ['dirigir', 'conduzir']
].map(([term, pt]) => ({ re: B(term), term, pt }));

// Valid but less natural in Portugal, or exonyms with a pt-PT form: warnings only.
const PT_STYLE = [
  ['motos?', 'mota(s)'],
  ['rodovias?', 'estrada / autoestrada'],
  ['posto de gasolina', 'bomba de gasolina'],
  ['(?:a|as|uma|da|das|na|nas|por)\\s+diárias?', 'preço por dia'],
  ['aspecto', 'aspeto'],
  ['Vietnam', 'Vietname'],
  ['Hanoi', 'Hanói']
].map(([term, pt]) => ({ re: B(term), term, pt }));

// Progressive with gerund ("está fazendo") is typical of Brazil; Portugal uses "está a fazer".
const GERUND = /(?<![\p{L}])(estou|está|estás|estamos|estão|estava|estavam|ficar|fica|ficam|continua|continuam|anda|andam)\s+(\p{L}+ndo)(?![\p{L}])/giu;

const context = (text, index, len) => text.slice(Math.max(0, index - 40), index + len + 40).replace(/\s+/g, ' ').trim();

function scan(list, text, level) {
  const hits = [];
  for (const { re, term, pt } of list) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) hits.push({ term: m[0], pt, level, rule: term, context: context(text, m.index, m[0].length) });
  }
  return hits;
}

export function findBrazilianisms(text) {
  const hits = scan(BRAZILIANISMS, text, 'error');
  GERUND.lastIndex = 0;
  let g;
  while ((g = GERUND.exec(text))) {
    if (/^(quando|onde|mundo|segundo|fundo|redondo)$/i.test(g[2])) continue;
    hits.push({ term: g[0], pt: `${g[1]} a + infinitivo`, level: 'warning', context: context(text, g.index, g[0].length) });
  }
  return hits;
}

export const findStyleIssues = (text) => scan(PT_STYLE, text, 'warning');

// Signs of copied or machine-translated text: Spanish words (the /spanish site), English sentences
// and Portuguese written without diacritics.
// Hyphens are excluded around the match so Portuguese clitics ("encontrá-los", "vê-las") are not Spanish.
const W = (term) => new RegExp(`(?<![\\p{L}-])${term}(?![\\p{L}-])`, 'giu');
const SPANISH = ['alquiler(?:es)?', 'usted(?:es)?', 'también', 'precios?', 'fianza', 'carné', 'carnet', 'conducir', 'ciudad', 'calle', 'barrio', 'aeropuerto', 'hoy', 'mañana', 'lluvia', 'llev(?:ar|a|an)', 'lleg(?:ar|a|an)', 'vehículos?', 'gasolinera', 'permiso de conducir', 'los', 'las', 'del', 'pero', 'muy'].map((t) => ({ re: W(t), term: t, pt: 'texto em espanhol' }));
const NO_ACCENTS = ['nao', 'voce', 'tambem', 'informacao', 'informacoes', 'condicao', 'condicoes', 'preco', 'precos', 'possivel', 'disponivel', 'proxim[oa]s?', 'numeros?', 'transito', 'policia', 'veiculos?', 'seguranca', 'documentacao', 'caucao', 'licenca', 'conducao', 'servicos?', 'horarios?', 'entao', 'alem', 'tres', 'mes', 'ja', 'ate'].map((t) => ({ re: B(t), term: t, pt: 'palavra sem acentos' }));
const ENGLISH = new Set('the and with your you for this that from are is of to will can our'.split(' '));

export function findForeignText(text) {
  const out = { spanish: scan(SPANISH, text, 'warning'), noAccents: scan(NO_ACCENTS, text, 'warning'), english: [] };
  if (/[¿¡]/.test(text)) out.spanish.push({ term: '¿/¡', pt: 'pontuação espanhola', level: 'warning', context: context(text, text.search(/[¿¡]/), 1) });
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
    const words = sentence.toLowerCase().match(/\p{L}+/gu) || [];
    const english = new Set(words.filter((w) => ENGLISH.has(w)));
    if (english.size >= 3) out.english.push({ term: [...english].join(' '), pt: 'frase em inglês', level: 'warning', context: sentence.slice(0, 120) });
  }
  return out;
}

// Readability: very long sentences are hard to read on a phone and often come from translation.
export function readability(text) {
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => /\p{L}/u.test(s));
  const lengths = sentences.map((s) => (s.match(/[\p{L}\p{N}]+/gu) || []).length);
  const words = lengths.reduce((a, b) => a + b, 0);
  const youCount = (text.match(B('você')) || []).length;
  return {
    sentences: sentences.length,
    avg: sentences.length ? Number((words / sentences.length).toFixed(1)) : 0,
    long: sentences.filter((s, i) => lengths[i] > 50).map((s) => s.slice(0, 100)),
    voce_per_1000: words ? Number(((youCount / words) * 1000).toFixed(1)) : 0
  };
}

// Claims the business has NOT confirmed (free delivery, no deposit, no licence — including 50 cc —,
// 24/7, ratings, insurance included, guaranteed prices). Ignored when the sentence is a question,
// is negated before the match, quotes the claim («…») or talks about the penalty for it.
const CLAIMS = [
  /entregas?\s+(?:é\s+|são\s+)?(?:gratuitas?|grátis|sem\s+custos?)/giu,
  /(?:aluguer|alugar|mota|motas)\s+sem\s+(?:caução|depósito|garantia)/giu,
  /sem\s+(?:carta|licença)\s+de\s+condução/giu,
  /dispensa(?:m)?\s+(?:a\s+)?(?:carta|licença)/giu,
  /n[ãa]o\s+(?:é|e)\s+(?:preciso|necessári[oa]|obrigatóri[oa]|exigid[oa])\s+(?:ter\s+|de\s+)?(?:a\s+|uma\s+)?(?:carta|licença)/giu,
  /n[ãa]o\s+(?:precisa|precisam|necessita|necessitam|exige|exigem|requer|requerem)\s+(?:de\s+)?(?:ter\s+)?(?:a\s+|uma\s+)?(?:carta|licença)/giu,
  /(?:50\s?cc|50\s?cm³)[^.?!\n«»"“”]{0,60}?(?<![\p{L}])sem\s+(?:carta|licença)/giu,
  /(?:carta|licença)(?:\s+de\s+condução)?\s+(?:é\s+|está\s+)?(?:dispensad[oa]|desnecessári[oa]|opcional)/giu,
  /24\s*(?:horas|h)\s+por\s+dia|24\s*\/\s*7|aberto\s+24\s*h/giu,
  /melhor(?:es)?\s+preços?|preços?\s+mais\s+baixos?|garantimos|garantid[oa]s?/giu,
  /avaliações|estrelas|★|classificação\s+de\s+\d/giu,
  /seguro\s+(?:está\s+)?incluído|com\s+seguro\s+incluído/giu,
  /disponibilidade\s+imediata|sempre\s+disponíve(?:l|is)/giu
];
const NEGATION = /(?<![\p{L}])(não|nunca|nem|sem\s+garantir|nenhum|nenhuma|evite|cuidado|desconfie|mito|mitos)(?![\p{L}])/iu;
const PENALTY = /(?<![\p{L}])(multa|multas|multar|multado|coimas?|ilegal|proibid[oa]s?|infraç(?:ão|ões)|sanç(?:ão|ões)|apreens\p{L}*|crime|punid\p{L}*)(?![\p{L}])/iu;

function sentenceAround(text, index) {
  const start = Math.max(text.lastIndexOf('.', index), text.lastIndexOf('?', index), text.lastIndexOf('!', index), text.lastIndexOf('\n', index)) + 1;
  const ends = ['.', '?', '!', '\n'].map((c) => text.indexOf(c, index)).filter((i) => i !== -1);
  const end = ends.length ? Math.min(...ends) : text.length;
  return { sentence: text.slice(start, end + 1), before: text.slice(start, index), terminator: text[end] };
}

const insideQuotes = (before) => (before.match(/[«“]/g) || []).length > (before.match(/[»”]/g) || []).length || (before.match(/"/g) || []).length % 2 === 1;

export function findRiskyClaims(text) {
  const hits = [];
  for (const re of CLAIMS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      const { sentence, before, terminator } = sentenceAround(text, m.index);
      if (terminator === '?' || NEGATION.test(before) || insideQuotes(before) || PENALTY.test(sentence)) continue;
      hits.push({ match: m[0], context: context(text, m.index, m[0].length) });
    }
  }
  return hits;
}
