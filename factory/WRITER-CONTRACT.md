# Contrato do escritor — Content Factory 300 (pt.rentbikehanoi.com)

> **Tóm tắt (tiếng Việt, cho chủ website):** người viết (người thật, AI bên ngoài hoặc Claude) chỉ viết các chủ đề có trong `data/writer-queue.json`, mỗi bài một file `_factory/inbox/PT-XXXX.json` đúng định dạng `factory/article.schema.json`. Mọi dữ kiện kinh doanh (giá, điện thoại, giờ mở cửa, địa chỉ) phải dùng token `{{...}}` để tự đồng bộ từ `site/data.json`. Cấm tự bịa caução, giao xe miễn phí, không cần bằng lái, 24/7, bảo hiểm, đánh giá, xếp hạng. QA tự động (`scripts/qa-factory.mjs`) sẽ từ chối bài vi phạm; bài đạt QA chờ duyệt (`factory approve`) rồi mới xuất bản. QA còn kiểm tra trùng search intent với trang đã đăng và các bài cùng lô, đối chiếu nguồn (nội dung pháp lý phải có nguồn luật/chính thức, nguồn quá cũ bị cảnh báo), phát hiện văn bản sao chép/dịch máy (tiếng Tây Ban Nha, tiếng Anh, thiếu dấu); tối đa 10 bài mới mỗi 7 ngày; sửa bài cũ bằng trường `revision`.

Versão do contrato: **1**. Língua: **português de Portugal (pt-PT)**, Acordo Ortográfico de 1990.

## 1. O que entregar

1. Ler `data/writer-queue.json` e escrever **apenas** temas dessa fila (campo `items`).
2. Um ficheiro por artigo: `_factory/inbox/PT-XXXX.json`, em UTF-8, válido segundo `factory/article.schema.json`.
3. Não alterar código, configuração, plano, estado da fábrica nem ficheiros já publicados.
4. Parar se `factory_status` for `PAUSED` ou se a fila estiver vazia.

## 2. Campos obrigatórios

| Campo | Regra |
|---|---|
| `contract_version` | `1` |
| `id`, `slug` | Exatamente os do item da fila |
| `title` | Título SEO único, 30–65 caracteres (máx. 70), com o tema principal |
| `description` | Meta descrição única, 120–160 caracteres, útil e concreta |
| `h1` | Título visível, diferente do `title`, mesmo tema |
| `summary` | **Resposta direta** à pergunta do tema em 1–3 frases (80–420 caracteres) |
| `key_points` | 3–6 pontos-chave curtos |
| `intro` | 1–3 parágrafos que enquadram o tema sem repetir o resumo |
| `sections` | ≥ 4 secções `{ "h2": "...", "body": [...] }`, H2 únicos |
| `faq` | Vazio ou 2–8 perguntas reais (terminam em `?`, resposta de 40–700 caracteres) |
| `sources` | IDs de `site/sources.json` e/ou fontes novas `{title, publisher, url, accessed}` |
| `legal_note` | `true` em temas de lei, seguros ou segurança |
| `writer` | `{ "type": "human" | "external-ai" | "claude", "name": "..." }` |
| `status` | `"READY_FOR_QA"` |

Extensão: o intervalo `target_words` do item (sempre entre **1.000 e 3.000 palavras** de texto editorial).

## 3. Blocos do corpo

Cada elemento de `body` é um destes:

- texto simples → parágrafo;
- `{ "h3": "Subtítulo" }`;
- `{ "ul": [...] }`, `{ "ol": [...] }`, `{ "checklist": [...] }`;
- `{ "steps": [{ "title": "...", "text": "..." }] }`;
- `{ "table": { "caption": "...", "head": [...], "rows": [[...]] } }`;
- `{ "note": "...", "tone": "info" | "warn", "title": "..." }`;
- `{ "component": "price-table" | "model-cards", "category": "scooters-automaticas" | "motas-semiautomaticas" | "motas-50cc" | "motas-eletricas" | "bicicletas-eletricas" }` — mostra os preços da loja, sempre atualizados.

Formatação em linha: `[texto](/url-interna/)`, `[texto](https://fonte-externa)` e `**destaque**`. HTML é proibido.

## 4. Factos da loja: sempre por token

