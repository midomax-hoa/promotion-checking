# Giai đoạn 03 — Đọc & chuẩn hoá file Excel

## Liên kết bối cảnh

- [Tổng quan kế hoạch](plan.md) · [Giai đoạn 01](phase-01-nen-tang-du-an-va-luoc-do-du-lieu.md)
- [Báo cáo brainstorm](../reports/brainstorm-260817-1019-promotion-import-checking-tool.md) — mục 1 (cấu trúc dữ liệu thật)
- File mẫu: `promotion.t8.xlsx` ở thư mục gốc dự án

## Tổng quan

- **Ưu tiên:** Cao — bộ máy luật không chạy được nếu tầng này sai
- **Trạng thái:** ✅ Xong 2026-08-18 — xem [Kết quả thực tế](#kết-quả-thực-tế-2026-08-18)
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

- [x] `types.ts`
- [x] `number-parser.ts` + test
- [x] `date-parser.ts` + test (đủ 4 định dạng, có ca lệch múi giờ)
- [x] `column-mapper.ts` + test (tiêu đề có `\r\n`, thứ tự `mã hiệu` trước `mã`)
- [x] `excel-reader.ts` đọc mọi sheet + băm file
- [x] `row-normalizer.ts` + test
- [x] `program-grouper.ts` + test
- [x] Test đối chiếu file thật `promotion.t8.xlsx`
- [x] `cell-value.ts` — bóc tách ô công thức / rich text (phát sinh, xem bên dưới)
- [x] `text-repair.ts` — vá chữ hỏng do lỗi giải mã của `exceljs` (phát sinh)

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

## Kết quả thực tế (2026-08-18)

Toàn bộ tiêu chí hoàn thành đều đạt. 139 test cho tầng Excel, 201 test toàn dự án, `tsc --noEmit` và `eslint` sạch.

### Khác biệt so với đặc tả ban đầu

Bốn điểm dưới đây phát hiện khi đối chiếu file thật, đặc tả gốc chưa lường tới:

**1. Ô công thức — bắt buộc phải xử lý, đặc tả gốc không nhắc**

Trong sheet `Key`, **100% ô `Tên ctkm` và `Số tiền giảm` là ô công thức**, `exceljs` trả về `{ formula, result }` chứ không phải giá trị trần. Đọc thẳng `cell.value` sẽ gom cả 3.929 dòng vào một chương trình tên `[object Object]`. Thêm `cell-value.ts` để bóc tách công thức, rich text, hyperlink và ô lỗi.

Ô lỗi (`#DIV/0!`) được trả về nguyên dạng chuỗi chứ không quy về rỗng — để nó hiện ra thành cảnh báo, không bị hiểu nhầm là ô trống.

**2. Tiêu đề `Số dư` là rich text, không phải chuỗi**

Đặc tả ghi `"Số dư\r\n(Để trống nếu không giới hạn)"`. Thực tế `exceljs` trả `{ richText: [...] }` và ký tự xuống dòng là `\n`. Phải nối các đoạn rich text lại trước khi chuẩn hoá.

**3. Đọc theo luồng nhanh gấp ~11 lần, nhưng có hai lỗi của `exceljs` phải né**

Đo trên file thật: bộ đọc luồng ~100 ms, bộ đọc buffered ~1.100 ms. Tuy nhiên **mỗi bộ đọc sai một kiểu khác nhau**, đã đối chiếu XML gốc để biết đâu là đúng:

| Ô | Giá trị thật trong XML | Bộ đọc luồng | Bộ đọc buffered |
|---|---|---|---|
| `Key!I51` | `<v>0</v>` | `0` ✅ | mất luôn số `0` ❌ |
| `Key!C801` | `Quả bóng chuyền trẻ em…` | hỏng thành `tr��em` ❌ | đúng ✅ |

- **Buffered đánh rơi kết quả `0` của ô công thức chia sẻ** — đúng 279 ô, tức toàn bộ chương trình `2608GST0K`. Nếu dùng bộ đọc này, tính năng cốt lõi "phát hiện dòng giảm 0đ" sẽ báo là ô trống thay vì 0.
- **Luồng làm hỏng ký tự UTF-8 nằm vắt qua ranh giới chunk** — nguyên nhân ở `lib/utils/parse-sax.js:21`, mỗi chunk được giải mã riêng lẻ, không dùng `StringDecoder`. File mẫu dính 1 ô. Đáng lo vì cột `Kiểu ctkm` cũng là tiếng Việt: nếu "Giảm giá theo số tiền" bị hỏng thì sinh ra cảnh báo sai.

Cách xử lý: **lấy bộ đọc luồng làm gốc** (số liệu đúng), chỉ khi phát hiện ký tự `U+FFFD` mới đọc thêm buffered để **thay riêng những chuỗi hỏng**. Số liệu không bao giờ lấy từ buffered.

Ngoài ra bộ đọc luồng **sập hẳn** với file do chính `exceljs` ghi ra (`workbook-reader.js:303` truy cập `this.model` chưa khởi tạo, vì `xl/workbook.xml` nằm cuối zip thay vì đầu). Đã thêm đường lui sang buffered cho trường hợp này — cần thiết vì phần mềm nội bộ rất có thể xuất file theo kiểu đó.

**4. Không copy `promotion.t8.xlsx` vào `test/fixtures/`**

Đặc tả đề nghị copy file mẫu vào thư mục fixture, nhưng đây là dữ liệu kinh doanh thật và `.gitignore` đang loại trừ `*.xlsx`. Thay bằng: test dựng file `.xlsx` trong bộ nhớ bằng `exceljs` cho các ca biên, còn test đối chiếu file thật đọc từ thư mục gốc và **tự bỏ qua** nếu không có file.

### Số đo

| Hạng mục | Kết quả |
|---|---|
| Đọc trọn file thật (kể cả bước vá chữ) | ~1.100–1.300 ms — đạt ngưỡng dưới 2 giây |
| Riêng bộ đọc luồng | ~100 ms |
| Bước vá chữ | ~1.000 ms — chỉ chạy khi phát hiện chữ hỏng |

Nếu sau này thấy bước vá chữ không đáng giá, bỏ nó đi thì thời gian đọc về ~100 ms, đổi lại chấp nhận nguy cơ hỏng chữ tiếng Việt lẻ tẻ.

### File đã tạo

```
src/lib/excel/types.ts                cell-value.ts       number-parser.ts
                date-parser.ts        column-mapper.ts    excel-reader.ts
                text-repair.ts        row-normalizer.ts   program-grouper.ts
                promotion-workbook.ts   # đầu mối duy nhất: bytes -> WorkbookReadResult
```

Mọi file đều dưới 200 dòng (cao nhất là `excel-reader.ts` 153 dòng).

## Bước kế tiếp

Giai đoạn 04 nhận `WorkbookReadResult` làm đầu vào cho bộ máy luật. Đầu mối gọi: `readPromotionWorkbook(bytes, fileName)` trong `src/lib/excel/promotion-workbook.ts`.
