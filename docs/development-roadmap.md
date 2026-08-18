# Lộ trình phát triển

Tài liệu sống, cập nhật mỗi khi một giai đoạn đổi trạng thái. Kế hoạch chi tiết từng giai đoạn nằm trong [`plans/260817-1233-promotion-import-checking-tool/`](../plans/260817-1233-promotion-import-checking-tool/plan.md).

## Tiến độ

| # | Giai đoạn | Phụ thuộc | Trạng thái |
|---|---|---|---|
| 01 | Nền tảng dự án & lược đồ dữ liệu | — | ✅ Xong 2026-08-17 |
| 02 | Haravan client & đồng bộ danh mục | 01 | ✅ Xong 2026-08-17 |
| 03 | Đọc & chuẩn hoá file Excel | 01 | ✅ Xong 2026-08-18 |
| 04 | Bộ máy luật (nhóm A–E) | 02, 03 | ✅ Xong 2026-08-18 |
| 05 | Màn kiểm tra file & xuất báo cáo | 04 | ✅ Xong 2026-08-18 |
| 06 | Màn đối soát sau import (nhóm F) | 04 | ✅ Xong 2026-08-18 |
| 07 | Màn cấu hình luật & tài liệu | 01 | ✅ Xong 2026-08-18 |
| 08 | Triển khai bằng Docker Compose | 05 | 🟡 Đóng gói xong 2026-08-18 — chờ máy chủ để triển khai thật |

Giai đoạn 03 và 02 chạy độc lập với nhau. Giai đoạn 08 chỉ cần 05 là chạy được.

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

### Giai đoạn 05 — Màn kiểm tra file & xuất báo cáo (2026-08-18)

Bốn màn hình: tải file lên, kết quả một lần chạy, lịch sử, và tuyến tải file báo cáo về. Toàn bộ lọc, sắp xếp, phân trang chạy trong PostgreSQL — trang kết quả chỉ gửi về trình duyệt 162 B mã JavaScript.

Đo trên file thật: toàn luồng kiểm tra **2,36 giây** (ngưỡng 8 giây), truy vấn một trang 100 dòng đã lọc **4 ms**, dựng file Excel báo cáo 6,37 giây. Chương trình `2608GST0K` nằm đầu bảng với đúng 279 phát hiện mức `critical`.

Thêm bảng `CheckProgram` so với lược đồ giai đoạn 01: bảng chương trình cần hiển thị *số dòng* và cần liệt kê cả chương trình sạch, mà chương trình không có phát hiện nào thì không để lại dấu vết trong bảng `Finding`.

### Giai đoạn 06 — Màn đối soát sau import (2026-08-18)

Nhóm luật F (6 luật), cơ chế đối soát hai lượt, màn hình ⑤ và ⑥, bảng so ba cột.

Kéo `GET /com/promotions.json` về, khớp theo tên chương trình, chạy F1–F6, lưu vào `CheckRun`
với `mode = "reconcile"` kèm bảng `ReconcileMatch` chụp lại cả hai phía.

Bốn điều chỉnh so với kế hoạch, tất cả đến từ gọi thật lên store dev — bằng chứng ở
[báo cáo kiểm chứng](../plans/reports/verification-260818-1046-haravan-promotions-api.md):

- Đường dẫn là `/com/promotions.json`, không phải `/promotions.json` (bản kia trả 404)
- Không có `promotions/count.json` (trả 422), nên không đối chiếu được tổng số
- Máy chủ **bỏ qua mọi bộ lọc truy vấn**, phải kéo hết rồi lọc trong bộ nhớ
- CTKM thật đính theo `entitled_product_ids` chứ không phải `entitled_variant_ids`, nên luật F5
  quy đổi cả hai về số biến thể qua cache danh mục; tra không ra thì bỏ qua, không kết luận

Đo trên store dev: một lượt đối soát đủ hai lượt hết 8,5 giây (8 giây là khoảng chờ cố ý).
Luật F3 im lặng đúng với ca `2026-07-22T08:11:00Z` ↔ 15:11 giờ Việt Nam, F2 im lặng đúng với ca
file ghi `0.1` còn Haravan ghi `10`. Tổng 475 test pass; `typecheck`, `lint`, `build` sạch.

Thêm hai migration: `add_reconcile_match` và `add_reconcile_match_sku_count`. Thêm cấu hình
`shop.timezone_offset_minutes` (mặc định 420) — độ lệch múi giờ không chôn cứng trong mã nguồn.

