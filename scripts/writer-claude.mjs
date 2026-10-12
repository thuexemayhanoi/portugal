#!/usr/bin/env node
// OPTIONAL Claude writer for the Content Factory — PAID API, OFF BY DEFAULT.
// It only runs when ALL of these are true:
//   1. data/factory-config.json → writer.mode = "claude" (or the workflow variable FACTORY_WRITER=claude);
//   2. the ANTHROPIC_API_KEY secret is available in the environment (never written to disk or logs);
//   3. data/factory-state.json → status = "ACTIVE".
// It drafts the next queued topics into _factory/inbox/ as Writer Contract v1 JSON. Drafts still go
// through scripts/qa-factory.mjs and human approval; nothing is published by this script.
//   node scripts/writer-claude.mjs            → write up to writer.claude.max_articles_per_run drafts
//   node scripts/writer-claude.mjs --dry-run  → print the request plan without calling the API
// The SDK is not a site dependency; CI installs it on demand: npm install --no-save @anthropic-ai/sdk@<pinned>
import fs from 'node:fs';
import { readJSON, writeJSON, rel, todayISO } from './lib/util.mjs';
import { buildTokens } from './lib/text.mjs';

const dryRun = process.argv.includes('--dry-run');
const config = readJSON('data/factory-config.json');
const c = config.writer.claude;
const mode = process.env.FACTORY_WRITER || config.writer.mode;
const modelId = process.env.FACTORY_CLAUDE_MODEL || c.model;
const state = readJSON('data/factory-state.json');

if (mode !== 'claude' && !dryRun) {
  console.log('Claude writer disabled (writer.mode = "external"). Drafts are expected from an external writer.');
  process.exit(0);
}
if (state.status !== 'ACTIVE' && !dryRun) {
  console.log(`Factory is ${state.status}: no drafts written.`);
  process.exit(0);
}
if (!modelId && !dryRun) {
  console.log('FACTORY_CLAUDE_MODEL is not set: choose the model in the repository variables before enabling the writer.');
  process.exit(0);
}
if (!process.env.ANTHROPIC_API_KEY && !dryRun) {
  console.log('ANTHROPIC_API_KEY is not configured: skipping the paid writer (no request sent).');
  process.exit(0);
}

const queue = readJSON('data/writer-queue.json');
const data = readJSON('site/data.json');
const tokens = buildTokens(data);
const registry = readJSON('site/sources.json').sources;
const contract = fs.readFileSync(rel('factory/WRITER-CONTRACT.md'), 'utf8').replace(/^> \*\*Tóm tắt[\s\S]*?\n\n/m, '');

// Structured-output schema: the factory sets id, slug, version, writer and status itself.
const schema = readJSON('factory/article.schema.json');
const FACTORY_FIELDS = ['contract_version', 'id', 'slug', 'writer', 'status'];
const modelSchema = {
  type: 'object',
  additionalProperties: false,
  required: schema.required.filter((k) => !FACTORY_FIELDS.includes(k)),
  properties: Object.fromEntries(Object.entries(schema.properties).filter(([k]) => !FACTORY_FIELDS.includes(k)))
};

// Stable system prompt (cached across the run): contract, current token values and the source registry.
const SYSTEM = [
  'És um redator profissional de português de Portugal que escreve guias práticos para o site pt.rentbikehanoi.com, da loja de aluguer de motas Cho Thuê Xe Máy Nguyễn Tú, em Hanói.',
  'Escreve para viajantes e residentes lusófonos. O texto tem de ser útil, exato, original e verificável — nunca uma tradução de outro site.',
  'Segue rigorosamente o contrato abaixo. Responde apenas com o objeto JSON pedido.',
  '',
  '# Contrato do escritor',
  contract,
  '',
  '# Valores atuais dos tokens (usa os tokens, nunca os valores)',
  ...Object.entries(tokens).map(([k, v]) => `- {{${k}}} = ${v}`),
  '',
  '# Registo de fontes (podes citar pelo id)',
  ...registry.map((s) => `- ${s.id}: ${s.title} — ${s.publisher} (${s.url}). Apoia: ${s.supports}`)
].join('\n');

