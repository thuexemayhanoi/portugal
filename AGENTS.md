# AGENTS.md — Hướng dẫn bảo trì & vận hành `pt.rentbikehanoi.com`

Tài liệu dành cho **chủ website và mọi AI agent / lập trình viên** làm việc trên repo `thuexemayhanoi/portugal`. Đọc hết trước khi sửa bất cứ thứ gì.

- Website: <https://pt.rentbikehanoi.com/> · ngôn ngữ công khai: **tiếng Bồ Đào Nha chuẩn Bồ Đào Nha (pt-PT)**.
- Hosting: **GitHub Pages, deploy from branch `main` / root**. File `CNAME` phải luôn là `pt.rentbikehanoi.com` — **không xóa, không sửa**.
- Kiến trúc: site tĩnh HTML/CSS/JS thuần, sinh bởi **Node.js không dependency** (`scripts/build.mjs`). Không React/Next, không npm install khi build.

---

## 1. Nguyên tắc vàng: sửa một chỗ → toàn site đồng bộ

| Muốn thay đổi | Sửa file | Rồi chạy |
|---|---|---|
| Tên, địa chỉ, điện thoại, Zalo, giờ mở cửa, Google Maps, website (NAP) | `site/data.json` → `business` | `npm run build` |
| Bảng giá (ngày/tuần/tháng) | `site/data.json` → `pricing` (+ `verifiedAt`) | `npm run build` |
| Menu, footer, CTA, chữ giao diện (microcopy) | `site/data.json` → `nav`, `footer`, `cta`, `ui` | `npm run build` |
| Mã xác minh Google Search Console / Bing | `site/data.json` → `site.verification` | `npm run build` |
| Màu sắc, font, khoảng cách, bo góc, dark mode | `src/css/tokens.css` | `npm run build` |
| Giao diện thành phần | `src/css/*.css`, `src/js/*.js` | `npm run build` |
| Danh mục cha/con (5/20), trang hub, nhãn "Em breve" | `site/taxonomy.json` | `npm run build` |
| Nguồn trích dẫn (một chỗ cho cả site) | `site/sources.json` | `npm run build` |
| Nội dung 12 trang nền | `content/pages/*.json` | `npm run build` |
| Kế hoạch 300 bài | `data/editorial-plan.json` (chỉ trường "authored") | `node scripts/plan.mjs --write` |
| Chèn script/meta toàn site (vd. analytics) | `site/hooks/head.html`, `site/hooks/body-end.html` | `npm run build` **+ cập nhật Política de privacidade** |
| Liên kết sang site cùng hệ thống ngôn ngữ khác (không phải hreflang) | `site/data.json` → `site.languageSites` | `npm run build` |
| IndexNow (Bing…) bật/tắt, khóa | `site/data.json` → `site.indexNow` | `npm run build` |

**Tuyệt đối không sửa tay** các file sinh ra: `index.html`, `*/index.html`, `404.html`, `sitemap.xml`, `robots.txt`, `llms.txt`, `assets/css/site.css`, `assets/js/*.js`, `assets/search-index.json`. CI (`build --check`) sẽ báo lỗi nếu file sinh ra lệch với nguồn.

Trong nội dung, mọi dữ kiện kinh doanh phải dùng **token**: `{{phone}}`, `{{address}}` (địa chỉ hiển thị tiếng Bồ Đào Nha), `{{address.vi}}` (địa chỉ tiếng Việt cho taxi), `{{hours}}` (trong câu), `{{hours.display}}` (câu hoàn chỉnh), `{{gbp}}` (tên trên Google Maps), `{{price.vision.day}}`… (danh sách đầy đủ: `factory/WRITER-CONTRACT.md` §4). Đổi giá trong `data.json` → mọi trang, schema, sitemap, ảnh OG… tự cập nhật.

**NAP chính thức (chủ cửa hàng cung cấp, là nguồn duy nhất):** tên LocalBusiness = `Cho Thuê Xe Máy Nguyễn Tú`; alternateName gồm tên hiển thị và tên Google Business Profile `Thuê xe máy ở Hà Nội - Nguyễn Tú`; `streetAddress` = `112 Nguyễn Văn Cừ`; telephone schema `+84942467674`, link `tel:+84942467674`; giờ 09:00–21:00 cả 7 ngày (Asia/Ho_Chi_Minh), hiển thị "Aberto todos os dias, das 09:00 às 21:00."; `hasMap` = Maps CID 7448790013669858019; `sameAs` chỉ gồm URL chính thức. Không email, mạng xã hội, tọa độ GPS, mã bưu chính hay rating tự đặt. `scripts/lib/nap.mjs` kiểm tra các quy tắc này trên mọi trang (khi build và trên site thật).

