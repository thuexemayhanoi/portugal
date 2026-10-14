# Audit nội dung & kế hoạch tăng trưởng — 14/10/2026

Sinh lại bằng `node scripts/audit-content.mjs` (chỉ đọc repo, không gọi mạng) và `node scripts/guard.mjs`. Bảng dưới đây là bản tóm tắt; **số liệu hiện hành luôn nằm trong `summary.json` và `seo-matrix-summary.json`** (sinh lại ở mỗi batch). Ma trận theo từng URL: xem `SEO-MATRIX.md`.

## Tình trạng

| Chỉ số | Giá trị |
|---|---|
| URL index được | 332 (300 bài + 32 trang nền/hub) |
| Bài theo kế hoạch 300 | 300 đã đăng · 0 còn lại |
| URL index nhưng thiếu trong sitemap | 0 |
| Canonical sai | 0 |
| Bài chưa có liên kết ngữ cảnh trỏ vào | 0 (sau SEO batch 1 và 4) |
| Cặp có nguy cơ ăn thịt từ khóa | HIGH 0 · MEDIUM 0 · LOW 43 (sau SEO batch 2) |

**Chưa đo được** (không giả định): HTTP status trên site thật (xem workflow SEO Monitor), Search Console (chưa kết nối), Core Web Vitals thực tế.

## Các bảng (12 deliverable)

| # | Deliverable | Ở đâu |
|---|---|---|
| 1 | Global Content Inventory | `inventory.csv` (URL, ID, title, H1, meta, danh mục, intent, từ khóa, số từ, ngày, canonical, robots, sitemap, link ra/vào, nguồn) |
| 2 | SEO Master Matrix | `inventory.csv` cột `role` + `action` |
| 3 | Cannibalization Matrix | `cannibalization.csv` |
| 4 | Topical Coverage Matrix | `coverage.csv` (5 danh mục cha / 20 con) |
| 5 | Knowledge Gap Report | mục «63 chủ đề còn lại» bên dưới |
| 6 | Knowledge Graph / Topic Cluster | `entities.csv` (thực thể → URL) |
| 7 | Internal Linking Matrix | `internal-links.csv` |
| 8 | Content Upgrade Backlog | `upgrade-backlog.csv` |
| 9 | New Content Editorial Plan | `data/editorial-plan.json` + `data/writer-queue.json` |
| 10 | AI Content Collision Guard | `scripts/lib/guard.mjs`, báo cáo `reports/collision-guard.json` |
| 11 | Risk Register | mục «Rủi ro» bên dưới |
| 12 | QA Report & Deployment Plan | `npm run check` (0 lỗi), `npm test` (24 pass, 2 skip vì không còn chủ đề mở), mục «Triển khai» |

## Collision Guard

Mỗi chủ đề mới đi qua: chuẩn hóa → so với URL đang chạy, bản nháp (inbox/review/hold), chủ đề khác trong kế hoạch → so intent (Jaccard) → so ngữ nghĩa (TF-IDF cosine) → quyết định:

- `ALLOW_CREATE`: khoảng trống thật → được đưa vào hàng đợi viết.
- `UPGRADE_EXISTING`: URL đang có đã trả lời → nâng cấp URL đó, không tạo URL mới.
- `REVIEW_COLLISION`: không chắc → người duyệt quyết định (đặt `guard_reviewed: true` trong kế hoạch sau khi kiểm tra).
- `REJECT_DUPLICATE`: trùng từ khóa chính hoặc intent ≥ 0,75 với URL đang chạy.

Bản nháp đặt trong `_factory/hold/` luôn là REVIEW và không bao giờ vào hàng đợi.

## Hoàn thành kế hoạch 300 bài (Knowledge Gap đã xử lý)

- **10 chủ đề REVIEW đã được duyệt** (14/10/2026):
  - 3 chủ đề trùng hẳn với bài đang có được thay bằng chủ đề mới trong cùng danh mục: PT-0221 (cầu Long Biên → nhà hát múa rối nước Thăng Long), PT-0232 (đường tới cửa hàng → Vinhomes Riverside), PT-0296 (chuẩn bị đi xa → Tam Đảo).
  - 7 chủ đề trả lời câu hỏi khác với bài đang có, đánh dấu `guard_reviewed`: PT-0006, PT-0039, PT-0057, PT-0211, PT-0246, PT-0267, PT-0270.
- **53 chủ đề thiếu dữ kiện**: có thêm 8 gói nghiên cứu mới, sau đó các bài được viết. Điểm nào chưa xác minh được ghi rõ ngay trong bài («por confirmar» / «o que perguntar»), không trình bày như sự thật.
- Muốn tăng thêm nội dung thì phải dựa trên khoảng trống có bằng chứng (Search Console và câu hỏi thật của khách), không đặt chỉ tiêu số bài.

## Rủi ro

| Rủi ro | Mức | Xử lý |
|---|---|---|
| Luật Việt Nam thay đổi (Nghị định 168, Nghị quyết 56/2026 Hà Nội nhân 1,5–2 lần mức phạt) | Cao | Bài có `legal_note` ghi ngày tra cứu; rà soát định kỳ |
| Phường Bồ Đề có thể đã đổi tên sau sắp xếp hành chính 2025 | Trung bình | Không sửa NAP — chủ site xác nhận |
| Giờ mở cửa/giá vé của điểm tham quan lấy từ nguồn du lịch không đồng nhất | Trung bình | Bài ghi rõ là khoảng giá, khuyên kiểm tra lại |
| Đoạn chung lặp lại giữa các bài cùng khu vực (đỗ xe, cầu Long Biên, vùng phát thải thấp) | Thấp | Đã viết lại ở 6 bài (batch 2): mỗi bài một câu riêng + link về bài hướng dẫn chính. Bài mới nên làm tương tự |

## Triển khai

1. `npm run build` → `npm run check` → `npm test` (đều 0 lỗi).
2. Merge vào `main` → GitHub Pages tự deploy → workflow **SEO Audit & Monitoring** kiểm tra site thật và gửi IndexNow.
3. Không đổi slug/URL nào đã đăng; mọi sửa đổi bài cũ đi qua `revision` (giữ ngày đăng gốc).
