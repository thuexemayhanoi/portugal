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
  assert.equal(t.address, data.business.address.full);
  const vision = data.pricing.models.find((m) => m.id === 'vision');
  assert.equal(t['price.vision.day'], formatVND(vision.day));
  assert.throws(() => plain('{{price.inexistente.day}}', ctx()), /Unknown token/);
});

test('inline markup escapes HTML and validates links', () => {
  const links = [];
  const html = inline('<script>x</script> **forte** [Preços](/precos/) [IMT](https://www.imt-ip.pt/) [Ligar]({{tel}})', ctx(links));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('<strong>forte</strong>'));
  assert.ok(html.includes('<a href="/precos/">Preços</a>'));
  assert.ok(html.includes('rel="noopener noreferrer" target="_blank"'));
  assert.ok(html.includes(`href="tel:${data.business.phone.e164}"`));
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
