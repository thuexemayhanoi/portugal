// Reusable UI components. Every component reads business facts from the model (site/data.json),
// so a change in one place updates every page that uses the component.
import { esc, formatVND, formatDatePT, fail } from './util.mjs';
import { inline, plain } from './text.mjs';
import { icon } from './icons.mjs';

export function breadcrumb(page, ctx) {
  if (page.url === '/') return '';
  const items = page.breadcrumb
    .map((item, i, arr) =>
      i === arr.length - 1
        ? `<li><span aria-current="page">${esc(item.label)}</span></li>`
        : `<li><a href="${esc(item.url)}">${esc(item.label)}</a></li>`
    )
    .join('');
  return `<nav class="breadcrumb" aria-label="${esc(ctx.ui.breadcrumb)}"><ol>${items}</ol></nav>`;
}

export function toc(headings, ctx, { variant = 'desktop', label } = {}) {
  const h2 = [];
  for (const h of headings) {
    if (h.level === 2) h2.push({ ...h, sub: [] });
    else if (h.level === 3 && h2.length) h2[h2.length - 1].sub.push(h);
  }
  if (h2.length < 3) return '';
  const title = label || ctx.ui.toc;
  const items = h2
    .map((h) => {
      const sub = h.sub.length ? `<ol>${h.sub.map((s) => `<li><a href="#${s.id}">${esc(s.text)}</a></li>`).join('')}</ol>` : '';
      return `<li><a href="#${h.id}">${esc(h.text)}</a>${sub}</li>`;
    })
    .join('');
  if (variant === 'mobile') {
    return `<details class="toc toc-mobile"><summary>${icon('doc', 18)}<span>${esc(title)}</span>${icon('chevron', 18)}</summary><ol>${items}</ol></details>`;
  }
  return `<nav class="toc toc-desktop" aria-label="${esc(title)}" data-toc><p class="toc-title">${icon('doc', 18)}<span>${esc(title)}</span></p><ol>${items}</ol></nav>`;
}

const priceCell = (value, ctx) => esc(formatVND(value, ctx.ui.onRequest));

export function priceTable(ctx, opts = {}) {
  const { pricing, ui } = ctx;
  const models = opts.category ? pricing.models.filter((m) => m.category === opts.category) : pricing.models;
  if (!models.length) fail(`price-table: no models for category ${opts.category}`);
  const rows = models
    .map(
      (m) =>
        `<tr><th scope="row">${esc(m.name)}<span class="cell-sub">${esc(pricing.categories[m.category])}</span></th><td>${priceCell(m.day, ctx)}</td><td>${priceCell(m.week, ctx)}</td><td>${priceCell(m.month, ctx)}</td></tr>`
    )
    .join('');
  const caption = opts.caption || `Preços de referência em VND (tabela verificada a ${formatDatePT(pricing.verifiedAt)})`;
  return `<div class="table-wrap price-table" role="region" aria-label="${esc(caption)}" tabindex="0"><table><caption>${esc(caption)}</caption><thead><tr><th scope="col">${esc(ui.model)}</th><th scope="col">${esc(ui.day)}</th><th scope="col">${esc(ui.week)}</th><th scope="col">${esc(ui.month)}</th></tr></thead><tbody>${rows}</tbody></table></div><p class="table-note">${icon('info', 16)}<span>${esc(pricing.note)}</span></p>`;
}

export function modelCards(ctx, opts = {}) {
  const { pricing, ui } = ctx;
  const models = pricing.models.filter((m) => !opts.category || m.category === opts.category);
  if (!models.length) fail(`model-cards: no models for ${opts.category}`);
  return `<ul class="model-grid">${models
    .map((m) => {
      const lines = [
        [ui.day, m.day],
        [ui.week, m.week],
        [ui.month, m.month]
      ]
        .map(([label, v]) => `<div><dt>${esc(label)}</dt><dd>${priceCell(v, ctx)}</dd></div>`)
        .join('');
      return `<li class="model-card"><p class="model-type">${esc(pricing.categories[m.category])}</p><h3 class="model-name">${esc(m.name)}</h3><dl class="model-prices">${lines}</dl></li>`;
    })
    .join('')}</ul><p class="table-note">${icon('info', 16)}<span>${esc(pricing.note)}</span></p>`;
}

