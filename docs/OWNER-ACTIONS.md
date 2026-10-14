# Việc chủ website cần làm (không thể tự động hóa)

## Lên top cho «aluguer de motas em Hanói» — phần ngoài trang (chỉ chủ site làm được)

Phần on-page (300 bài, liên kết nội bộ, schema, tốc độ, SEO Matrix) đã được làm trong repo. Thứ hạng của từ khóa chính còn phụ thuộc nhiều vào **độ tin cậy từ bên ngoài**. Việc cần làm, xếp theo tác động:

1. **Search Console** (property đã có thẻ xác minh): gửi `https://pt.rentbikehanoi.com/sitemap.xml`; dùng *URL Inspection → Request indexing* cho `/`, `/precos/`, `/tipos-de-motas/`, `/guia-de-aluguer/`, `/contactos/`. Kết nối service account (mục dưới) để SEO Monitor đọc được impressions, clicks và vị trí theo từng nhóm từ khóa.
2. **Liên kết từ site chính** `thuexemaynguyentu.com` tới `https://pt.rentbikehanoi.com/`, với anchor như «Português» hoặc «Aluguer de motas em Hanói (português)». Làm tương tự từ các site ngôn ngữ khác của cùng hệ thống. Đây là nguồn uy tín mạnh nhất mà cửa hàng tự kiểm soát được.
3. **Google Business Profile**:
   - giữ NAP đúng như site;
   - đăng ảnh thật của cửa hàng và xe;
   - mời khách (kể cả khách Bồ Đào Nha) để lại **đánh giá thật** trên Google. Không mua đánh giá; site không tự đăng rating.
   - Có thể thêm bài đăng (Posts) bằng tiếng Bồ Đào Nha, dẫn link tới trang pt.
4. **Backlink thật từ cộng đồng nói tiếng Bồ Đào Nha** (không mua link, không spam):
   - blog du lịch Bồ Đào Nha viết về Việt Nam (mời viết bài khách, phỏng vấn, chia sẻ kinh nghiệm thực tế);
   - trả lời câu hỏi thật trong diễn đàn hoặc nhóm du lịch, chỉ dẫn link khi thực sự hữu ích;
   - danh bạ doanh nghiệp du lịch uy tín, có NAP đúng.
5. **Ảnh thật** (cửa hàng, từng mẫu xe, biển hiệu, quy trình giao xe) kèm quyền sử dụng. Ảnh giúp kết quả tìm kiếm hình ảnh, tăng E-E-A-T và tỷ lệ nhấp.
6. **Phản hồi nhanh** qua điện thoại/Zalo khi khách từ site liên hệ. Tỷ lệ chuyển đổi và đánh giá tốt là tín hiệu bền vững nhất.

Kiểm tra sau 4–12 tuần trong Search Console: Performance → Queries, lọc «hanói/hanoi» và «mota/scooter»; Pages → Indexed. Không ai kiểm soát được thứ hạng của Google, nên site không hứa vị trí cụ thể; mọi thay đổi đều dựa trên số liệu thật.

## Ưu tiên cao

- [x] **DNS + HTTPS**: đã xác minh ngày 12/10/2026 bằng SEO Monitor chạy từ GitHub Actions. `https://pt.rentbikehanoi.com` trả về 15/15 URL đúng; `http://` chuyển hướng 301 sang `https://` (Enforce HTTPS đang bật); `thuexemayhanoi.github.io/portugal/` chuyển hướng 301 về domain riêng. Từ nay, SEO Monitor sẽ báo lỗi nếu một trong các điều này thay đổi.
- [ ] **Google Search Console**: thêm property `https://pt.rentbikehanoi.com/`, hoặc dùng domain property `rentbikehanoi.com`. Nếu xác minh bằng thẻ meta, dán mã vào `site/data.json` → `site.verification.google` rồi chạy `npm run build`. Sau đó gửi `https://pt.rentbikehanoi.com/sitemap.xml`.
- [ ] **Bing Webmaster Tools**: chọn "Import from Google Search Console" (nhanh nhất) hoặc xác minh bằng `site.verification.bing`. Site đã bật **IndexNow**: file khóa nằm tại `/f93b7c644c1f781349f457961584c522.txt`, và SEO Monitor tự báo cho Bing các URL thay đổi sau mỗi lần deploy. Lần gửi đầu tiên (15 URL) được chấp nhận với HTTP 202. Muốn tắt thì đặt `site.indexNow.enabled = false`.
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
- [x] Duyệt 45 chủ đề `HOLD_FOR_INTENT_REVIEW`: đã xong; kế hoạch 300 bài đã đăng đủ (14/10/2026).
- [ ] Bài PT-0001 (Honda Vision) chưa có nguồn của nhà sản xuất (honda.com.vn) cho thông số kỹ thuật: QA đang cảnh báo. Có thể bổ sung bằng bản cập nhật `revision`.

## Content Factory

- **Writer bên ngoài**: gửi file JSON vào `_factory/inbox/` (theo `factory/WRITER-CONTRACT.md`), rồi chạy Actions → **Article Factory** → `process`; duyệt bằng `approve` + IDs. Giới hạn số bài mới mỗi 7 ngày đặt ở `publishing.max_new_per_7_days` (hiện `null` = không giới hạn).
- **Sửa bài cũ** theo số liệu của SEO Monitor: gửi lại bản đầy đủ với trường `"revision": { "reason": "…" }`. URL và ngày đăng gốc giữ nguyên.
- **Writer Claude** (trả phí, chỉ khi chủ site đồng ý):
  - thêm secret `ANTHROPIC_API_KEY`;
  - thêm variable `FACTORY_WRITER=claude` và `FACTORY_CLAUDE_MODEL` (ID model khuyến nghị trong tài liệu Anthropic);
  - chạy action `write`. Mỗi lần tối đa 3 bài, và bài vẫn phải qua QA và duyệt.
