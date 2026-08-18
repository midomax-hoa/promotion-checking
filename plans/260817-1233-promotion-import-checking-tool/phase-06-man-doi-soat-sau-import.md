# Giai đoạn 06 — Màn đối soát sau import (nhóm F)

## Liên kết bối cảnh

- [Tổng quan kế hoạch](plan.md) · [Giai đoạn 02](phase-02-haravan-client-va-dong-bo-danh-muc.md) · [Giai đoạn 04](phase-04-bo-may-luat-nhom-a-den-e.md) · [Giai đoạn 05](phase-05-man-kiem-tra-file-va-xuat-bao-cao.md)
- [Báo cáo brainstorm](../reports/brainstorm-260817-1019-promotion-import-checking-tool.md) — mục 2 (trễ chỉ mục), mục 7 (rủi ro 2, 6, 7)

## Tổng quan

- **Ưu tiên:** Cao — đây là câu trả lời cuối cùng cho *"tôi import đúng hay sai"*
- **Trạng thái:** Xong 2026-08-18
- Kéo chương trình từ Haravan về, so từng dòng với file Excel gốc, chỉ ra chỗ lệch.

## Nhận định quan trọng

Ba đặc tính của Haravan quyết định thiết kế màn này, **đều đã kiểm chứng bằng gọi thật**:

1. **`GET /promotions.json` trả về cả chương trình đã tắt lẫn đã hết hạn.** Tài liệu ghi *"List enabling promotions"* là viết sai. Nhờ vậy nhóm F làm được đầy đủ.
2. **Trễ chỉ mục khoảng 5 giây.** Chương trình vừa tạo không xuất hiện ngay trong danh sách, nhưng `GET /promotions/{id}.json` thì tức thì. Đối soát ngay sau khi import sẽ báo oan hàng loạt ở luật F1.
3. **Haravan cho phép trùng tên chương trình.** Khớp theo tên có thể ra nhiều kết quả.

**Chốt thiết kế:** đối soát chạy **hai lượt cách nhau `reconcile.recheck_delay_ms`** (mặc định 8 giây). Chỉ báo lệch khi cả hai lượt đều cho cùng kết quả. Cách này an toàn với mọi độ trễ, không cần đo trước con số cụ thể trên máy chủ thật.

Cũng cần nhớ: `discount_type` thật là `product_amount` kèm `take_type`, còn cột `Phần trăm giảm` trong Excel là **thập phân** (`0.5`) trong khi Haravan lưu `50`. So sánh phải quy về cùng đơn vị.

## Yêu cầu

**Chức năng**
- Chọn một lần chạy đã lưu ở màn ① hoặc tải lại file Excel gốc
- Kéo chương trình từ Haravan, giới hạn theo khoảng ngày lấy từ file để không quét thừa
- Khớp theo tên chương trình; một tên ra nhiều kết quả thì **liệt kê hết, không tự chọn**
- Chạy 6 luật nhóm F
- Bảng ba cột: giá trị trong Excel · giá trị trên Haravan · chênh lệch
- Nút chạy lại thủ công

**Phi chức năng**
- Đối soát 154 chương trình xong dưới 60 giây (đã tính thời gian chờ giữa hai lượt)
- Chỉ dùng `GET`

## Kiến trúc

```
src/lib/haravan/promotion-fetcher.ts   # phân trang danh sách chương trình
src/lib/reconcile/
  promotion-matcher.ts                 # khớp chương trình Excel ↔ Haravan theo tên
  reconcile-engine.ts                  # chạy 2 lượt, giao kết quả
  group-f-reconcile/                   # f1..f6
src/app/doi-soat/page.tsx
src/app/doi-soat/[runId]/page.tsx
src/app/api/reconcile/route.ts
src/components/reconcile/
  diff-table.tsx
  match-status-badge.tsx
```

### Hợp đồng chính

```ts
export type MatchResult = {
  programName: string
  excelRows: PromotionRow[]
  haravanMatches: HaravanPromotion[]   // nhiều phần tử = trùng tên
  status: 'matched' | 'not-found' | 'ambiguous' | 'extra-on-haravan'
}

export type ReconcileOptions = {
  recheckDelayMs: number     // mặc định lấy từ AppSetting
  passes: 1 | 2              // mặc định 2
}

export async function reconcile(
  workbook: WorkbookReadResult,
  opts: ReconcileOptions
): Promise<{
  matches: MatchResult[]
  findings: (RuleFinding & { ruleCode: string; severity: Severity })[]
  passesAgreed: boolean      // false = hai lượt cho kết quả khác nhau, cần chạy lại
}>
```

### Cơ chế hai lượt

