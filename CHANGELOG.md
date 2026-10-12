# Changelog

## 1.1.1 — 2026-10-12

- Primeira execução do SEO Monitor no domínio real: 15/15 URL sem erros, http→https e github.io→domínio com 301, IndexNow aceite (HTTP 202). Documentação atualizada.
- Os resumos do Lighthouse e da Search Console/Bing também aparecem no registo da execução.

## 1.1.0 — 2026-10-12 · NAP oficial, SEO Monitor e fábrica reforçada

- **NAP oficial** do proprietário como fonte única (`site/data.json`):
  - nome no Perfil da Empresa no Google, marca, tipo de negócio e fuso horário;
  - morada de apresentação em português e morada em vietnamita para mostrar ao taxista;
  - telefone em schema `+84942467674` e `tel:+84942467674`;
  - horário «Aberto todos os dias, das 09:00 às 21:00.» e CID do Google Maps;
  - `sameAs` e `alternateName` limitados à lista oficial;
  - regras verificadas por `scripts/lib/nap.mjs` na compilação e no site publicado.
- **Schema**:
  - a loja passa a ser uma só entidade `LocalBusiness` + `Organization`;
  - os artigos passam a `BlogPosting`, com autor ligado à secção editorial.
- **E-E-A-T**: a página «Sobre nós» ganha os dados oficiais e a secção «Quem escreve e verifica este site»; a assinatura dos artigos aponta para essa secção.
- **SEO Monitor**: novo workflow independente da Content Factory.
  - Auditoria do site publicado: HTTPS, robots, sitemap, canonical, indexabilidade, NAP, ligações e 404.
  - Lighthouse mobile semanal e IndexNow.
  - Search Console e Bing por grupo de palavras-chave, com fila de manutenção de conteúdo, quando o proprietário ligar as contas.
- **Content Factory**:
  - deteção de intenção de pesquisa duplicada (páginas publicadas e lote);
  - cruzamento de fontes (fontes legais e oficiais, idade e tipo);
  - controlo de pt-PT contra texto copiado ou traduzido (espanhol, inglês, palavras sem acentos);
  - limite de 10 artigos novos por 7 dias;
  - atualização de artigos publicados com `revision`;
  - deteção de todas as variantes de «50 cc sem carta».
- Ligações simples para os sites da loja em inglês e espanhol (sem hreflang).
- Documentação: `docs/SEO-CHECKLIST.md`, `docs/AUTHORITY-PLAN.md` e `docs/OWNER-ACTIONS.md` atualizado.

## 1.0.1 — 2026-10-12

- `sitemap.xml` publicado no GitHub Pages: o filtro `exclude` do Jekyll ocultava-o, porque compara por prefixo («site»). Acrescentada uma verificação automática.
- A fábrica já não cria commits vazios nas execuções agendadas e pede um build do Pages depois de publicar.

## 1.0.0 — 2026-10-12

- Gerador estático sem dependências, design Blue Titanium, 12 páginas base, taxonomia 5 × 20, matriz de 300 temas, Content Factory com QA e três artigos-piloto.