export function contactLinks(ctx, { compact = false } = {}) {
  const b = ctx.data.business;
  const ui = ctx.ui;
  const links = [
    `<a class="btn btn-primary" href="tel:${esc(b.phone.e164)}" data-contact="call">${icon('phone', 18)}<span>${esc(compact ? ui.call : `${ui.call} · ${b.phone.display}`)}</span></a>`
  ];
  if (b.zalo.enabled && b.zalo.verified) {
    links.push(`<a class="btn btn-ghost" href="${esc(b.zalo.url)}" rel="noopener noreferrer" target="_blank" data-contact="zalo">${icon('chat', 18)}<span>${esc(ui.zalo)}</span></a>`);
  }
  if (b.whatsapp.enabled && b.whatsapp.verified && b.whatsapp.url) {
    links.push(`<a class="btn btn-ghost" href="${esc(b.whatsapp.url)}" rel="noopener noreferrer" target="_blank" data-contact="whatsapp">${icon('whatsapp', 18)}<span>${esc(ui.whatsapp)}</span></a>`);
  }
  if (!compact) {
    links.push(`<a class="btn btn-ghost" href="${esc(b.maps)}" rel="noopener noreferrer" target="_blank" data-contact="maps">${icon('pin', 18)}<span>${esc(ui.maps)}</span></a>`);
  }
  return `<div class="btn-row">${links.join('')}</div>`;
}

export function contactCard(ctx, opts = {}) {
  const b = ctx.data.business;
  const ui = ctx.ui;
  return `<div class="contact-card"><p class="contact-name">${esc(b.displayName)}</p><p class="contact-legal">${esc(b.canonicalName)}</p><dl class="facts"><div><dt>${icon('pin', 18)}${esc(ui.address)}</dt><dd>${esc(b.address.full)}</dd></div><div><dt>${icon('phone', 18)}${esc(ui.phone)} / Zalo</dt><dd><a href="tel:${esc(b.phone.e164)}">${esc(b.phone.display)}</a> · <span class="nowrap">${esc(b.phone.local)}</span></dd></div><div><dt>${icon('clock', 18)}${esc(ui.hours)}</dt><dd>${esc(b.hours.label)}</dd></div></dl>${contactLinks(ctx)}${opts.note ? `<p class="contact-note">${inline(opts.note, ctx)}</p>` : ''}</div>`;
}

export function faqList(items, ctx) {
  if (!items?.length) return '';
  return `<div class="faq">${items
    .map((item) => `<details class="faq-item"><summary><span>${inline(item.q, ctx)}</span>${icon('chevron', 18)}</summary><div class="faq-answer"><p>${inline(item.a, ctx)}</p></div></details>`)
    .join('')}</div>`;
}

export function ctaBox(ctx) {
  const c = ctx.data.cta;
  return `<section class="cta" aria-labelledby="cta-title"><div class="cta-inner"><div><p class="eyebrow eyebrow-light">${esc(c.eyebrow)}</p><h2 id="cta-title">${esc(c.title)}</h2><p>${esc(c.text)}</p></div>${contactLinks(ctx)}</div></section>`;
}

export function sourcesList(list, ctx) {
  if (!list?.length) return '';
  const items = list
    .map((s) => {
      const meta = [s.publisher, s.accessed ? `consultado a ${formatDatePT(s.accessed)}` : ''].filter(Boolean).join(' · ');
      return `<li><a href="${esc(s.url)}" rel="noopener noreferrer" target="_blank">${esc(s.title)}</a>${meta ? `<span class="source-meta">${esc(meta)}</span>` : ''}</li>`;
    })
    .join('');
  return `<section class="sources" aria-labelledby="fontes"><h2 id="fontes">${esc(ctx.ui.sources)}</h2><p class="muted">${esc(ctx.ui.sourcesNote)}</p><ol>${items}</ol></section>`;
}

