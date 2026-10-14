# SEO Master Matrix — pt.rentbikehanoi.com

Ma trận đánh giá **từng URL** (332 URL: 12 trang nền, 2 hub, 18 archive, 300 bài) theo P0/P1/P2.

- **Sinh lại bằng:** `node scripts/seo-matrix.mjs`. Script chỉ đọc HTML đã build, `sitemap.xml`, `llms.txt` và model nội dung, không sửa gì trên site.
- **Kết quả:** `seo-master-matrix.csv` (1 dòng / URL) và `seo-matrix-summary.json` (số liệu tổng).
- **Đo hiệu năng (lab):** `node scripts/tools/cwv-lab.mjs` → `cwv-lab.json`.
- **Cửa chặn CI:** `node scripts/seo-matrix.mjs --check` (trong `npm run check` và Site QA) không ghi file và báo lỗi khi bất kỳ URL nào còn P0.

## Mức ưu tiên

| Mức | Nghĩa | Ví dụ kiểm tra |
|---|---|---|
| **P0** | Hỏng index, sai dữ kiện hoặc mất tin cậy: sửa ngay | canonical sai, indexable mà ngoài sitemap, noindex trong sitemap, `lang`, viewport, title/description thiếu hoặc trùng, ≠ 1 H1, JSON-LD lỗi hoặc có trường cấm, bài thiếu BlogPosting, FAQPage không có FAQ hiển thị |
| **P1** | Mất điểm SEO rõ ràng: batch kế tiếp | title ngoài 30–70 ký tự, description ngoài 110–165, title gần trùng, từ khóa chính vắng trong title/H1, bài < 900 từ, bài không có nguồn, bài mồ côi (0 link ngữ cảnh), FAQ hiển thị mà thiếu FAQPage, thiếu BreadcrumbList, ảnh thiếu alt, bảng không cuộn được trên mobile, thiếu answer box, nội dung chồng lấn (cannibalization HIGH/MEDIUM) |
| **P2** | Cải thiện dần | title > 65 ký tự, description 110–119 hoặc 161–165 ký tự, từ khóa vắng trong description, bài có nota legal mà < 3 nguồn, bài quy trình không có nguồn, chỉ 1 link ngữ cảnh trỏ vào, < 5 link nội bộ ra, nhảy cấp heading, ảnh thiếu width/height, HTML > 120 KB, vắng trong `llms.txt`, FAQ < 2 câu, trang nền < 300 từ (trừ trang tiện ích: liên hệ, về chúng tôi, privacidade, termos) |

Các mục đã đạt trên toàn site (qa-site chặn khi build): canonical tự tham chiếu, sitemap ⇔ trang indexable, robots.txt, 404 noindex, không link gãy (nội bộ và anchor), NAP thống nhất, không aggregateRating/review/tọa độ, pt-PT.

## Trạng thái hiện tại (14/10/2026, sau batch 6)

| | P0 | P1 | P2 | OK |
|---|---|---|---|---|
| Trước batch 1 | 0 | 98 | 92 | 142 |
| Sau batch 1 | 0 | 21 | 92 | 219 |
| Sau batch 4 | 0 | 0 | 79 | 253 |
| Sau batch 5 (quy tắc tinh chỉnh) | 0 | 0 | 62 | 270 |
| **Sau batch 6** | **0** | **0** | **13** | **319** |

**P2 còn lại (13 URL), chấp nhận có lý do, không ép:**
- 7 bài có nota legal nhưng chỉ 1–2 nguồn: nội dung luật dẫn thẳng văn bản luật (Nghị định 168/2024, Luật Trật tự an toàn giao thông đường bộ…). Chỉ thêm nguồn khi có nguồn thật đỡ được nội dung; không thêm nguồn cho đủ số.
- 6 bài quy trình không có nguồn ngoài: hợp lệ, vì không có dữ kiện bên ngoài nào cần dẫn (nguồn duy nhất là thông tin của cửa hàng).

Đã xử lý ở batch 6: 49 meta description viết lại theo đúng từ khóa chính (độ phủ ≥ 0,5, 120–160 ký tự, không khẳng định gì ngoài bài); 2 bài chỉ có 1 link vào (PT-0124, PT-0220) có thêm link thứ hai. Hai quy tắc gây nhiễu được tinh chỉnh ở batch 5: «< 3 nguồn» chỉ áp dụng cho bài có nota legal; trang tiện ích không bị tính là «trang ngắn».

## Từ khóa thương mại: mỗi cụm một trang đích (`money-keywords.csv`)

| Cụm truy vấn (pt-PT) | Trang đích | Link ngữ cảnh trỏ vào | Title khác bắt đầu bằng cùng cụm |
|---|---|---|---|
| aluguer de motas em Hanói | `/` | 22 (trước batch 3: 0) | 0 |
| preços aluguer mota Hanói | `/precos/` | 97 | 0 |
| aluguer de scooter em Hanói | `/tipos-de-motas/scooters/` | 56 | 0 |
| como alugar mota em Hanói | `/guia-de-aluguer/` | 86 | 0 |
| documentos e caução aluguer mota Hanói | `/guia-de-aluguer/documentacao-e-caucao/` | 196 | 0 |
| mota 50cc Hanói | `/tipos-de-motas/motas-50cc/` | 32 | 0 |
| tipos de motas para alugar em Hanói | `/tipos-de-motas/` | 56 | 0 |

