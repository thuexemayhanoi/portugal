// JSON-LD (@graph) built only from real data in site/data.json and page content.
// Never add aggregateRating, reviews, geo coordinates or offers that are not published by the business.
import { plain } from './text.mjs';

const abs = (ctx, url) => ctx.data.site.baseUrl + url;

export function businessNode(ctx) {
  const b = ctx.data.business;
  const base = ctx.data.site.baseUrl;
  const days = ctx.data.pricing.models.map((m) => m.day).filter((v) => typeof v === 'number');
  const node = {
    '@type': 'LocalBusiness',
    '@id': `${base}/#business`,
    name: b.canonicalName,
    alternateName: b.alternateNames,
    url: b.website,
    logo: base + b.logo,
    image: base + b.logo,
    telephone: b.phone.display,
    address: {
      '@type': 'PostalAddress',
      streetAddress: b.address.streetAddress,
      addressLocality: b.address.locality,
      addressCountry: b.address.countryCode
    },
    openingHoursSpecification: [
      { '@type': 'OpeningHoursSpecification', dayOfWeek: b.hours.days, opens: b.hours.opens, closes: b.hours.closes }
    ],
    hasMap: b.maps,
    areaServed: { '@type': 'City', name: b.areaServed },
    sameAs: b.sameAs,
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Aluguer de motas em Hanói',
      itemListElement: b.services.map((s) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: s.name } }))
    }
  };
  if (days.length) node.priceRange = `${fmt(Math.min(...days))}–${fmt(Math.max(...days))} VND por dia`;
  return node;
}

const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export function websiteNode(ctx) {
  const base = ctx.data.site.baseUrl;
  return {
    '@type': 'WebSite',
    '@id': `${base}/#website`,
    url: `${base}/`,
    name: ctx.data.site.name,
    inLanguage: ctx.data.site.lang,
    publisher: { '@id': `${base}/#business` }
  };
}

function webPageNode(page, ctx) {
  const base = ctx.data.site.baseUrl;
  const types = { AboutPage: 'AboutPage', ContactPage: 'ContactPage', CollectionPage: 'CollectionPage', FAQPage: 'WebPage' };
  const node = {
    '@type': types[page.schemaType] || (page.kind === 'hub' || page.kind === 'archive' ? 'CollectionPage' : 'WebPage'),
    '@id': `${abs(ctx, page.url)}#webpage`,
    url: abs(ctx, page.url),
    name: page.title,
    description: page.description,
    inLanguage: ctx.data.site.lang,
    isPartOf: { '@id': `${base}/#website` },
    dateModified: page.updated
  };
  if (page.url !== '/') node.breadcrumb = { '@id': `${abs(ctx, page.url)}#breadcrumb` };
  if (page.url === '/' || page.schemaType === 'ContactPage' || page.schemaType === 'AboutPage') node.about = { '@id': `${base}/#business` };
  return node;
}

function breadcrumbNode(page, ctx) {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${abs(ctx, page.url)}#breadcrumb`,
    itemListElement: page.breadcrumb.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      item: abs(ctx, item.url)
    }))
  };
}

function articleNode(page, ctx) {
  const base = ctx.data.site.baseUrl;
  const a = page.article;
  return {
    '@type': 'Article',
    '@id': `${abs(ctx, page.url)}#article`,
    headline: page.h1.slice(0, 110),
    description: page.description,
    inLanguage: ctx.data.site.lang,
    datePublished: page.published,
    dateModified: page.updated,
    wordCount: page.wordCount,
    articleSection: ctx.children.get(page.child).label,
    keywords: [page.topic.primary_keyword, ...(page.topic.secondary_keywords || [])].join(', '),
    author: { '@type': 'Organization', name: ctx.data.editorial.byline, url: `${base}/sobre-nos/` },
    publisher: { '@id': `${base}/#business` },
    isPartOf: { '@id': `${base}/#website` },
    mainEntityOfPage: { '@id': `${abs(ctx, page.url)}#webpage` },
    citation: (page.resolvedSources || []).map((s) => s.url),
    ...(a.image ? { image: base + a.image } : {})
  };
}

function faqNode(page, items, ctx) {
  return {
    '@type': 'FAQPage',
    '@id': `${abs(ctx, page.url)}#faq`,
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: plain(item.q, ctx),
      acceptedAnswer: { '@type': 'Answer', text: plain(item.a, ctx) }
    }))
  };
}

export function jsonLd(page, ctx, { faqItems = [] } = {}) {
  const graph = [businessNode(ctx), websiteNode(ctx), webPageNode(page, ctx)];
  if (page.url !== '/') graph.push(breadcrumbNode(page, ctx));
  if (page.kind === 'article') graph.push(articleNode(page, ctx));
  if (faqItems.length >= 2 && page.faqSchema !== false) graph.push(faqNode(page, faqItems, ctx));
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">${json}</script>`;
}
