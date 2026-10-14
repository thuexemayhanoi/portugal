# SEO Master Standard A–Z — đã triển khai & cách kiểm tra

Mọi mục dưới đây được **sinh tự động** bởi generator và **kiểm tra tự động** bởi `scripts/qa-site.mjs` (toàn site) hoặc `scripts/qa-factory.mjs` (từng bài). CI chặn merge khi có lỗi.

## Technical SEO

| Yêu cầu | Triển khai | Kiểm tra |
|---|---|---|
| robots.txt | `scripts/lib/outputs.mjs` → `Allow: /` + `Sitemap:` | qa-site: có dòng Sitemap, không `Disallow: /` |
| XML Sitemap tự sinh | chỉ trang indexable, có `<lastmod>` thật | qa-site: sitemap ⇔ tập trang indexable, không trùng, không trang noindex |
| Canonical | tuyệt đối, tự tham chiếu, kết thúc `/` | qa-site: canonical = URL trang, og:url khớp |
| Clean URL | `isCleanUrl()` (chữ thường, không dấu, gạch ngang, `/` cuối) | build lỗi nếu sai; plan.mjs kiểm tra 300 URL |
| 404 noindex | `404.html` noindex, không canonical | qa-site |
| Indexability | `robots` meta theo trang; hub mỏng noindex; archive chỉ sinh khi ≥ 5 bài | qa-site + model.mjs |
| Broken links | link nội bộ + anchor `#id` phải tồn tại; link ngoài phải https | build (nội dung) + qa-site (toàn HTML) |
| URL trung gian 404 | build **từ chối** nếu thiếu trang cha | model.mjs (breadcrumb) |
| Google verification | `site.verification.google` (trống = không in meta) | — |
| hreflang | **không tự thêm**; chỉ qua `site.hreflang.alternates` khi có liên kết hai chiều | — |
| Nguồn không công khai | `_config.yml` loại `site/`, `data/`, `scripts/`… khỏi Pages; Jekyll so khớp `exclude` theo tiền tố nên `sitemap.xml` nằm trong `include` | qa-site mô phỏng bộ lọc Jekyll: lỗi nếu một file công khai bị ẩn hoặc một thư mục nguồn bị xuất bản |

## On-page SEO

| Yêu cầu | Triển khai / kiểm tra |
|---|---|
| Title / meta / H1 duy nhất | qa-site: title & description không trùng, đúng 1 H1; qa-factory: title/H1/description không trùng trang khác |
| Độ dài | title 30–65 (tối đa 70), description 120–160 (110–165) |
| H2/H3 ngữ nghĩa | block có cấu trúc; qa-site cảnh báo nhảy cấp heading |
| Open Graph / Twitter | og:type/title/description/url/image/locale `pt_PT`; ảnh OG thương hiệu 1200×630 |
| Search intent | mỗi chủ đề 1 intent + funnel; cannibalization tự tính, trùng → HOLD |
| Không keyword stuffing | qa-factory cảnh báo mật độ > 6/1000 từ |
| Không doorway pages | không có trang "aluguer em [quận]" lặp lại; chủ đề P4 trả lời câu hỏi cụ thể; mẫu lặp theo khu vực bị HOLD |
| Commercial pages | Preços, Scooters, 50 cc, Contactos có bảng giá từ dữ liệu, CTA gọi/Zalo, FAQ |

## Structured data (JSON-LD, chỉ dữ liệu thật)

- **LocalBusiness + Organization** (một thực thể duy nhất `@id #business`, theo NAP chính thức):
  - `name` = Cho Thuê Xe Máy Nguyễn Tú; `alternateName` = tên hiển thị + tên Google Business Profile; `brand` = Nguyễn Tú;
  - `address`: streetAddress "112 Nguyễn Văn Cừ", addressLocality "Bồ Đề, Long Biên", addressRegion "Hà Nội", addressCountry "VN";
  - `telephone` "+84942467674", giờ 09:00–21:00 cả 7 ngày;
  - `hasMap` và `sameAs` = Google Maps CID; dịch vụ có tên tiếng Việt (`alternateName`); priceRange tính từ bảng giá.
- **WebSite**, **WebPage** (AboutPage / ContactPage / CollectionPage theo trang), **BreadcrumbList** (khớp breadcrumb hiển thị), **BlogPosting** (ngày đăng/sửa, wordCount, citation = nguồn, author = Equipa editorial có `url` tới `/sobre-nos/#equipa-editorial`), **FAQPage** (chỉ khi FAQ hiển thị ≥ 2 câu; trang chủ không dùng). Không kỳ vọng FAQ rich result.
- **Cấm**: aggregateRating, review, email, geo/tọa độ, postalCode, sameAs ngoài danh sách chính thức, offer chưa xác minh. `scripts/lib/nap.mjs` báo lỗi khi build (qa-site) và trên site thật (audit-live).

## Performance (Core Web Vitals)

