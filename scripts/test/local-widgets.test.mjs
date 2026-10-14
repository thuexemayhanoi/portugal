import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import '../../src/js/assistant.js';
import '../../src/js/pt-assistant-adapter.js';

const data = JSON.parse(fs.readFileSync('site/data.json', 'utf8'));
const searchData = JSON.parse(fs.readFileSync('assets/chat/search-index.json', 'utf8'));
const { Engine, SiteSearch } = globalThis.MotorbikeAssistant;
const models = Object.fromEntries(data.pricing.models.map(m => [
  m.id === 'eletrica' ? 'electric' : m.id, m
]));
const business = {
  phone: data.business.phone.local,
  phoneTel: data.business.phone.e164,
  address: data.business.address.display,
  mapsUrl: data.business.maps,
  timezone: data.business.hours.timezone,
  hoursText: data.business.hours.short,
  zaloUrl: data.business.zalo.url
};
function engine(){ return new Engine({BUSINESS:business,PRICES:models}); }
test('the original local engine remains available with memory and search', () => {
  assert.equal(typeof Engine.prototype.reset, 'function');
  assert.equal(typeof Engine.prototype.reply, 'function');
  assert.equal(typeof SiteSearch.prototype.load, 'function');
  assert.equal(typeof SiteSearch.prototype.search, 'function');
  assert.equal(typeof Engine.prototype.totalText, 'function');
});
test('Portuguese rental prices and conversational follow-up use owner data', () => {
  const e=engine();
  const daily=e.reply('Quanto custa a Honda Vision por dia?');
  assert.match(daily,/200[.,]000/);
  const weekly=e.reply('E por semana?');
  assert.match(weekly,/1[.,]000[.,]000/);
  assert.equal(e.state.model, 'vision');
});
test('electric rental remains on request, never invented as free or zero', () => {
  const e=engine();
  const reply=e.reply('Qual é o preço da mota elétrica por mês?');
  assert.match(reply,/sob consulta/i);
  assert.doesNotMatch(reply,/0 VND|200[.,]000/);
});
test('verified monthly ranges are never invented as a single price', () => {
  const e=engine();
  const reply=e.reply('Honda Wave por mês');
  assert.match(reply,/900[.,]000/);
  assert.match(reply,/1[.,]200[.,]000/);
});
test('local search index covers published articles with section content', () => {
  assert.equal(searchData.site, data.site.baseUrl);
  assert.equal(searchData.e.filter(x => /^\/tipos-de-motas\/|^\/precos\//.test(x.u)).length>0,true);
  assert.ok(searchData.e.length>=300);
  assert.ok(searchData.e.some(x => x.s.some(s => s.p.length>0)));
  const idx=new SiteSearch();idx.data=searchData;
  assert.ok(idx.search('carta de condução'));
});
test('no bottom contact dock; both separate accessible floating controls exist', () => {
  const page=fs.readFileSync('index.html','utf8');
  assert.match(page,/id="quick-contact"/);
  assert.match(page,/id="chat-fab"/);
  assert.match(page,/id="chat-panel" hidden/);
  assert.doesNotMatch(page,/class="float-contact"/);
  assert.match(page,/assets\/js\/assistant\.js/);
  assert.match(page,/assets\/js\/pt-assistant-adapter\.js/);
  assert.match(page,/assets\/js\/floating\.js/);
  assert.doesNotMatch(page,/href="https:\/\/wa\.me\//);
});