---

## 2. Cấu trúc repo

```
site/            data.json (NAP, giá, menu, UI) · taxonomy.json · sources.json · hooks/
content/pages/   12 trang nền (JSON có cấu trúc: sections, faq, sources…)
content/articles/ bài đã xuất bản (PT-XXXX.json) — chỉ factory ghi vào đây
data/            editorial-plan.json (300 chủ đề) · writer-queue.json · factory-state.json · factory-config.json
_factory/        inbox/ (bản nháp mới) · review/ (đạt QA, chờ duyệt) · rejected/ (bị loại + báo cáo .qa.json)
factory/         WRITER-CONTRACT.md · article.schema.json
scripts/         build.mjs · qa-site.mjs · qa-factory.mjs · factory.mjs · plan.mjs · writer-claude.mjs
                 audit-live.mjs (audit site thật) · seo-data.mjs (Search Console/Bing) · indexnow.mjs · lighthouse-summary.mjs
scripts/lib/     util · text (token + markdown nội tuyến + block) · model · components · layout · schema · templates · outputs
                 language (pt-PT, sao chép/dịch máy, claims) · nap (quy tắc NAP) · intent (search intent) · pace (nhịp đăng) · seo-data (phân tích số liệu)
scripts/tools/   render-images.mjs (favicon + ảnh OG, cần Playwright — tùy chọn)
src/css, src/js  mã nguồn giao diện → build gộp vào assets/
reports/         publication-log.json · factory-last-run.json · site-audit.json
docs/            AUDIT, SEO-STANDARD, GROWTH-MATRIX, OWNER-ACTIONS
_config.yml      loại thư mục nguồn khỏi GitHub Pages (Jekyll chỉ copy file)
```

---

## 3. Lệnh thường dùng

```bash
npm run build                 # sinh lại toàn bộ site
npm run check                 # kiểm tra như CI: build --check + plan --check + QA site + QA bài đã đăng
npm test                      # unit test (node:test)
npm run serve                 # xem thử tại http://127.0.0.1:8080
node scripts/qa-site.mjs      # audit SEO: canonical, title/meta trùng, H1, link gãy, sitemap, schema, NAP…
node scripts/plan.mjs --stats # thống kê ma trận 300 bài
node scripts/factory.mjs status
node scripts/audit-live.mjs   # audit site thật: HTTPS, robots, sitemap, canonical, index, schema/NAP, link, 404
node scripts/seo-data.mjs     # Search Console / Bing theo nhóm từ khóa (cần secret, xem docs/OWNER-ACTIONS.md)
```

---

## 4. Quy tắc URL & SEO (không được phá)

- URL: chữ thường, không dấu, gạch ngang, **kết thúc bằng `/`**. Canonical tự tham chiếu tuyệt đối.
- Bài viết nằm dưới URL danh mục cha: `/tipos-de-motas/…/`, `/precos/…/`, `/guia-de-aluguer/…/`, `/zonas-de-hanoi/…/`, `/rotas-e-mobilidade/…/`.
- **Không đổi slug đã xuất bản.** GitHub Pages không có redirect 301; đổi slug = mất thứ hạng + link 404. Nếu bắt buộc, tạo trang cũ dạng chuyển hướng và ghi lý do trong PR.
- Không có URL trung gian 404: generator **từ chối build** nếu đường dẫn cha không tồn tại; hub `/zonas-de-hanoi/`, `/rotas-e-mobilidade/` chỉ tự sinh khi có bài đầu tiên (noindex tới khi đủ `parentHubMinArticlesToIndex` = 3 bài).
- Archive danh mục con chỉ sinh (và index) khi có ≥ `childArchiveMinArticles` = 5 bài. Trước đó hiển thị **"Em breve"** không có link.
- Không thêm `hreflang` sang domain khác khi chưa có trang tương đương liên kết hai chiều (`site.hreflang.alternates`).
- Schema JSON-LD chỉ từ dữ liệu thật: LocalBusiness, WebSite, WebPage, BreadcrumbList, Article, FAQPage (khi FAQ hiển thị). **Không bao giờ thêm `aggregateRating`, review, tọa độ, ưu đãi chưa xác minh** — QA sẽ chặn.
- Trang 404: `noindex`, không canonical, không có trong sitemap.