const userPrompt = (item) =>
  [
    `Data de hoje: ${todayISO()}.`,
    'Escreve o rascunho completo deste tema da fila. Respeita o ângulo do content_brief, o intervalo target_words e as fontes mínimas.',
    c.web_search ? 'Usa a pesquisa na web para confirmar cada regra legal, preço oficial ou facto sensível ao tempo e cita apenas URLs que viste.' : 'Cita apenas fontes do registo ou URLs oficiais que conheces com segurança.',
    'Ligações internas: usa apenas URLs desta lista de páginas publicadas:',
    ...queue.live_pages.map((p) => `- ${p.url} (${p.title})`),
    '',
    'Tema:',
    JSON.stringify(item, null, 2)
  ].join('\n');

const items = queue.items
  .filter((i) => !['inbox', 'review'].some((d) => fs.existsSync(rel(`_factory/${d}/${i.id}.json`))))
  .slice(0, c.max_articles_per_run);

if (!items.length) {
  console.log('Writer queue is empty (or every queued topic already has a draft).');
  process.exit(0);
}

const baseParams = {
  model: modelId,
  max_tokens: c.max_tokens,
  // Refusal fallback (server-side, routed by refusal category) — recommended for this model.
  betas: ['server-side-fallback-2026-07-01'],
  fallbacks: 'default',
  output_config: { effort: c.effort, format: { type: 'json_schema', schema: modelSchema } },
  system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
  ...(c.web_search ? { tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: c.web_search_max_uses }] } : {})
};

if (dryRun) {
  console.log(`DRY RUN — model ${modelId || '(FACTORY_CLAUDE_MODEL not set)'}, effort ${c.effort}, max_tokens ${c.max_tokens}, web_search ${Boolean(c.web_search)}`);
  console.log(`System prompt: ${SYSTEM.length} characters · schema fields: ${modelSchema.required.join(', ')}`);
  for (const item of items) console.log(`would draft ${item.id} → _factory/inbox/${item.id}.json (${item.working_title})`);
  process.exit(0);
}

let Anthropic;
try {
  ({ default: Anthropic } = await import('@anthropic-ai/sdk'));
} catch {
  console.error(`The Anthropic SDK is not installed. Run: npm install --no-save ${c.sdk_package}`);
  process.exit(1);
}

const client = new Anthropic({ maxRetries: 3 }); // reads ANTHROPIC_API_KEY from the environment
let failures = 0;

for (const item of items) {
  let messages = [{ role: 'user', content: userPrompt(item) }];
  let message;
  try {
    // Server-side tools (web search) can pause a long turn; resume by sending the paused turn back.
    for (let turn = 0; turn < 5; turn++) {
      const stream = client.beta.messages.stream({ ...baseParams, messages });
      message = await stream.finalMessage();
      if (message.stop_reason !== 'pause_turn') break;
      messages = [...messages, { role: 'assistant', content: message.content }];
    }
  } catch (err) {
    failures++;
    if (err instanceof Anthropic.AuthenticationError) {
      console.error('Authentication failed: check the ANTHROPIC_API_KEY secret. Stopping.');
      break;
    } else if (err instanceof Anthropic.RateLimitError) {
      console.error(`${item.id}: rate limited after retries; try again later.`);
      break;
    } else if (err instanceof Anthropic.APIConnectionError) {
      console.error(`${item.id}: network error (${err.message}).`);
    } else if (err instanceof Anthropic.APIError) {
      console.error(`${item.id}: API error ${err.status} ${err.type || ''}: ${err.message}`);
    } else {
      console.error(`${item.id}: ${err.message}`);
    }
    continue;
  }

  const usage = message.usage || {};
  console.log(`${item.id}: stop_reason=${message.stop_reason} input=${usage.input_tokens} output=${usage.output_tokens} cache_read=${usage.cache_read_input_tokens || 0}`);
  if (message.stop_reason === 'refusal') {
    failures++;
    console.error(`${item.id}: declined (${message.stop_details?.category ?? 'no category'}); no draft written.`);
    continue;
  }
  if (message.stop_reason === 'max_tokens') {
    failures++;
    console.error(`${item.id}: output truncated at max_tokens; no draft written.`);
    continue;
  }
  const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  let draft;
  try {
    draft = JSON.parse(text);
  } catch (e) {
    failures++;
    console.error(`${item.id}: response is not valid JSON (${e.message}).`);
    continue;
  }
  writeJSON(`_factory/inbox/${item.id}.json`, {
    contract_version: config.contract_version,
    id: item.id,
    slug: item.slug,
    ...draft,
    writer: { type: 'claude', name: 'Claude (API)' },
    status: 'READY_FOR_QA'
  });
  console.log(`${item.id}: draft written to _factory/inbox/${item.id}.json`);
}

process.exit(failures && failures === items.length ? 1 : 0);
