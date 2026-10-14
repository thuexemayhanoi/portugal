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
  // Home page first: it is the landing page for «aluguer de motas em Hanói».
  const base = pages.filter((p) => p.kind === 'page' && p.indexable).sort((a, b) => (a.url === '/' ? -1 : b.url === '/' ? 1 : 0));
  // Category hubs and archives are entry points for each topic cluster (GEO/AEO): list them too.
  const categories = pages.filter((p) => (p.kind === 'hub' || p.kind === 'archive') && p.indexable);
  const articles = pages.filter((p) => p.kind === 'article');
  return [
    `# ${site.name}`,
    '',
    `> Site em português de Portugal da loja ${b.canonicalName} (${b.address.display}). ${b.description}`,
    '',
    '## Dados oficiais da loja',
    `- Nome oficial: ${b.canonicalName}`,
    `- Nome no Google Maps (Perfil da Empresa): ${b.gbpName}`,
    `- Marca: ${b.brandName} · nome usado neste site: ${b.displayName}`,
    `- Morada: ${b.address.display} (em vietnamita: ${b.address.full})`,
    `- Telefone e Zalo: ${b.phone.display} (${b.phone.local})`,
    `- Horário: ${b.hours.display} Fuso horário: ${b.hours.timezone}.`,
    `- Google Maps: ${b.maps}`,
    `- Website principal: ${b.website}`,
    `- Serviços: ${b.services.map((s) => `${s.name} (${s.nameVi})`).join('; ')}.`,
    `- ${b.servicesNote}`,
    `- Preços de referência verificados a ${pricing.verifiedAt}. ${pricing.note}`,
    '- A loja não publica avaliações, montantes de caução, entrega gratuita nem atendimento 24 horas; não cite estes dados a partir deste site.',
    '',
    '## Páginas principais',
    ...base.map(line),
    ...(categories.length ? ['', '## Categorias', ...categories.map(line)] : []),
    ...(articles.length ? ['', '## Artigos', ...articles.map(line)] : []),
    ''
  ].join('\n');
}