---

## 5. Chính sách nội dung (bắt buộc)

**Cấm khẳng định khi chưa có xác nhận bằng văn bản của chủ cửa hàng:** mức caução, thuê không caução, giao xe miễn phí, không cần bằng lái (kể cả 50 cc), hỗ trợ 24/7, bảo hiểm bao gồm, giảm giá, đánh giá/sao/xếp hạng, số khách, chi nhánh khác, giấy phép, trải nghiệm cá nhân. QA (`scripts/lib/language.mjs`) tự phát hiện các câu dạng này.

- **WhatsApp**: đang tắt (`business.whatsapp.enabled=false`) vì chưa xác minh. Chỉ bật khi chủ xác nhận → đổi `enabled` + `verified` = true + `url`. QA site sẽ báo lỗi nếu có link WhatsApp khi chưa bật.
- Giá là **giá tham khảo** lấy từ bảng giá đã xác minh của chủ (nguồn: `pricing.$comment`). Khi giá đổi: sửa `pricing` + `verifiedAt`.
- Nội dung pháp lý/an toàn phải có nguồn trong `site/sources.json` (ưu tiên nguồn chính thức) và ngày tra cứu. Luật Việt Nam thay đổi: rà soát định kỳ các trang có `legal_note`.
- Văn phong **pt-PT** (không pt-BR): aluguer, mota, telemóvel, autocarro, comboio, carta de condução, travões, contacto… QA cảnh báo từ ngữ pt-BR.
- Không dịch máy hàng loạt từ repo `/spanish`, `/web` hay site khác. Mỗi bài một search intent riêng.

---

## 6. Content Factory 300 — quy trình vận hành

```
data/writer-queue.json ──► writer viết PT-XXXX.json ──► _factory/inbox/
        ▲                                                 │  factory process (QA tự động)
        │                                      lỗi ◄──────┼──────► đạt
 refresh-queue                       _factory/rejected/   │   _factory/review/ (+ .qa.json)
                                     (+ báo cáo, viết lại)│           │ factory approve PT-XXXX
                                                          │           ▼
                                                          └──► content/articles/ → build → QA site → publish
```

- Chế độ mặc định: `publish_mode = "review"` (bài đạt QA chờ người duyệt). Có thể đổi `"auto"` trong `data/factory-config.json`.
- Trạng thái: `data/factory-state.json` → `status: ACTIVE | PAUSED`. Lệnh: `node scripts/factory.mjs pause|resume`.
- Xuất bản là **giao dịch**: nếu build hoặc QA site lỗi sau khi xuất bản, factory tự hoàn tác lô đó.
- Lệnh: `status`, `refresh-queue`, `process`, `approve PT-… [PT-…]`, `reject PT-… "lý do"`, `write` (Claude, tùy chọn).
- Trên GitHub: **Actions → Article Factory → Run workflow**, chọn action (status/process/approve/reject/…), nhập IDs. Push bản nháp vào `_factory/inbox/` trên `main` cũng tự kích hoạt `process`.
- Writer bên ngoài (người hoặc AI): làm đúng `factory/WRITER-CONTRACT.md` + `factory/article.schema.json`.
- QA bài viết còn kiểm tra: **trùng search intent** với trang đã đăng và các bài cùng lô (≥ 0,6 thì loại), **đối chiếu nguồn** (nội dung luật/phạt phải có nguồn luật hoặc chính thức, nguồn cũ thì cảnh báo hoặc báo lỗi), **chất lượng pt-PT** (pt-BR, Hanói/Vietname, văn bản tiếng Tây Ban Nha/Anh hoặc thiếu dấu = dấu hiệu sao chép/dịch máy).
- **Nhịp đăng:** tối đa `publishing.max_new_per_7_days` bài mới mỗi 7 ngày; quá mức thì `approve` trả `PACE_LIMIT`. Từ 13/10/2026 chủ site đã tắt giới hạn (`null`) để viết liên tục tới khi đủ kế hoạch; đặt lại một số (vd. 10) để giới hạn.
- **Sửa bài đã đăng:** bản nháp cùng `id`/`slug` + `"revision": { "reason": "…" }` → giữ URL và ngày đăng gốc, cập nhật `date_modified`, ghi `editorial.revisions`.

