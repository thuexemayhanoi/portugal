// Page templates. Each returns { main, faqItems, headings, text } for one page of the model.
import { esc, formatDatePT, wordCount, fail } from './util.mjs';
import { inline, plain, renderBlocks, renderSections, blocksToText } from './text.mjs';
import { icon } from './icons.mjs';
import {
  breadcrumb,
  toc,
  faqList,
  ctaBox,
  sourcesList,
  resolveSources,
  articleCards,
  prevNext,
  relatedSection,
  childList,
  contactCard
} from './components.mjs';

function pageTop(page, ctx, { meta = '' } = {}) {
  const eyebrow = page.eyebrow ? `<p class="eyebrow">${esc(page.eyebrow)}</p>` : '';
  const lead = page.lead ? `<p class="lead">${inline(page.lead, ctx)}</p>` : '';
  return `<header class="page-top"><div class="wrap">${breadcrumb(page, ctx)}${eyebrow}<h1>${inline(page.h1, ctx)}</h1>${lead}${meta}</div></header>`;
}

const updatedMeta = (page, ctx, extra = '') =>
  `<p class="page-meta">${icon('calendar', 16)}<span>${esc(ctx.ui.updated)} <time datetime="${page.updated}">${esc(formatDatePT(page.updated))}</time></span>${extra}</p>`;

function answerBox(text, ctx) {
  if (!text) return '';
  const body = Array.isArray(text)
    ? `<ul>${text.map((t) => `<li>${inline(t, ctx)}</li>`).join('')}</ul>`
    : `<p>${inline(text, ctx)}</p>`;
  return `<div class="answer-box"><p class="answer-title">${icon('check', 18)}<span>${esc(ctx.ui.quickAnswer)}</span></p>${body}</div>`;
}

function faqSection(items, ctx, title) {
  if (!items?.length) return '';
  ctx.headings.push({ level: 2, id: 'perguntas-frequentes', text: title || ctx.ui.faq });
  ctx.usedIds.add('perguntas-frequentes');
  return `<section class="prose-section" aria-labelledby="perguntas-frequentes"><h2 id="perguntas-frequentes">${esc(title || ctx.ui.faq)}</h2>${faqList(items, ctx)}</section>`;
}

// Lists published articles for a base page (parent hub or child pillar).
function attachedArticles(page, ctx) {
  let list = [];
  let heading = ctx.ui.articles;
  const childIds = page.children || (page.child ? [page.child] : []);
  if (childIds.length) {
    list = ctx.articles.filter((a) => childIds.includes(a.child));
    if (childIds.length === 1) heading = `${ctx.ui.articles}: ${ctx.children.get(childIds[0]).label}`;
  } else if (page.template === 'hub' && page.parent) {
    list = ctx.articles.filter((a) => a.parent === page.parent);
  }
  if (!list.length) return '';
  list = [...list].sort((a, b) => b.updated.localeCompare(a.updated) || a.order - b.order);
  ctx.headings.push({ level: 2, id: 'artigos', text: heading });
  ctx.usedIds.add('artigos');
  return `<section class="section-block" aria-labelledby="artigos"><h2 id="artigos">${esc(heading)}</h2>${articleCards(list.slice(0, 24), ctx)}</section>`;
}

function categoryOverview(page, ctx) {
  if (page.template !== 'hub' || !page.parent) return '';
  const parent = ctx.parents.get(page.parent);
  ctx.headings.push({ level: 2, id: 'categorias', text: `Categorias de ${parent.label.toLowerCase()}` });
  ctx.usedIds.add('categorias');
  return `<section class="section-block" aria-labelledby="categorias"><h2 id="categorias">Categorias de ${esc(parent.label.toLowerCase())}</h2>${childList(parent.id, ctx)}</section>`;
}

function contentLayout(page, ctx, inner, lead = '') {
  const label = page.kind === 'article' ? ctx.ui.toc : ctx.ui.tocPage;
  const desktopToc = page.toc ? toc(ctx.headings, ctx, { variant: 'desktop', label }) : '';
  if (!desktopToc) return `<div class="wrap content-single"><div class="prose">${lead}${inner}</div></div>`;
  const mobileToc = toc(ctx.headings, ctx, { variant: 'mobile', label });
  return `<div class="wrap content-grid"><aside class="content-aside">${desktopToc}<div class="aside-contact">${contactMini(ctx)}</div></aside><div class="prose">${lead}${mobileToc}${inner}</div></div>`;
}

function contactMini(ctx) {
  const b = ctx.data.business;
  return `<p class="aside-title">${esc(b.shortName)} · ${esc(b.address.areaLabel)}</p><p>${esc(b.hours.short)}</p><a class="btn btn-primary btn-block" href="${esc(b.phone.tel)}">${icon('phone', 18)}<span>${esc(b.phone.display)}</span></a>`;
}