```
Lượt 1: kéo danh sách chương trình  →  tập A các tên "không tìm thấy"
   ↓ chờ recheck_delay_ms
Lượt 2: kéo lại danh sách           →  tập B các tên "không tìm thấy"

F1 chỉ báo với những tên nằm trong  A ∩ B
Tên chỉ có trong A: coi như do trễ chỉ mục, KHÔNG báo lỗi
Nếu A ≠ B: đặt passesAgreed = false, hiện gợi ý "vừa import xong, nên chạy lại sau ít phút"
```

### Danh mục luật nhóm F

| Mã | Luật | Mức |
|---|---|---|
| F1 | Chương trình có trong Excel nhưng không thấy trên Haravan | critical |
| F2 | Giá trị giảm trên Haravan lệch với Excel | critical |
| F3 | Ngày bắt đầu hoặc kết thúc lệch | critical |
| F4 | Chương trình đã tạo nhưng đang ở trạng thái tắt | warn |
| F5 | Số SKU đính kèm lệch — Excel N dòng, Haravan nhận M | critical |
| F6 | Haravan có chương trình mà Excel không có | warn |

Bổ sung: khi `status = 'ambiguous'` (trùng tên) thì F1–F5 **không kết luận**, chỉ liệt kê từng chương trình trùng tên kèm số liệu để người dùng tự đối chiếu.

### Quy tắc so sánh

| Trường Excel | Trường Haravan | Cách so |
|---|---|---|
| `discountAmount` | `value` khi `take_type = fixed_amount` | sai số 0,5đ |
| `discountPercent × 100` | `value` khi `take_type = percentage` | sai số 0,01 |
| `startAt` | `starts_at` | so tới phút, quy về cùng múi giờ |
| `endAt` | `ends_at` | như trên; `ends_at = null` là một dạng lệch |
| số dòng của chương trình | số phần tử `entitled_variant_ids` | so số nguyên |

**Lưu ý múi giờ:** Haravan trả mốc thời gian dạng UTC (`2019-12-31T17:00:00Z` chính là `2020-01-01 00:00` giờ Việt Nam). Phải quy đổi trước khi so, nếu không F3 sẽ báo oan toàn bộ.

## File liên quan

**Tạo mới:** toàn bộ file trong phần Kiến trúc
**Sửa:** `src/lib/rules/rule-catalog.ts` (nhóm F đã khai từ giai đoạn 01, kiểm tra lại mức độ)

## Các bước thực hiện

1. Viết `promotion-fetcher.ts` — phân trang `page`, `limit=50`; **kiểm chứng lại hành vi phân trang trên máy chủ thật vì store dev quá ít dữ liệu**
2. Viết `promotion-matcher.ts` — chuẩn hoá tên (cắt khoảng trắng, không phân biệt hoa thường), trả về đủ 4 trạng thái
3. Viết `reconcile-engine.ts` — chạy hai lượt, giao tập kết quả, đặt cờ `passesAgreed`
4. Hiện thực F1–F6 + test
5. Viết hàm so sánh mốc thời gian có xử lý múi giờ + test riêng cho ca `2019-12-31T17:00:00Z` ↔ `2020-01-01 00:00`
6. Làm `doi-soat/page.tsx` — chọn lần chạy trước hoặc tải file mới
7. Làm `diff-table.tsx` — ba cột, tô đậm ô lệch
8. Làm `api/reconcile/route.ts` — chạy nền, phát tiến trình
9. Kiểm thử đầu-cuối trên store dev: tự tạo vài chương trình, đối soát, rồi **xoá sạch**

## Danh sách việc

- [x] `promotion-fetcher.ts` phân trang + test
- [x] `promotion-matcher.ts` 4 trạng thái + test
- [x] `reconcile-engine.ts` hai lượt + test giả lập trễ chỉ mục
- [x] So sánh mốc thời gian có xử lý múi giờ + test
- [x] F1–F6 + test
- [x] Màn hình đối soát + bảng ba cột
- [x] Tuyến API chạy đối soát có tiến trình
- [x] Kiểm thử đầu-cuối trên store dev (chỉ đọc, không tạo chương trình nào)

## Tiêu chí hoàn thành

- Test giả lập: chương trình chỉ xuất hiện ở lượt 2 → **không** bị báo F1
- Hai lượt cho kết quả khác nhau → `passesAgreed = false`, giao diện gợi ý chạy lại
- Chương trình trùng tên → trạng thái `ambiguous`, liệt kê hết, không tự chọn cái nào
- So `2019-12-31T17:00:00Z` với `2020-01-01 00:00` giờ Việt Nam → **không** báo lệch
- Bảng ba cột hiện đúng chênh lệch giá trị, ngày, số SKU
- Toàn bộ giai đoạn không phát sinh lệnh ghi nào lên Haravan (đã rà lại mã nguồn)

## Đã làm khác kế hoạch, và vì sao

