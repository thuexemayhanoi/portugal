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
| Nguồn không công khai | `_config.yml` loại `site/`, `data/`, `scripts/`… khỏi Pages | qa-site cảnh báo nếu thiếu `_config.yml` |

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

- **LocalBusiness** (`@id #business`): tên chuẩn, alternateName, địa chỉ, điện thoại, giờ mở cửa 7 ngày, hasMap, sameAs, logo thật, danh mục dịch vụ, priceRange tính từ bảng giá.
- **WebSite**, **WebPage** (AboutPage / ContactPage / CollectionPage theo trang), **BreadcrumbList** (khớp breadcrumb hiển thị), **Article** (ngày đăng/sửa, wordCount, citation = nguồn), **FAQPage** (chỉ khi FAQ hiển thị ≥ 2 câu; trang chủ không dùng).
- **Cấm**: aggregateRating, review, tọa độ, offer chưa xác minh — qa-site báo lỗi.
- NAP trong schema phải trùng `data.json` — qa-site so sánh trên từng trang.

## Performance (Core Web Vitals)

- Không web font (font hệ thống) → không FOIT/CLS; không ảnh hero lớn (hero là CSS gradient + SVG inline nhỏ).
- 1 file CSS (~25 KB) + 1 JS nhỏ `defer`; **search.js và chỉ mục chỉ tải khi mở tìm kiếm**.
- Theme sáng/tối áp dụng trước khi vẽ (script inline 150 byte) → không nháy.
- Đã đo bằng Playwright: CLS = 0, không tràn ngang ở 390 px và 1440 px (xem báo cáo PR). Điểm Lighthouse chỉ được ghi khi thực sự đo.

## AEO / GEO

- Hộp **"Resposta rápida"** ở đầu trang/bài (trả lời trực tiếp), `key_points`, FAQ hữu ích.
- Nhất quán thực thể: cùng tên, địa chỉ, điện thoại ở header, footer, schema, `llms.txt`.
- Nguồn đáng tin có ngày tra cứu (`site/sources.json`), `citation` trong schema Article.
- Không hứa Top 1 hay xuất hiện trong AI Overviews.

## Accessibility

Skip link, focus-visible, `aria-expanded`/`aria-controls` cho menu, focus trap + Esc trong drawer, `aria-current`, bảng có caption/scope, tương phản ≥ 4.5:1 (đã tính cho cả theme sáng và tối), `prefers-reduced-motion`.
