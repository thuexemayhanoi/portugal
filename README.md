# pt.rentbikehanoi.com — Aluguer de motas em Hanói (pt-PT)

Site estático em **português de Portugal** da loja **Cho Thuê Xe Máy Nguyễn Tú** (112 Nguyễn Văn Cừ, Bồ Đề, Long Biên, Hà Nội). Publicado no GitHub Pages em <https://pt.rentbikehanoi.com/>.

> Hướng dẫn bảo trì/vận hành đầy đủ (tiếng Việt): **[AGENTS.md](AGENTS.md)**. Việc chủ website cần làm: **[docs/OWNER-ACTIONS.md](docs/OWNER-ACTIONS.md)**.

## Em resumo

- **Gerador sem dependências** (Node.js ≥ 20): `site/data.json` é a fonte única de NAP, preços, menu e microtexto; `src/css/tokens.css` concentra o design system *Blue Titanium* (claro/escuro).
- **12 páginas base**, **taxonomia 5 × 20** (`site/taxonomy.json`), **plano de 300 artigos** (`data/editorial-plan.json`) e **Content Factory** com QA automático, revisão humana e publicação transacional.
- **SEO técnico**: canonical, sitemap e robots gerados, JSON-LD (LocalBusiness/Organization com o NAP oficial, WebSite, WebPage, BreadcrumbList, BlogPosting, FAQPage), 404 noindex, pesquisa local carregada apenas quando aberta, sem fontes externas nem imagens pesadas.
- **SEO Monitor** (independente da fábrica): auditoria do site publicado, Lighthouse, IndexNow e, quando ligados, dados da Search Console e do Bing por grupo de palavras-chave.

## Comandos

```bash
npm run build      # gera todas as páginas e ficheiros SEO
npm run check      # verificação completa (igual à CI)
npm test           # testes unitários
npm run serve      # pré-visualização em http://127.0.0.1:8080
npm run audit:live # auditoria do site publicado (https://pt.rentbikehanoi.com)
node scripts/factory.mjs status
```

## Documentação

| Ficheiro | Conteúdo |
|---|---|
| [AGENTS.md](AGENTS.md) | Arquitetura, regras e operação (VI) |
| [factory/WRITER-CONTRACT.md](factory/WRITER-CONTRACT.md) | Contrato dos escritores (PT) |
| [docs/SEO-STANDARD.md](docs/SEO-STANDARD.md) | Norma SEO A–Z e como é verificada (VI) |
| [docs/GROWTH-MATRIX.md](docs/GROWTH-MATRIX.md) | Matriz de 300 temas (VI) |
| [docs/AUDIT-2026-10-12.md](docs/AUDIT-2026-10-12.md) | Auditoria inicial do repositório (VI) |
| [docs/OWNER-ACTIONS.md](docs/OWNER-ACTIONS.md) | Ações pendentes do proprietário (VI) |
| [docs/SEO-CHECKLIST.md](docs/SEO-CHECKLIST.md) | 9 grupos de trabalho SEO e 4 fases, com o estado de cada um (VI) |
| [docs/AUTHORITY-PLAN.md](docs/AUTHORITY-PLAN.md) | NAP oficial para citações, ligações e sinais de marca (VI) |
| [CHANGELOG.md](CHANGELOG.md) | Versões |

Os preços publicados são de referência; caução, documentos e entrega confirmam-se sempre com a loja.
