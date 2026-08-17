# Giai đoạn 04 — Bộ máy luật (nhóm A–E)

## Liên kết bối cảnh

- [Tổng quan kế hoạch](plan.md) · [Giai đoạn 02](phase-02-haravan-client-va-dong-bo-danh-muc.md) · [Giai đoạn 03](phase-03-doc-va-chuan-hoa-file-excel.md)
- [Báo cáo brainstorm](../reports/brainstorm-260817-1019-promotion-import-checking-tool.md) — mục 2 (Haravan nhận/từ chối cái gì), mục 5 (bộ luật)

## Tổng quan

- **Ưu tiên:** Cao nhất về mặt giá trị — đây là phần lõi của sản phẩm
- **Trạng thái:** Chưa làm
- Hiện thực 31 luật nhóm A–E, đọc cấu hình từ DB, cho ra danh sách phát hiện. Nhóm F để giai đoạn 06.

## Nhận định quan trọng

Mức cảnh báo **không phải cảm tính** — dựa trên hành vi Haravan đã kiểm chứng:

| Mức | Nghĩa | Căn cứ |
|---|---|---|
| `critical` 🔴 | Haravan trả 422, chương trình **không được tạo** | Đã bắn thử lên store dev |
| `danger` 🟠 | Haravan chấp nhận nhưng sai nghiệp vụ hoặc mất tiền | Đã bắn thử |
| `warn` 🟡 | Có thể là cố ý | |

Các phản hồi 422 đã ghi nhận: `value = 0`, `value` âm, phần trăm > 100, `ends_at < starts_at`, danh sách biến thể rỗng, biến thể trùng lặp, biến thể không tồn tại.
Các trường hợp Haravan **chấp nhận**: giảm lớn hơn giá bán, ngày bắt đầu ở quá khứ, tên chương trình trùng nhau.

**Luật B1 là luật quan trọng nhất.** Công cụ import tra SKU trước rồi lặng lẽ bỏ SKU không tra ra, nên chương trình vẫn báo tạo thành công dù thiếu SKU. Bắt được B1 trước khi import là xử lý trọn vẹn vấn đề gốc.

### Chốt chặn bắt buộc: cache rỗng

Nếu `CatalogIndex` **rỗng hoặc chưa từng đồng bộ**, toàn bộ nhóm B sẽ báo *mọi* SKU là "không tồn tại" — 3.929 cảnh báo sai, và người dùng sẽ mất niềm tin vào công cụ ngay lần dùng đầu tiên.

Quy tắc bắt buộc trong `engine.ts`:

```ts
if (ctx.catalog.syncedAt === null || ctx.catalog.bySku.size === 0) {
  // BỎ QUA toàn bộ nhóm B, đưa vào skippedRules
  // Phát một cảnh báo mức 'critical' mã 'SYS-CATALOG-EMPTY':
  //   "Chưa đồng bộ danh mục sản phẩm nên không kiểm tra được SKU
  //    có tồn tại hay không. Hãy đồng bộ rồi kiểm tra lại."
}
```

Tương tự với `haravanPromotions === null`: bỏ qua D8 và E3, ghi vào `skippedRules`, **không** im lặng bỏ qua.

Nguyên tắc chung: **thiếu dữ liệu đầu vào thì báo là thiếu, tuyệt đối không suy ra kết luận "không tìm thấy".**

## Yêu cầu

**Chức năng**
- 31 luật nhóm A–E, mỗi luật là một hàm thuần, nằm ở file riêng
- Đọc `enabled` / `severity` / `params` từ `RuleConfig`; luật tắt thì bỏ qua hoàn toàn
- Luật B1 kèm gợi ý SKU gần giống theo khoảng cách Levenshtein
- Kết quả trả về có `rowNumber`, `sheetName`, `programName`, `sku` để truy ngược về file

**Phi chức năng**
- Chạy hết 31 luật trên 3.929 dòng dưới 3 giây
- Mỗi file luật dưới 200 dòng
- Thêm luật mới chỉ cần tạo file và khai vào danh mục, không sửa bộ máy

## Kiến trúc

```
src/lib/rules/
  types.ts
  rule-catalog.ts          # đã tạo ở giai đoạn 01 — nguồn dữ liệu chung
  registry.ts              # gom mọi luật, đối chiếu với rule-catalog
  engine.ts                # chạy luật, lọc theo cấu hình, gom kết quả
  helpers/
    levenshtein.ts
    money.ts               # so sánh tiền có ngưỡng sai số
    date-range.ts          # kiểm tra giao nhau giữa hai khoảng thời gian
  group-a-file-structure/  # a1..a5
  group-b-catalog/         # b1..b6
  group-c-arithmetic/      # c1..c7
  group-d-program/         # d1..d10
  group-e-overlap/         # e1..e3
```

### Hợp đồng chính