Luật D8 và E3 của nhóm trước cũng được nối vào màn kiểm tra file ở giai đoạn này, vì đây là lúc
danh sách khuyến mãi có sẵn. Gọi API hỏng thì việc kiểm tra vẫn chạy, hai luật đó ghi là bỏ qua.

### Giai đoạn 07 — Màn cấu hình luật & tài liệu (2026-08-18)

Màn hình ⑦ tại `/cau-hinh`: 37 luật gom sáu nhóm A–F cùng 11 thiết lập chung, tất cả sửa được mà không đụng mã nguồn. Lưu bằng Server Action, kiểm bằng `zod`, chỉ ghi dòng thật sự đổi nên `RuleConfig.updatedAt` giữ đúng nghĩa.

Kiểm chứng trên bản dựng thật, CSDL thật, file mẫu thật:

| Tiêu chí | Kết quả |
|---|---|
| Hạ ngưỡng luật C4 từ 70% xuống 50% | Phát hiện C4 tăng từ **0 lên 189** |
| Tắt một luật đang báo (C2) | 279 phát hiện → **0** |
| Tắt cả nhóm D (D3, D4, D5 đang báo) | **Không còn phát hiện nào của nhóm D** |
| Khôi phục mặc định toàn bộ | Số phát hiện trùng khớp mốc ban đầu |
| Nhập `maxDiscountPercent = 500` | Bị chặn, báo tiếng Việt, **giá trị vừa gõ vẫn nằm lại** trên màn hình |
| Nhập `haravan.page_size = 250` | Bị chặn: "Giá trị tối đa cho phép là 50." |
| Ghi chọn lọc | Đổi 2 luật → chỉ 2 dòng có `updatedAt` mới |

Hai điều chỉnh so với kế hoạch, cả hai đến từ thao tác thật trên trình duyệt:

- **Biểu mẫu đặt `noValidate`.** Để nguyên, trình duyệt chặn trước bằng bong bóng tiếng Anh và thông báo tiếng Việt không bao giờ hiện ra.
- **Trạng thái trả về mang theo nguyên văn giá trị bị từ chối.** React tự `reset` biểu mẫu sau khi Server Action trả về, nên nếu không làm vậy thì ô nhập bật về giá trị cũ trong khi lỗi vẫn trỏ vào nó.

Tài liệu: thêm `codebase-summary.md`, `huong-dan-su-dung.md` (cho người dùng cuối, kèm ảnh chụp màn hình), `van-hanh-va-trien-khai.md`; cập nhật `system-architecture.md` và `code-standards.md`.

Tổng 495 test pass; `typecheck`, `lint`, `build` sạch. Không thêm migration — bảng `RuleConfig` và `AppSetting` đã đủ từ giai đoạn 01.

### Giai đoạn 08 — Đóng gói Docker Compose (2026-08-18)

`Dockerfile` năm chặng (`deps` → `migrator-deps` → `builder` → `migrator` → `runner`), `docker-compose.yml` ba dịch vụ theo thứ tự `migrate` → `app` → `caddy` cộng profile `tools`, `Caddyfile` chọn cách cấp TLS bằng biến `CADDY_TLS`, điểm kiểm tra `/api/health`, bốn script sao lưu / phục hồi / dọn file.

Đo trên máy phát triển (Docker trong WSL): image ứng dụng **326 MB** (ngưỡng 400 MB), image migrator 931 MB sau khi cắt cây phụ thuộc chỉ dùng cho giao diện. Chạy thử toàn phần với một PostgreSQL tạm: 5 migration áp đúng, seed nạp 37 luật + 11 thiết lập, `/api/health` trả `{"status":"ok","database":"up"}`, `/cau-hinh` dựng 85 KB HTML đọc từ CSDL đã seed, `whoami` → `nextjs`, `date` → `+07`. `docker history` không lộ token hay chuỗi kết nối; chỉ `caddy` ánh xạ cổng ra ngoài; Caddy tự bật chuyển hướng HTTP → HTTPS ở cả hai chế độ TLS.

Ba điểm lệch so với kế hoạch, đều do kiểm chứng thực tế:

- **Không dùng được `npm ci --ignore-scripts`.** Client Prisma 7 đúng là không kèm engine, nhưng `prisma migrate deploy` thì có — `@prisma/engines` tải `schema-engine-linux-musl-openssl-3.0.x` (~20 MB) trong postinstall. Chặng `deps` vì vậy chép sẵn `prisma/schema.prisma` và `prisma.config.ts` **trước** `npm ci` để hook `postinstall` chạy trọn.
- **Thêm chặng `migrator-deps`.** Xoá thư mục ở một layer sau không thu hồi được dung lượng của layer trước, nên phải cắt ở một chặng riêng rồi `COPY` sang. Migrator từ 1,51 GB còn 931 MB.
- **Mọi lệnh compose phải kèm `--env-file .env.production`.** `env_file:` chỉ truyền biến vào container; phần `${...}` trong compose lấy từ `--env-file`. Các script `docker:*` trong `package.json` đã kèm sẵn.

