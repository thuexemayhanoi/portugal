// Content rendering: {{tokens}} from site/data.json, a tiny inline Markdown subset and structured blocks.
// Inline syntax: [text](url) for links and **text** for emphasis. Raw HTML in content is always escaped.
import { esc, slugify, formatVND, formatDatePT, fail } from './util.mjs';

export function buildTokens(data) {
  const b = data.business;
  const models = data.pricing.models;
  const days = models.map((m) => m.day).filter((v) => typeof v === 'number');
  const tokens = {
    name: b.canonicalName,
    display: b.displayName,
    brand: b.brandName,
    gbp: b.gbpName,
    address: b.address.display,
    'address.vi': b.address.full,
    street: b.address.streetAddress,
    area: b.address.areaLabel,
    phone: b.phone.display,
    'phone.local': b.phone.local,
    tel: b.phone.tel,
    hours: b.hours.label,
    'hours.display': b.hours.display,
    opens: b.hours.opens,
    closes: b.hours.closes,
    maps: b.maps,
    zalo: b.zalo.url,
    website: b.website,
    byline: data.editorial.byline,
    year: String(data.site.copyrightYear),
    'pricing.verifiedAt': formatDatePT(data.pricing.verifiedAt),
    'price.min.day': formatVND(Math.min(...days)),
    'price.max.day': formatVND(Math.max(...days))
  };
  for (const m of models) {
    for (const period of ['day', 'week', 'month']) {
      tokens[`price.${m.id}.${period}`] = formatVND(m[period], data.ui.onRequest);
    }
  }
  return tokens;
}

export function resolveTokens(text, ctx, where = '') {
  return String(text).replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key) => {
    if (!(key in ctx.tokens)) fail(`Unknown token {{${key}}}${where ? ` in ${where}` : ''}`);
    return ctx.tokens[key];
  });
}

function linkHtml(label, href, ctx) {
  if (href.startsWith('/')) {
    ctx.onInternalLink?.(href);
    return `<a href="${esc(href)}">${label}</a>`;
  }
  if (href.startsWith('#')) return `<a href="${esc(href)}">${label}</a>`;
  if (/^https:\/\//.test(href)) {
    return `<a href="${esc(href)}" rel="noopener noreferrer" target="_blank">${label}</a>`;
  }
  if (/^(tel|mailto):/.test(href)) return `<a href="${esc(href)}">${label}</a>`;
  fail(`Unsupported link "${href}" in ${ctx.where || 'content'} (use /internal/, https:// or tel:)`);
}

// Escapes everything, then converts the small Markdown subset.
export function inline(text, ctx) {
  const resolved = resolveTokens(text, ctx, ctx.where);
  let html = esc(resolved);
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) =>
    linkHtml(label, href.replace(/&amp;/g, '&'), ctx)
  );
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  if (/\*\*|\]\(/.test(html)) fail(`Unbalanced inline markup in ${ctx.where || 'content'}: ${text.slice(0, 80)}`);
  return html;
}

// Plain text version of an inline string (for meta tags, schema and search).
export function plain(text, ctx) {
  return resolveTokens(text, ctx, ctx.where)
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1');
}

export function headingId(text, ctx) {
  const base = slugify(text) || 'secao';
  let id = base;
  let n = 2;
  while (ctx.usedIds.has(id)) id = `${base}-${n++}`;
  ctx.usedIds.add(id);
  return id;
}

function list(tag, items, ctx) {
  if (!Array.isArray(items) || !items.length) fail(`Empty list in ${ctx.where}`);
  return `<${tag}>${items.map((item) => `<li>${inline(item, ctx)}</li>`).join('')}</${tag}>`;
}

