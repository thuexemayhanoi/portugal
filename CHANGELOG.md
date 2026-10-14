# Changelog

## 1.7.3 — 2026-10-14 · auditoria do site real tolerante ao deploy

- `scripts/audit-live.mjs` repete (3 s, depois 6 s) os pedidos que recebem 5xx ou um erro de ligação antes de os contar como erro: o GitHub Pages responde 503 durante alguns segundos enquanto um deploy se propaga, o que deixou vermelha a execução do SEO Monitor sobre o #17 sem que o site estivesse avariado. O resumo indica quantas respostas transitórias foram repetidas; `--retries 0` desliga.

## 1.7.2 — 2026-10-14 · meta descriptions e os últimos P2 da matriz

- **49 meta descriptions reescritas** (revisões que mantêm URL e data de publicação): cada uma responde à pesquisa principal do artigo com as palavras da própria pesquisa, 120–160 caracteres, sem afirmações que o artigo não faça. Nenhum título, H1 ou corpo mudou.
- **+2 ligações contextuais** para os dois artigos que só tinham uma entrada (custo por quilómetro → preço da gasolina; Bairro Antigo a pé → atravessar a rua).
- **Regras da matriz afinadas** para não assinalar o que não é um problema: páginas utilitárias (contactos, sobre nós, privacidade, termos) não contam como «página curta»; «< 3 fontes» só se aplica a artigos com nota legal (um guia de procedimento pode assentar na informação da loja).
- O workflow **SEO Audit & Monitoring** acrescenta, na execução semanal, o resumo da matriz ao Summary (só leitura, não falha a execução).
- Matriz: P0 0 · P1 0 · P2 62 → 13 (7 artigos legais com 1–2 fontes e 6 guias de procedimento sem fontes externas: aceites, só se acrescentam fontes reais).

## 1.7.1 — 2026-10-14 · a matriz SEO passa a ser uma barreira na CI

- `node scripts/seo-matrix.mjs --check` corre em `npm run check` e no workflow Site QA: qualquer URL com um problema P0 faz falhar a verificação.
- O QA da fábrica mede a repetição de texto com o mesmo método da matriz (shingles de 3 palavras; ≥ 0,12 aviso, ≥ 0,20 erro), para que um artigo novo não recrie a canibalização corrigida no lote 2.
- `scripts/lib/overlap.mjs` guarda os limiares num só sítio; testes para a biblioteca.

## 1.7.0 — 2026-10-14 · auditoria SEO por URL e otimização em lotes

- **SEO Master Matrix** (`node scripts/seo-matrix.mjs`): cada um dos 332 URLs classificado em P0/P1/P2 (técnico, on-page, conteúdo, E-E-A-T, schema, ligações, mobile, AEO/GEO), com a canibalização calculada a partir do conteúdo atual e os grupos de palavras-chave comerciais com uma página de destino cada. Resultado: P0 0 · P1 98 → 0.
- **Ligações internas:** 0 artigos órfãos (eram 79); +24 ligações para artigos com uma só entrada; a página inicial passa a ser o destino de «aluguer de motas em Hanói», com 20 ligações contextuais e âncoras variadas.
- **Texto repetido entre artigos:** 6 artigos reescritos para remeter para os guias de referência (estacionamento, ponte Long Biên, zona de baixas emissões, álcool, documentos); nenhum par acima de 0,10 de sobreposição.
- **Correções de factos** (revisão do lote anterior): pontos na carta, roda bloqueada, notas de polímero, terminais de autocarros, hora de fecho por token.
- `llms.txt` lista a página inicial e as 18 categorias; título do arquivo de duração distinto da página de preços.
- **CWV de laboratório** (`scripts/tools/cwv-lab.mjs`): LCP ≤ 0,84 s, CLS 0, TBT ≤ 84 ms nos 8 modelos de página.
- `docs/OWNER-ACTIONS.md`: o que só o proprietário pode fazer para a palavra-chave principal (Search Console, ligação do site principal, Perfil da Empresa, avaliações reais, fotografias).

## 1.6.0 — 2026-10-14 · plano de 300 artigos completo