Nunca escreva à mão preços, telefone, morada ou horário. Use tokens (substituídos na compilação a partir de `site/data.json`):

| Token | Exemplo de valor atual |
|---|---|
| `{{name}}` / `{{display}}` / `{{brand}}` / `{{gbp}}` | Cho Thuê Xe Máy Nguyễn Tú / Nguyễn Tú — Aluguer de Motas em Hanói / Nguyễn Tú / Thuê xe máy ở Hà Nội - Nguyễn Tú (nome no Google Maps) |
| `{{address}}` / `{{address.vi}}` | 112 Nguyễn Văn Cừ, Bồ Đề, Long Biên, Hanói, Vietname / a mesma morada em vietnamita (para mostrar ao taxista) |
| `{{street}}` / `{{area}}` | 112 Nguyễn Văn Cừ / Long Biên, Hanói |
| `{{phone}}` / `{{phone.local}}` / `{{tel}}` | +84 942 467 674 / 0942 467 674 / `tel:+84942467674` para ligações |
| `{{hours}}` / `{{hours.display}}` | «todos os dias, das 09:00 às 21:00» (dentro de uma frase) / «Aberto todos os dias, das 09:00 às 21:00.» (frase completa) |
| `{{maps}}`, `{{zalo}}`, `{{website}}`, `{{byline}}` | Google Maps (CID oficial), Zalo, site principal da loja, assinatura editorial |
| `{{price.<modelo>.day|week|month}}` | modelos: `wave`, `sirius`, `vision`, `airblade`, `click`, `mio`, `cc50`, `eletrica`, `bicicleta` |
| `{{price.min.day}}`, `{{price.max.day}}`, `{{pricing.verifiedAt}}` | intervalo diário e data de verificação |

Valores legais (coimas, limites) podem ser escritos por extenso, **sempre com fonte**.

## 5. Proibido inventar

Não afirmar sem confirmação escrita do proprietário: montantes de caução, aluguer sem caução, entrega ou recolha grátis, dispensa de carta (incluindo 50 cc), atendimento 24 horas, seguro incluído, descontos, disponibilidade garantida, avaliações, estrelas, prémios, rankings, número de clientes, experiências pessoais («quando alugámos…») ou citações de clientes. Quando um ponto depende da loja, diga **o que perguntar** e remeta para [Contactos](/contactos/).

## 6. Fontes

- Mínimo indicado em `source_requirements.min_sources` (0–2), com prioridade para fontes oficiais: legislação vietnamita, IMT, Portal Diplomático, operadores de transporte, serviços meteorológicos, fabricantes.
- Reutilize IDs de `site/sources.json` sempre que existam.
- Fontes novas: URL `https://` real e verificada, título e entidade reais, data de consulta (`AAAA-MM-DD`). **Nunca inventar URLs.** O QA pode verificar cada URL online.
- Temas sensíveis ao tempo (código `Z`): confirmar a regra em vigor na data de consulta e dizê-lo no texto.
- Indique `type` em cada fonte nova (`legal-database`, `official`, `news`, `manufacturer`, `business`, `reference`) e `lang` (`pt`, `vi`, `en`…).
- **Cruzamento de fontes (QA):** se o texto falar de leis, decretos, coimas, idade mínima, álcool ou Licença Internacional de Condução, tem de citar pelo menos uma fonte `legal-database` ou `official` e marcar `legal_note: true`. Temas com código `P` exigem fonte oficial portuguesa (IMT, Portal Diplomático, gov.pt). Fontes consultadas há mais de 365 dias geram aviso; há mais de 730 dias, erro.

## 7. Ligações internas

- Pelo menos **3** ligações internas distintas, incluindo **obrigatoriamente** o `pillar_url` quando estiver publicado.
- Usar apenas URLs de `live_pages` (e as de `required_links`). Os URLs de `planned_links_not_live_yet` ainda não existem: não os ligue.
- Âncoras descritivas («a tabela de preços por semana»), nunca «clique aqui».

## 8. Estilo: português de Portugal

