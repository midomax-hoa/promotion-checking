# Vận hành và triển khai

Dành cho người quản trị hệ thống. Trạng thái hiện tại: chạy được bằng tay ở máy phát triển; đóng gói Docker Compose thuộc giai đoạn 08, chưa làm.

## Biến môi trường

Chép `.env.example` thành `.env` rồi điền. **Không commit `.env`.**

| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `DATABASE_URL` | Có | Chuỗi kết nối PostgreSQL. Ký tự đặc biệt trong mật khẩu phải mã hoá URL — `@` viết thành `%40` |
| `HARAVAN_API_TOKEN` | Có | Token ứng dụng riêng của Haravan. **Chỉ dùng ở phía máy chủ**, tuyệt đối không đặt tiền tố `NEXT_PUBLIC_` |
| `UPLOAD_DIR` | Không | Thư mục giữ file `.xlsx` đã tải lên, để xuất lại báo cáo. Mặc định `.uploads` |

Địa chỉ gốc của API Haravan **không** nằm trong biến môi trường — nó là thiết lập `haravan.api_base` trong CSDL, sửa được trên màn cấu hình. Giá trị nhập vào bị ràng buộc phải là `https` và thuộc tên miền `haravan.com`, để không ai vô tình gửi token sang máy chủ khác.

## Cài đặt lần đầu

```bash
npm install
npx prisma migrate deploy     # dựng lược đồ
npm run db:seed               # nạp 37 luật và các thiết lập mặc định
npm run build
npm start
```

`npm run db:seed` chạy lại được nhiều lần: bản ghi đã có giữ nguyên giá trị người vận hành đã chỉnh, chỉ làm mới phần mô tả.

## Đổi giá trị mặc định của luật

Sửa `src/lib/rules/rule-catalog.ts` rồi chạy:

```bash
npm run db:seed:reset
```

Lệnh này **ghi đè** mọi tinh chỉnh trên màn cấu hình bằng giá trị trong danh mục. Đây là cách được hỗ trợ để phát hành một giá trị mặc định mới — nếu không, thay đổi sẽ không bao giờ chạm tới CSDL đã seed trước đó.

## Migration CSDL

- **Tuyệt đối không dùng `prisma db push`.** Mọi thay đổi lược đồ phải tạo migration.
- Máy phát triển: `npm run db:migrate`
- Máy chủ: `npm run db:deploy`
- Cần xem SQL trước khi chạy: `npx prisma migrate dev --create-only --name <ten>`, đọc file rồi mới `db:deploy`.

Kiểm tra đang trỏ vào CSDL nào trước khi chạy bất cứ lệnh nào đụng dữ liệu. Dòng đã bị chú thích bằng `#` trong `.env` là cấu hình đã bỏ, không phải cấu hình đang dùng.

## Bảo mật vận hành

**Công cụ không có đăng nhập.** Đã chốt chạy trong mạng nội bộ. Hệ quả:

- Ai vào được địa chỉ này đều **sửa được cấu hình luật** và **tải file lên**.
- Không đặt máy chủ ra Internet công cộng khi chưa bổ sung lớp xác thực.
- Cột `RuleConfig.updatedAt` là dấu vết duy nhất cho biết cấu hình đổi lúc nào. Nó chỉ nhích khi giá trị thật sự thay đổi, nên mốc thời gian ở đó có nghĩa; bấm Lưu mà không đổi gì thì không ghi gì.

Những chốt chặn đã có sẵn trong mã:

- Toàn bộ giao tiếp với Haravan chỉ dùng `GET`. Không có đường ghi nào trong mã nguồn.
- Token bị thay bằng `***` trước khi bất kỳ nội dung phản hồi nào lọt vào thông báo lỗi.
- File tải lên chỉ được đọc như dữ liệu; chữ ký đầu tệp kiểm trên byte, dung lượng chặn theo `Content-Length` trước khi đọc thân yêu cầu.
- Tên file lưu trữ bị viết lại, đường dẫn giải ra được kiểm lại ở cả chiều ghi lẫn chiều đọc.
- Mọi giá trị nhập trên màn cấu hình đều qua `zod` trước khi ghi CSDL; mã luật lấy từ danh mục trong mã nguồn chứ không lấy từ biểu mẫu.

## Việc định kỳ

| Việc | Nhịp gợi ý | Cách làm |
|---|---|---|
| Đồng bộ đầy đủ danh mục | Hằng ngày hoặc trước mỗi đợt import lớn | Màn **Đồng bộ danh mục** → **Đồng bộ lại từ đầu** |
| Đồng bộ tăng dần | Trước mỗi lần kiểm tra file | Cùng màn, nút còn lại. Nhanh hơn nhiều nhưng không thấy sản phẩm đã bị xoá |
| Dọn thư mục `UPLOAD_DIR` | Theo dung lượng đĩa | **Chưa có script** — `scripts/prune-uploads.sh` thuộc giai đoạn 08 |
| Sao lưu CSDL | Theo quy định nội bộ | `pg_dump`. File kết xuất chứa dữ liệu kinh doanh, không đưa vào kho mã |

## Điều tiết nhịp gọi Haravan

Haravan giới hạn nhịp gọi. Thiết lập `haravan.requests_per_second` mặc định `3`, đặt dưới mức rỉ 4/giây cho an toàn, và trần cho phép là 4.

Gặp `429` thì công cụ hiểu đó là chuyện giới hạn nhịp chứ không phải dữ liệu sai: nó thử lại tới `haravan.max_attempts` lần rồi mới báo hỏng.

Đồng bộ chậm bất thường thì nâng `haravan.requests_per_second` lên 4 trước, đừng động vào `haravan.page_size` — Haravan ép cứng tối đa 50 bản ghi mỗi trang, đặt lớn hơn sẽ làm vòng phân trang hiểu nhầm một trang đầy là trang cuối.

## Kiểm tra sức khoẻ sau khi triển khai

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Rồi mở lần lượt: **Đồng bộ danh mục** (số sản phẩm khớp cửa hàng), **Cấu hình luật** (đủ 37 luật, sáu nhóm), **Kiểm tra file** (nạp một file mẫu nhỏ).

## Giới hạn đã biết

- Chưa có xác thực người dùng.
- Chưa có script dọn file tải lên.
- Trang lịch sử hiện 100 lần chạy gần nhất, chưa phân trang.
- `GET /com/promotions.json` không lọc được phía máy chủ, nên mỗi lần đối soát đều kéo toàn bộ chương trình khuyến mãi của cửa hàng về rồi lọc trong bộ nhớ. Cửa hàng tích luỹ nhiều năm sẽ phải xem lại điểm này.
- Ngân sách 30 giây cho 3.000 sản phẩm chưa kiểm chứng được — cửa hàng dev chỉ có 74 sản phẩm.
- `npm audit` báo 3 lỗi mức cao ở phụ thuộc gián tiếp của Next 15. Nâng lên Next 16 là thay đổi phá vỡ, để thành một đợt riêng.