- **63 artigos novos** (300/300): técnica da semiautomática, notas e cartões, estacionamento e portagens, estações e comboio, Long Biên, Tây Hồ e Ba Đình, mercados, crianças, trovoada, Tam Đảo, entre outros. Todos com 0 erros de QA; o que as fontes não confirmam está dito no texto.
- **Revisão dos 10 temas em colisão**: 3 substituídos na mesma categoria por temas sem sobreposição (teatro de marionetas na água, Vinhomes Riverside, Tam Đảo); 7 aceites com `guard_reviewed` depois de verificar que respondem a outra pergunta.
- **Factory**: com o plano completo, `process` continua a tratar revisões de artigos publicados (antes parava com TARGET_REACHED).
- Testes independentes de haver temas por escrever.

## 1.5.0 — 2026-10-13 · 237 artigos, guarda de colisões e auditoria

- **152 artigos novos** (237/300), todos com 0 erros de QA; 20 revisões de artigos publicados (ressalva das coimas de Hanói desde julho de 2026, escalões das coimas por álcool, números de emergência 113/114/115/112, ligações internas para os artigos novos).
- **AI Content Collision Guard** (`node scripts/guard.mjs`): cada tema é comparado com os URLs publicados, os rascunhos e os outros temas antes de entrar na fila (ALLOW_CREATE, UPGRADE_EXISTING, REVIEW_COLLISION, REJECT_DUPLICATE). Rascunhos em `_factory/hold/` nunca voltam à fila.
- **Auditoria de conteúdo** (`node scripts/audit-content.mjs` → `docs/audit/`): inventário, canibalização, cobertura, entidades, ligações internas e backlog.
- QA de fontes: títulos que são notas, slugs ou «Thông tin văn bản» são rejeitados.
- 63 temas ficam por escrever: 10 à espera de decisão humana (possível sobreposição) e 53 por falta de factos verificados.

## 1.4.0 — 2026-10-13 · 85 artigos e ligações internas entre eles

- **21 artigos novos** (85/300). Cobrem, entre outros:
  - Vision ou Air Blade, critérios para escolher scooter e quem nunca conduziu;
  - 50 cc: 50 ou 110 cc, como confirmar que é 50 cc e estudantes;
  - carta para mota elétrica, conduzir sem carta válida e álcool zero;
  - aluguer de longa duração, desgaste ou dano, voo atrasado, famílias, casal e outra pessoa a conduzir;
  - capacetes, cobranças indevidas, assistência na estrada e quando não conduzir.
- **Ligações internas**: 65 artigos publicados foram revistos pela fábrica (`revision`) para ligar, no texto, aos artigos publicados depois deles. São cerca de 110 ligações novas, seguindo `internal_links_in/out` do plano. Todos os artigos publicados recebem pelo menos uma ligação contextual (mediana: 3).
- **QA de linguagem**: capacete, combustível, entrega, recolha ou assistência «incluídos» passam a ser alegações a confirmar; perguntas indiretas («quantos capacetes estão incluídos») não são assinaladas.
- Testes independentes do número de revisões já feitas.

## 1.3.0 — 2026-10-13 · 64 artigos e plano sem temas em espera

- **53 artigos novos** publicados pela Content Factory (64/300). Todos passaram o QA com 0 erros e 0 avisos e foram aprovados. Temas:
  - caução e pagamentos, custos extra, combustível e entrega no alojamento;
  - receber, devolver e trocar a mota, atrasos, chave perdida e danos;
  - acordo de aluguer, fotografias, multas e controlo policial;
  - categorias de carta, seguro obrigatório, buzina e motas de 50 cc;
  - zona de baixas emissões, ponte Long Biên e a loja em Long Biên.
- **Revisão de intenção** dos 45 temas em espera e de 3 temas problemáticos:
  - PT-0039 tinha uma premissa falsa: a semiautomática custa o mesmo que a Click;
  - PT-0081 e PT-0082 sobrepunham-se aos artigos semanal e mensal;
  - cada um destes 48 temas ganhou um ângulo próprio ou foi substituído na mesma categoria, sem mudar os totais por categoria;
  - ficam 0 temas em espera e 0 com risco alto de canibalização.
- **QA de linguagem**: «toda a gente» deixa de ser assinalado como pt-BR (só «a gente» o é).
- Testes independentes do estado do plano.

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
