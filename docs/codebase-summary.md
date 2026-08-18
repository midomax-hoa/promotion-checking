# Bản đồ mã nguồn

Điểm vào nhanh cho người mới đọc kho này. Kiến trúc và lý do thiết kế nằm ở [`system-architecture.md`](system-architecture.md); quy ước viết mã ở [`code-standards.md`](code-standards.md).

Số liệu tính tới 2026-08-18: **146 file** `.ts`/`.tsx` trong `src/` (không tính mã Prisma sinh tự động), **40 file test**, **5 migration**.

## Bố cục thư mục

```
src/
  app/            màn hình và tuyến API (Next.js App Router)
  components/     thành phần giao diện
  lib/            toàn bộ logic nghiệp vụ
  generated/      client Prisma sinh tự động - không sửa tay, không commit
prisma/           lược đồ, migration, seed
test/             soi gương theo cấu trúc src/
docs/             tài liệu
plans/            kế hoạch và báo cáo từng giai đoạn
```

## Màn hình

| Đường dẫn | File | Việc |
|---|---|---|
| `/` | `app/page.tsx` | Tải file lên để kiểm tra |
| `/ket-qua/{runId}` | `app/ket-qua/[runId]/page.tsx` | Kết quả một lần kiểm tra |
| `/lich-su` | `app/lich-su/page.tsx` | 100 lần chạy gần nhất |
| `/doi-soat` | `app/doi-soat/page.tsx` | Chọn nguồn để đối soát |
| `/doi-soat/{runId}` | `app/doi-soat/[runId]/page.tsx` | Bảng so ba cột |
| `/dong-bo` | `app/dong-bo/page.tsx` | Đồng bộ danh mục sản phẩm |
| `/cau-hinh` | `app/cau-hinh/page.tsx` | Sửa 37 luật và thiết lập chung |

Tất cả là Server Component, đặt `export const dynamic = 'force-dynamic'`. Thành phần phía trình duyệt chỉ có ở chỗ thật sự cần tương tác.

## Tuyến API

| Tuyến | File | Việc |
|---|---|---|
| `POST /api/sync` | `app/api/sync/route.ts` | Đồng bộ danh mục, phát tiến trình NDJSON |
| `POST /api/check` | `app/api/check/route.ts` | Nhận file, chạy luật, trả `runId` |
| `GET /api/check/{runId}/export` | `app/api/check/[runId]/export/route.ts` | Dựng file Excel báo cáo |
| `POST /api/reconcile` | `app/api/reconcile/route.ts` | Đối soát hai lượt, phát tiến trình NDJSON |

Riêng màn cấu hình không có tuyến API — nó dùng **Server Action** trong `app/cau-hinh/actions.ts`.

## Logic nghiệp vụ (`src/lib/`)

### `catalog/` — bộ nhớ đệm danh mục

`sku.ts` giữ **luật chuẩn hoá SKU duy nhất** của cả dự án. `catalog-store.ts` tách khỏi phần gọi mạng để test được không cần CSDL. `catalog-index.ts` dựng các bảng tra trong bộ nhớ mà luật nhóm B và F5 dùng.

### `excel/` — đọc và ghi file

Đầu mối là `promotion-workbook.ts` → `readPromotionWorkbook(bytes, fileName)`. Xung quanh nó là các mảnh nhỏ: dò cột theo từ khoá, phân tích ngày an toàn múi giờ, sửa chuỗi hỏng, gom nhóm theo `Tên ctkm`. Nhánh ghi nằm ở `report-exporter.ts` và hai file phụ trợ.

### `haravan/` — tầng gọi API

`haravan-client.ts` chỉ phơi ra phương thức `get`. `rate-limiter.ts` giữ nhịp gọi. `catalog-sync.ts` và `promotion-fetcher.ts` lo phân trang. Các file `run-*.ts` là chỗ duy nhất nối phần thuần với cấu hình thật.

### `rules/` — bộ máy luật (37 luật)

| File | Việc |
|---|---|
| `rule-catalog.ts` | **Nguồn sự thật duy nhất**: 37 luật, mức mặc định, ngưỡng mặc định, tên nhóm |
| `registry.ts` | Danh sách luật thật sự chạy được; lệch với danh mục là test đỏ |
| `engine.ts` | Chạy các luật đang bật, sắp xếp phát hiện, ghi lại luật bị bỏ qua |
| `rule-config-store.ts` | Trộn `RuleConfig` trong CSDL với mặc định trong danh mục |
| `run-check.ts` | Đầu mối có chạm CSDL và mạng |
| `group-a-*/` … `group-e-*/` | Mỗi luật một file hàm thuần |

Nhóm F nằm riêng ở `reconcile/group-f-reconcile/` vì chúng chạy sau khi import, trên dữ liệu khác.

### `reconcile/` — đối soát sau import

`reconcile-engine.ts` giữ cơ chế hai lượt: kiểm hai lần cách nhau một khoảng chờ, chỉ báo phần giao nhau, để trễ chỉ mục của Haravan không thành báo oan. `promotion-matcher.ts` khớp theo tên và trả về đủ bốn trạng thái.

### `config/` — cấu hình

| File | Việc |
|---|---|
| `app-settings-catalog.ts` | 11 thiết lập chung, khoá + mặc định + mô tả tiếng Việt |
| `app-config.ts` | Đọc `AppSetting`, kiểm bằng `zod`, sai thì rơi về mặc định; kèm `validateSettingValue` cho màn cấu hình |
| `rule-config-schema.ts` | Mô tả ngưỡng sửa được của từng luật: nhãn, đơn vị, chặn trên chặn dưới — lược đồ `zod` dựng từ chính mô tả đó |
| `rule-config-form.ts` | Đọc biểu mẫu cấu hình thành các bản cập nhật, hoàn toàn thuần nên test được không cần CSDL |
| `config-form-state.ts` | Hình dạng dùng chung giữa màn cấu hình và Server Action |

### `check/`, `db/`

`check/` lo lưu và đọc lại kết quả, lọc và phân trang trong PostgreSQL. `db/prisma.ts` khởi tạo client **trễ** qua `Proxy` — khởi tạo ngay lúc nạp module sẽ làm `next build` đứt khi không có CSDL.

## Dữ liệu (`prisma/schema.prisma`)

| Bảng | Giữ gì |
|---|---|
| `VariantCache` | Bộ nhớ đệm biến thể, khoá theo `variantId` vì Haravan cho phép SKU trùng và rỗng |
| `SyncState` | Mốc đồng bộ gần nhất và các số đếm |
| `CheckRun` | Một lần chạy, `mode` là `check` hoặc `reconcile` |
| `CheckProgram` | Mỗi chương trình trong file một dòng, kể cả chương trình sạch |
| `Finding` | Từng phát hiện |
| `ReconcileMatch` | Chụp lại cả hai phía của một cặp đối soát |
| `RuleConfig` | 37 luật: bật/tắt, mức, ngưỡng, `updatedAt` |
| `AppSetting` | Thiết lập chung dạng khoá–giá trị |

## Chạy các lệnh

```bash
npm run dev         # máy phát triển
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest run
npm run build       # next build
npm run db:migrate  # tạo migration
npm run db:seed     # nạp mặc định, giữ nguyên tinh chỉnh đã có
```

Triển khai và vận hành: [`van-hanh-va-trien-khai.md`](van-hanh-va-trien-khai.md). Hướng dẫn cho người dùng cuối: [`huong-dan-su-dung.md`](huong-dan-su-dung.md).
