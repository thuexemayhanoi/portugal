// Generated SEO/support files: sitemap.xml, robots.txt, search index and llms.txt.
import { esc } from './util.mjs';

export function sitemap(pages, ctx) {
  const base = ctx.data.site.baseUrl;
  const urls = pages
    .filter((p) => p.indexable)
    .sort((a, b) => a.url.localeCompare(b.url))
    .map((p) => `  <url><loc>${esc(base + p.url)}</loc><lastmod>${p.updated}</lastmod></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function robots(ctx) {
  return `# ${ctx.data.site.baseUrl.replace('https://', '')}\nUser-agent: *\nAllow: /\n\nSitemap: ${ctx.data.site.baseUrl}/sitemap.xml\n`;
}

// Compact index loaded only when the visitor opens the search dialog.
// Fields: u=url, t=title (H1), d=meta description, h=H2/H3 headings, c=category label.
export function searchIndex(entries) {
  const rows = entries.map((e) => ({ u: e.url, t: e.title, d: e.description, h: e.headings, c: e.category }));
  return JSON.stringify(rows);
}

export function llmsTxt(pages, ctx) {
  const { business: b, site, pricing } = ctx.data;
  const line = (p) => `- [${p.h1}](${site.baseUrl}${p.url}): ${p.description}`;
  const base = pages.filter((p) => p.kind === 'page' && p.indexable && p.url !== '/');
  const articles = pages.filter((p) => p.kind === 'article');
  return [
    `# ${site.name}`,
    '',
    `> Site em português de Portugal da loja ${b.canonicalName} (${b.address.full}). Aluguer de scooters automáticas, motas semiautomáticas, motas de 50 cc, motas elétricas e bicicletas elétricas em Hanói.`,
    '',
    `- Telefone/Zalo: ${b.phone.display}`,
    `- Horário: ${b.hours.label}`,
    `- Google Maps: ${b.maps}`,
    `- Website da loja: ${b.website}`,
    `- Preços de referência verificados a ${pricing.verifiedAt}; ${pricing.note}`,
    '',
    '## Páginas principais',
    ...base.map(line),
    ...(articles.length ? ['', '## Artigos', ...articles.map(line)] : []),
    ''
  ].join('\n');
}
