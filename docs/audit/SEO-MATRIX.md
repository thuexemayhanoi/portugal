# SEO Master Matrix — pt.rentbikehanoi.com

Ma trận đánh giá **từng URL** (332 URL: 12 trang nền, 2 hub, 18 archive, 300 bài) theo P0/P1/P2.

- **Sinh lại bằng:** `node scripts/seo-matrix.mjs`. Script chỉ đọc HTML đã build, `sitemap.xml`, `llms.txt` và model nội dung, không sửa gì trên site.
- **Kết quả:** `seo-master-matrix.csv` (1 dòng / URL) và `seo-matrix-summary.json` (số liệu tổng).
- **Đo hiệu năng (lab):** `node scripts/tools/cwv-lab.mjs` → `cwv-lab.json`.

## Mức ưu tiên

| Mức | Nghĩa | Ví dụ kiểm tra |
|---|---|---|
| **P0** | Hỏng index, sai dữ kiện hoặc mất tin cậy: sửa ngay | canonical sai, indexable mà ngoài sitemap, noindex trong sitemap, `lang`, viewport, title/description thiếu hoặc trùng, ≠ 1 H1, JSON-LD lỗi hoặc có trường cấm, bài thiếu BlogPosting, FAQPage không có FAQ hiển thị |
| **P1** | Mất điểm SEO rõ ràng: batch kế tiếp | title ngoài 30–70 ký tự, description ngoài 110–165, title gần trùng, từ khóa chính vắng trong title/H1, bài < 900 từ, bài không có nguồn, bài mồ côi (0 link ngữ cảnh), FAQ hiển thị mà thiếu FAQPage, thiếu BreadcrumbList, ảnh thiếu alt, bảng không cuộn được trên mobile, thiếu answer box, nội dung chồng lấn (cannibalization HIGH/MEDIUM) |
| **P2** | Cải thiện dần | title > 65 ký tự, description 110–119 hoặc 161–165 ký tự, từ khóa vắng trong description, < 3 nguồn, chỉ 1 link ngữ cảnh trỏ vào, < 5 link nội bộ ra, nhảy cấp heading, ảnh thiếu width/height, HTML > 120 KB, vắng trong `llms.txt`, FAQ < 2 câu |

Các mục đã đạt trên toàn site (qa-site chặn khi build): canonical tự tham chiếu, sitemap ⇔ trang indexable, robots.txt, 404 noindex, không link gãy (nội bộ và anchor), NAP thống nhất, không aggregateRating/review/tọa độ, pt-PT.

## Trạng thái hiện tại (14/10/2026, sau batch 1)

| | P0 | P1 | P2 | OK |
|---|---|---|---|---|
| Trước batch 1 | 0 | 98 | 92 | 142 |
| **Sau batch 1** | **0** | **21** | **92** | **219** |

**P1 còn lại (21 URL):**

1. **Cannibalization theo độ trùng chữ (14 URL, 7 cặp).**
   - Các cặp: Văn Miếu ↔ Hoàng thành Thăng Long, Nhà thờ Lớn ↔ khu phố Pháp, Bảo tàng Dân tộc học ↔ Phủ Tây Hồ, đi đêm ↔ ẩm thực đường phố / kiến trúc Pháp, xe 50 cc hay xe điện ↔ xe điện hay xe xăng, tai nạn ↔ va chạm nhẹ.
   - Mỗi cặp là hai địa danh hoặc hai câu hỏi khác nhau, trùng nhau ở đoạn dùng chung (đường đi, chỗ gửi xe, tiền phạt).
   - Hướng xử lý: viết lại đoạn trùng cho khác góc nhìn. **Không merge, không redirect, không noindex** khi chưa được duyệt.
2. **Bài không có nguồn trích dẫn (6 bài):** PT-0094, 0108, 0115, 0137, 0197, 0208. Đây là bài quy trình, phần lớn là "hỏi cửa hàng". Chỉ thêm nguồn khi có nguồn thật đỡ được nội dung, không thêm nguồn cho đủ số.
3. **Title gần trùng (2 URL):** `/precos/` ↔ `/precos/aluguer-por-duracao/`. Đây là archive tự sinh; đề xuất làm title của archive khác đi.

**P2 (92 URL):** chủ yếu là từ khóa chính vắng trong meta description (52), < 3 nguồn (26), chỉ 1 link ngữ cảnh trỏ vào (26). Theo quy tắc bảo vệ production, **không đổi hàng loạt title/description**; chỉ sửa trang có lý do rõ ràng.

## Core Web Vitals (lab, không phải dữ liệu thực địa)

Điều kiện đo: Chromium headless, mobile 390×844, CPU ×4, ~1,6 Mbps, RTT 150 ms, server local không gzip.

| Mẫu | LCP | CLS | TBT |
|---|---|---|---|
| Trang chủ | 780 ms | 0 | 90 ms |
| Pillar /precos/ | 808 ms | 0 | 60 ms |
| Hub | 804 ms | 0 | 42 ms |
| Archive | 660 ms | 0 | 8 ms |
| Bài có bảng | 796 ms | 0 | 86 ms |
| Bài dài | 804 ms | 0 | 49 ms |
| FAQ | 740 ms | 0 | 21 ms |
| Liên hệ | 640 ms | 0 | 26 ms |

Tất cả đạt ngân sách (LCP ≤ 2,5 s, CLS ≤ 0,1, TBT ≤ 200 ms) và không tràn ngang. Dữ liệu thực địa (CrUX) và INP cần người dùng thật: theo dõi trong Search Console sau khi kết nối.

## Nhật ký batch

| Batch | Ngày | Nội dung | Kết quả |
|---|---|---|---|
| 0 | 14/10 | Sửa 5 lỗi dữ kiện do review phát hiện: điểm trừ GPLX (PT-0182), xử lý bánh xe bó cứng khi phanh (PT-0029), `{{closes}}` (PT-0247), tiền polymer (PT-0090), số bến xe (PT-0256) | Đã deploy cùng batch 1 |
| 1 | 14/10 | Thêm 158 link ngữ cảnh qua 130 bản sửa (giữ URL và ngày đăng). `llms.txt` thêm mục "Categorias" (18 archive và hub). Thêm công cụ SEO Matrix và đo CWV lab | Mồ côi 79 → 0; P1 98 → 21; check và test xanh |

## Chưa đo được (không giả định)

- Search Console / Bing: impressions, clicks, CTR, vị trí, trạng thái index. Cần chủ site cấu hình (xem `docs/OWNER-ACTIONS.md`).
- Core Web Vitals thực địa và INP.
- HTTP status trên site thật: do workflow SEO Monitor kiểm tra sau mỗi lần deploy.
