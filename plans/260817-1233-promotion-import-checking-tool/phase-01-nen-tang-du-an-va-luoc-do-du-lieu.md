# Giai đoạn 01 — Nền tảng dự án & lược đồ dữ liệu

## Liên kết bối cảnh

- [Tổng quan kế hoạch](plan.md)
- [Báo cáo brainstorm](../reports/brainstorm-260817-1019-promotion-import-checking-tool.md) — mục 4 (kiến trúc), mục 5 (bộ luật)

## Tổng quan

- **Ưu tiên:** Cao nhất — mọi giai đoạn khác phụ thuộc
- **Trạng thái:** ✅ Hoàn thành (2026-08-17)
- Dựng khung Next.js, cấu hình Prisma + PostgreSQL, định nghĩa toàn bộ lược đồ dữ liệu, seed 37 bản ghi cấu hình luật.

## Nhận định quan trọng

- Dự án greenfield hoàn toàn — không có mã nguồn cũ để tái sử dụng.
- **SKU trên Haravan có thể trùng nhau** giữa các biến thể, và có biến thể `sku = null` (đã gặp 3 trường hợp trên store dev). Vì vậy khoá chính của bảng cache phải là `variantId`, không phải `sku`.
- Ngưỡng nghiệp vụ bắt buộc nằm trong DB ngay từ đầu, kể cả khi giao diện cấu hình làm ở giai đoạn 07.
- **CSDL là PostgreSQL, không phải SQLite.** Máy phát triển đã có sẵn PostgreSQL 18.4 chạy trong WSL (đã kiểm chứng bằng `psql --version` trong WSL ngày 2026-08-17). Mọi thao tác tạo CSDL, chạy `psql` để kiểm tra dữ liệu đều **gọi qua WSL**, không cài PostgreSQL riêng trên Windows.
- CSDL cho dự án này: **`promotion_checking`** (máy phát triển). Tạo bằng `createdb` qua WSL — xem bước 0 phần dưới.

## Yêu cầu

**Chức năng**
- Chạy được `npm run dev` và `npm run build` không lỗi
- `prisma migrate dev` tạo được CSDL
- Lệnh seed nạp đủ 37 bản ghi `RuleConfig` và các `AppSetting` mặc định

**Phi chức năng**
- Mọi file mã nguồn dưới 200 dòng
- Tên file kebab-case
- Token Haravan chỉ đọc từ biến môi trường phía máy chủ, không lộ ra trình duyệt

## Kiến trúc

```
src/
  app/                     # Next.js App Router
    layout.tsx
    page.tsx               # tạm thời: trang chủ rỗng
  lib/
    db/prisma.ts           # Prisma client dạng singleton
    config/app-config.ts   # đọc AppSetting có kèm giá trị mặc định
  components/ui/           # shadcn
prisma/
  schema.prisma
  seed.ts
  migrations/
```

### Lược đồ dữ liệu

