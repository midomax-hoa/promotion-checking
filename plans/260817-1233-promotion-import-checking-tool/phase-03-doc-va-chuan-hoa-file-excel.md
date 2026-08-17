# Giai đoạn 03 — Đọc & chuẩn hoá file Excel

## Liên kết bối cảnh

- [Tổng quan kế hoạch](plan.md) · [Giai đoạn 01](phase-01-nen-tang-du-an-va-luoc-do-du-lieu.md)
- [Báo cáo brainstorm](../reports/brainstorm-260817-1019-promotion-import-checking-tool.md) — mục 1 (cấu trúc dữ liệu thật)
- File mẫu: `promotion.t8.xlsx` ở thư mục gốc dự án

## Tổng quan

- **Ưu tiên:** Cao — bộ máy luật không chạy được nếu tầng này sai
- **Trạng thái:** Chưa làm
- Đọc **tất cả sheet**, dò cột linh hoạt, phân tích ngày an toàn, gom nhóm theo `Tên ctkm`, trả về mô hình dữ liệu chuẩn.

## Nhận định quan trọng

Rút ra từ khảo sát file thật:

- File có **2 sheet**: `Key` (3.929 dòng) và `Giảm phần trăm` (2 dòng). **Phải đọc cả hai.**
- Tiêu đề cột có ký tự xuống dòng: `"Số dư\r\n(Để trống nếu không giới hạn)"` → dò cột phải chuẩn hoá khoảng trắng trước khi so khớp.
- Có cột thừa không tên ở cuối (đọc ra thành `__EMPTY`) → bỏ qua.
- Ô ngày trong file lưu dạng **số sê-ri Excel** (ví dụ `46235` = 2026-08-01), nhưng file khác có thể lưu dạng chuỗi.
- Cột `Phần trăm giảm` lưu dạng thập phân (`0.5` = 50%), còn Haravan nhận `50`.
- Múi giờ `Asia/Saigon`. Số sê-ri Excel phải quy về **ngày theo giờ địa phương**, tuyệt đối không để lệch sang ngày hôm trước do quy đổi UTC.

**Nguyên tắc bất di bất dịch:** ô ngày không phân tích được thì **báo lỗi**, không được âm thầm thay bằng giá trị mặc định. Thay thầm lặng chính là nguồn gốc của những chương trình mang ngày sai mà không ai hay.

## Yêu cầu

**Chức năng**
- Đọc mọi sheet, ghi lại tên sheet và số dòng từng sheet
- Dò cột theo từ khoá, không phụ thuộc vị trí cột
- Phân tích ngày cho: số sê-ri Excel, đối tượng Date, chuỗi `YYYY-MM-DD[ HH:mm:ss]`, chuỗi `D/M/YYYY`
- Gom nhóm theo `Tên ctkm`
- Giữ **số dòng thật trong Excel** cho mọi bản ghi để người dùng mở file ra dò lại được

**Phi chức năng**
- Đọc 4.000 dòng dưới 2 giây
- Không bao giờ ném lỗi làm sập; dữ liệu hỏng phải quy thành kết quả có đánh dấu lỗi

## Kiến trúc

```
src/lib/excel/
  excel-reader.ts       # exceljs → dữ liệu thô theo từng sheet
  column-mapper.ts      # dò cột theo từ khoá
  date-parser.ts        # phân tích ngày đa định dạng, không có giá trị dự phòng thầm lặng
  number-parser.ts      # làm sạch số: bỏ dấu phẩy, nháy, khoảng trắng
  row-normalizer.ts     # dòng thô → PromotionRow
  program-grouper.ts    # PromotionRow[] → PromotionProgram[]
src/lib/excel/types.ts
```

### Mô hình dữ liệu

