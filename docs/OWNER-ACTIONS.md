# Việc chủ website cần làm (không thể tự động hóa)

## Ưu tiên cao

- [ ] **Kiểm tra DNS + HTTPS**: bản ghi `CNAME` tên `pt` → `thuexemayhanoi.github.io` tại nhà cung cấp DNS của `rentbikehanoi.com`; trong GitHub → Settings → Pages: Custom domain `pt.rentbikehanoi.com` (đã có qua file CNAME) và bật **Enforce HTTPS**. (Môi trường build không truy cập được domain nên chưa xác minh.)
- [ ] **Google Search Console**: thêm property `https://pt.rentbikehanoi.com/` (hoặc dùng domain property `rentbikehanoi.com` nếu đã có). Nếu dùng thẻ meta, dán mã vào `site/data.json` → `site.verification.google`, chạy `npm run build`. Sau đó gửi `https://pt.rentbikehanoi.com/sitemap.xml`.
- [ ] **Xác nhận bảng giá** trong `site/data.json` → `pricing` (lấy từ bảng "verified" của app.rentbikehanoi.com ngày 12/10/2026). Đặc biệt: **xe máy điện** 200.000/1.000.000/1.500.000 VND (site tiếng Tây Ban Nha ghi "Consultar"), **xe 50 cc** theo tuần/tháng, **xe đạp điện** (đang "Sob consulta").
- [ ] **WhatsApp**: số +84 942 467 674 có dùng WhatsApp không? Nếu có → `business.whatsapp`: `enabled: true`, `verified: true`, `url: "https://wa.me/84942467674"`, chạy build. Hiện đang tắt.
- [ ] **NAP bên ngoài**: Vinpearl ghi "112B Nguyễn Văn Cừ" và địa chỉ thứ hai "24D Tạ Hiện". Nên thống nhất với Google Business Profile và yêu cầu sửa trích dẫn sai.

## Nên làm

- [ ] Xác nhận các liên kết `sameAs` (Facebook, TripAdvisor) trong `business.sameAs` — lấy từ cấu hình site tiếng Anh.
- [ ] Bật **branch protection** cho `main`: bắt buộc check **Site QA** cho Pull Request. Lưu ý: bot Article Factory push thẳng vào `main` (sau khi tự chạy build + QA) — nếu quy tắc chặn push trực tiếp, phải cho bot quyền bỏ qua (bypass), nếu không bước push của factory sẽ dừng an toàn và báo lỗi.
- [ ] Cung cấp **ảnh thật** (cửa hàng, xe) nếu muốn dùng trong bài — kèm quyền sử dụng; tránh ảnh stock.
- [ ] Đọc lại 2 trang pháp lý (`politica-de-privacidade`, `termos-e-condicoes`) — mô tả đúng hoạt động thực tế của site tĩnh; nếu sau này thêm form/analytics phải cập nhật.
- [ ] **Vùng phát thải thấp Hà Nội** (thí điểm Hoàn Kiếm từ 7/2026): cân nhắc ảnh hưởng tới khách thuê xe xăng đi phố cổ; khi có quy định chính thức ổn định, ưu tiên viết PT-0065.
- [ ] Duyệt 45 chủ đề `HOLD_FOR_INTENT_REVIEW` (xem `docs/GROWTH-MATRIX.md`).

## Content Factory

- Writer bên ngoài: gửi file JSON vào `_factory/inbox/` (theo `factory/WRITER-CONTRACT.md`), rồi chạy Actions → **Article Factory** → `process`; duyệt bằng `approve` + IDs.
- Writer Claude (trả phí, chỉ khi chủ đồng ý): thêm secret `ANTHROPIC_API_KEY`, variable `FACTORY_WRITER=claude` và `FACTORY_CLAUDE_MODEL` (ID model khuyến nghị trong tài liệu Anthropic); chạy action `write`. Mỗi lần tối đa 3 bài, vẫn qua QA + duyệt.
