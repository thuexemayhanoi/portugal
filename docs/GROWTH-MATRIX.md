# SEO Growth Matrix — 300 chủ đề

Nguồn dữ liệu: `data/editorial-plan.json` (PT-0001 → PT-0300). Thống kê hiện tại: `node scripts/plan.mjs --stats`.

## Phân bổ (đúng chỉ tiêu taxonomy)

| Danh mục cha | Con (số bài) | Tổng |
|---|---|---|
| Tipos de motas | Scooters automáticas 25 · Motas semiautomáticas 15 · Motas de 50 cc 15 · Motas elétricas 10 | 65 |
| Preços e condições | Aluguer por duração 20 · Cauções e pagamentos 15 · Entrega e custos adicionais 15 · Comparações de preços 10 | 60 |
| Guia de aluguer | Processo e documentação 25 · Inspeção e segurança 25 · Condução e utilização diária 20 · Entrega, devolução e incidentes 20 | 90 |
| Zonas de Hanói | Bairro Antigo e Hoàn Kiếm 15 · Long Biên e Gia Lâm 12 · Tây Hồ e Ba Đình 10 · Estações e pontos de interesse 8 | 45 |
| Rotas e mobilidade | Itinerários urbanos 15 · Clima e épocas do ano 10 · Alternativas de transporte 10 · Viagens fora de Hanói 5 | 40 |

## Trường của mỗi chủ đề

| Trường | Ý nghĩa | Nguồn |
|---|---|---|
| `id`, `order` | PT-0001…PT-0300 liên tục | tính |
| `working_title`, `slug` | tiêu đề làm việc (pt-PT), slug cố định | tác giả |
| `primary_keyword`, `secondary_keywords` | từ khóa chính/phụ | tác giả |
| `search_intent`, `funnel_stage`, `priority` | informational/commercial/transactional/navigational · TOFU/MOFU/BOFU · 1–3 | tác giả |
| `parent_category`, `child_category` | taxonomy | tác giả / tính |
| `pillar_url`, `target_url` | trang trụ cột & URL đích | tính |
| `content_brief` | góc độ riêng, điều phải có/không được làm | tác giả |
| `target_words` | khoảng số từ (trong 1.000–3.000) | tính |
| `source_codes` → `source_requirements` | loại nguồn bắt buộc và số tối thiểu (B, L, P, S, M, W, X, Z, H) | tác giả / tính |
| `internal_links_out`, `internal_links_in` | trụ cột, hub cha, trang thương mại, 2 bài cùng cụm, 1 bài liên cụm | tính |
| `cannibalization_risk`, `cannibalization_with` | low/medium/high theo độ trùng từ khóa đặc trưng (cả với trang nền) | tính |
| `hold_reason`, `intent_reviewed` | lý do HOLD; người duyệt xác nhận intent khác biệt | tác giả |
| `editorial_qa_status` | PLANNED · QUEUED · IN_REVIEW · PUBLISHED · HOLD_FOR_INTENT_REVIEW · REWRITE_REQUIRED | tính |
| `metrics` | `null` — **không có số liệu volume/KD/ranking** khi chưa đo bằng công cụ thật | — |

## Ưu tiên thương mại

Priority 1 tập trung vào: aluguer de motas/scooters em Hanói, preços por dia/semana/mês, caução, documentação (LIC/IMT), entrega no hotel, Long Biên (nơi có cửa hàng), Bairro Antigo, các mẫu xe thật (Vision, Air Blade, Click, Mio, Wave, Sirius, 50 cc, elétrica). Hàng đợi xếp theo priority rồi **xen kẽ 5 danh mục cha** để phủ chủ đề đều.

## HOLD_FOR_INTENT_REVIEW (45 chủ đề)

Gắn khi tiêu đề chỉ khác **thời hạn** (3 ngày, 2 tuần, 2 ngày lịch trình…), chỉ khác **khu vực** với cùng câu trả lời (vd. "ficar alojado em …"), hoặc trùng ý định với trang nền/chủ đề khác. Cách xử lý:

1. Đọc `hold_reason` và các ID trong `cannibalization_with`.
2. Hoặc **gộp** (giữ chủ đề, đổi brief/keyword sang góc độ mới), hoặc **thay** bằng chủ đề khác cùng danh mục con (giữ nguyên số lượng).
3. Đặt `intent_reviewed: true`, xóa `hold_reason`, chạy `node scripts/plan.mjs --write`.

## Bài đã xuất bản (thí điểm)

PT-0001 (Honda Vision), PT-0066 (aluguer por um dia), PT-0126 (15 perguntas antes de alugar) — đi qua toàn bộ quy trình factory (inbox → QA → review → approve → publish).