```ts
export type Severity = 'critical' | 'danger' | 'warn'

export type RuleContext = {
  workbook: WorkbookReadResult
  catalog: CatalogIndex
  haravanPromotions: HaravanPromotion[] | null  // null = chưa nạp; D8/E3 tự bỏ qua
  now: Date
  params: Record<string, unknown>               // params của chính luật đang chạy
}

export type RuleFinding = {
  sheetName?: string
  rowNumber?: number
  programName?: string
  sku?: string
  message: string      // tiếng Việt, nêu rõ số liệu cụ thể
  suggestion?: string  // tiếng Việt, nêu cách sửa
}

export type Rule = {
  code: string
  groupCode: 'A' | 'B' | 'C' | 'D' | 'E'
  title: string
  run(ctx: RuleContext): RuleFinding[]
}

export async function runRules(ctx: Omit<RuleContext, 'params'>): Promise<{
  findings: (RuleFinding & { ruleCode: string; severity: Severity })[]
  counts: Record<Severity, number>
  skippedRules: string[]      // luật bị tắt hoặc thiếu dữ liệu đầu vào
}>
```

### Danh mục luật cần hiện thực

**Nhóm A — cấu trúc file**

| Mã | Luật | Mức |
|---|---|---|
| A1 | Thiếu cột bắt buộc (`Mã hiệu`, `Kiểu ctkm`, `Tên ctkm`) | critical |
| A2 | Liệt kê mọi sheet kèm số dòng đã đọc | warn |
| A3 | Ô ngày không phân tích được | danger |
| A4 | Ô SKU rỗng hoặc chỉ có khoảng trắng | warn |
| A5 | Dòng trống xen giữa vùng dữ liệu | warn |

**Nhóm B — đối chiếu danh mục**

| Mã | Luật | Mức |
|---|---|---|
| **B1** | **SKU không tồn tại trên Haravan** — kèm gợi ý SKU gần giống | danger |
| B2 | Sản phẩm chưa đăng bán (`publishedAt` rỗng) | warn |
| B3 | `Giá niêm yết` lệch giá thật trên Haravan | danger |
| B4 | `Mã hiệu` không bắt đầu bằng `Mã` | warn |
| B5 | SKU khớp **nhiều biến thể** trên Haravan — không xác định được gắn cái nào | danger |
| B6 | Sản phẩm bị đánh dấu **cấm khuyến mãi** (`not_allow_promotion = true`) | danger |

> **B6 cần kiểm chứng thêm:** trường `not_allow_promotion` chắc chắn tồn tại và đọc được, nhưng store dev không có sản phẩm nào bật cờ này nên chưa biết Haravan xử lý ra sao — từ chối tạo, hay tạo xong nhưng không áp dụng. Trước khi hiện thực B6 phải bật thử cờ trên **một** sản phẩm ở store dev, thử tạo khuyến mãi cho nó, rồi trả sản phẩm về trạng thái cũ. Nếu Haravan trả 422 thì nâng B6 lên `critical`.

**Nhóm C — số học**

| Mã | Luật | Mức |
|---|---|---|
| C1 | `Giá niêm yết − Số tiền giảm ≠ Giá sau giảm` | danger |
| C2 | `Số tiền giảm` bằng 0 hoặc âm | critical |
| C3 | Số tiền giảm ≥ giá niêm yết | danger |
| C4 | Giảm sâu quá ngưỡng (`maxDiscountPercent`, mặc định 70) | warn |
| C5 | Cột phần trăm ghi `50` thay vì `0.5` (giá trị > 1) | critical |
| C6 | `Kiểu ctkm` không xác định, hoặc điền lệch cột | critical |
| C7 | Giá sau giảm không tròn `roundingUnit` (mặc định 1.000đ) | warn |

**Nhóm D — theo chương trình**

| Mã | Luật | Mức | Mặc định |
|---|---|---|---|
| D1 | Tên chương trình không khớp giá trị giảm | warn | tắt |
| D2 | Tên chương trình ghi tháng khác với ngày trong dòng | warn | tắt |
| D3 | Cùng tên nhưng các dòng ghi ngày / mức giảm khác nhau | danger | bật |
| D4 | Ngày bắt đầu đã trôi qua | warn | bật |
| D5 | Ngày kết thúc đã qua | danger | bật |
| D6 | Ngày kết thúc trước ngày bắt đầu | critical | bật |
| D7 | Thời lượng bất thường (`maxDurationDays`, mặc định 90; hoặc 0 ngày) | warn | bật |
| D8 | Tên chương trình đã tồn tại trên Haravan | danger | bật |
| D9 | `Số dư` âm, hoặc bằng 0 mà không để trống | warn | bật |
| D10 | Trong cùng chương trình, các dòng ghi `Số dư` khác nhau | danger | bật |

**Nhóm E — chồng lấn**

| Mã | Luật | Mức |
|---|---|---|
| E1 | Một SKU nằm trong từ 2 chương trình có thời gian giao nhau | danger |
| E2 | SKU trùng lặp trong cùng một chương trình | critical |
| E3 | SKU đang thuộc chương trình khác đang chạy trên Haravan | warn |

