# Việc chủ website cần làm (không thể tự động hóa)

## Ưu tiên cao

- [ ] **DNS + HTTPS**: bản ghi `CNAME` tên `pt` → `thuexemayhanoi.github.io` tại nhà cung cấp DNS của `rentbikehanoi.com`. Sau đó vào GitHub → Settings → Pages: custom domain `pt.rentbikehanoi.com` (đã có sẵn qua file CNAME) và bật **Enforce HTTPS**. Workflow **SEO Monitor** kiểm tra mục này trên site thật sau mỗi lần deploy: nếu báo `site not reachable` hoặc `HTTP answers without redirecting to HTTPS` thì đây là việc cần sửa.
- [ ] **Google Search Console**: thêm property `https://pt.rentbikehanoi.com/`, hoặc dùng domain property `rentbikehanoi.com`. Nếu xác minh bằng thẻ meta, dán mã vào `site/data.json` → `site.verification.google` rồi chạy `npm run build`. Sau đó gửi `https://pt.rentbikehanoi.com/sitemap.xml`.
- [ ] **Bing Webmaster Tools**: chọn "Import from Google Search Console" (nhanh nhất) hoặc xác minh bằng `site.verification.bing`. Site đã bật **IndexNow**: file khóa nằm tại `/f93b7c644c1f781349f457961584c522.txt`, và SEO Monitor tự báo cho Bing các URL thay đổi sau mỗi lần deploy. Muốn tắt thì đặt `site.indexNow.enabled = false`.
- [ ] **Xác nhận bảng giá** trong `site/data.json` → `pricing`, lấy từ bảng "verified" ngày 12/10/2026. Cần xác nhận riêng:
  - **xe máy điện** 200.000/1.000.000/1.500.000 VND (site tiếng Tây Ban Nha ghi "Consultar");
  - **xe 50 cc** theo tuần/tháng;
  - **xe đạp điện** (hiện ghi "Sob consulta").
- [ ] **WhatsApp**: số +84 942 467 674 có dùng WhatsApp không? Nếu có, sửa `business.whatsapp`: `enabled: true`, `verified: true`, `url: "https://wa.me/84942467674"`, rồi build. Hiện đang tắt.
- [ ] **NAP bên ngoài**: Vinpearl ghi "112B Nguyễn Văn Cừ" và thêm địa chỉ thứ hai "24D Tạ Hiện". Cần thống nhất theo NAP chính thức (xem `docs/AUTHORITY-PLAN.md` §1).

## Kết nối số liệu cho SEO Monitor (Giai đoạn 3)

Khi chưa kết nối, workflow vẫn chạy phần audit kỹ thuật, còn phần số liệu ghi "chưa kết nối": hệ thống không ước tính hay tự đặt ra con số nào.

**Google Search Console (miễn phí):**
1. Vào Google Cloud Console, tạo project, rồi bật **Google Search Console API**.
2. Tạo **Service account** → Keys → *Add key* → JSON, rồi tải file về.
3. Trong Search Console, chọn property → Settings → *Users and permissions* → *Add user*: nhập email của service account (đuôi `…iam.gserviceaccount.com`), quyền *Restricted* là đủ.
4. Trong GitHub → Settings → Secrets and variables → Actions:
   - secret `GSC_SERVICE_ACCOUNT_JSON` = toàn bộ nội dung file JSON;
   - nếu dùng domain property, thêm variable `GSC_SITE_URL` = `sc-domain:rentbikehanoi.com` (mặc định là `https://pt.rentbikehanoi.com/`).

**Bing Webmaster Tools (tùy chọn):** Settings → API access → tạo API key → secret `BING_WEBMASTER_API_KEY`.

Kết quả xem tại **Actions → SEO Monitor → bản chạy mới nhất → Summary**. Báo cáo JSON nằm ở mục Artifacts, lưu 30 ngày. Bản chạy hằng tuần (thứ Hai, 08:41 giờ Hà Nội) có thêm Lighthouse, kiểm tra link ngoài và URL Inspection.

## Nên làm

- [ ] **Mạng xã hội trong schema**: Facebook và TripAdvisor đã được **gỡ** khỏi `business.sameAs` vì không có trong NAP chính thức. Nếu đó là tài khoản chính thức của cửa hàng, thêm lại URL vào `business.sameAs`. QA chỉ chấp nhận những URL được liệt kê ở đó.
- [ ] Bật **branch protection** cho `main`: bắt buộc check **Site QA** cho Pull Request. Bot Article Factory push thẳng vào `main` (sau khi đã tự chạy build và QA), nên nếu quy tắc chặn push trực tiếp thì phải cho bot quyền bỏ qua (bypass). Nếu không, bước push của factory sẽ dừng an toàn và báo lỗi.
- [ ] Cung cấp **ảnh thật** (cửa hàng, xe) nếu muốn dùng trong bài, kèm quyền sử dụng. Tránh ảnh stock.
- [ ] **Link "Português"** từ các site cùng hệ thống (app.rentbikehanoi.com, es.rentbikehanoi.com, /china, /blog) tới `https://pt.rentbikehanoi.com/`. Việc này phải làm trong các repo đó.
- [ ] Đọc lại 2 trang pháp lý (`politica-de-privacidade`, `termos-e-condicoes`). Nếu sau này thêm form hoặc analytics, phải cập nhật hai trang này.
- [ ] **Vùng phát thải thấp Hà Nội** (thí điểm ở Hoàn Kiếm từ 7/2026): cân nhắc ảnh hưởng tới khách thuê xe xăng đi phố cổ. Khi quy định chính thức ổn định, ưu tiên viết PT-0065.
- [ ] Duyệt 45 chủ đề `HOLD_FOR_INTENT_REVIEW` (xem `docs/GROWTH-MATRIX.md`).
- [ ] Bài PT-0001 (Honda Vision) chưa có nguồn của nhà sản xuất (honda.com.vn) cho thông số kỹ thuật: QA đang cảnh báo. Có thể bổ sung bằng bản cập nhật `revision`.

## Content Factory

- **Writer bên ngoài**: gửi file JSON vào `_factory/inbox/` (theo `factory/WRITER-CONTRACT.md`), rồi chạy Actions → **Article Factory** → `process`; duyệt bằng `approve` + IDs. Mỗi 7 ngày tối đa 10 bài mới (`publishing.max_new_per_7_days`).
- **Sửa bài cũ** theo số liệu của SEO Monitor: gửi lại bản đầy đủ với trường `"revision": { "reason": "…" }`. URL và ngày đăng gốc giữ nguyên.
- **Writer Claude** (trả phí, chỉ khi chủ site đồng ý):
  - thêm secret `ANTHROPIC_API_KEY`;
  - thêm variable `FACTORY_WRITER=claude` và `FACTORY_CLAUDE_MODEL` (ID model khuyến nghị trong tài liệu Anthropic);
  - chạy action `write`. Mỗi lần tối đa 3 bài, và bài vẫn phải qua QA và duyệt.