function standardBody(page, ctx) {
  const sources = resolveSources(page.sources, ctx, page.source);
  page.resolvedSources = sources;
  const answer = answerBox(page.answer, ctx);
  const sections = renderSections(page.sections, ctx);
  const faq = faqSection(page.faq, ctx, page.faqTitle);
  const overview = categoryOverview(page, ctx);
  const attached = attachedArticles(page, ctx);
  if (sources.length) ctx.headings.push({ level: 2, id: 'fontes', text: ctx.ui.sources });
  const inner = `${sections}${overview}${attached}${faq}${sourcesList(sources, ctx)}`;
  // TOC needs all headings, so the layout is assembled after rendering the content.
  return { inner, lead: answer, faqItems: page.faq || [] };
}

export function renderPage(page, ctx) {
  switch (page.template) {
    case 'home':
      return renderHome(page, ctx);
    case 'article':
      return renderArticle(page, ctx);
    case 'parent-hub':
    case 'child-archive':
      return renderGeneratedHub(page, ctx);
    case 'faq':
      return renderFaq(page, ctx);
    case 'contact':
      return renderContact(page, ctx);
    case 'page':
    case 'hub':
    case 'legal': {
      const { inner, lead, faqItems } = standardBody(page, ctx);
      const top = pageTop(page, ctx, { meta: updatedMeta(page, ctx) });
      const cta = page.template === 'legal' || page.cta === false ? '' : ctaBox(ctx);
      return { main: `${top}${contentLayout(page, ctx, inner, lead)}${cta}`, faqItems };
    }
    default:
      fail(`No renderer for template ${page.template}`);
  }
}

function renderHome(page, ctx) {
  const h = page.hero;
  const facts = (h.facts || []).map((f) => `<li>${icon(f.icon || 'check', 18)}<span>${inline(f.text, ctx)}</span></li>`).join('');
  const actions = (h.actions || [])
    .map((a) => `<a class="btn ${a.style === 'primary' ? 'btn-primary' : 'btn-glass'}" href="${esc(a.url)}">${a.icon ? icon(a.icon, 18) : ''}<span>${esc(a.label)}</span></a>`)
    .join('');
  const panelRows = ctx.pricing.models
    .filter((m) => (h.panelModels || []).includes(m.id))
    .map((m) => `<li><span>${esc(m.name)}</span><strong>${esc(ctx.tokens[`price.${m.id}.day`])}<small>/${esc(ctx.ui.perDay)}</small></strong></li>`)
    .join('');
  const panel = panelRows
    ? `<aside class="hero-panel" aria-label="${esc(h.panelTitle)}"><p class="panel-kicker">${esc(h.panelTitle)}</p><ul>${panelRows}</ul><a class="hero-panel-link" href="/precos/">${esc(h.panelLink)}${icon('arrowRight', 16)}</a></aside>`
    : '';
  const hero = `<section class="hero"><div class="wrap hero-grid"><div class="hero-copy"><p class="eyebrow eyebrow-light">${esc(h.eyebrow)}</p><h1>${inline(page.h1, ctx)}</h1><p class="lead">${inline(page.lead, ctx)}</p><div class="btn-row">${actions}</div><ul class="hero-facts">${facts}</ul></div>${panel}</div></section>`;
  const sections = (page.sections || [])
    .map((s, i) => {
      const id = s.id || `s${i + 1}`;
      ctx.usedIds.add(id);
      ctx.headings.push({ level: 2, id, text: plain(s.h2, ctx) });
      const intro = s.intro ? `<p class="section-intro">${inline(s.intro, ctx)}</p>` : '';
      const eyebrow = s.eyebrow ? `<p class="eyebrow">${esc(s.eyebrow)}</p>` : '';
      const more = s.link ? `<p class="section-more"><a class="link-arrow" href="${esc(s.link.url)}">${esc(s.link.label)}${icon('arrowRight', 16)}</a></p>` : '';
      return `<section class="home-section${s.alt ? ' alt' : ''}" aria-labelledby="${id}"><div class="wrap${s.narrow ? ' narrow' : ''}"><div class="section-head">${eyebrow}<h2 id="${id}">${inline(s.h2, ctx)}</h2>${intro}</div>${renderBlocks(s.body, ctx)}${more}</div></section>`;
    })
    .join('');
  const latest = [...ctx.articles].sort((a, b) => b.published.localeCompare(a.published) || b.order - a.order).slice(0, 3);
  const latestHtml = latest.length
    ? `<section class="home-section" aria-labelledby="ultimos"><div class="wrap"><div class="section-head"><p class="eyebrow">Guias</p><h2 id="ultimos">Últimos guias publicados</h2></div>${articleCards(latest, ctx)}</div></section>`
    : '';
  const faqItems = (page.faqSchemaIds || []).map((id) => ctx.faqById.get(id)).filter(Boolean);
  return { main: `${hero}${sections}${latestHtml}${ctaBox(ctx)}`, faqItems: page.faqSchema ? faqItems : [] };
}

