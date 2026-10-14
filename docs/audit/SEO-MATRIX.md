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
| **P2** | Cải thiện dần | title > 65 ký tự, description 110–119 hoặc 161–165 ký tự, từ khóa vắng trong description, < 3 nguồn, chỉ 1 link ngữ cảnh trỏ vào, < 5 link nội bộ ra, nhảy cấp heading, ảnh thiếu width/height, HTML > 120 KB, vắng trong `llms.txt`, FAQ < 2 câu |

Các mục đã đạt trên toàn site (qa-site chặn khi build): canonical tự tham chiếu, sitemap ⇔ trang indexable, robots.txt, 404 noindex, không link gãy (nội bộ và anchor), NAP thống nhất, không aggregateRating/review/tọa độ, pt-PT.

## Trạng thái hiện tại (14/10/2026, sau batch 4)

| | P0 | P1 | P2 | OK |
|---|---|---|---|---|
| Trước batch 1 | 0 | 98 | 92 | 142 |
| Sau batch 1 | 0 | 21 | 92 | 219 |
| **Sau batch 4** | **0** | **0** | **79** | **253** |

**P2 còn lại (79 URL), để tự nhiên, không ép:**
- 49 meta description chỉ dùng từ đồng nghĩa với từ khóa chính (ví dụ «toque ligeiro» thay vì «colisão ligeira»). Description viết cho người đọc; **không sửa hàng loạt**.
- 26 bài có < 3 nguồn: hầu hết là bài quy trình (nguồn duy nhất là bảng giá của cửa hàng), hoặc bài pháp lý dẫn thẳng nguồn luật. Chỉ thêm nguồn khi có nguồn thật đỡ được nội dung.
- 6 bài quy trình không có nguồn ngoài: hợp lệ, vì không có dữ kiện bên ngoài nào cần dẫn.
- 2 bài chỉ có 1 link ngữ cảnh trỏ vào (PT-0113, PT-0191): không có chỗ tự nhiên để đặt thêm link.
- 1 trang ngắn (`/termos-e-condicoes/`, 273 từ): trang pháp lý, độ dài đủ.

## Từ khóa thương mại: mỗi cụm một trang đích (`money-keywords.csv`)

| Cụm truy vấn (pt-PT) | Trang đích | Link ngữ cảnh trỏ vào | Title khác bắt đầu bằng cùng cụm |
|---|---|---|---|
| aluguer de motas em Hanói | `/` | 20 (trước batch 3: 0) | 0 |
| preços aluguer mota Hanói | `/precos/` | 96 | 0 |
| aluguer de scooter em Hanói | `/tipos-de-motas/scooters/` | 56 | 0 |
| como alugar mota em Hanói | `/guia-de-aluguer/` | 84 | 0 |
| documentos e caução aluguer mota Hanói | `/guia-de-aluguer/documentacao-e-caucao/` | 194 | 0 |
| mota 50cc Hanói | `/tipos-de-motas/motas-50cc/` | 32 | 0 |
| tipos de motas para alugar em Hanói | `/tipos-de-motas/` | 56 | 0 |

**Anchor trỏ về trang chủ (20 link):**

| Anchor | Số link |
|---|---|
| «aluguer de motas em Hanói» | 5 |
| «alugar uma mota em Hanói» | 5 |
| «loja de aluguer de motas em Hanói» | 3 |
| «loja de aluguer de motas em Long Biên» | 3 |
| «motas para alugar em Hanói» | 2 |
| «scooters e motas para alugar em Hanói» | 1 |
| «alugar uma mota» | 1 |

Anchor khớp chính xác chỉ chiếm 25%, tức là đa dạng, không nhồi từ khóa.

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
| 5 | 14/10 | Giữ kết quả bền vững: `seo-matrix --check` vào `npm run check` và CI (chặn khi còn P0); factory QA đo trùng văn bản bằng đúng phép đo của Matrix (cụm 3 từ, ≥ 0,12 cảnh báo, ≥ 0,20 loại) để bài mới không tái tạo cannibalization | CI gate; test cho lib overlap |

## Chưa đo được (không giả định)

- Search Console / Bing: impressions, clicks, CTR, vị trí, trạng thái index. Cần chủ site cấu hình (xem `docs/OWNER-ACTIONS.md`).
- Core Web Vitals thực địa và INP.
- HTTP status trên site thật: do workflow SEO Monitor kiểm tra sau mỗi lần deploy.