```prisma
// Cache danh mục kéo từ Haravan
model VariantCache {
  variantId      BigInt    @id
  productId      BigInt
  sku            String?               // Haravan cho phép null
  barcode        String?
  productTitle   String
  variantTitle   String?
  price          Float
  compareAtPrice Float?
  inventoryQty   Int?
  // Các trường lấy từ sản phẩm cha — đã kiểm chứng đều chọn được qua tham số `fields`
  publishedAt        DateTime?         // null = chưa đăng bán → luật B2
  notAllowPromotion  Boolean @default(false) // sản phẩm cấm khuyến mãi → luật B6
  publishedScope     String?           // 'global' | 'pos' | null — lưu sẵn, chưa dùng
  syncedAt       DateTime
  @@index([sku])
  @@index([productId])
}

model SyncState {
  id             Int       @id @default(1)
  lastFullSyncAt DateTime?
  lastCursor     DateTime?             // dùng cho updated_at_min
  productCount   Int       @default(0)
  variantCount   Int       @default(0)
  blankSkuCount  Int       @default(0)
  duplicateSkuCount Int    @default(0)
}

model CheckRun {
  id            String    @id @default(cuid())
  mode          String                 // "check" | "reconcile"
  fileName      String                 // tên gốc người dùng tải lên
  storedFileName String?               // tên file đã lưu trong UPLOAD_DIR; null = đã dọn theo hạn lưu
  fileHash      String
  createdAt     DateTime  @default(now())
  totalSheets   Int
  totalRows     Int
  totalPrograms Int
  countCritical Int       @default(0)
  countDanger   Int       @default(0)
  countWarn     Int       @default(0)
  catalogSyncedAt DateTime?            // ảnh chụp độ tươi của cache lúc chạy
  findings      Finding[]
}

model Finding {
  id          String   @id @default(cuid())
  runId       String
  run         CheckRun @relation(fields: [runId], references: [id], onDelete: Cascade)
  ruleCode    String
  severity    String                   // "critical" | "danger" | "warn"
  sheetName   String?
  rowNumber   Int?                     // số dòng thật trong Excel, tính cả dòng tiêu đề
  programName String?
  sku         String?
  message     String
  suggestion  String?
  @@index([runId, severity])
  @@index([runId, ruleCode])
  @@index([runId, programName])
}

model RuleConfig {
  code      String   @id              // "A1", "B1", ...
  groupCode String                    // "A".."F"
  title     String
  enabled   Boolean  @default(true)
  severity  String
  params    Json?                     // ngưỡng riêng của từng luật
  updatedAt DateTime @updatedAt
}

model AppSetting {
  key   String @id
  value String
}
```

### Giá trị seed mặc định

`AppSetting`:

| Khoá | Mặc định | Ý nghĩa |
|---|---|---|
| `catalog.max_age_hours` | `24` | Quá số giờ này thì cảnh báo cache cũ |
| `haravan.api_base` | `https://apis.haravan.com` | |
| `haravan.page_size` | `50` | Haravan ép cứng 50 |
| `haravan.requests_per_second` | `3` | Dưới mức rỉ 4/s cho an toàn |
| `reconcile.recheck_delay_ms` | `8000` | Khoảng chờ giữa 2 lần kiểm chống trễ chỉ mục |
| `report.max_rows_per_page` | `100` | Phân trang bảng kết quả |

`RuleConfig`: 37 bản ghi, mã và mức lấy đúng theo mục 5 báo cáo brainstorm (A1–A5, B1–B6, C1–C7, D1–D10, E1–E3, F1–F6). Tham số riêng:

| Luật | `params` mặc định |
|---|---|
| C4 | `{ "maxDiscountPercent": 70 }` |
| C7 | `{ "roundingUnit": 1000 }` |
| D7 | `{ "maxDurationDays": 90 }` |
| B1 | `{ "suggestMaxDistance": 2 }` |

D1 và D2 seed với `enabled: false`.

## File liên quan

