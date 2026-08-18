# Lộ trình phát triển

Tài liệu sống, cập nhật mỗi khi một giai đoạn đổi trạng thái. Kế hoạch chi tiết từng giai đoạn nằm trong [`plans/260817-1233-promotion-import-checking-tool/`](../plans/260817-1233-promotion-import-checking-tool/plan.md).

## Tiến độ

| # | Giai đoạn | Phụ thuộc | Trạng thái |
|---|---|---|---|
| 01 | Nền tảng dự án & lược đồ dữ liệu | — | ✅ Xong 2026-08-17 |
| 02 | Haravan client & đồng bộ danh mục | 01 | ✅ Xong 2026-08-17 |
| 03 | Đọc & chuẩn hoá file Excel | 01 | ✅ Xong 2026-08-18 |
| 04 | Bộ máy luật (nhóm A–E) | 02, 03 | ✅ Xong 2026-08-18 |
| 05 | Màn kiểm tra file & xuất báo cáo | 04 | ⬜ Chưa làm |
| 06 | Màn đối soát sau import (nhóm F) | 04 | ⬜ Chưa làm |
| 07 | Màn cấu hình luật & tài liệu | 01 | ⬜ Chưa làm |
| 08 | Triển khai bằng Docker Compose | 05 | ⬜ Chưa làm |

Giai đoạn 03 và 02 chạy độc lập với nhau. Giai đoạn 07 cắt bỏ được nếu gấp — ngưỡng vẫn nằm đúng chuẩn trong CSDL, chỉ là chưa sửa được trên giao diện.

## Đã xong

### Giai đoạn 01 — Nền tảng (2026-08-17)

Khung Next.js 15 + TypeScript + Tailwind v4, Prisma 7 nối PostgreSQL trong WSL, 6 bảng dữ liệu, migration `init`, seed 37 luật và các cấu hình mặc định, shadcn/ui.

### Giai đoạn 02 — Haravan client & đồng bộ danh mục (2026-08-17)

Tầng gọi API có kiểm soát nhịp, đồng bộ danh mục về cache, màn hình ③.

Kiểm chứng trên store dev: 74 sản phẩm / 937 biến thể trong 0,7–1,1 giây, **khớp chính xác** `GET /com/products/count.json`. Đồng bộ tăng dần 65 mili giây. 62 test pass; `typecheck`, `lint`, `build` sạch.

### Giai đoạn 03 — Đọc & chuẩn hoá file Excel (2026-08-18)

Đầu mối `readPromotionWorkbook(bytes, fileName)` → `WorkbookReadResult`. Đọc mọi sheet, dò cột theo từ khoá, phân tích ngày an toàn múi giờ, gom nhóm theo `Tên ctkm`.

Đối chiếu file thật: 2 sheet, 3.931 dòng, 154 chương trình ở sheet `Key`, đúng **279 dòng giảm 0đ** của `2608GST0K`, đọc hết trong ~1,1–1,3 giây. 139 test cho tầng này, 201 test toàn dự án.

Phải né **ba lỗi của `exceljs`** — chi tiết ở [`system-architecture.md`](system-architecture.md#tầng-đọc-excel-giai-đoạn-03).

### Giai đoạn 04 — Bộ máy luật nhóm A–E (2026-08-18)

31 luật, mỗi luật một file hàm thuần, gom qua `registry.ts` và chạy bằng `engine.ts`. Mức cảnh báo, bật/tắt và ngưỡng đọc từ bảng `RuleConfig`.

Nguyên tắc cứng: **thiếu dữ liệu đầu vào thì báo là thiếu**. Luật khai báo `requires`; cache danh mục rỗng thì 5 luật nhóm B bị bỏ qua và phát cảnh báo `SYS-CATALOG-EMPTY`, thay vì báo cả 3.929 mã hiệu là "không tồn tại".

Đối chiếu file thật: đúng **279 dòng** giảm 0đ của `2608GST0K`, C1/E1/E2 sạch, chạy ~30 ms. 139 test cho tầng này, 340 test toàn dự án.

Rủi ro Levenshtein đã thành sự thật và đã xử lý — chi tiết ở [`system-architecture.md`](system-architecture.md#bộ-máy-luật-giai-đoạn-04).

Chi tiết kiến trúc ở [`system-architecture.md`](system-architecture.md).

## Việc còn treo

| Việc | Vì sao còn treo | Cần làm gì |
|---|---|---|
| Ngân sách 30 giây cho 3.000 sản phẩm | Store dev chỉ có 74 sản phẩm nên chưa đo được | Chạy đồng bộ đầy đủ trên store thật, đo thời gian. Đòn bẩy nếu chậm: nâng `haravan.requests_per_second` tới 4, hoặc nới cửa sổ tải trước |
| Hành vi `not_allow_promotion` khi bật | Store dev toàn `false` | Cần một sản phẩm thật có cờ này để biết Haravan xử lý ra sao. Luật B6 tạm để mức `danger`; nâng lên `critical` phải **ghi** lên Haravan (bật cờ thử) nên chờ xác nhận trước khi làm |
| Luật D8 và E3 chưa chạy với dữ liệu thật | Cần danh sách khuyến mãi đang có trên Haravan, mà `promotion-fetcher.ts` thuộc giai đoạn 06 | Giai đoạn 06 ánh xạ phản hồi API sang kiểu `HaravanPromotion` trong `src/lib/rules/types.ts`. Hiện hai luật nằm trong `skippedRules`, không bị bỏ qua âm thầm |
| Nhóm B chưa đối chiếu danh mục thật | Store dev không có 3.929 mã hiệu của file mẫu | Đồng bộ cửa hàng thật rồi chạy lại, đo số mã hiệu không tra ra và chất lượng gợi ý của B1 |
| Biến thể chuyển sản phẩm | Không kiểm chứng được bằng đọc, mà công cụ này chỉ đọc | Xác nhận Haravan có cập nhật `updated_at` của sản phẩm đích hay không |
| `promotion-fetcher.ts` | Chỉ giai đoạn 06 dùng — YAGNI | Viết khi làm giai đoạn 06, dùng lại `HaravanClient` sẵn có |
| Nâng Next 16 | `npm audit` báo 3 lỗi mức cao ở phụ thuộc gián tiếp của Next 15 (`postcss`, `sharp`) | Làm thành một đợt riêng — `npm audit fix --force` sẽ hạ `exceljs` xuống 3.x và nâng Next lên 16, đều là thay đổi phá vỡ |

## Định nghĩa hoàn thành của cả dự án

- Nạp file mẫu → phát hiện đúng 279 dòng giảm 0đ của chương trình `2608GST0K`, báo rõ chương trình này sẽ bị Haravan từ chối
- Liệt kê đầy đủ SKU không tồn tại trên Haravan kèm gợi ý SKU gần giống
- Kiểm tra một file dưới 5 giây khi cache danh mục đã sẵn sàng
- Đối soát sau import không báo oan do trễ chỉ mục
- Không phát sinh bất kỳ lệnh ghi nào lên Haravan