function renderFaq(page, ctx) {
  const groups = page.groups
    .map((g) => {
      const id = g.id;
      ctx.usedIds.add(id);
      ctx.headings.push({ level: 2, id, text: g.title });
      return `<section class="prose-section" aria-labelledby="${id}"><h2 id="${id}">${esc(g.title)}</h2>${faqList(g.items, ctx)}</section>`;
    })
    .join('');
  const items = page.groups.flatMap((g) => g.items);
  const sources = resolveSources(page.sources, ctx, page.source);
  page.resolvedSources = sources;
  const top = pageTop(page, ctx, { meta: updatedMeta(page, ctx) });
  const inner = `${groups}${sourcesList(sources, ctx)}`;
  return { main: `${top}${contentLayout(page, ctx, inner, answerBox(page.answer, ctx))}${ctaBox(ctx)}`, faqItems: items };
}

function renderContact(page, ctx) {
  const top = pageTop(page, ctx, { meta: updatedMeta(page, ctx) });
  const sections = renderSections(page.sections, ctx);
  const card = contactCard(ctx, { note: page.cardNote });
  return {
    main: `${top}<div class="wrap contact-grid"><div class="contact-primary">${card}</div><div class="prose">${sections}</div></div>`,
    faqItems: []
  };
}

function renderGeneratedHub(page, ctx) {
  const top = pageTop(page, ctx, { meta: updatedMeta(page, ctx) });
  let list;
  let extra = '';
  if (page.template === 'parent-hub') {
    list = ctx.articles.filter((a) => a.parent === page.parent);
    extra = `<section class="section-block"><h2 id="categorias">Categorias</h2>${childList(page.parent, ctx)}</section>`;
  } else {
    list = ctx.articles.filter((a) => a.child === page.child);
  }
  list = [...list].sort((a, b) => a.order - b.order);
  const cards = `<section class="section-block"><h2 id="artigos">${esc(ctx.ui.allArticles)}</h2>${articleCards(list, ctx)}</section>`;
  return { main: `${top}<div class="wrap content-single">${extra}${cards}</div>${ctaBox(ctx)}`, faqItems: [] };
}

function renderArticle(page, ctx) {
  const a = page.article;
  ctx.where = page.source;
  const sources = resolveSources(a.sources, ctx, page.source);
  page.resolvedSources = sources;
  const intro = (a.intro || []).map((p) => `<p>${inline(p, ctx)}</p>`).join('');
  const keyPoints = answerBox(a.key_points, ctx);
  const sections = renderSections(a.sections, ctx);
  const faq = faqSection(a.faq, ctx);
  if (sources.length) ctx.headings.push({ level: 2, id: 'fontes', text: ctx.ui.sources });
  const disclaimer = a.legal_note ? `<aside class="note note-warn"><p>${esc(ctx.ui.legalNote)}</p></aside>` : '';
  const textForCount = [
    ...(a.intro || []).map((p) => plain(p, ctx)),
    ...(a.key_points || []).map((p) => plain(p, ctx)),
    ...a.sections.flatMap((s) => [plain(s.h2, ctx), blocksToText(s.body, ctx)]),
    ...(a.faq || []).flatMap((f) => [plain(f.q, ctx), plain(f.a, ctx)])
  ].join('\n');
  page.wordCount = wordCount(textForCount);
  const minutes = Math.max(1, Math.round(page.wordCount / 200));
  const meta = updatedMeta(
    page,
    ctx,
    `<span class="sep" aria-hidden="true">·</span><span>${minutes} ${esc(ctx.ui.readingTime)}</span><span class="sep" aria-hidden="true">·</span><a href="${esc(ctx.data.editorial.url)}" rel="author">${esc(ctx.data.editorial.byline)}</a>`
  );
  const pageWithEyebrow = { ...page, eyebrow: ctx.children.get(page.child).label };
  const top = pageTop(pageWithEyebrow, ctx, { meta });
  const inner = `${intro}${sections}${faq}${sourcesList(sources, ctx)}${disclaimer}`;
  const after = `<div class="wrap article-after">${prevNext(page, ctx)}${relatedSection(page, ctx)}</div>`;
  return { main: `<article class="article">${top}${contentLayout({ ...page, toc: true }, ctx, inner, keyPoints)}${after}</article>${ctaBox(ctx)}`, faqItems: a.faq || [] };
}

export function render404(ctx) {
  const links = [
    ['/', ctx.ui.home],
    ['/tipos-de-motas/', 'Tipos de motas'],
    ['/precos/', 'Preços'],
    ['/guia-de-aluguer/', 'Guia de aluguer'],
    ['/perguntas-frequentes/', 'Perguntas frequentes'],
    ['/contactos/', 'Contactos']
  ]
    .map(([u, l]) => `<li><a href="${u}">${esc(l)}</a></li>`)
    .join('');
  return `<header class="page-top"><div class="wrap"><p class="eyebrow">Erro 404</p><h1>${esc(ctx.ui.notFoundTitle)}</h1><p class="lead">A página que procura não existe ou mudou de endereço. Use a pesquisa ou escolha uma das secções abaixo.</p><div class="btn-row"><button class="btn btn-primary" type="button" data-search-open>${icon('search', 18)}<span>${esc(ctx.ui.searchLabel)}</span></button></div></div></header><div class="wrap content-single"><ul class="link-list">${links}</ul></div>`;
}