- Vocabulário: aluguer (não aluguel), mota, telemóvel, autocarro, comboio, carta de condução, travões, contacto, receção, secção, registo, equipa, utilizador, quilómetro, Vietname, ecrã, casa de banho, pequeno-almoço, portagem, camião.
- Progressivo com «a + infinitivo» («está a chover»), não gerúndio.
- Tratamento formal implícito («Confirme…», «Pode…»), ênclise nas orações afirmativas («Contacte-nos»).
- Números: «150.000 VND», «1.000 km»; datas: «12 de outubro de 2026»; horas: «09:00».
- Frases claras, parágrafos de 2–5 frases, sem enchimento nem repetição da palavra-chave. O QA avisa quando a média passa de 26 palavras por frase ou uma frase passa de 50.
- Exónimos em português: **Hanói**, **Vietname** (não «Hanoi», «Vietnam»); «mota» em vez de «moto».
- **Texto original, nunca traduzido nem copiado** (do site espanhol ou de outro): palavras em espanhol, frases em inglês ou palavras portuguesas sem acentos («nao», «possivel») são detetadas; a partir de 2–3 ocorrências o rascunho é rejeitado.

## 9. SEO e respostas diretas

- A primeira frase do `summary` responde à pergunta do tema; os H2 seguem a ordem lógica da decisão do leitor.
- Uma intenção por artigo: não repetir o que já responde o `pillar_url` ou outro artigo publicado — aprofunde o ângulo do `content_brief`. O QA compara a «impressão digital» de intenção (palavra-chave principal + título + H1) com todas as páginas publicadas e com os outros rascunhos do mesmo lote: sobreposição ≥ 0,45 gera aviso, ≥ 0,6 rejeita; a mesma palavra-chave principal de uma página publicada também rejeita.
- Palavra-chave principal no título ou no H1 e no início do texto, sem repetição artificial.
- FAQ só com perguntas que o leitor faria e que o texto não responde já de forma óbvia.

## 10. Fluxo e QA

`_factory/inbox/` → `node scripts/factory.mjs process` (QA automático) → `_factory/review/` com relatório `.qa.json` → aprovação editorial (`node scripts/factory.mjs approve PT-XXXX`) → `content/articles/` → site regenerado e verificado. Rascunhos com erros vão para `_factory/rejected/` com o relatório; reescreva e volte a entregar na inbox.

O QA verifica estrutura, extensão, tokens, ligações, fontes (tipo, data, cruzamento com o tema), unicidade de título/descrição, intenção de pesquisa, vocabulário pt-BR, texto copiado ou traduzido, afirmações não verificadas e semelhança com páginas existentes. **Passar no QA não garante qualidade editorial nem posições no Google**: a revisão humana continua necessária.

**Ritmo de publicação:** no máximo `publishing.max_new_per_7_days` artigos novos (10 por omissão) em qualquer janela de 7 dias. Acima disso, `approve` devolve `PACE_LIMIT` e o rascunho fica em revisão.

### Atualizar um artigo publicado (manutenção de conteúdo)

Para melhorar um artigo existente (dados da Search Console, lei alterada, preço novo), entregue na inbox o mesmo `id` e `slug` com o texto completo revisto e o campo:

```json
"revision": { "reason": "Coimas atualizadas segundo o decreto em vigor; título reescrito por CTR baixo." }
```

O URL nunca muda. A data de publicação original mantém-se, `date_modified` passa a ser a da aprovação e o motivo fica no histórico (`editorial.revisions`). Sem `revision`, um id já publicado é rejeitado.

## 11. Esqueleto mínimo (não publicável: falta extensão)

```json
{
  "contract_version": 1,
  "id": "PT-0068",
  "slug": "aluguer-mensal-de-mota",
  "title": "Aluguer mensal de mota em Hanói: preços e condições",
  "description": "Quanto custa alugar uma mota por um mês em Hanói, que modelos compensam e o que confirmar com a loja antes de fechar um aluguer longo.",
  "h1": "Alugar uma mota por um mês em Hanói",
  "summary": "Na tabela de referência da loja, um mês de mota custa entre {{price.wave.month}} e {{price.vision.month}}, conforme o modelo.",
  "key_points": ["…", "…", "…"],
  "intro": ["…"],
  "sections": [{ "h2": "…", "body": ["… [tabela de preços](/precos/) …", { "component": "price-table", "category": "scooters-automaticas" }] }],
  "faq": [],
  "sources": ["tabela-precos-proprietario"],
  "legal_note": false,
  "writer": { "type": "human", "name": "Nome do autor" },
  "status": "READY_FOR_QA"
}
```