- Không web font (font hệ thống) → không FOIT/CLS; không ảnh hero lớn (hero là CSS gradient + SVG inline nhỏ).
- 1 file CSS (~39 KB) + 2 JS nhỏ `defer` (`app.js`, `floating.js` cho nút trợ lý và Quick Call); **search.js và chỉ mục chỉ tải khi mở tìm kiếm**; **engine trợ lý local (`business-config.js`, `assistant.js`, `pt-assistant-adapter.js`, ~42 KB) chỉ `prefetch` ở ưu tiên thấp và chỉ chạy khi khách chạm/mở nút trợ lý** (loader trong `app.js`). Không bao giờ thêm engine này dưới dạng `<script>` lúc tải: TBT trang chủ tăng từ 37 lên ~230 ms (test `local-widgets` chặn).
- Đo lab (`node scripts/tools/cwv-lab.mjs`): bảng trong `docs/audit/SEO-MATRIX.md`; ngân sách LCP ≤ 2,5 s, CLS ≤ 0,1, TBT ≤ 200 ms trên 8 mẫu trang.
- Theme sáng/tối áp dụng trước khi vẽ (script inline 150 byte) → không nháy.
- Đã đo bằng Playwright: CLS = 0, không tràn ngang ở 390 px và 1440 px (xem báo cáo PR). Điểm Lighthouse chỉ được ghi khi thực sự đo.
- **SEO Monitor** chạy Lighthouse mobile hằng tuần trên domain thật (ngân sách: Perf ≥ 90, A11y/BP/SEO ≥ 95, LCP ≤ 2,5 s, CLS ≤ 0,1, TBT ≤ 200 ms; INP chỉ đo được bằng dữ liệu người dùng thật, TBT là chỉ số thay thế trong lab).

## SEO Master Matrix (theo từng URL, `scripts/seo-matrix.mjs`)

Mỗi URL đã build được chấm P0/P1/P2 từ HTML sinh ra, sitemap, `llms.txt` và model nội dung: kỹ thuật (canonical, robots, sitemap, `lang`, viewport), on-page (title/description duy nhất và đúng độ dài, 1 H1, từ khóa chính trong title/H1), nội dung và E-E-A-T (độ dài, nguồn, nota legal cũ), schema (JSON-LD hợp lệ, không trường cấm, BlogPosting, BreadcrumbList, FAQPage khớp FAQ hiển thị), liên kết nội bộ (bài mồ côi, số link vào/ra), cannibalization (tính trực tiếp từ nội dung hiện tại), mobile/CWV (alt, width/height, bảng cuộn, dung lượng), AEO/GEO (answer box, `llms.txt`). Kết quả: `docs/audit/seo-master-matrix.csv`, `seo-matrix-summary.json`, `money-keywords.csv` (mỗi cụm từ khóa thương mại một trang đích, không title cạnh tranh). `--check` chạy trong CI: **không URL nào được còn P0**. Định nghĩa mức ưu tiên và nhật ký batch: `docs/audit/SEO-MATRIX.md`.

## Giám sát site thật (SEO Monitor, `scripts/audit-live.mjs`)

HTTPS và chuyển hướng http→https, github.io→domain riêng, robots.txt, sitemap.xml, mọi URL trong sitemap và mọi link nội bộ (status, chuyển hướng, canonical, robots/X-Robots-Tag, title trùng, meta description, H1, `lang`, JSON-LD và NAP), asset, mixed content, soft 404, trùng URL có/không có `/` cuối, gzip/br, dung lượng, thời gian phản hồi, so sánh nội dung live với repo (phát hiện deploy chậm), link ngoài và độ mới của nguồn (theo tuần). Trả lời 5xx hoặc lỗi kết nối được thử lại (3 s rồi 6 s) trước khi tính là lỗi, vì GitHub Pages có thể trả 503 vài giây khi deploy đang lan truyền; Summary ghi số lần thử lại (`--retries 0` để tắt). IndexNow báo cho Bing các URL thay đổi.

## Ngôn ngữ (qa-site cảnh báo, qa-factory chặn)

pt-BR → pt-PT, phong cách pt-PT (Hanói, Vietname, mota), văn bản tiếng Tây Ban Nha/Anh hoặc thiếu dấu (dấu hiệu sao chép/dịch máy), câu quá dài, khẳng định chưa xác minh (gồm mọi biến thể "50 cc không cần bằng"; bỏ qua câu hỏi, câu phủ định, câu trích trong «» và câu nói về mức phạt). Văn bản có `lang` khác `pt` (tên nguồn, địa chỉ tiếng Việt) được bỏ qua.

## AEO / GEO

- Hộp **"Resposta rápida"** ở đầu trang/bài (trả lời trực tiếp), `key_points`, FAQ hữu ích.
- Nhất quán thực thể: cùng tên, địa chỉ, điện thoại ở header, footer, schema, `llms.txt`.
- Nguồn đáng tin có ngày tra cứu (`site/sources.json`), `citation` trong schema Article.
- Không hứa Top 1 hay xuất hiện trong AI Overviews.

## Accessibility

Skip link, focus-visible, `aria-expanded`/`aria-controls` cho menu, focus trap + Esc trong drawer, `aria-current`, bảng có caption/scope, tương phản ≥ 4.5:1 (đã tính cho cả theme sáng và tối), `prefers-reduced-motion`.
