// Measurement analysis (Search Console / Bing) on synthetic data: no network, no real account.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readJSON } from '../lib/util.mjs';
import { signJwt, analyse, bingRows, urlMapper } from '../lib/seo-data.mjs';

const plan = readJSON('data/editorial-plan.json');
const taxonomy = readJSON('site/taxonomy.json');
const base = 'https://pt.rentbikehanoi.com';

test('service-account JWT is signed with RS256 and carries the Search Console scope', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const jwt = signJwt({ client_email: 'monitor@example.iam.gserviceaccount.com', private_key: pem.replace(/\n/g, '\\n') }, 'https://www.googleapis.com/auth/webmasters.readonly', 1_800_000_000);
  const [h, c, s] = jwt.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(h, 'base64url')), { alg: 'RS256', typ: 'JWT' });
  const claims = JSON.parse(Buffer.from(c, 'base64url'));
  assert.equal(claims.aud, 'https://oauth2.googleapis.com/token');
  assert.equal(claims.exp - claims.iat, 3600);
  assert.ok(crypto.createVerify('RSA-SHA256').update(`${h}.${c}`).verify(publicKey, Buffer.from(s, 'base64url')));
});

test('URLs are grouped by taxonomy and planned topic', () => {
  const map = urlMapper({ plan, taxonomy, base });
  assert.equal(map(`${base}/tipos-de-motas/honda-vision-em-hanoi/`).id, 'PT-0001');
  assert.match(map(`${base}/tipos-de-motas/honda-vision-em-hanoi/`).group, /^tipos-de-motas\//);
  assert.equal(map(`${base}/contactos/`).group, 'loja');
});

test('maintenance queue: low CTR, striking distance, declining, cannibalization, not indexed, planned demand', () => {
  const vision = `${base}/tipos-de-motas/honda-vision-em-hanoi/`;
  const scooters = `${base}/tipos-de-motas/scooters/`;
  const day = `${base}/precos/aluguer-de-mota-por-um-dia/`;
  // A topic that is still planned (whatever has been published since): its query is planned demand.
  const openPlan = structuredClone(plan);
  const weekly = openPlan.topics.find((t) => t.id === 'PT-0067');
  weekly.editorial_qa_status = 'PLANNED';
  const rows = [
    { query: 'honda vision hanói', page: vision, clicks: 2, impressions: 400, ctr: 0.005, position: 2.1 },
    { query: 'alugar scooter hanói', page: vision, clicks: 3, impressions: 120, ctr: 0.025, position: 7.4 },
    { query: 'alugar scooter hanói', page: scooters, clicks: 4, impressions: 100, ctr: 0.04, position: 6.2 },
    { query: 'mota por um dia hanói', page: day, clicks: 5, impressions: 90, ctr: 0.05, position: 3 },
    { query: weekly.primary_keyword, page: day, clicks: 0, impressions: 60, ctr: 0, position: 18 }
  ];
  const prevRows = [{ query: 'mota por um dia hanói', page: day, clicks: 40, impressions: 300, ctr: 0.13, position: 2.5 }];
  const inspections = [{ url: scooters, indexStatusResult: { verdict: 'NEUTRAL', coverageState: 'Discovered - currently not indexed' } }];
  const r = analyse({ rows, prevRows, plan: openPlan, taxonomy, base, inspections, sitemapUrls: [vision, scooters, day, `${base}/tipos-de-motas/`, `${base}/contactos/`] });
  const types = (t) => r.maintenance.filter((m) => m.type === t).map((m) => m.url);
  assert.deepEqual(types('LOW_CTR'), [vision]);
  assert.ok(types('STRIKING_DISTANCE').includes(vision));
  assert.deepEqual(types('DECLINING'), [day]);
  assert.equal(r.cannibalization[0].query, 'alugar scooter hanói');
  assert.deepEqual(types('NOT_INDEXED'), [scooters]);
  assert.deepEqual(types('NO_IMPRESSIONS'), [`${base}/tipos-de-motas/`], 'shop pages such as /contactos/ are not expected to rank');
  assert.equal(r.opportunities.find((o) => o.query === weekly.primary_keyword).topic, 'PT-0067');
  assert.ok(!r.opportunities.some((o) => o.query === 'honda vision hanói'), 'a query already answered by a published article is not an opportunity');
  assert.equal(r.totals.impressions, 770);
  assert.ok(r.groups.some((g) => g.group.startsWith('tipos-de-motas/')));
});

test('Bing rows are parsed and limited to the period', () => {
  const now = Date.parse('2026-10-12T00:00:00Z');
  const rows = bingRows([{ Query: 'aluguer mota hanoi', Clicks: 3, Impressions: 40, AvgImpressionPosition: 6.5, Date: `/Date(${now - 5 * 86400000})/` }, { Query: 'antigo', Clicks: 1, Impressions: 9, Date: `/Date(${now - 90 * 86400000})/` }], 28, now);
  assert.deepEqual(rows.map((r) => r.key), ['aluguer mota hanoi']);
  assert.equal(rows[0].position, 6.5);
});