**Tạo mới**
- `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `.gitignore`, `.env.example`
- `prisma/schema.prisma`, `prisma/seed.ts`
- `src/lib/db/prisma.ts`, `src/lib/config/app-config.ts`
- `src/app/layout.tsx`, `src/app/page.tsx`
- `src/lib/rules/rule-catalog.ts` — danh sách 37 luật kèm mặc định, dùng chung cho seed và bộ máy luật

**Sửa:** không có (dự án mới)

## Các bước thực hiện

0. **Tạo CSDL qua WSL** (không cài PostgreSQL trên Windows):
   ```bash
   wsl.exe -e bash -lc 'PGPASSWORD="..." createdb -h localhost -U harris promotion_checking'
   # kiểm tra lại
   wsl.exe -e bash -lc 'PGPASSWORD="..." psql -h localhost -U harris -tAc "\l" | grep promotion_checking'
   ```
   Máy này đã có sẵn nhiều CSDL của dự án khác (`midomax_*`, `plm_*`, `zns_*`...). **Không đụng vào bất kỳ CSDL nào ngoài `promotion_checking`.**
1. `npx create-next-app@latest` — TypeScript, Tailwind, App Router, thư mục `src/`, không dùng Turbopack cho bản dựng sản xuất
2. Cài `prisma`, `@prisma/client`, `exceljs`, `zod`; cài `vitest` làm phụ thuộc phát triển
3. Khởi tạo shadcn/ui, thêm sẵn: `table`, `badge`, `button`, `input`, `select`, `progress`, `alert`, `tabs`
4. Viết `prisma/schema.prisma` theo lược đồ trên, `provider = "postgresql"`. **Đã điều chỉnh khi làm thật:** bản Prisma 7 không nhận `url` trong `schema.prisma` cũng không cần `binaryTargets`; thay vào đó khai `generator client { provider = "prisma-client", output = "../src/generated/prisma" }` và đặt chuỗi kết nối trong `prisma.config.ts`
5. `.env.example` gồm `DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/promotion_checking"`, `HARAVAN_API_TOKEN=`. **`.env` thật đặt mật khẩu đã mã hoá URL** — ký tự `@` trong mật khẩu phải viết thành `%40`, không thì Prisma phân tích sai chuỗi kết nối
6. **Tạo migration bằng `prisma migrate dev --name init`. Tuyệt đối không dùng `prisma db push`.**
7. Viết `src/lib/rules/rule-catalog.ts` — mảng 37 phần tử `{ code, groupCode, title, defaultSeverity, defaultEnabled, defaultParams }`
8. Viết `prisma/seed.ts` đọc `rule-catalog.ts` và nạp bằng `upsert` (chạy lại nhiều lần không nhân đôi dữ liệu)
9. Viết `src/lib/db/prisma.ts` dạng singleton tránh tạo nhiều kết nối khi chạy dev
10. Viết `src/lib/config/app-config.ts` — hàm đọc `AppSetting` có ép kiểu và giá trị dự phòng
11. Thêm script `package.json`: `db:migrate`, `db:seed`, `db:studio`, `test`, `lint`
12. Chạy `npm run build` kiểm tra không lỗi biên dịch

## Danh sách việc

- [x] Tạo CSDL `promotion_checking` qua WSL
- [x] Khởi tạo dự án Next.js 15 + TypeScript + Tailwind
- [x] Cài phụ thuộc và khởi tạo shadcn/ui
- [x] Viết `prisma/schema.prisma` đầy đủ 6 bảng
- [x] Tạo migration `init` (không dùng `db push`)
- [x] Viết `rule-catalog.ts` — 37 luật kèm mặc định
- [x] Viết `prisma/seed.ts` dùng upsert, chạy và kiểm tra dữ liệu
- [x] Viết `prisma.ts` singleton và `app-config.ts`
- [x] Bổ sung script npm và `.env.example`
- [x] `npm run build` chạy sạch

## Kết quả thực tế (2026-08-17)

Bốn điểm lệch so với kế hoạch, đã xử lý và kiểm chứng:

| Kế hoạch ghi | Thực tế | Cách xử lý |
|---|---|---|
| Prisma đặt `url` trong `schema.prisma`, khai `binaryTargets` cho Alpine | Bản cài về là **Prisma 7.9.1**: chuỗi kết nối nằm ở `prisma.config.ts`, generator đổi thành `provider = "prisma-client"` bắt buộc có `output`, và **bắt buộc driver adapter** `@prisma/adapter-pg` khi khởi tạo client | Viết theo bản 7. Client sinh ra ở `src/generated/prisma` (đã cho vào `.gitignore`, có script `postinstall: prisma generate`). **Prisma 7 không còn engine nhị phân nên `binaryTargets` không còn tác dụng** — xem ghi chú ở giai đoạn 08 |
| `tailwind.config.ts` | Tailwind v4 cấu hình bằng CSS, không sinh file config | Bỏ file, cấu hình nằm trong `src/app/globals.css` |
| Font mặc định Geist | Geist **không có subset `vietnamese`**, `next build` báo lỗi và chữ có dấu sẽ rơi về font hệ thống | Đổi sang Inter (sans) + JetBrains Mono (mono), cả hai đều có subset `vietnamese` |
| — | `npm audit`: 3 lỗi mức cao (`postcss`, `sharp` — đều là phụ thuộc gián tiếp của Next 15, chỉ hết khi lên Next 16), 2 lỗi mức trung bình (`exceljs` → `uuid`) | **Không chạy `npm audit fix --force`** vì nó hạ `exceljs` xuống 3.x và nâng Next lên 16 (thay đổi phá vỡ). Ghi nhận lại, cân nhắc nâng Next 16 ở một đợt riêng |

Kiểm chứng bằng `psql` qua WSL sau khi seed: `RuleConfig` 37 dòng (A=5, B=6, C=7, D=10, E=3, F=6), `AppSetting` 6 dòng, `SyncState` 1 dòng, D1/D2 `enabled = false`, `params` đúng 4 luật B1/C4/C7/D7. Chạy seed lần hai vẫn giữ nguyên 37/6.

`.gitignore` bổ sung so với kế hoạch: `src/generated/`, và các thư mục công cụ AI (`.claude/`, `.opencode/`, `.agents/`, `.agent/`, `.cursor/`) — đã chốt khi khởi tạo git. `eslint.config.mjs` cũng loại các thư mục này cùng `check-promotion/`, nếu không `npm run lint` sẽ quét nhầm và báo hơn 1.700 lỗi của mã nguồn bên ngoài.

## Tiêu chí hoàn thành

- `npm run build` không lỗi
- `npm run db:migrate && npm run db:seed` chạy được trên CSDL `promotion_checking`, `RuleConfig` có đúng 37 dòng, `AppSetting` có đủ **7** khoá — khoá thứ 7 là `check.money_tolerance_vnd`, bổ sung sau khi rà soát (kiểm bằng `psql` qua WSL)
- Chạy seed lần hai không tạo bản ghi trùng
- `.env` thật không bị commit; chỉ có `.env.example`

## Đánh giá rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Prisma + `BigInt` khi trả về JSON gây lỗi tuần tự hoá | Chuyển sang chuỗi tại ranh giới máy chủ ↔ trình duyệt; viết hàm trợ giúp dùng chung |
| Giá tiền dùng `Float` (`double precision`) | Tiền VND là số nguyên dưới 10⁹ nên `double` biểu diễn chính xác; mọi so sánh tiền vẫn dùng ngưỡng sai số 0,5đ. Cần chính xác tuyệt đối hơn thì đổi sang `Decimal @db.Decimal(14,2)` — Postgres hỗ trợ sẵn |
| Lỡ tay dùng `prisma db push` | Ghi rõ trong bước 6; `package.json` **không** khai báo script `db:push` |
| Postgres nằm trong WSL, lệnh `npm` chạy bên Windows | WSL2 chuyển tiếp `localhost` nên `localhost:5432` từ Windows vẫn tới được. Nếu không nối được thì kiểm `listen_addresses` và `pg_hba.conf` trong WSL, hoặc chạy luôn lệnh Prisma bên trong WSL |
| Mật khẩu có ký tự `@` làm hỏng chuỗi kết nối | Mã hoá URL trong `DATABASE_URL` (`@` → `%40`) |
| Chạy nhầm migration lên CSDL của dự án khác trên cùng máy chủ | Chỉ để tool tự đọc `.env`; không truyền tay `DATABASE_URL` vào lệnh. Trước khi chạy lệnh có ghi dữ liệu, in ra host + tên CSDL và xác nhận đúng `promotion_checking` |