**Anchor trỏ về trang chủ trong nội dung nguồn (24 anchor, theo `home_anchor_texts` trong `seo-matrix-summary.json`):**

| Anchor | Số link |
|---|---|
| «alugar uma mota em Hanói» | 5 |
| «página inicial» (3 trang institucional) | 5 |
| «aluguer de motas em Hanói» | 4 |
| «loja de aluguer de motas em Hanói» | 3 |
| «loja de aluguer de motas em Long Biên» | 3 |
| «motas para alugar em Hanói» | 2 |
| «scooters e motas para alugar em Hanói» | 1 |
| «alugar uma mota» | 1 |

Anchor khớp chính xác chỉ chiếm 17%, tức là đa dạng, không nhồi từ khóa.

## Core Web Vitals (lab, không phải dữ liệu thực địa)

Điều kiện đo: Chromium headless, mobile 390×844, CPU ×4, ~1,6 Mbps, RTT 150 ms, server local không gzip.

| Mẫu | LCP | CLS | TBT | Dung lượng (chưa gzip) |
|---|---|---|---|---|
| Trang chủ | 772 ms | 0 | 77 ms | 94 KB |
| Pillar /precos/ | 812 ms | 0 | 69 ms | 103 KB |
| Hub | 804 ms | 0 | 48 ms | 106 KB |
| Archive | 684 ms | 0 | 43 ms | 83 KB |
| Bài có bảng | 768 ms | 0 | 84 ms | 111 KB |
| Bài dài | 840 ms | 0 | 70 ms | 108 KB |
| FAQ | 724 ms | 0 | 19 ms | 98 KB |
| Liên hệ | 672 ms | 0 | 47 ms | 75 KB |

Tất cả đạt ngân sách (LCP ≤ 2,5 s, CLS ≤ 0,1, TBT ≤ 200 ms) và không tràn ngang. Dữ liệu thực địa (CrUX) và INP cần người dùng thật: theo dõi trong Search Console sau khi kết nối.

## Nhật ký batch

| Batch | Ngày | Nội dung | Kết quả |
|---|---|---|---|
| 0 | 14/10 | Sửa 5 lỗi dữ kiện do review phát hiện: điểm trừ GPLX (PT-0182), xử lý bánh xe bó cứng khi phanh (PT-0029), `{{closes}}` (PT-0247), tiền polymer (PT-0090), số bến xe (PT-0256) | Đã deploy cùng batch 1 |
| 1 | 14/10 | Thêm 158 link ngữ cảnh qua 130 bản sửa (giữ URL và ngày đăng). `llms.txt` thêm mục "Categorias" (18 archive và hub). Thêm công cụ SEO Matrix và đo CWV lab | Mồ côi 79 → 0; P1 98 → 21; check và test xanh |
| 2 | 14/10 | Viết lại đoạn chung lặp lại ở 6 bài: PT-0258, 0227, 0260, 0268, 0047, 0202 (mỗi bài một câu riêng + link về bài hướng dẫn chính). Đổi title archive `/precos/aluguer-por-duracao/` cho khác `/precos/` | Cặp HIGH/MEDIUM 7 → 0 (độ trùng mọi cặp < 0,10) |
| 3 | 14/10 | Trang chủ thành trang đích của «aluguer de motas em Hanói»: thêm 20 link ngữ cảnh (4 trang trụ cột + 16 bài), anchor đa dạng; H1 của trang giấy tờ & tiền cọc nêu đúng truy vấn; trang chủ có trong `llms.txt` | Link vào trang chủ 0 → 20 |
| 4 | 14/10 | Thêm 1 link vào cho 24 bài chỉ có 1 link trỏ vào. Sửa 4 góp ý review: cannibalization tính trực tiếp, so khớp `llms.txt` chính xác, đo dung lượng CWV, README | P1 → 0; check và test xanh |
| 5 | 14/10 | Giữ kết quả bền vững: `seo-matrix --check` vào `npm run check` và CI (chặn khi còn P0); factory QA đo trùng văn bản bằng đúng phép đo của Matrix (cụm 3 từ, ≥ 0,12 cảnh báo, ≥ 0,20 loại) để bài mới không tái tạo cannibalization. Tinh chỉnh 2 quy tắc P2 (nguồn chỉ với bài pháp lý; trang tiện ích không là «trang ngắn») | CI gate; test cho lib overlap; P2 79 → 62 |
| 6 | 14/10 | Viết lại 49 meta description theo từ khóa chính (49 bản sửa, chỉ đổi `description`, giữ URL và ngày đăng); thêm link thứ hai vào PT-0124 và PT-0220; SEO Monitor in tóm tắt Matrix mỗi tuần | P2 62 → 13; check và test xanh |

## Chưa đo được (không giả định)

- Search Console / Bing: impressions, clicks, CTR, vị trí, trạng thái index. Cần chủ site cấu hình (xem `docs/OWNER-ACTIONS.md`).
- Core Web Vitals thực địa và INP.
- HTTP status trên site thật: do workflow SEO Monitor kiểm tra sau mỗi lần deploy.