export function renderBlock(block, ctx) {
  if (typeof block === 'string') return `<p>${inline(block, ctx)}</p>`;
  if (!block || typeof block !== 'object') fail(`Invalid block in ${ctx.where}`);
  if ('p' in block) return `<p>${inline(block.p, ctx)}</p>`;
  if ('h3' in block) {
    const text = plain(block.h3, ctx);
    const id = headingId(text, ctx);
    ctx.headings.push({ level: 3, id, text });
    return `<h3 id="${id}">${inline(block.h3, ctx)}</h3>`;
  }
  if ('ul' in block) return list('ul', block.ul, ctx);
  if ('ol' in block) return list('ol', block.ol, ctx);
  if ('checklist' in block) {
    return `<ul class="checklist">${block.checklist.map((item) => `<li>${inline(item, ctx)}</li>`).join('')}</ul>`;
  }
  if ('steps' in block) {
    return `<ol class="steps">${block.steps
      .map((s) => `<li><strong>${inline(s.title, ctx)}</strong><span>${inline(s.text, ctx)}</span></li>`)
      .join('')}</ol>`;
  }
  if ('dl' in block) {
    return `<dl class="facts">${block.dl.map(([t, d]) => `<div><dt>${inline(t, ctx)}</dt><dd>${inline(d, ctx)}</dd></div>`).join('')}</dl>`;
  }
  if ('table' in block) {
    const t = block.table;
    if (!Array.isArray(t.head) || !Array.isArray(t.rows)) fail(`Invalid table in ${ctx.where}`);
    const head = `<thead><tr>${t.head.map((h) => `<th scope="col">${inline(h, ctx)}</th>`).join('')}</tr></thead>`;
    const rows = t.rows
      .map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${inline(c, ctx)}</th>` : `<td>${inline(c, ctx)}</td>`)).join('')}</tr>`)
      .join('');
    const caption = t.caption ? `<caption>${inline(t.caption, ctx)}</caption>` : '';
    return `<div class="table-wrap" role="region" aria-label="${esc(plain(t.caption || 'Tabela', ctx))}" tabindex="0"><table>${caption}${head}<tbody>${rows}</tbody></table></div>`;
  }
  if ('note' in block) {
    const tone = block.tone === 'warn' ? 'warn' : 'info';
    const title = block.title ? `<strong class="note-title">${inline(block.title, ctx)}</strong>` : '';
    return `<aside class="note note-${tone}">${title}<p>${inline(block.note, ctx)}</p></aside>`;
  }
  if ('component' in block) {
    const fn = ctx.components[block.component];
    if (!fn) fail(`Unknown component "${block.component}" in ${ctx.where}`);
    return fn(ctx, block);
  }
  fail(`Unknown block type ${JSON.stringify(Object.keys(block))} in ${ctx.where}`);
}

export const renderBlocks = (blocks, ctx) => (blocks || []).map((b) => renderBlock(b, ctx)).join('');

// sections: [{ h2, id?, body: [...] }]
export function renderSections(sections, ctx) {
  return (sections || [])
    .map((section) => {
      if (!section.h2) fail(`Section without h2 in ${ctx.where}`);
      const text = plain(section.h2, ctx);
      const id = section.id ? section.id : headingId(text, ctx);
      if (section.id) {
        if (ctx.usedIds.has(section.id)) fail(`Duplicate section id "${section.id}" in ${ctx.where}`);
        ctx.usedIds.add(section.id);
      }
      ctx.headings.push({ level: 2, id, text });
      return `<section class="prose-section" aria-labelledby="${id}"><h2 id="${id}">${inline(section.h2, ctx)}</h2>${renderBlocks(section.body, ctx)}</section>`;
    })
    .join('');
}

// Plain text of a block list (used for word counts and similarity checks).
export function blocksToText(blocks, ctx) {
  const out = [];
  for (const b of blocks || []) {
    if (typeof b === 'string') out.push(plain(b, ctx));
    else if (b.p) out.push(plain(b.p, ctx));
    else if (b.h3) out.push(plain(b.h3, ctx));
    else if (b.ul || b.ol || b.checklist) out.push(...(b.ul || b.ol || b.checklist).map((i) => plain(i, ctx)));
    else if (b.steps) out.push(...b.steps.map((s) => `${plain(s.title, ctx)} ${plain(s.text, ctx)}`));
    else if (b.dl) out.push(...b.dl.map(([t, d]) => `${plain(t, ctx)} ${plain(d, ctx)}`));
    else if (b.table) out.push(...b.table.rows.flat().map((c) => plain(c, ctx)));
    else if (b.note) out.push(plain(b.note, ctx));
  }
  return out.join('\n');
}
