// Unit tests: node --test scripts/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, slugify, formatVND, formatDatePT, isCleanUrl, wordCount, esc } from '../lib/util.mjs';
import { buildTokens, inline, plain } from '../lib/text.mjs';
import { findBrazilianisms, findRiskyClaims } from '../lib/language.mjs';
import { readJSON } from '../lib/util.mjs';

const data = readJSON('site/data.json');
const ctx = (links = []) => ({ tokens: buildTokens(data), where: 'test', onInternalLink: (h) => links.push(h) });

test('normalize removes Portuguese and Vietnamese diacritics', () => {
  assert.equal(normalize('Caução Hà Nội Đồng Xuân'), 'caucao ha noi dong xuan');
  assert.equal(slugify('Guia de Aluguer: Documentação & Caução'), 'guia-de-aluguer-documentacao-caucao');
});

test('formatVND formats numbers, ranges and missing values', () => {
  assert.equal(formatVND(150000), '150.000 VND');
  assert.equal(formatVND([900000, 1200000]), '900.000–1.200.000 VND');
  assert.equal(formatVND(null), 'Sob consulta');
});

test('formatDatePT and URL rules', () => {
  assert.equal(formatDatePT('2026-10-12'), '12 de outubro de 2026');
  assert.ok(isCleanUrl('/precos/aluguer-mensal-de-mota/'));
  assert.ok(!isCleanUrl('/Precos/'));
  assert.ok(!isCleanUrl('/precos'));
  assert.ok(!isCleanUrl('/preços/'));
  assert.equal(wordCount('Alugar uma mota em Hanói, 150.000 VND por dia.'), 9);
});

test('tokens come from site/data.json (single source of truth)', () => {
  const t = buildTokens(data);
  assert.equal(t.phone, data.business.phone.display);
  assert.equal(t.address, data.business.address.display);
  assert.equal(t['address.vi'], data.business.address.full);
  assert.equal(t.tel, 'tel:+84942467674');
  const vision = data.pricing.models.find((m) => m.id === 'vision');
  assert.equal(t['price.vision.day'], formatVND(vision.day));
  assert.throws(() => plain('{{price.inexistente.day}}', ctx()), /Unknown token/);
});

test('price conclusions are computed: weekFrom token and duration-compare follow the table', async () => {
  const { durationCompare } = await import('../lib/components.mjs');
  const vision = data.pricing.models.find((m) => m.id === 'vision');
  const n = Math.ceil(vision.week / vision.day);
  const t = buildTokens(data);
  assert.equal(t['price.vision.weekFrom'], ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete'][n]);
  assert.ok(!('price.bicicleta.weekFrom' in t), 'no token without day and week prices');
  // A weekly rate that no longer pays off within 7 days makes any text using the token fail.
  const dear = structuredClone(data);
  dear.pricing.models.find((m) => m.id === 'vision').week = vision.day * 8;
  const dctx = { tokens: buildTokens(dear), where: 'test' };
  assert.throws(() => plain('A semana compensa a partir de {{price.vision.weekFrom}} dias.', dctx), /no longer pays off/);
  const html = durationCompare({ pricing: data.pricing, ui: data.ui });
  assert.match(html, new RegExp(`${n} dias`));
  assert.match(html, /Sem tarifa semanal publicada/);
  assert.match(durationCompare({ pricing: dear.pricing, ui: data.ui }), /Não compensa em sete dias/);
  // Price comparisons between models follow the table; unknown prices cannot be compared.
  const click = data.pricing.models.find((m) => m.id === 'click');
  const expected = click.day < vision.day ? 'menos do que' : click.day === vision.day ? 'o mesmo que' : 'mais do que';
  assert.equal(plain('{{cmp.click.vision.day}}', ctx()), expected);
  assert.throws(() => plain('{{cmp.click.bicicleta.day}}', ctx()), /cannot be compared/);
});

test('inline markup escapes HTML and validates links', () => {
  const links = [];
  const html = inline('<script>x</script> **forte** [Preços](/precos/) [IMT](https://www.imt-ip.pt/) [Ligar]({{tel}})', ctx(links));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('<strong>forte</strong>'));
  assert.ok(html.includes('<a href="/precos/">Preços</a>'));
  assert.ok(html.includes('rel="noopener noreferrer" target="_blank"'));
  assert.ok(html.includes(`href="${data.business.phone.tel}"`));
  assert.deepEqual(links, ['/precos/']);
  assert.throws(() => inline('[x](http://inseguro.example/)', ctx()), /Unsupported link/);
  assert.equal(esc('"a" & <b>'), '&quot;a&quot; &amp; &lt;b&gt;');
});

