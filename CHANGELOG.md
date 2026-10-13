# Changelog

## 1.2.0 — 2026-10-13 · Conteúdo contínuo e conclusões de preço calculadas

- **8 artigos novos** publicados pela Content Factory (11/300 no total): Honda Air Blade 125 ou 160, Honda Click, aluguer semanal, aluguer mensal, Licença Internacional de Condução, documentos da mota alugada, conduzir no Bairro Antigo e Hanói de mota num dia. As categorias «Zonas de Hanói» e «Rotas e mobilidade» ganham a sua página (noindex até terem três artigos).
- **Conclusões de preço calculadas** a partir de `site/data.json`, para continuarem certas quando a tabela mudar:
  - componente `duration-compare`: ao dia ou à semana, modelo a modelo, a partir de quantos dias a semana compensa;
  - tokens `{{price.<modelo>.weekFrom}}` (por extenso), `{{cmp.<modelo>.<outro>.<período>}}` («menos do que», «o mesmo que», «mais do que») e `{{price.min.week}}` / `{{price.max.week}}`;
  - um token que deixe de ser verdadeiro (por exemplo, a semana já não compensa em sete dias) faz falhar a compilação, para o texto ser revisto.
- **QA da fábrica**: o primeiro artigo de uma categoria sem página base pode e deve ligar à página da categoria, que é criada com ele.
- **Escrita contínua**: limite semanal de publicação desativado a pedido do proprietário (`publishing.max_new_per_7_days = null`).
- Testes independentes do progresso da publicação.

## 1.1.2 — 2026-10-12

- SEO Monitor: cada execução do Lighthouse tem um limite de 4 minutos e o passo inteiro de 15, para que um bloqueio nunca prenda o workflow.
- Execução completa no domínio real: Lighthouse móvel (laboratório) 97–100 em desempenho e 100 em acessibilidade, boas práticas e SEO; LCP 0,9–1,3 s; CLS 0. Verificadas 24 ligações externas sem erros.

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
