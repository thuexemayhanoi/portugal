# Checklist SEO — 9 nhóm việc và 4 giai đoạn

9 nhóm dưới đây **không phải** 9 yếu tố xếp hạng riêng của Google. Đây chỉ là cách chia việc SEO để dễ audit, phát triển và tự động hóa. Không ai bảo đảm được Top 1 hay việc xuất hiện trong câu trả lời AI. Hệ thống chỉ giúp site có nền tảng tốt nhất và đo được kết quả thật.

Ký hiệu:
- ✅ đã làm và có kiểm tra tự động
- 🟡 cần chủ site làm một việc ngoài repo
- 📈 cần dữ liệu thật sau khi site được index

## Giai đoạn 1 — Nền tảng SEO

| # | Nhóm | Đã triển khai | Kiểm tra tự động | Trạng thái |
|---|---|---|---|---|
| 1 | **Technical SEO** | robots.txt, sitemap.xml tự sinh (chỉ trang indexable), canonical tuyệt đối, URL sạch, 404 noindex, không URL trung gian 404, `_config.yml` không lộ thư mục nguồn | `build --check`, `qa-site` (gồm mô phỏng bộ lọc Jekyll), `audit-live` trên site thật: HTTPS, http→https, github.io→domain, status, X-Robots-Tag, soft 404, trùng URL có/không có `/`, bản deploy so với repo | ✅ · 🟡 DNS + Enforce HTTPS |
| 2 | **Kiến trúc SEO** | Silo 5 danh mục cha × 20 con, hub và archive chỉ sinh khi đủ bài, breadcrumb hiển thị khớp schema, bài trước/sau, 3 bài liên quan, link về pillar bắt buộc | `qa-site` (link gãy, anchor, breadcrumb), `qa-factory` (≥ 3 link nội bộ, có link pillar), `plan --check` (link in/out) | ✅ |
| 3 | **On-page SEO** | Mẫu title/meta/H1/OG thống nhất, H1 duy nhất, heading đúng thứ tự, OG image thương hiệu, `lang="pt-PT"` | `qa-site` (trùng title/description, độ dài, H1, heading), `audit-live` (title trùng, meta, H1, og:url trên site thật) | ✅ |
| 4 | **Content SEO** | Ma trận 300 chủ đề, mỗi bài một search intent, 45 chủ đề HOLD | `plan.mjs` (cannibalization), `qa-factory`: dấu vết intent so với trang đã đăng và các bài cùng lô (≥ 0,6 thì loại), trùng câu trả lời nhanh, độ giống 5-gram | ✅ |
| 5 | **Performance & Core Web Vitals** | Không web font, không ảnh hero nặng, CSS/JS nhỏ, tìm kiếm chỉ tải khi mở, nút Gọi/Zalo không dùng JS, không chatbot | Lighthouse mobile hằng tuần trên domain thật (`lighthouse-summary`, ngân sách: Perf ≥ 90, LCP ≤ 2,5 s, CLS ≤ 0,1, TBT ≤ 200 ms), `audit-live` (dung lượng HTML, thời gian phản hồi, gzip/br) | ✅ (đo lab, không phải dữ liệu người dùng) |
| 6 | **Schema & Entity** | Một thực thể `#business` (LocalBusiness + Organization) theo NAP chính thức, WebSite, WebPage, BreadcrumbList, BlogPosting, FAQPage chỉ khi FAQ hiển thị. FAQ rich result không còn được hiển thị cho phần lớn site nên không kỳ vọng | `qa-site` + `audit-live`: tên, alternateName (tên GBP), `+84942467674`, địa chỉ, giờ 7 ngày, Maps CID, sameAs chính thức; không email/geo/postalCode/rating | ✅ |

## Giai đoạn 2 — Content Factory

| Việc | Đã triển khai | Trạng thái |
|---|---|---|
| Chống trùng search intent | `scripts/lib/intent.mjs` + `qa-factory`: so với mọi trang đã đăng và các bài cùng lô; trùng từ khóa chính thì bị loại | ✅ |
| Đối chiếu nguồn | Nội dung có luật, phạt, tuổi tối thiểu, nồng độ cồn hoặc LIC phải có nguồn `legal-database`/`official`; mã P phải có nguồn chính thức Bồ Đào Nha; nguồn quá 365 ngày thì cảnh báo, quá 730 ngày thì lỗi; nguồn phải ghi rõ loại | ✅ |
| Kiểm soát chất lượng tiếng Bồ Đào Nha (pt-PT) | Từ pt-BR (lỗi), phong cách pt-PT (Hanói, Vietname, mota), phát hiện văn bản sao chép hoặc dịch máy (tiếng Tây Ban Nha, tiếng Anh, chữ thiếu dấu), câu quá dài, mật độ "você", khẳng định chưa xác minh (gồm "50 cc không cần bằng") | ✅ |
| Xuất bản theo batch | Mỗi lần xử lý theo `batch_size`, duyệt thủ công; tối đa `publishing.max_new_per_7_days` = 10 bài mới mỗi 7 ngày | ✅ |
| Cập nhật bài cũ theo dữ liệu | Trường `revision` trong bản nháp: giữ URL và ngày đăng gốc, ghi lịch sử chỉnh sửa | ✅ |

## Giai đoạn 3 — Đo lường

| # | Nhóm | Đã triển khai | Trạng thái |
|---|---|---|---|
| 7 | **AI Search / GEO / AEO** | Hộp "Resposta rápida", key points, FAQ, nguồn có ngày tra cứu, `llms.txt` có dữ liệu chính thức và danh sách những gì **không** được trích dẫn | ✅ · 📈 |
| 9 | **Analytics, theo dõi index, bảo trì nội dung** | Workflow **SEO Monitor**: Search Console (theo nhóm từ khóa/danh mục, so với kỳ trước, URL Inspection hằng tuần), Bing Webmaster (tùy chọn), hàng đợi bảo trì (CTR thấp, gần trang 1, giảm traffic, ăn thịt từ khóa, chưa index, chưa có hiển thị), nhu cầu cho chủ đề chưa viết; IndexNow cho Bing sau mỗi lần deploy | ✅ code · 🟡 thêm secret GSC/Bing · 📈 |

## Giai đoạn 4 — Authority

| # | Nhóm | Đã triển khai | Trạng thái |
|---|---|---|---|
| 8 | **E-E-A-T, độ tin cậy địa phương và Off-page** | Bảng thông tin chính thức và mục biên tập trên trang Sobre nós, byline có link, nguồn pháp lý, liên kết sang site tiếng Anh/Tây Ban Nha, kế hoạch citations và earned links (`docs/AUTHORITY-PLAN.md`) | ✅ trên site · 🟡 ảnh thật, sửa NAP bên ngoài, link "Português" từ các site cùng hệ thống |

## Lệnh kiểm tra

```bash
npm run check                         # nền tảng: build, plan, QA site, QA bài đã đăng
npm test                              # unit test (gồm NAP, intent, ngôn ngữ, đo lường, cập nhật bài)
node scripts/audit-live.mjs           # audit site thật (chạy tự động trong SEO Monitor)
node scripts/seo-data.mjs             # Search Console / Bing (cần secret)
```