```ts
export type CellIssue =
  | 'missing' | 'unparsable-date' | 'unparsable-number' | 'unknown-discount-type'

export type PromotionRow = {
  sheetName: string
  rowNumber: number              // số dòng thật trong Excel, tính cả dòng tiêu đề
  productCode: string | null     // Mã
  sku: string | null             // Mã hiệu
  skuNormalized: string | null   // trim + lowercase
  productName: string | null     // Mặt hàng
  variantName: string | null     // Đặc tính
  unit: string | null            // Bộ đóng gói
  listPrice: number | null       // Giá niêm yết
  usageLimit: number | null      // Số dư
  priceAfter: number | null      // Giá sau giảm
  discountAmount: number | null  // Số tiền giảm
  discountPercent: number | null // Phần trăm giảm — giữ nguyên dạng thập phân
  discountTypeRaw: string | null // Kiểu ctkm, giữ nguyên chuỗi gốc
  discountType: 'fixed_amount' | 'percentage' | 'same_price' | null
  startAt: Date | null
  endAt: Date | null
  programName: string | null     // Tên ctkm
  issues: Partial<Record<keyof PromotionRow, CellIssue>>
}

export type PromotionProgram = {
  name: string
  rows: PromotionRow[]
  sheetNames: string[]
  distinctDiscountTypes: string[]
  distinctAmounts: (number | null)[]
  distinctPercents: (number | null)[]
  distinctStarts: (Date | null)[]
  distinctEnds: (Date | null)[]
  distinctUsageLimits: (number | null)[]
}

export type WorkbookReadResult = {
  fileName: string
  fileHash: string
  sheets: { name: string; rowCount: number; mappedColumns: Record<string, string | null> }[]
  rows: PromotionRow[]
  programs: PromotionProgram[]
  missingRequiredColumns: { sheetName: string; missing: string[] }[]
}
```

### Quy tắc dò cột

So khớp không phân biệt hoa thường, sau khi thay mọi chuỗi khoảng trắng (kể cả `\r\n`) bằng một dấu cách và cắt hai đầu:

| Trường | Từ khoá |
|---|---|
| `productCode` | `mã` (khớp chính xác sau chuẩn hoá) |
| `sku` | `mã hiệu` |
| `productName` | `mặt hàng` |
| `variantName` | `đặc tính` |
| `unit` | `bộ đóng gói` |
| `listPrice` | `giá niêm yết` |
| `usageLimit` | `số dư` |
| `priceAfter` | `giá sau giảm` |
| `discountAmount` | `số tiền giảm` |
| `discountPercent` | `phần trăm giảm` |
| `discountTypeRaw` | `kiểu ctkm` |
| `startAt` | `bắt đầu` |
| `endAt` | `kết thúc` |
| `programName` | `tên ctkm` |

Cột bắt buộc: `sku`, `discountTypeRaw`, `programName`. Thiếu bất kỳ cột nào thì ghi vào `missingRequiredColumns` cho luật A1 xử lý, **không ném lỗi**.

Lưu ý thứ tự dò: `mã hiệu` phải khớp trước `mã`, nếu không cột `Mã` sẽ nuốt mất cột `Mã hiệu`.

### Phân tích ngày

```ts
export type DateParseResult =
  | { ok: true; value: Date; source: 'serial' | 'date' | 'iso-string' | 'dmy-string' }
  | { ok: false; raw: unknown }
```

- Số sê-ri: `(serial - 25569) * 86400 * 1000` cho ra mốc UTC, sau đó **dựng lại Date theo thành phần ngày ở UTC** để tránh lệch múi giờ
- `exceljs` có thể trả thẳng `Date` — nhận luôn
- Chuỗi `YYYY-MM-DD` hoặc `YYYY-MM-DD HH:mm:ss` — nhận
- Chuỗi `D/M/YYYY` — nhận, hiểu theo thứ tự ngày/tháng/năm
- Ngoài các dạng trên → `{ ok: false }`, **không có giá trị dự phòng**

### Ánh xạ kiểu khuyến mãi

