// Shared layout: <head> (SEO + Open Graph + JSON-LD), header with dropdowns, mobile drawer,
// footer, floating Call/Zalo buttons and the search dialog. Used by every generated page.
import fs from 'node:fs';
import { esc, rel } from './util.mjs';
import { icon } from './icons.mjs';

const THEME_INIT = "(function(){try{var t=localStorage.getItem('pt-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}})();";

function hook(name) {
  const file = rel(`site/hooks/${name}.html`);
  if (!fs.existsSync(file)) return '';
  // Comment lines starting with <!-- are kept out of the output.
  return fs.readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '').trim();
}

export function head(page, ctx, { jsonLd }) {
  const { site } = ctx.data;
  const url = site.baseUrl + page.url;
  const robots = page.indexable ? 'index,follow,max-image-preview:large,max-snippet:-1' : 'noindex,follow';
  const og = page.ogImage || site.defaultOgImage;
  const meta = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}">`,
    page.canonical !== false ? `<link rel="canonical" href="${esc(url)}">` : '',
    `<meta name="robots" content="${robots}">`,
    '<meta name="color-scheme" content="light dark">',
    `<meta name="theme-color" media="(prefers-color-scheme: light)" content="${esc(site.themeColor.light)}">`,
    `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="${esc(site.themeColor.dark)}">`,
    '<meta name="format-detection" content="telephone=no">',
    site.verification.google ? `<meta name="google-site-verification" content="${esc(site.verification.google)}">` : '',
    site.verification.bing ? `<meta name="msvalidate.01" content="${esc(site.verification.bing)}">` : '',
    ...(site.hreflang.alternates || []).map((a) => `<link rel="alternate" hreflang="${esc(a.lang)}" href="${esc(a.url)}">`),
    '<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">',
    '<link rel="icon" href="/assets/img/favicon-32.png" type="image/png" sizes="32x32">',
    '<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">',
    `<link rel="stylesheet" href="/assets/css/site.css?v=${ctx.assetVersion.css}">`,
    `<script>${THEME_INIT}</script>`,
    `<script src="/assets/js/app.js?v=${ctx.assetVersion.js}" defer></script>`,
    `<meta property="og:type" content="${page.kind === 'article' ? 'article' : 'website'}">`,
    `<meta property="og:site_name" content="${esc(site.name)}">`,
    `<meta property="og:locale" content="${esc(site.ogLocale)}">`,
    `<meta property="og:title" content="${esc(page.title)}">`,
    `<meta property="og:description" content="${esc(page.description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    og ? `<meta property="og:image" content="${esc(site.baseUrl + og)}">` : '',
    og ? '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">' : '',
    og ? `<meta property="og:image:alt" content="${esc(site.name)}">` : '',
    page.kind === 'article' ? `<meta property="article:published_time" content="${page.published}">` : '',
    page.kind === 'article' ? `<meta property="article:modified_time" content="${page.updated}">` : '',
    page.kind === 'article' ? `<meta property="article:section" content="${esc(ctx.children.get(page.child).label)}">` : '',
    `<meta name="twitter:card" content="${og ? 'summary_large_image' : 'summary'}">`,
    jsonLd,
    hook('head')
  ];
  return `<!doctype html><html lang="${esc(site.lang)}"><head>${meta.filter(Boolean).join('')}</head>`;
}

function panelLinks(parent, ctx) {
  const items = parent.children
    .map((c) => {
      const url = ctx.childLink(c.id);
      return url
        ? `<li><a href="${esc(url)}"><strong>${esc(c.label)}</strong><span>${esc(c.summary)}</span></a></li>`
        : `<li class="is-soon"><span class="soon-row"><strong>${esc(c.label)}</strong><span class="badge">${esc(ctx.ui.comingSoon)}</span></span><span>${esc(c.summary)}</span></li>`;
    })
    .join('');
  return `<ul class="panel-links">${items}</ul>`;
}

function parentBlock(parent, ctx) {
  const url = ctx.parentLink(parent.id);
  const head = url
    ? `<a class="panel-overview" href="${esc(url)}"><span class="panel-kicker">${esc(ctx.ui.overview)}</span><strong>${esc(parent.label)}</strong><span>${esc(parent.summary)}</span></a>`
    : `<div class="panel-overview is-soon"><span class="panel-kicker">${esc(ctx.ui.comingSoon)}</span><strong>${esc(parent.label)}</strong><span>${esc(parent.summary)}</span></div>`;
  // Base pages attached to the parent (e.g. "Documentação e caução") are listed as extra links.
  const extra = ctx.pages
    .filter((p) => p.kind === 'page' && p.parent === parent.id && p.url !== parent.url && !parent.children.some((c) => c.archiveUrl === p.url))
    .map((p) => `<li><a href="${esc(p.url)}"><strong>${esc(p.navLabel || p.h1)}</strong><span>${esc(p.navSummary || '')}</span></a></li>`)
    .join('');
  return `<div class="panel-col">${head}${extra ? `<ul class="panel-links panel-extra">${extra}</ul>` : ''}${panelLinks(parent, ctx)}</div>`;
}

function navItems(ctx, page, mode) {
  return ctx.data.nav.primary
    .map((item, i) => {
      if (item.url) {
        const current = page.url === item.url ? ' aria-current="page"' : '';
        return `<li class="nav-item"><a class="nav-link" href="${esc(item.url)}"${current}>${esc(item.label)}</a></li>`;
      }
      const parents = (item.parents || [item.parent]).map((id) => {
        const p = ctx.parents.get(id);
        if (!p) throw new Error(`nav: unknown parent ${id}`);
        return p;
      });
      const label = item.group || item.label || parents[0].label;
      const active = parents.some((p) => p.id === page.parent) ? ' is-active' : '';
      const id = `${mode}-panel-${i}`;
      const body = parents.map((p) => parentBlock(p, ctx)).join('');
      if (mode === 'drawer') {
        return `<li class="drawer-item${active}"><details><summary>${esc(label)}${icon('chevron', 18)}</summary><div class="drawer-sub">${body}</div></details></li>`;
      }
      return `<li class="nav-item has-panel${active}"><button class="nav-trigger" type="button" aria-expanded="false" aria-controls="${id}">${esc(label)}${icon('chevron', 16)}</button><div class="nav-panel${parents.length > 1 ? ' panel-wide' : ''}" id="${id}">${body}</div></li>`;
    })
    .join('');
}

function brand(ctx, tag = 'a') {
  const b = ctx.data.business;
  return `<a class="brand" href="/" aria-label="${esc(b.displayName)} — ${esc(ctx.ui.home)}"><span class="brand-mark" aria-hidden="true">${esc(b.monogram)}</span><span class="brand-text"><strong>${esc(b.shortName)}</strong><small>${esc(b.tagline)}</small></span></a>`;
}

export function header(page, ctx) {
  const b = ctx.data.business;
  const ui = ctx.ui;
  const topbar = `<div class="topbar"><div class="wrap topbar-inner"><span>${icon('clock', 16)}${esc(b.hours.short)}</span><span>${icon('pin', 16)}${esc(b.address.streetAddress)}, ${esc(b.address.locality)}</span><a href="tel:${esc(b.phone.e164)}">${icon('phone', 16)}${esc(b.phone.display)}</a></div></div>`;
  const desktop = `<header class="site-header" data-header><div class="wrap header-inner">${brand(ctx)}<nav class="main-nav" aria-label="${esc(ui.mainNav)}"><ul class="nav-list">${navItems(ctx, page, 'desktop')}</ul></nav><div class="header-actions"><button class="icon-btn" type="button" data-search-open aria-label="${esc(ui.search)}">${icon('search')}</button><button class="icon-btn" type="button" data-theme-toggle aria-label="${esc(ui.theme)}">${icon('theme')}</button><a class="btn btn-primary btn-sm header-call" href="tel:${esc(b.phone.e164)}">${icon('phone', 18)}<span>${esc(ui.call)}</span></a><button class="icon-btn menu-btn" type="button" aria-expanded="false" aria-controls="menu-movel" data-menu-open aria-label="${esc(ui.openMenu)}">${icon('menu')}</button></div></div></header>`;
  const zalo = b.zalo.enabled && b.zalo.verified ? `<a class="btn btn-ghost" href="${esc(b.zalo.url)}" rel="noopener noreferrer" target="_blank">${icon('chat', 18)}<span>${esc(ui.zalo)}</span></a>` : '';
  const drawer = `<div class="drawer" id="menu-movel" data-drawer hidden><div class="drawer-backdrop" data-menu-close></div><div class="drawer-panel" role="dialog" aria-modal="true" aria-label="${esc(ui.menu)}"><div class="drawer-head">${brand(ctx)}<button class="icon-btn" type="button" data-menu-close aria-label="${esc(ui.closeMenu)}">${icon('close')}</button></div><button class="drawer-search" type="button" data-search-open>${icon('search', 18)}<span>${esc(ui.searchLabel)}</span></button><nav aria-label="${esc(ui.mobileNav)}"><ul class="drawer-nav">${navItems(ctx, page, 'drawer')}</ul></nav><div class="drawer-contact"><p><strong>${esc(b.shortName)}</strong> · ${esc(b.hours.short)}</p><p>${esc(b.address.full)}</p><div class="btn-row"><a class="btn btn-primary" href="tel:${esc(b.phone.e164)}">${icon('phone', 18)}<span>${esc(ui.call)}</span></a>${zalo}<a class="btn btn-ghost" href="${esc(b.maps)}" rel="noopener noreferrer" target="_blank">${icon('pin', 18)}<span>Maps</span></a></div><button class="drawer-theme" type="button" data-theme-toggle>${icon('theme', 18)}<span>${esc(ui.theme)}</span></button></div></div></div>`;
  return `<a class="skip-link" href="#conteudo">${esc(ui.skip)}</a>${topbar}${desktop}${drawer}`;
}

export function footer(ctx) {
  const { business: b, footer: f, site, ui } = ctx.data;
  const cols = f.columns
    .map((col) => {
      const links = col.links
        .map(([label, url]) => {
          if (!ctx.byUrl.has(url)) throw new Error(`footer: ${url} does not exist`);
          return `<li><a href="${esc(url)}">${esc(label)}</a></li>`;
        })
        .join('');
      return `<div class="footer-col"><h2 class="footer-title">${esc(col.title)}</h2><ul>${links}</ul></div>`;
    })
    .join('');
  const live = [...ctx.parents.values()]
    .flatMap((p) => p.children)
    .filter((c) => !c.archiveIsBasePage && ctx.childLink(c.id))
    .map((c) => `<li><a href="${esc(ctx.childLink(c.id))}">${esc(c.label)}</a></li>`)
    .join('');
  const zalo = b.zalo.enabled && b.zalo.verified ? ` · <a href="${esc(b.zalo.url)}" rel="noopener noreferrer" target="_blank">Zalo</a>` : '';
  return `<footer class="site-footer"><div class="wrap footer-grid"><div class="footer-brand">${brand(ctx)}<p class="footer-legal">${esc(b.canonicalName)}</p><address><span>${icon('pin', 16)}${esc(b.address.full)}</span><span>${icon('phone', 16)}<a href="tel:${esc(b.phone.e164)}">${esc(b.phone.display)}</a>${zalo}</span><span>${icon('clock', 16)}${esc(b.hours.label)}</span></address><p class="footer-links-inline"><a href="${esc(b.maps)}" rel="noopener noreferrer" target="_blank">${esc(ui.maps)}</a> · <a href="${esc(b.website)}" rel="noopener noreferrer" target="_blank">${esc(b.website.replace(/^https:\/\/|\/$/g, ''))}</a></p></div>${cols}${live ? `<div class="footer-col"><h2 class="footer-title">${esc(ui.articles)}</h2><ul>${live}</ul></div>` : ''}</div><div class="wrap footer-bottom"><p>© ${esc(site.copyrightYear)} ${esc(b.canonicalName)}. ${esc(f.note)}</p></div></footer>`;
}

export function floatingContact(ctx) {
  const b = ctx.data.business;
  const ui = ctx.ui;
  const items = [`<a class="fab fab-call" href="tel:${esc(b.phone.e164)}" aria-label="${esc(`${ui.callLong}: ${b.phone.display}`)}">${icon('phone', 20)}<span>${esc(ui.call)}</span></a>`];
  if (b.zalo.enabled && b.zalo.verified) items.push(`<a class="fab fab-zalo" href="${esc(b.zalo.url)}" rel="noopener noreferrer" target="_blank" aria-label="${esc(ui.zaloLong)}">${icon('chat', 20)}<span>${esc(ui.zalo)}</span></a>`);
  if (b.whatsapp.enabled && b.whatsapp.verified && b.whatsapp.url) items.push(`<a class="fab fab-wa" href="${esc(b.whatsapp.url)}" rel="noopener noreferrer" target="_blank" aria-label="${esc(ui.whatsapp)}">${icon('whatsapp', 20)}<span>${esc(ui.whatsapp)}</span></a>`);
  return `<div class="float-contact">${items.join('')}</div>`;
}

export function searchDialog(ctx) {
  const ui = ctx.ui;
  return `<dialog class="search-dialog" id="pesquisa" aria-label="${esc(ui.searchLabel)}" data-search-dialog data-index="/assets/search-index.json?v=${ctx.assetVersion.search}" data-empty="${esc(ui.searchEmpty)}" data-hint="${esc(ui.searchHint)}" data-loading="${esc(ui.searchLoading)}" data-error="${esc(ui.searchError)}"><div class="search-box"><form class="search-form" role="search" method="dialog"><label class="visually-hidden" for="pesquisa-input">${esc(ui.searchLabel)}</label>${icon('search')}<input id="pesquisa-input" type="search" name="q" autocomplete="off" spellcheck="false" placeholder="${esc(ui.searchPlaceholder)}"><button class="icon-btn" type="submit" value="close" aria-label="${esc(ui.close)}">${icon('close')}</button></form><p class="search-status" role="status" aria-live="polite">${esc(ui.searchHint)}</p><ol class="search-results"></ol></div></dialog>`;
}

export function document(page, ctx, { jsonLd, main }) {
  return `${head(page, ctx, { jsonLd })}<body class="tpl-${esc(page.template)}">${header(page, ctx)}<main id="conteudo" tabindex="-1">${main}</main>${footer(ctx)}${floatingContact(ctx)}${searchDialog(ctx)}${hook('body-end')}</body></html>\n`;
}