// Resolves source references: string id -> registry entry; object -> ad-hoc source (articles).
export function resolveSources(refs, ctx, where) {
  return (refs || []).map((ref) => {
    if (typeof ref === 'string') {
      const s = ctx.sources.get(ref);
      if (!s) fail(`Unknown source id "${ref}" in ${where}`);
      return s;
    }
    if (!ref?.url || !/^https:\/\//.test(ref.url) || !ref.title) fail(`Invalid source object in ${where}`);
    return ref;
  });
}

export function articleCards(list, ctx, { heading = 'h3', showCategory = true } = {}) {
  if (!list.length) return '';
  return `<ul class="card-grid">${list
    .map((p) => {
      const cat = showCategory && p.child ? `<p class="card-kicker">${esc(ctx.children.get(p.child).label)}</p>` : '';
      return `<li class="card">${cat}<${heading} class="card-title"><a href="${esc(p.url)}">${esc(p.h1)}</a></${heading}><p>${esc(p.description)}</p><p class="card-meta">${icon('calendar', 16)}<span>${esc(ctx.ui.updated)} ${esc(formatDatePT(p.updated))}</span></p></li>`;
    })
    .join('')}</ul>`;
}

export function prevNext(page, ctx) {
  if (!page.prev && !page.next) return '';
  const link = (p, dir) =>
    p
      ? `<a class="pn pn-${dir}" href="${esc(p.url)}" rel="${dir}">${icon(dir === 'prev' ? 'arrowLeft' : 'arrowRight', 18)}<span><small>${esc(dir === 'prev' ? ctx.ui.prev : ctx.ui.next)}</small>${esc(p.h1)}</span></a>`
      : '<span class="pn pn-empty"></span>';
  return `<nav class="prev-next" aria-label="${esc(ctx.ui.sameCategory)}">${link(page.prev, 'prev')}${link(page.next, 'next')}</nav>`;
}

export function relatedSection(page, ctx) {
  let list = page.related || [];
  if (!list.length) return '';
  return `<section class="related" aria-labelledby="relacionados"><h2 id="relacionados">${esc(ctx.ui.related)}</h2>${articleCards(list, ctx)}</section>`;
}

// Children of a parent: link when the archive/pillar is live, "Em breve" label otherwise (never a 404 link).
export function childList(parentId, ctx, { withSummary = true } = {}) {
  const parent = ctx.parents.get(parentId);
  return `<ul class="child-list">${parent.children
    .map((c) => {
      const url = ctx.childLink(c.id);
      const count = ctx.childCount.get(c.id);
      const label = url
        ? `<a href="${esc(url)}">${esc(c.label)}</a>`
        : `<span class="soon-label">${esc(c.label)}</span> <span class="badge">${esc(ctx.ui.comingSoon)}</span>`;
      const meta = url && count ? ` <span class="count">${count}</span>` : '';
      return `<li>${label}${meta}${withSummary ? `<p>${esc(c.summary)}</p>` : ''}</li>`;
    })
    .join('')}</ul>`;
}

export function serviceCards(ctx) {
  const { business, pricing } = ctx.data;
  const icons = {
    'scooters-automaticas': 'scooter',
    'motas-semiautomaticas': 'gear',
    'motas-50cc': 'gauge',
    'motas-eletricas': 'bolt',
    'bicicletas-eletricas': 'bolt'
  };
  return `<ul class="service-grid">${business.services
    .map((s) => {
      const days = pricing.models.filter((m) => m.category === s.id && typeof m.day === 'number').map((m) => m.day);
      const price = days.length ? `${ctx.ui.from} ${formatVND(Math.min(...days))}/${ctx.ui.perDay}` : ctx.ui.onRequest;
      const models = pricing.models.filter((m) => m.category === s.id).map((m) => m.name).join(' · ');
      return `<li class="service-card"><span class="service-icon">${icon(icons[s.id] || 'scooter', 22)}</span><h3><a href="${esc(s.url)}">${esc(pricing.categories[s.id])}</a></h3><p class="service-models">${esc(models)}</p><p class="service-price">${esc(price)}</p></li>`;
    })
    .join('')}</ul>`;
}

// Component registry used by `{ "component": "…" }` blocks in content files.
export const blockComponents = {
  'price-table': (ctx, b) => priceTable(ctx, b),
  'model-cards': (ctx, b) => modelCards(ctx, b),
  'contact-card': (ctx, b) => contactCard(ctx, b),
  'contact-links': (ctx) => contactLinks(ctx),
  'service-cards': (ctx) => serviceCards(ctx),
  'child-list': (ctx, b) => childList(b.parent, ctx),
  faq: (ctx, b) => {
    const items = b.items || (b.ids || []).map((id) => ctx.faqById.get(id) || fail(`Unknown FAQ id ${id} in ${ctx.where}`));
    return faqList(items, ctx);
  }
};

export { plain };
