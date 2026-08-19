# Đăng nhập bằng username hoặc email

**Trạng thái:** xong — 2026-08-19
**Mục tiêu:** chặn người lạ vào công cụ. Chỉ cần đăng nhập bằng username *hoặc* email kèm mật khẩu.

## Quyết định đã chốt

| Hạng mục | Chốt | Lý do |
|---|---|---|
| Thư viện | Tự làm, không thêm dependency | Nhu cầu chỉ có một màn hình đăng nhập; `node:crypto` đã đủ để băm mật khẩu |
| Băm mật khẩu | `scrypt` của `node:crypto` | Có sẵn trong Node, chống dò mật khẩu bằng chi phí bộ nhớ; khỏi thêm bcrypt/argon2 (đều cần biên dịch native) |
| Phiên đăng nhập | Token ngẫu nhiên lưu trong bảng `Session`, cookie `httpOnly` | Đăng xuất được ngay lập tức, khác với JWT tự hết hạn. Cookie không cho JavaScript đọc nên XSS không lấy được phiên |
| Tạo tài khoản | Lệnh dòng lệnh `npm run user:*` | Không cần thêm màn hình quản trị và phân quyền |
| Tài khoản đầu tiên | Seed từ biến môi trường, chỉ tạo khi bảng còn rỗng | Cài bằng Docker vẫn có tài khoản để đăng nhập lần đầu |

## Kiến trúc

```
Trình duyệt ──cookie pc_session──> middleware.ts   (kiểm nhanh: có cookie không)
                                        │ không có → chuyển tới /dang-nhap
                                        ↓ có
                                   Trang / API      (kiểm thật: requireUser đối chiếu CSDL)
```

Hai lớp vì `middleware` chạy trên Edge runtime, không gọi được Prisma. Lớp ngoài chỉ ngăn
khách vãng lai; lớp trong mới là chốt chặn thật, nên mọi trang, mọi API và mọi server action
đều tự gọi `requireUser()` chứ không tin vào middleware.

Token phiên lưu xuống CSDL dưới dạng băm SHA-256. Ai đọc trộm được bảng `Session` cũng không
dựng lại được cookie để mạo danh.

## Giá trị cấu hình (thêm vào màn hình Cấu hình, không chôn cứng)

| Khoá | Mặc định | Ý nghĩa |
|---|---|---|
| `auth.session_ttl_hours` | 24 | Đăng nhập một lần dùng được bao nhiêu giờ |
| `auth.max_failed_attempts` | 5 | Sai mật khẩu mấy lần thì khoá tạm |
| `auth.lockout_minutes` | 15 | Khoá tạm bao lâu |
| `auth.min_password_length` | 8 | Mật khẩu ngắn nhất được phép đặt |

## Việc cần làm

- [x] Lược đồ: bảng `User`, `Session` + migration
- [x] `src/lib/auth/`: băm mật khẩu, token phiên, kho phiên, kiểm đăng nhập, chống dò mật khẩu
- [x] `src/middleware.ts`: lớp chặn nhanh
- [x] Màn hình `/dang-nhap` + server action đăng nhập/đăng xuất
- [x] Gắn `requireUser()` vào 7 trang, 4 API route, 2 server action cấu hình
- [x] Thanh bên: hiện tên người đang đăng nhập + nút đăng xuất
- [x] Lệnh `user:create`, `user:list`, `user:passwd`, `user:delete`
- [x] Seed tài khoản quản trị đầu tiên từ biến môi trường
- [x] Bốn thiết lập mới trong danh mục cấu hình
- [x] Kiểm thử: băm mật khẩu, phiên, chống chuyển hướng ra ngoài, khoá tạm
- [x] Cập nhật tài liệu vận hành và hướng dẫn sử dụng

## Điều kiện hoàn thành

- Chưa đăng nhập, mở bất kỳ đường dẫn nào (trừ `/api/health`) đều bị đưa về `/dang-nhap`
- Đăng nhập được bằng cả username lẫn email, không phân biệt hoa thường
- Sai mật khẩu quá số lần cho phép thì bị khoá tạm, hết thời gian khoá thì đăng nhập lại được
- `npm run typecheck`, `npm run lint`, `npm test` đều sạch

## Ngoài phạm vi

Phân quyền theo vai trò, đăng nhập bằng Google, quên mật khẩu qua email, xác thực hai lớp.
Cần thì làm sau, nay chưa có nhu cầu.

## Đã kiểm chứng thế nào

Chạy trên máy phát triển với CSDL thật:

| Việc kiểm | Kết quả |
|---|---|
| Chưa đăng nhập mở `/` và `/lich-su` | 307 về `/dang-nhap?tiep=…` |
| Chưa đăng nhập gọi `POST /api/sync` | 401 kèm thông báo tiếng Việt |
| `GET /api/health` không cookie | 200, healthcheck không bị chặn |
| Cookie bịa ra | Qua được middleware, bị `requireUser()` chặn — đúng thiết kế hai lớp |
| Cookie phiên hợp lệ | Các màn hình trả 200, thanh bên hiện tên tài khoản |
| Đã đăng nhập mở `/dang-nhap` | 307 về trang chủ |
| Đăng nhập bằng username / email / viết hoa | Đều vào được |
| Sai mật khẩu 5 lần | Khoá 15 phút; mật khẩu đúng trong lúc khoá vẫn bị từ chối |
| Hết thời gian khoá | Vào được, bộ đếm về 0 |
| Bốn thiết lập `auth.*` | Hiện đủ trên màn cấu hình |
| `npm run db:seed` chạy lại | Không tạo trùng tài khoản |

Chưa kiểm bằng trình duyệt thật: biểu mẫu đăng nhập mới chỉ kiểm ở mức HTML dựng ra đúng ô
`identifier` và `password`. Phần nối biểu mẫu dùng đúng khuôn `useActionState` như màn cấu hình
đang chạy. Nên bấm thử một lượt trên trình duyệt trước khi phát hành.

## Bẫy đã gặp

`middleware.ts` chạy trên Edge runtime, không có `node:crypto`. Bản đầu để tên cookie chung file
với hàm sinh token nên middleware kéo `node:crypto` vào, làm **mọi tuyến trả 500** kể cả
`/api/health`. Đã tách `session-cookie.ts` (thuần) khỏi `session-token.ts` (dùng `node:crypto`),
và ghi ràng buộc này thành comment trong cả hai file.
