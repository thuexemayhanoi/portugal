# Audit nội dung & kế hoạch tăng trưởng — 13/10/2026

Sinh lại bằng `node scripts/audit-content.mjs` (chỉ đọc repo, không gọi mạng) và `node scripts/guard.mjs`. Số liệu dưới đây là tại thời điểm commit.

## Tình trạng

| Chỉ số | Giá trị |
|---|---|
| URL index được | 267 (237 bài + 30 trang nền/hub) |
| Bài theo kế hoạch 300 | 237 đã đăng · 63 chưa viết |
| URL index nhưng thiếu trong sitemap | 0 |
| Canonical sai | 0 |
| Bài chưa có liên kết ngữ cảnh trỏ vào | 89 (chỉ có link từ hub/archive) |
| Cặp có nguy cơ ăn thịt từ khóa | HIGH 1 · MEDIUM 7 · LOW 38 |

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
| 12 | QA Report & Deployment Plan | `npm run check` (0 lỗi), `npm test` (26/26), mục «Triển khai» |

## Collision Guard

Mỗi chủ đề mới đi qua: chuẩn hóa → so với URL đang chạy, bản nháp (inbox/review/hold), chủ đề khác trong kế hoạch → so intent (Jaccard) → so ngữ nghĩa (TF-IDF cosine) → quyết định:

- `ALLOW_CREATE`: khoảng trống thật → được đưa vào hàng đợi viết.
- `UPGRADE_EXISTING`: URL đang có đã trả lời → nâng cấp URL đó, không tạo URL mới.
- `REVIEW_COLLISION`: không chắc → người duyệt quyết định (đặt `guard_reviewed: true` trong kế hoạch sau khi kiểm tra).
- `REJECT_DUPLICATE`: trùng từ khóa chính hoặc intent ≥ 0,75 với URL đang chạy.

Bản nháp đặt trong `_factory/hold/` luôn là REVIEW và không bao giờ vào hàng đợi.

## 63 chủ đề còn lại (Knowledge Gap)

- **10 chủ đề REVIEW** (có thể trùng với URL đang chạy, cần chủ site quyết định): PT-0006, PT-0039 (bản nháp trong `_factory/hold`, gần với «scooter ou semiautomática»), PT-0057, PT-0211, PT-0221, PT-0232, PT-0246, PT-0267, PT-0270, PT-0296. Đề xuất: phần lớn nên **nâng cấp bài đang có** thay vì tạo URL mới.
- **53 chủ đề ALLOW_CREATE nhưng thiếu dữ kiện đã xác minh** (kỹ thuật lái xe số, giá gửi xe, thanh toán/thẻ, ga tàu và bến xe, Long Biên/Tây Hồ, chợ, ...). Writer không viết khi không có nguồn. Cần một vòng nghiên cứu mới rồi mới viết.

## Rủi ro

| Rủi ro | Mức | Xử lý |
|---|---|---|
| Luật Việt Nam thay đổi (Nghị định 168, Nghị quyết 56/2026 Hà Nội nhân 1,5–2 lần mức phạt) | Cao | Bài có `legal_note` ghi ngày tra cứu; rà soát định kỳ |
| Phường Bồ Đề có thể đã đổi tên sau sắp xếp hành chính 2025 | Trung bình | Không sửa NAP — chủ site xác nhận |
| Giờ mở cửa/giá vé của điểm tham quan lấy từ nguồn du lịch không đồng nhất | Trung bình | Bài ghi rõ là khoảng giá, khuyên kiểm tra lại |
| Templo da Literatura ↔ Cidadela Imperial (HIGH, trùng đoạn về đường đi/đỗ xe chung khu vực) | Thấp | Hai địa danh, hai intent khác nhau; giữ nguyên, theo dõi Search Console |
| 89 bài chưa có link ngữ cảnh trỏ vào | Thấp | Lượt liên kết chéo tiếp theo (bản sửa giữ nguyên URL) |

## Triển khai

1. `npm run build` → `npm run check` → `npm test` (đều 0 lỗi).
2. Merge vào `main` → GitHub Pages tự deploy → workflow **SEO Audit & Monitoring** kiểm tra site thật và gửi IndexNow.
3. Không đổi slug/URL nào đã đăng; mọi sửa đổi bài cũ đi qua `revision` (giữ ngày đăng gốc).
