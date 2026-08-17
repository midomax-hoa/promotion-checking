# Nhật ký thay đổi

Ghi lại các thay đổi đáng kể của dự án. Mới nhất ở trên.

## 2026-08-17 — Giai đoạn 02: Haravan client & đồng bộ danh mục

### Thêm mới

**Tầng gọi API Haravan** (`src/lib/haravan/`)

- `types.ts` — kiểu dữ liệu viết theo phản hồi thật, kèm mẫu và ngày kiểm chứng
- `rate-limiter.ts` — bình chứa token, đồng hồ tiêm được từ ngoài, đọc header `X-Haravan-Api-Call-Limit`
- `haravan-errors.ts` — 6 lớp lỗi phân loại rõ
- `haravan-client.ts` — chỉ `GET`, gắn Bearer token, thử lại khi 429/5xx theo `Retry-After`
- `catalog-sync.ts` — duyệt trang, tải trước trang kế, kiểm tra tính trọn vẹn
- `sync-cursor.ts` — tính mốc cho lượt đồng bộ tăng dần
- `run-catalog-sync.ts` — ráp client thật với kho lưu thật

**Cache danh mục** (`src/lib/catalog/`)

- `sku.ts` — luật chuẩn hoá SKU duy nhất cho toàn bộ mã nguồn
- `catalog-store.ts` — ghi xuống Prisma theo lô, tính số liệu bằng một câu SQL
- `catalog-index.ts` — tra cứu bằng `Map`, đệm 60 giây, `bySku` trả mảng

**Giao diện và tuyến API**

- `src/app/api/sync/route.ts` — chạy đồng bộ, phát tiến trình NDJSON
- `src/app/dong-bo/` — màn hình ③ Đồng bộ danh mục
- Thanh điều hướng trong `src/app/layout.tsx`

**Kiểm thử** — 62 test, thêm 6 file trong `test/haravan/` và `test/catalog/`

### Thay đổi

- `haravan.page_size` giới hạn xuống tối đa **50** (trước là 250). Haravan ép cứng `limit` về 50 phía máy chủ; đặt lớn hơn sẽ khiến một trang đầy 50 phần tử bị hiểu nhầm là trang cuối → đồng bộ dừng sớm → bước dọn dẹp xoá phần còn lại của cache mà vẫn đóng dấu thành công. Bộ phân trang giờ còn tự học kích thước trang thật từ trang 1 thay vì tin cấu hình.
- `AppSetting` tăng từ 7 lên **10 khoá**: thêm `haravan.max_attempts` (4), `catalog.cursor_overlap_ms` (300000), `catalog.sync_shortfall_tolerance` (0).

### Sửa lỗi tiềm ẩn — phát hiện khi rà soát mã nguồn

| Vấn đề | Vì sao nguy hiểm |
|---|---|
| Cấu hình kích thước trang lớn hơn 50 làm đồng bộ cụt rồi xoá sạch cache, vẫn đóng dấu thành công | Đây đúng là kịch bản "mất dữ liệu mà không ai biết"; sau đó toàn bộ nhóm luật B báo hàng ngàn "SKU không tồn tại" giả |
| Duyệt hết trang mà vẫn thiếu dữ liệu thì không ném lỗi nào | Nay đọc `products/count.json` trước, kéo về thiếu quá dung sai thì ném lỗi **trước khi** dọn dẹp và không đóng dấu `lastFullSyncAt` |
| Mốc đồng bộ tăng dần bỏ sót vĩnh viễn sản phẩm sửa lúc đang đồng bộ | Nay lùi mốc lại `catalog.cursor_overlap_ms` |
| Trình duyệt ngắt kết nối làm lượt đồng bộ đứt giữa chừng | Nay nuốt lỗi ghi ra luồng, lượt đồng bộ chạy tới hết để CSDL về trạng thái nhất quán |
| Thông báo lỗi nội bộ đi thẳng ra trình duyệt, máy chủ không ghi log gì | Lỗi Prisma và driver chứa tên máy chủ CSDL. Nay ghi log đầy đủ phía máy chủ, trình duyệt chỉ nhận thông báo trong danh sách cho phép |
| Chốt chặn SKU rỗng lách được bằng cách nối `?sku=` vào đường dẫn | Nay từ chối luôn đường dẫn tự chứa `?`, có test khẳng định |
| Mỗi client tạo bộ điều tiết nhịp riêng | Hai bên gọi song song thành 6 lượt/giây, vượt mức rỉ 4/giây. Nay dùng chung một bộ điều tiết cho mỗi địa chỉ API |
| `POST /api/sync` nhận được yêu cầu gửi chéo trang | Nay từ chối qua header `Sec-Fetch-Site` |
| Token có thể lọt vào thông báo lỗi qua nội dung phản hồi | Nay thay bằng `***` ngay tại chỗ dựng lỗi |

### Kiểm chứng bằng gọi thật (store dev)

- `GET /com/products/count.json` → 74; đồng bộ đầy đủ kéo về đúng **74 sản phẩm / 937 biến thể** trong 0,7–1,1 giây qua 2 trang
- 3 biến thể có SKU rỗng, 0 nhóm SKU trùng, 238 biến thể có sản phẩm cha `published_at = null`
- `limit=250` xác nhận bị ép về 50; `page=2` trả 24 phần tử không chồng lấn trang 1; `updated_at_min` chạy đúng
- **Thứ tự `products.json` là `id` giảm dần** — không phải `updated_at` như từng lo, nên phân trang ổn định trước các thao tác sửa
- Đồng bộ tăng dần: 1 sản phẩm / 15 biến thể trong 65 mili giây
- Chạy hai lượt đồng bộ cùng lúc → HTTP 409; gửi yêu cầu chéo trang → HTTP 403
- `npm run typecheck`, `lint`, `build` sạch; `npm test` 62 test pass

### Chưa kiểm chứng

Ngân sách 30 giây cho 3.000 sản phẩm — store dev chỉ có 74 sản phẩm.

## 2026-08-17 — Giai đoạn 01: Nền tảng dự án & lược đồ dữ liệu

### Thêm mới

- Khung Next.js 15 App Router + TypeScript + Tailwind v4 + shadcn/ui
- Prisma 7 nối PostgreSQL trong WSL, 6 bảng, migration `init`
- `rule-catalog.ts` — 37 luật kèm mặc định, dùng chung cho seed và bộ máy luật
- `prisma/seed.ts` dùng `upsert`, chạy lại nhiều lần không nhân đôi dữ liệu
- `app-config.ts` — đọc `AppSetting` có kiểm bằng `zod` và giá trị dự phòng
- `bigint.ts` — chuyển `BigInt` qua ranh giới server ↔ trình duyệt

### Điểm lệch so với kế hoạch

- Prisma cài về là bản 7: chuỗi kết nối nằm ở `prisma.config.ts`, generator đổi thành `provider = "prisma-client"`, bắt buộc driver adapter. Bản 7 không còn engine nhị phân nên `binaryTargets` không còn tác dụng.
- Tailwind v4 cấu hình bằng CSS, không sinh file config.
- Đổi font Geist sang Inter + JetBrains Mono — Geist không có subset `vietnamese` nên chữ có dấu rơi về font hệ thống.