Bốn điểm dưới đây đến từ việc gọi thật lên store dev ngày 2026-08-18. Bằng chứng đầy đủ:
[báo cáo kiểm chứng](../reports/verification-260818-1046-haravan-promotions-api.md).

| Kế hoạch ghi | Thực tế | Đã xử lý |
|---|---|---|
| `GET /promotions.json` | Trả 404; đường dẫn đúng là `/com/promotions.json` | Sửa đường dẫn |
| Lọc theo khoảng ngày khi gọi | Máy chủ **bỏ qua mọi bộ lọc** (`?status=disabled` vẫn trả CTKM đang bật) | Kéo hết rồi lọc trong bộ nhớ, chỉ dùng để giảm nhiễu ở F6 |
| F5 đếm `entitled_variant_ids` | CTKM thật có mảng đó **rỗng**, thay vào đó `entitled_product_ids` có 18 sản phẩm | Quy đổi cả hai về số biến thể qua cache danh mục; không tra được thì bỏ qua F5 |
| — | Không có `promotions/count.json` (trả 422) | Không đối chiếu được tổng số; vòng phân trang học kích thước trang thật từ trang đầu |

Ba quyết định chốt thêm trong lúc làm:

1. **F5 so trên số mã hiệu khác nhau, không phải số dòng.** Một chương trình liệt kê trùng mã
   hiệu chỉ gửi lên Haravan một biến thể, đếm theo dòng sẽ tự chế ra chỗ thiếu.
2. **D8 và E3 được nối vào màn kiểm tra file.** Hai luật đó cần đúng danh sách CTKM mà giai đoạn
   này đã có. Gọi API hỏng thì vẫn kiểm tra bình thường, hai luật ghi là bỏ qua.
3. **Bỏ lượt 2 khi lượt 1 tìm thấy đủ.** Phần giao chắc chắn rỗng nên lượt 2 không đổi được kết
   luận nào, chỉ tốn thêm 8 giây chờ.

Ngoài ra thêm một cấu hình mới: `shop.timezone_offset_minutes` (mặc định 420). Độ lệch múi giờ
không được chôn cứng trong mã nguồn.

## Kết quả đo được

Chạy thật lên store dev ngày 2026-08-18, file thử 2 chương trình:

| Mục | Kết quả |
|---|---|
| Thời gian một lượt đối soát đủ hai lượt | 8,5 giây (trong đó 8 giây là khoảng chờ cố ý) |
| F1 với chương trình không tồn tại | Báo đúng |
| F3 với CTKM khớp thật (`2026-07-22T08:11:00Z` ↔ 15:11 giờ Việt Nam) | **Im lặng** — quy đổi múi giờ đúng |
| F2 với phần trăm (file ghi `0.1`, Haravan ghi `10`) | **Im lặng** — quy đổi đơn vị đúng |
| F5 với CTKM đính theo sản phẩm | Tra ra 232 biến thể từ `entitled_product_ids` |
| Lệnh ghi phát sinh lên Haravan | Không có |

Kiểm thử tự động: 475 test qua hết, trong đó 88 test mới cho lớp đối soát.

## Đánh giá rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Trễ chỉ mục gây báo oan hàng loạt ở F1 | Cơ chế hai lượt; chỉ báo phần giao của hai lượt |
| Khớp nhầm do trùng tên | Trạng thái `ambiguous`, không tự chọn; luật D8 cảnh báo trước ở màn ① |
| Chưa rõ phân trang của `promotions.json` | Bước 1 phải kiểm chứng thật trước khi tin; nếu `limit` bị ép thì bám theo giá trị thật |
| Lệch múi giờ làm F3 báo sai toàn bộ | Test riêng cho ca quy đổi; mọi so sánh đi qua một hàm dùng chung |
| Số lượng chương trình tích luỹ nhiều tháng làm quét chậm | Lọc theo khoảng ngày lấy từ file trước khi so |

## Cân nhắc bảo mật

- Chỉ dùng `GET`. Đã rà lại mã nguồn: `HaravanClient` chỉ phơi ra đúng một phương thức `get`,
  lớp đối soát chỉ gọi `client.get`, nên đây là ràng buộc về cấu trúc chứ không phải quy ước.
  Bước 9 của kế hoạch ban đầu (tạo vài CTKM thử rồi xoá) **đã bỏ**, vì nó mâu thuẫn với chính
  cam kết chỉ đọc của giai đoạn này. Kiểm thử đầu-cuối chạy trên CTKM sẵn có của store dev.
- Kết quả đối soát lưu cùng bảng `CheckRun` với `mode = "reconcile"`

## Bước kế tiếp

Giai đoạn 07 làm màn cấu hình để chỉnh ngưỡng của mọi luật, gồm cả `reconcile.recheck_delay_ms`.