| Chuỗi trong `Kiểu ctkm` chứa | Kiểu |
|---|---|
| `phần trăm` | `percentage` |
| `số tiền` | `fixed_amount` |
| `đồng giá` | `same_price` |
| khác | `null` → luật C6 xử lý |

## File liên quan

**Tạo mới:** toàn bộ file trong phần Kiến trúc, kèm test cho từng file
**Dữ liệu test:** copy `promotion.t8.xlsx` vào `test/fixtures/`, thêm vài file nhỏ tự dựng cho các trường hợp biên

## Các bước thực hiện

1. Viết `types.ts`
2. Viết `number-parser.ts` — bỏ `, " '` và khoảng trắng; chuỗi rỗng trả `null` chứ không phải `0`
3. Viết `date-parser.ts` phủ đủ 4 định dạng + test lệch múi giờ
4. Viết `column-mapper.ts` — chuẩn hoá tiêu đề, dò theo thứ tự ưu tiên, trả về bản đồ cột kèm phần còn thiếu
5. Viết `excel-reader.ts` — `exceljs` đọc theo luồng, duyệt **mọi** worksheet, tính SHA-256 của file
6. Viết `row-normalizer.ts` — dòng thô → `PromotionRow`, ghi nhận `issues` cho từng ô hỏng
7. Viết `program-grouper.ts` — gom theo `Tên ctkm` đã cắt khoảng trắng; dòng thiếu tên gom vào nhóm `"(không có tên)"`
8. Viết test đối chiếu với file thật: 2 sheet, 3.929 + 2 dòng, 154 chương trình ở sheet `Key`
9. Đo thời gian đọc, đảm bảo dưới 2 giây

## Danh sách việc

- [ ] `types.ts`
- [ ] `number-parser.ts` + test
- [ ] `date-parser.ts` + test (đủ 4 định dạng, có ca lệch múi giờ)
- [ ] `column-mapper.ts` + test (tiêu đề có `\r\n`, thứ tự `mã hiệu` trước `mã`)
- [ ] `excel-reader.ts` đọc mọi sheet + băm file
- [ ] `row-normalizer.ts` + test
- [ ] `program-grouper.ts` + test
- [ ] Test đối chiếu file thật `promotion.t8.xlsx`

## Tiêu chí hoàn thành

- Đọc `promotion.t8.xlsx` cho ra: 2 sheet, 3.931 dòng tổng, 154 chương trình ở sheet `Key`
- Ngày dòng đầu ra đúng `2026-08-01` và `2026-08-31` theo giờ địa phương
- Tiêu đề `"Số dư\r\n(Để trống nếu không giới hạn)"` dò trúng trường `usageLimit`
- Ô ngày dạng chuỗi lạ cho ra `issues.startAt = 'unparsable-date'`, **không** thay bằng giá trị mặc định
- Đọc xong dưới 2 giây

## Đánh giá rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Quy đổi số sê-ri Excel bị lệch 1 ngày do múi giờ | Dựng Date từ thành phần ngày ở UTC; có test riêng cho tình huống này |
| Dò cột khớp nhầm (`Mã` nuốt `Mã hiệu`) | Dò theo thứ tự ưu tiên, từ khoá dài trước; có test khẳng định |
| File có sheet hướng dẫn / sheet rỗng | Sheet không có cột bắt buộc thì ghi nhận và bỏ qua, vẫn liệt kê trong báo cáo (luật A2) |
| File lớn gây tràn bộ nhớ | Dùng chế độ đọc theo luồng của `exceljs` |

## Cân nhắc bảo mật

- Giới hạn dung lượng tệp tải lên (mặc định 20 MB)
- Chỉ nhận `.xlsx` / `.xls`; kiểm tra chữ ký đầu tệp chứ không chỉ tin phần mở rộng
- Không lưu tệp gốc lên đĩa lâu dài; chỉ giữ băm và kết quả đã phân tích

## Bước kế tiếp

Giai đoạn 04 nhận `WorkbookReadResult` làm đầu vào cho bộ máy luật.
