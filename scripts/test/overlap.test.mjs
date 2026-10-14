// Shared content-overlap scoring (audit, SEO matrix and factory QA use the same numbers).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overlapPairs, riskLevel, shingles, OVERLAP_THRESHOLDS } from '../lib/overlap.mjs';

const generic = 'Deixe a mota num parque com funcionário, pergunte o preço e fotografe o talão; no passeio arrisca uma coima de 400 mil a 600 mil VND ao abrigo do Decreto 168/2024. Guarde o talão e fotografe-o junto com a mota e a placa com o nome da rua. Use o bloqueio da direção e leve consigo os objetos de valor.';

test('two pages that repeat the same passages are a HIGH pair; distinct pages are not listed', () => {
  const pairs = overlapPairs([
    { key: '/a/', keyword: 'templo da literatura', title: 'Templo da Literatura de mota', h1: 'Templo', text: `O templo abre às 08:00. ${generic} ${generic}` },
    { key: '/b/', keyword: 'cidadela imperial', title: 'Cidadela Imperial de mota', h1: 'Cidadela', text: `A cidadela fecha às 17:00. ${generic} ${generic}` },
    { key: '/c/', keyword: 'honda wave', title: 'Honda Wave em Hanói', h1: 'Wave', text: 'A Wave tem mudanças de pé e consumo baixo segundo a Honda; o depósito leva cerca de quatro litros.' }
  ]);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].level, 'HIGH');
  assert.ok(pairs[0].overlap >= OVERLAP_THRESHOLDS.high);
});

test('risk levels follow the shared thresholds', () => {
  assert.equal(riskLevel({ sameKeyword: false, intent: 0, overlap: OVERLAP_THRESHOLDS.high }), 'HIGH');
  assert.equal(riskLevel({ sameKeyword: false, intent: 0, overlap: OVERLAP_THRESHOLDS.medium }), 'MEDIUM');
  assert.equal(riskLevel({ sameKeyword: false, intent: 0, overlap: 0.05 }), 'LOW');
  assert.equal(riskLevel({ sameKeyword: true, intent: 0, overlap: 0 }), 'HIGH');
});

test('shingles are 3-word windows of the normalized text', () => {
  assert.deepEqual([...shingles('Alugar uma mota em Hanói')], ['alugar uma mota', 'uma mota em', 'mota em hanoi']);
});