## Cân nhắc bảo mật

- `HARAVAN_API_TOKEN` chỉ đọc phía máy chủ, không đặt tiền tố `NEXT_PUBLIC_`
- Không ghi token vào log hay thông báo lỗi

### Nội dung `.gitignore` bắt buộc

```gitignore
# Bí mật và bản sao lưu cơ sở dữ liệu
.env
.env.local
.env.production
backups/
*.dump
*.sql.gz

# Phần mềm import nội bộ — chỉ để tham khảo, không thuộc dự án này
check-promotion/

# Dữ liệu kinh doanh thật — không đưa lên kho mã nguồn
promotion*.xlsx
*.xlsx
!test/fixtures/*.xlsx

# File Excel người dùng nạp lên, giữ lại để xuất báo cáo (xem giai đoạn 08)
.uploads/
uploads/

# Bản dựng
src/generated/
node_modules/
.next/
out/

# Thư mục công cụ AI - chỉ dùng cục bộ, không thuộc mã nguồn dự án
.claude/
.opencode/
.agents/
.agent/
.cursor/
```

`eslint.config.mjs` phải loại đúng các thư mục này cộng thêm `check-promotion/`, nếu không `npm run lint` sẽ quét luôn mã nguồn bên ngoài và báo hơn 1.700 lỗi không liên quan.

## Kết quả rà soát mã nguồn (2026-08-17)

Đã rà soát toàn bộ mã giai đoạn 01. Danh mục 37 luật khớp đúng từng dòng với đặc tả, không rò rỉ bí mật. Các vấn đề đã sửa xong ngay trong giai đoạn này:

| Vấn đề | Vì sao nguy hiểm | Đã sửa thế nào |
|---|---|---|
| Seed không bao giờ cập nhật `severity` / `enabled` / `params` của dòng đã có | Kế hoạch đã ghi sẵn việc **nâng B6 lên `critical`** sau khi kiểm chứng Haravan. Sửa `rule-catalog.ts` rồi seed lại sẽ **không đổi được gì** trên CSDL đã seed | Thêm cờ `--reset` và script `npm run db:seed:reset` để đẩy lại mặc định. Mặc định vẫn giữ nguyên giá trị người dùng đã chỉnh |
| Thiếu hàm chuyển `BigInt` (bảng rủi ro đã nêu nhưng chưa làm) | `JSON.stringify` ném lỗi khi gặp `BigInt`; giai đoạn 02/05 trả `VariantCache` ra trình duyệt là dính lỗi 500 lúc chạy thật | Viết `src/lib/serialization/bigint.ts` kèm test |
| Prisma client khởi tạo ngay lúc nạp module | Bất kỳ Server Component nào gọi `getAppConfig()` sẽ làm `next build` trong Docker đứt (lúc build không có CSDL), và không viết test được nếu không có CSDL sống | Đổi sang khởi tạo trễ bằng `Proxy` |
| `Number('')` bằng 0 và vẫn là số hữu hạn nên giá trị dự phòng không bao giờ kích hoạt | Người dùng xoá trắng ô cấu hình ở giai đoạn 07 → `haravan.page_size = 0` làm vòng lặp phân trang chạy vô tận | Kiểm tra bằng `zod`: số nguyên dương, có chặn trên/dưới, sai thì rơi về mặc định |
| `haravan.api_base` sửa được trên giao diện | Token Haravan được gắn vào mọi lượt gọi tới địa chỉ này → ai vào được màn cấu hình là chuyển hướng được token ra máy chủ lạ | Bắt buộc `https` và tên miền phải thuộc `haravan.com`, sai thì rơi về mặc định |
| `--font-sans: var(--font-sans)` trong `globals.css` | Tự tham chiếu vòng tròn nên **font Việt không hề được áp dụng**, đúng cái lỗi vừa đi sửa | Trỏ đúng về biến `--font-geist-sans` do `layout.tsx` phát ra |
| Ngưỡng còn nguy cơ bị fix cứng ở giai đoạn 04 | Vi phạm luật cứng "không hard-code giá trị nghiệp vụ" | Đưa vào cấu hình luôn: D7 thêm `minDurationDays`, C5 thêm `maxPercentValue`, và thêm `AppSetting` `check.money_tolerance_vnd` (ngưỡng sai số so tiền) → **`AppSetting` giờ có 7 khoá, không phải 6** |
| `SYS-CATALOG-EMPTY` không có dòng trong `RuleConfig` | Màn kết quả nối `ruleCode → RuleConfig.title` sẽ không tra ra nhãn | Chốt: mã hệ thống **cố tình không nằm trong `RuleConfig`** (không được phép tắt hay hạ mức), nhãn tra từ `SYSTEM_FINDING_TITLES` |
| Seed chạy 44 lượt gọi rời rạc, `process.exit(1)` cắt ngang lúc đang ngắt kết nối | Hỏng giữa chừng để lại dữ liệu seed dở dang | Bọc trong `$transaction`, đổi sang `process.exitCode` |
| Thiếu chỉ mục cho giai đoạn 05 | Danh sách lịch sử sắp theo `createdAt`, tra file trùng theo `fileHash` | Migration `20260817092526_add_check_run_indexes` |
| `target: ES2017`, `shadcn` nằm trong `dependencies`, thiếu lệnh kiểm kiểu | Chữ số `123n` không biên dịch được dưới ES2020; CLI lọt vào ảnh chạy thật; `npm test` không kiểm kiểu | Nâng lên ES2020, chuyển `shadcn` sang `devDependencies`, thêm script `typecheck` |