test('pt-BR vocabulary is detected, pt-PT is not', () => {
  const hits = findBrazilianisms('O aluguel da moto inclui ônibus e celular. Está chovendo.');
  const terms = hits.map((h) => h.term.toLowerCase());
  assert.ok(terms.includes('aluguel'));
  assert.ok(terms.includes('ônibus'));
  assert.ok(terms.includes('celular'));
  assert.ok(terms.some((t) => t.includes('chovendo')));
  assert.equal(findBrazilianisms('O aluguer da mota, o autocarro e o telemóvel. Está a chover.').length, 0);
});

test('unverified business claims are flagged unless negated or asked', () => {
  assert.equal(findRiskyClaims('Oferecemos entrega gratuita em toda a cidade.').length, 1);
  assert.equal(findRiskyClaims('Aluguer sem caução para todos.').length, 1);
  assert.equal(findRiskyClaims('Não assuma que a entrega é gratuita.').length, 0);
  assert.equal(findRiskyClaims('Uma mota de 50 cc dispensa carta de condução?').length, 0);
  assert.equal(findRiskyClaims('Aberto 24 horas por dia.').length, 1);
});

test('LocalBusiness schema follows the official NAP rules', async () => {
  const { businessNode } = await import('../lib/schema.mjs');
  const { businessProblems } = await import('../lib/nap.mjs');
  const b = data.business;
  const node = businessNode({ data });
  assert.deepEqual(businessProblems(node, b), []);
  assert.equal(node.telephone, '+84942467674');
  assert.equal(node.address.streetAddress, '112 Nguyễn Văn Cừ');
  assert.ok(node.alternateName.includes('Thuê xe máy ở Hà Nội - Nguyễn Tú'));
  const broken = {
    ...node,
    telephone: '+84 942 467 674',
    sameAs: [...node.sameAs, 'https://www.facebook.com/exemplo/'],
    address: { ...node.address, postalCode: '100000' },
    openingHoursSpecification: [{ ...node.openingHoursSpecification[0], dayOfWeek: ['Monday'] }],
    email: 'loja@example.com'
  };
  const problems = businessProblems(broken, b).join('\n');
  for (const expected of ['telephone', 'sameAs', 'postalCode', 'openingHoursSpecification', '"email"']) assert.match(problems, new RegExp(expected));
});

test('licence claims (including 50 cc) are flagged; warnings about fines and quoted myths are not', async () => {
  const { findRiskyClaims } = await import('../lib/language.mjs');
  for (const s of ['Pode alugar uma 50 cc sem carta.', 'A scooter de 50 cc não precisa de carta.', 'Para as 50 cc a carta é dispensada.', 'Não é obrigatória carta para 50 cc.']) {
    assert.equal(findRiskyClaims(s).length, 1, s);
  }
  for (const s of ['Conduzir sem carta de condução é ilegal e dá multa.', 'É comum ler que «não é preciso carta para uma 50 cc». Não use essa frase como regra.', 'Precisa de carta para uma 50 cc?']) {
    assert.deepEqual(findRiskyClaims(s), [], s);
  }
});

test('copied or machine-translated text is detected (Spanish, English, missing accents)', async () => {
  const { findForeignText, findStyleIssues } = await import('../lib/language.mjs');
  const f = findForeignText('Para encontrá-los e vê-las, use o mapa. El alquiler en la ciudad es muy barato. Nao e possivel alugar sem documentacao. This is the best rental for you.');
  assert.deepEqual(f.spanish.map((h) => h.term), ['alquiler', 'ciudad', 'muy']);
  assert.deepEqual(f.noAccents.map((h) => h.term), ['Nao', 'possivel', 'documentacao']);
  assert.equal(f.english.length, 1);
  assert.deepEqual(findForeignText('Leve o passaporte e a carta de condução; a loja confirma tudo antes do aluguer.'), { spanish: [], noAccents: [], english: [] });
  assert.deepEqual(findStyleIssues('Alugar uma moto em Hanoi, no Vietnam; a utilização diária é simples.').map((h) => h.term), ['moto', 'Vietnam', 'Hanoi']);
});
