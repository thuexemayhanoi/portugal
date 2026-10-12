# Giai đoạn 4 — Authority, thương hiệu và liên kết ngoài

Mục tiêu: Google, Bing và các công cụ AI nhận ra **một thực thể duy nhất**, là cửa hàng **Cho Thuê Xe Máy Nguyễn Tú**, với cùng tên, địa chỉ, điện thoại và giờ mở cửa ở mọi nơi. Thực thể này cần được các nguồn uy tín nhắc tới hoặc liên kết đến. Không ai bảo đảm được vị trí Top 1 hay việc xuất hiện trong câu trả lời AI. Tài liệu này chỉ gồm những việc làm tăng khả năng đó mà không vi phạm nguyên tắc của Google và Bing.

## 1. Bộ NAP chuẩn để dán ở mọi nơi

Mọi trích dẫn bên ngoài (Google Business Profile, Bing Places, Apple Business Connect, TripAdvisor, Facebook, danh bạ, bài báo, blog) phải dùng **đúng** các chuỗi sau, lấy từ `site/data.json`:

| Trường | Giá trị |
|---|---|
| Tên chính thức | Cho Thuê Xe Máy Nguyễn Tú |
| Tên trên Google Business Profile | Thuê xe máy ở Hà Nội - Nguyễn Tú |
| Thương hiệu | Nguyễn Tú |
| Tên hiển thị tiếng Bồ Đào Nha | Nguyễn Tú — Aluguer de Motas em Hanói |
| Địa chỉ (tiếng Việt) | 112 Nguyễn Văn Cừ, Bồ Đề, Long Biên, Hà Nội, Việt Nam |
| Địa chỉ (tiếng Bồ Đào Nha) | 112 Nguyễn Văn Cừ, Bồ Đề, Long Biên, Hanói, Vietname |
| Điện thoại / Zalo | +84 942 467 674 · 0942 467 674 (schema: +84942467674) |
| Giờ mở cửa | 09:00–21:00, 7 ngày (Asia/Ho_Chi_Minh) |
| Website chính | https://thuexemaynguyentu.com/ |
| Website tiếng Bồ Đào Nha | https://pt.rentbikehanoi.com/ |
| Google Maps | https://maps.google.com/maps?cid=7448790013669858019 |

**Việc cần sửa ngay:** một số trích dẫn bên ngoài ghi "112**B** Nguyễn Văn Cừ" và thêm địa chỉ "24D Tạ Hiện". Hãy yêu cầu sửa lại cho đúng NAP ở trên. Nếu có nhiều địa chỉ khác nhau, Google có thể hiểu thành nhiều doanh nghiệp.

## 2. Trích dẫn địa phương (citations), theo thứ tự ưu tiên

1. **Google Business Profile**: kiểm tra tên, địa chỉ, giờ, danh mục (*Motorcycle rental agency*), ảnh thật của cửa hàng và xe, các dịch vụ. Trả lời đánh giá thật, tuyệt đối không mua đánh giá.
2. **Bing Places for Business**: nhập từ Google Business Profile (miễn phí). Bing cung cấp dữ liệu cho Copilot và nhiều công cụ AI.
3. **Apple Business Connect**: cho người dùng iPhone và Apple Maps.
4. **TripAdvisor / Facebook** của cửa hàng: thống nhất NAP. Chỉ đưa các URL này vào `business.sameAs` sau khi chủ cửa hàng xác nhận đó là tài khoản chính thức. Hiện đã **gỡ** khỏi schema vì không có trong danh sách NAP chính thức.
5. Danh bạ Việt Nam uy tín (ví dụ Trang Vàng Việt Nam): chỉ dùng nơi có biên tập, không dùng danh bạ spam.

## 3. Liên kết giữa các website cùng hệ thống

- Site này đã có liên kết ở footer tới **English** (app.rentbikehanoi.com) và **Español** (es.rentbikehanoi.com), cấu hình trong `site/data.json` → `site.languageSites`. Đây là **liên kết thường**, không phải hreflang, vì các trang không tương đương 1-1.
- **Cần làm ở các repo khác** (phiên làm việc này không có quyền sửa): trong /web, /spanish, /china, /blog, thêm một liên kết "Português" tới `https://pt.rentbikehanoi.com/` ở footer hoặc menu ngôn ngữ.
- Chỉ dùng hreflang khi hai trang thật sự tương đương **và** liên kết qua lại cả hai chiều. Khi đó khai báo trong `site.hreflang.alternates`.
- **Không** tạo mạng lưới site vệ tinh, không đặt hàng loạt liên kết chéo trong nội dung, không dùng anchor text chứa từ khóa lặp lại.

## 4. Liên kết tự nhiên (earned links) cho độc giả nói tiếng Bồ Đào Nha

Nội dung đáng được trích dẫn (linkable assets) nên ưu tiên viết trước, theo đúng quy trình factory:

- Hướng dẫn luật giao thông Việt Nam cho du khách Bồ Đào Nha, có nguồn luật và bảng mức phạt (cụm Guia de aluguer).
- Checklist in được: kiểm tra xe trước khi nhận (Inspeção e segurança).
- Hướng dẫn xin Licença Internacional de Condução tại IMT (PT-0127, đang trong hàng đợi).

Cách tiếp cận: gửi thông tin (không trả tiền, không trao đổi link hàng loạt) tới blogger du lịch Bồ Đào Nha và Brazil viết về Việt Nam, nhóm cộng đồng du lịch, diễn đàn có kiểm duyệt. Mỗi liên kết phải đến từ một bài viết thật sự hữu ích cho người đọc.

**Cấm:** mua link, PBN, spam bình luận, guest post hàng loạt do AI viết, trao đổi link quy mô lớn, đánh giá giả.

## 5. Tín hiệu E-E-A-T đã có trên site

- Trang **Sobre nós**: bảng thông tin chính thức (tên, tên Google Maps, địa chỉ tiếng Bồ Đào Nha và tiếng Việt, điện thoại, giờ, website), cùng mục **Quem escreve e verifica este site** (`#equipa-editorial`): ai viết, cách kiểm chứng, có dùng AI hỗ trợ hay không, cách báo lỗi.
- Bài viết có byline liên kết tới mục biên tập, ngày cập nhật, nguồn kèm ngày tra cứu, và ghi chú pháp lý khi nói về luật.
- Schema: một thực thể duy nhất `#business` (`LocalBusiness` + `Organization`). Bài viết dùng `BlogPosting` với `publisher` là cửa hàng. Không có rating, email, tọa độ hay mã bưu chính tự đặt.

**Còn thiếu (cần chủ cửa hàng cung cấp):** ảnh thật của cửa hàng và xe, kèm quyền sử dụng; xác nhận chính sách đặt cọc để công bố.

## 6. Đo lường

Workflow **SEO Monitor** (xem `docs/OWNER-ACTIONS.md` để kết nối Search Console/Bing) báo hằng tuần:

- lượt nhấp và hiển thị theo nhóm từ khóa;
- truy vấn thương hiệu ("nguyễn tú", "thuê xe máy nguyễn tú");
- trang chưa được index và hàng đợi bảo trì nội dung.

Báo cáo liên kết ngoài xem trực tiếp trong Search Console (mục *Links*) và Bing Webmaster Tools (*Backlinks*).