Xác nhận cảnh báo của kế hoạch là thật: `grep` trong image thấy `allowedOrigins":["promotion.example.com"]` nằm trong `server.js`, tức đổi `APP_DOMAIN` là **phải dựng lại image**.

Chưa làm được vì cần máy chủ và thông tin CSDL thật: chạy `docker compose up` trên máy chủ Linux, kiểm HTTPS bằng tên miền thật, diễn tập nâng cấp, đặt cron.

## Việc còn treo

| Việc | Vì sao còn treo | Cần làm gì |
|---|---|---|
| Ngân sách 30 giây cho 3.000 sản phẩm | Store dev chỉ có 74 sản phẩm nên chưa đo được | Chạy đồng bộ đầy đủ trên store thật, đo thời gian. Đòn bẩy nếu chậm: nâng `haravan.requests_per_second` tới 4, hoặc nới cửa sổ tải trước |
| Hành vi `not_allow_promotion` khi bật | Store dev toàn `false` | Cần một sản phẩm thật có cờ này để biết Haravan xử lý ra sao. Luật B6 tạm để mức `danger`; nâng lên `critical` phải **ghi** lên Haravan (bật cờ thử) nên chờ xác nhận trước khi làm |
| Phân trang `promotions.json` | Store dev chỉ có **1** chương trình nên chưa xác định được `limit` có bị ép về 50 như `products.json` hay không | Chạy trên store thật rồi đọc lại. Cách hiện tại (học kích thước trang thật từ trang đầu) đúng với cả hai khả năng, nên đây là việc xác nhận chứ không phải việc sửa |
| Trường `set_time_active` | Bản ghi duy nhất trên store dev để `false` | Chưa rõ nó ảnh hưởng ra sao tới `starts_at`/`ends_at`. Nếu ảnh hưởng thì luật F3 cần tính thêm |
| Nhóm B chưa đối chiếu danh mục thật | Store dev không có 3.929 mã hiệu của file mẫu | Đồng bộ cửa hàng thật rồi chạy lại, đo số mã hiệu không tra ra và chất lượng gợi ý của B1 |
| Biến thể chuyển sản phẩm | Không kiểm chứng được bằng đọc, mà công cụ này chỉ đọc | Xác nhận Haravan có cập nhật `updated_at` của sản phẩm đích hay không |
| Ảnh chụp cấu hình theo từng lần chạy | Bảng rủi ro của giai đoạn 07 giả định `CheckRun` có lưu, nhưng lược đồ không có cột nào như vậy | Thêm một cột `Json` vào `CheckRun` kèm migration, ghi lại `RuleConfig` lúc chạy. Không có nó thì không giải thích được vì sao hai lần chạy cách nhau một lần chỉnh cấu hình lại ra số khác nhau |
| Triển khai thật lên máy chủ | Chưa có máy chủ Linux và thông tin CSDL (host, tài khoản, quyền `CREATE TABLE`, bắt buộc SSL hay không) | Xin cấu hình từ bên quản trị CSDL, điền `.env.production`, `npm run docker:up`, kiểm HTTPS qua tên miền thật, diễn tập nâng cấp, đặt cron sao lưu và dọn file |
| Nâng Next 16 | `npm audit` báo 3 lỗi mức cao ở phụ thuộc gián tiếp của Next 15 (`postcss`, `sharp`) | Làm thành một đợt riêng — `npm audit fix --force` sẽ hạ `exceljs` xuống 3.x và nâng Next lên 16, đều là thay đổi phá vỡ |

## Định nghĩa hoàn thành của cả dự án

- Nạp file mẫu → phát hiện đúng 279 dòng giảm 0đ của chương trình `2608GST0K`, báo rõ chương trình này sẽ bị Haravan từ chối
- Liệt kê đầy đủ SKU không tồn tại trên Haravan kèm gợi ý SKU gần giống
- Kiểm tra một file dưới 5 giây khi cache danh mục đã sẵn sàng
- Đối soát sau import không báo oan do trễ chỉ mục — ✅ cơ chế hai lượt, có test giả lập trễ chỉ mục
- Không phát sinh bất kỳ lệnh ghi nào lên Haravan — ✅ `HaravanClient` chỉ phơi ra phương thức `get`