Đã kiểm chứng và **loại bỏ** một nghi vấn: `@prisma/adapter-pg` có sẵn `client.on("error", ...)` cho kết nối rảnh, không cần tự gắn thêm.

### Việc chuyển tiếp cho giai đoạn sau

- **Giai đoạn 04:** `RuleConfig.params` từ CSDL là JSON tự do, bộ máy luật phải trộn `{...mặc định trong rule-catalog, ...params trong CSDL}` chứ không tin thẳng giá trị trong CSDL — nếu không, khoá mới thêm vào mặc định sẽ ra `undefined` với những dòng đã seed từ trước. Tương tự, `severity` đọc từ CSDL phải kiểm bằng `zod` trước khi ép về kiểu `Severity`.
- **Giai đoạn 07:** khi cho sửa `params` trên giao diện, phải kiểm cả kiểu lẫn miền giá trị ngay tại chỗ.
- **Giai đoạn 08:** `dotenv` và `tsx` đang nằm trong `devDependencies` mà `prisma.config.ts` và lệnh seed lại cần. Dịch vụ chạy migration trong Docker **phải dùng tầng ảnh có đủ gói phát triển**, không dùng `npm ci --omit=dev`. Script `postinstall: prisma generate` cũng cần Prisma CLI nên đừng chạy `npm ci --omit=dev` ở bất kỳ tầng nào.

**Vì sao loại `check-promotion/`:** đây là phần mềm import nội bộ dạng đóng gói, nặng khoảng 177 MB (gồm cả `node_modules` và tệp nhị phân Electron), chỉ nằm ở đây để tham khảo cách nó gọi API. Đưa lên kho mã nguồn là phình repo vô ích và lộ mã nguồn nội bộ của công cụ khác.

**Vì sao loại file Excel:** `promotion.t8.xlsx` là dữ liệu khuyến mãi thật, chứa giá vốn và giá bán. Bản sao dùng cho kiểm thử đặt trong `test/fixtures/` và **phải rút gọn, thay bằng dữ liệu giả** trước khi commit.

## Bước kế tiếp

Mở khoá giai đoạn 02 (Haravan client) và 03 (đọc Excel) — hai giai đoạn này chạy độc lập với nhau.