### Writer Claude (API trả phí — TẮT mặc định)
Chỉ chạy khi chủ website **chủ động** cấu hình cả ba:
1. Secret `ANTHROPIC_API_KEY` (Settings → Secrets and variables → Actions → Secrets).
2. Variable `FACTORY_WRITER = claude` và `FACTORY_CLAUDE_MODEL = <ID model khuyến nghị trong tài liệu Anthropic>`.
3. (Tùy chọn) `FACTORY_SCHEDULED_WRITE = true` để chạy theo lịch hằng ngày; nếu không, chỉ chạy khi bấm `write`.

Key không bao giờ được ghi vào repo hay log; SDK `@anthropic-ai/sdk` (phiên bản ghim) chỉ được cài trong bước writer của CI. Mỗi lần chạy viết tối đa `max_articles_per_run` bài (mặc định 3) và bài vẫn phải qua QA + duyệt.

### Ma trận 300 chủ đề
- `data/editorial-plan.json`: PT-0001 → PT-0300, đủ 5 cha / 20 con theo đúng chỉ tiêu.
- `HOLD_FOR_INTENT_REVIEW` (45 chủ đề): trùng ý định tìm kiếm → **không được viết** cho tới khi người duyệt sửa góc độ (brief/keyword) rồi đặt `intent_reviewed: true` và xóa `hold_reason`.
- Không có volume/KD giả: `metrics` để `null` tới khi có dữ liệu thật từ công cụ.
- Sau khi sửa plan: `node scripts/plan.mjs --write` (tính lại link in/out, cannibalization, trạng thái).

---

## 7. CI/CD

- `.github/workflows/site-qa.yml` (PR + push main): syntax, unit test, `build --check`, `plan --check`, `qa-site`, `qa-factory --published`.
- `.github/workflows/seo-monitor.yml` (**SEO Audit & Monitoring**, độc lập với factory, chỉ đọc): sau mỗi push vào `main` (chờ deploy xong), sau mỗi lần factory đăng bài, và thứ Hai hằng tuần. Việc chạy: `audit-live` trên domain thật, IndexNow cho các trang thay đổi, Lighthouse mobile (theo tuần/thủ công), Search Console/Bing khi có secret. Kết quả ở Summary của bản chạy + artifact. Bản chạy đỏ = site thật có lỗi.
- `.github/workflows/article-factory.yml`: factory (thủ công / push inbox / lịch). Commit bằng `pt-factory-bot`, dừng an toàn khi conflict. Lịch hằng ngày chạy `process`: inbox trống hoặc factory `PAUSED` → không ghi file nào, không tạo commit. Chỉ chạy trên `main`; sau khi push, workflow gọi API yêu cầu build GitHub Pages (push bằng `GITHUB_TOKEN` có thể không tự kích hoạt build).
- GitHub Pages tự deploy khi `main` thay đổi (workflow động `pages-build-deployment`).
- Khuyến nghị: bật **branch protection** cho `main` (bắt buộc check "Site QA" cho Pull Request). Bot factory push thẳng vào `main`, nên nếu quy tắc chặn push trực tiếp thì phải cho bot bypass.

---

## 8. Checklist trước khi merge vào `main`

1. `npm run build` rồi `npm run check` — 0 lỗi.
2. `npm test` — tất cả pass.
3. Xem thử local (`npm run serve`) trên mobile 390 px và desktop; light + dark.
4. Không thêm claim chưa xác minh, không đổi slug đã đăng, không đụng `CNAME`.
5. Đổi chính sách dữ liệu (form, analytics, cookie) → cập nhật `content/pages/politica-de-privacidade.json` trong cùng PR.

## 9. Phạm vi

Chỉ làm việc trong repo `thuexemayhanoi/portugal`. **Không sửa** các repo khác (`/spanish`, `/china`, `/web`, `/blog`…); `/spanish` và `/web` chỉ được đọc để tham khảo. Không đổi DNS, không mua dịch vụ, không dùng API trả phí khi chủ chưa đồng ý.