### Quy ước viết thông báo

Mỗi thông báo phải nêu **số liệu cụ thể**, không nói chung chung.

- ❌ `"Dữ liệu có vẻ bất thường"`
- ✅ `"Số tiền giảm bằng 0đ. Haravan sẽ từ chối chương trình này, toàn bộ 279 SKU sẽ không có khuyến mãi."`
- ✅ `"SKU 'KMAP231728F.XXL' không có trên Haravan. Có phải ý là 'KMAP231728F.XL' không?"`

## File liên quan

**Tạo mới:** toàn bộ file trong phần Kiến trúc; mỗi luật kèm một file test
**Sửa:** `src/lib/rules/rule-catalog.ts` (bổ sung B5 và B6 → tổng 37 luật, tính cả nhóm F)

## Các bước thực hiện

1. Viết `types.ts` và các hàm trợ giúp (`levenshtein`, `money`, `date-range`)
2. Viết `engine.ts`: nạp `RuleConfig`, lọc luật đang bật, truyền `params` riêng, gộp kết quả, đếm theo mức
3. Hiện thực nhóm A (5 luật) + test
4. Hiện thực nhóm C (7 luật) + test — thuần số học, không cần dữ liệu ngoài, làm trước cho nhanh
5. Hiện thực nhóm B (5 luật) + test — dùng `CatalogIndex`
6. Hiện thực nhóm D (10 luật) + test — D8 cần `haravanPromotions`, thiếu thì bỏ qua và ghi vào `skippedRules`
7. Hiện thực nhóm E (3 luật) + test
8. Viết `registry.ts`, kiểm tra chéo với `rule-catalog.ts` — thiếu hoặc thừa mã luật thì **để test đỏ**
9. Chạy toàn bộ trên `promotion.t8.xlsx` thật, kiểm chứng kết quả
10. Đo thời gian chạy

## Danh sách việc

- [ ] `types.ts` + hàm trợ giúp + test
- [ ] `engine.ts` đọc cấu hình từ DB + test
- [ ] **Chốt chặn cache rỗng** — bỏ qua nhóm B, phát `SYS-CATALOG-EMPTY` + test
- [ ] Nhóm A: 5 luật + test
- [ ] Nhóm C: 7 luật + test
- [ ] Nhóm B: 5 luật + test (B1 có gợi ý SKU gần giống)
- [ ] Nhóm D: 10 luật + test
- [ ] Nhóm E: 3 luật + test
- [ ] `registry.ts` + test đối chiếu với `rule-catalog.ts`
- [ ] Bổ sung B5 vào `rule-catalog.ts` và seed
- [ ] Chạy thật trên file mẫu, kiểm chứng số liệu

## Tiêu chí hoàn thành

Chạy trên `promotion.t8.xlsx` thật phải cho ra:

- **C2 bắt đúng 279 dòng** của chương trình `2608GST0K`, thông báo nêu rõ Haravan sẽ từ chối
- **A2 liệt kê cả 2 sheet**, gồm sheet `Giảm phần trăm` chỉ có 2 dòng
- **D4 báo** ngày bắt đầu 01/08 đã trôi qua
- C1 không báo dòng nào (toán trong file đúng 100%)
- E1, E2 không báo dòng nào (file sạch, đã kiểm chứng khi khảo sát)
- Tắt một luật trong `RuleConfig` → luật đó biến mất khỏi kết quả, xuất hiện trong `skippedRules`
- Đổi `maxDiscountPercent` trong `params` → số lượng phát hiện của C4 thay đổi theo
- Chạy hết dưới 3 giây

## Đánh giá rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Levenshtein trên 3.929 × toàn bộ SKU quá chậm | Chỉ tính khi B1 kích hoạt; lọc sơ bộ theo độ dài và 3 ký tự đầu trước khi tính |
| Sai số dấu phẩy động khi so tiền | Mọi so sánh tiền đi qua `money.ts` với ngưỡng sai số 0,5đ |
| E1 so mọi cặp chương trình gây bùng nổ tổ hợp | Lập chỉ mục theo SKU trước, chỉ so trong nhóm cùng SKU |
| `rule-catalog.ts` và `registry.ts` lệch nhau | Test đối chiếu bắt buộc, lệch là đỏ |
| Nhầm lẫn giữa `discountPercent` dạng thập phân và dạng phần trăm | Ghi rõ trong `types.ts`: trong file luôn là **thập phân**; chỉ nhân 100 khi so với Haravan |

## Cân nhắc bảo mật

- Luật là hàm thuần, không gọi mạng, không đụng hệ thống tệp
- Thông báo không được lộ dữ liệu ngoài phạm vi file đang kiểm và cache danh mục

## Bước kế tiếp

Giai đoạn 05 hiển thị kết quả. Giai đoạn 06 bổ sung nhóm F theo đúng khuôn mẫu này.
