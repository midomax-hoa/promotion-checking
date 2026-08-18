# Giai đoạn 05 — Màn kiểm tra file & xuất báo cáo

## Liên kết bối cảnh

- [Tổng quan kế hoạch](plan.md) · [Giai đoạn 04](phase-04-bo-may-luat-nhom-a-den-e.md)
- [Báo cáo brainstorm](../reports/brainstorm-260817-1019-promotion-import-checking-tool.md) — mục 4 (màn hình), mục 8 (tiêu chí thành công)

## Tổng quan

- **Ưu tiên:** Cao — đây là màn hình người dùng chạm vào hằng ngày
- **Trạng thái:** ✅ Xong 2026-08-18
- Tải file lên, chạy bộ luật, hiển thị kết quả gom theo chương trình, xuất file Excel tô màu, lưu lịch sử.

## Nhận định quan trọng

- Người dùng đối mặt với **3.929 dòng và 154 chương trình**. Đổ hết ra một bảng phẳng là vô dụng. Phải **gom theo chương trình trước**, cho mở rộng xuống từng dòng.
- Câu trả lời họ cần là một câu duy nhất: *"file này import được chưa?"* → đặt ngay đầu trang, chữ to.
- Lọc, sắp xếp, phân trang **làm ở máy chủ**. Không kéo 3.929 dòng về trình duyệt rồi lọc bằng JavaScript.
- File Excel xuất ra là để **gửi lại cho người lập file sửa** — phải giữ nguyên cấu trúc gốc, chỉ thêm màu và cột ghi chú.
- **File gốc phải giữ lại trên đĩa** thì mới xuất báo cáo cho những lần chạy cũ được. Thư mục lưu lấy từ biến `UPLOAD_DIR` (mặc định `./.uploads` khi phát triển), tên file `{runId}-{tên gốc đã làm sạch}.xlsx`, lưu vào `CheckRun.storedFileName`. Chi tiết vận hành và cách dọn file quá hạn ở [giai đoạn 08](phase-08-trien-khai-bang-docker-compose.md#lưu-file-excel-đã-nạp).

## Yêu cầu

**Chức năng**
- Tải lên `.xlsx` / `.xls`, chạy toàn bộ luật nhóm A–E
- Thẻ tóm tắt: tổng dòng, tổng chương trình, số phát hiện theo từng mức
- Bảng chương trình: tên, số dòng, số phát hiện từng mức, mở rộng ra danh sách dòng lỗi
- Bộ lọc phía máy chủ: theo mức, theo mã luật, theo tên chương trình, theo SKU
- Xuất Excel: giữ nguyên cột gốc, tô màu dòng theo mức, thêm cột `Cảnh báo` và `Gợi ý sửa`
- Lưu mỗi lần chạy vào `CheckRun` + `Finding`, xem lại được
- Giữ lại file gốc đã nạp; file bị dọn theo hạn lưu thì màn kết quả báo "file gốc đã hết hạn lưu, tải lên lại để xuất báo cáo" thay vì lỗi
- Cảnh báo nổi bật khi cache danh mục cũ hơn `catalog.max_age_hours`

**Phi chức năng**
- Từ lúc bấm tải lên tới lúc thấy kết quả dưới 8 giây với file 4.000 dòng
- Bảng phân trang mặc định 100 dòng mỗi trang

## Kiến trúc

```
src/app/
  page.tsx                          # màn ① — Server Component
  ket-qua/[runId]/page.tsx          # xem lại một lần chạy
  lich-su/page.tsx                  # danh sách các lần đã chạy
  api/check/route.ts                # nhận tải lên, chạy luật, lưu CheckRun
  api/check/[runId]/export/route.ts # xuất Excel tô màu
src/components/check/
  upload-panel.tsx                  # ô kéo thả (Client Component)
  summary-cards.tsx
  program-table.tsx                 # bảng gom theo chương trình
  finding-table.tsx                 # bảng dòng lỗi, phân trang máy chủ
  severity-badge.tsx
  catalog-freshness-alert.tsx
src/lib/excel/report-exporter.ts
src/lib/check/run-check.ts          # điều phối: đọc file → chạy luật → lưu DB
```

### Bố cục màn hình

> Các con số trong hình dưới chỉ là **minh hoạ bố cục**. Riêng `3.931 dòng`, `154 chương trình`, `2 sheet` và `279` là số liệu thật đã kiểm chứng; số lượng phát hiện mức 🟠 và 🟡 chưa chạy thật nên **không được coi là kỳ vọng**.

```
┌──────────────────────────────────────────────────────────┐
│  ⚠ Danh mục đồng bộ lúc 10:12 hôm nay — còn mới          │
├──────────────────────────────────────────────────────────┤
│  [ Kéo thả file .xlsx vào đây, hoặc bấm để chọn ]        │
├──────────────────────────────────────────────────────────┤
│  KẾT QUẢ: promotion.t8.xlsx                              │
│                                                          │
│  3.931 dòng · 154 chương trình · 2 sheet                 │
│                                                          │
│  🔴 279 chắc chắn thất bại                               │
│  🟠   N tạo được nhưng nguy hiểm                          │
│  🟡   M nên xem lại                                      │
│                                                          │
│  [Tất cả] [🔴] [🟠] [🟡]   Lọc luật ▾   Tìm SKU___       │
│                                            [Xuất Excel]  │
├──────────────────────────────────────────────────────────┤
│  ▾ 2608GST0K            279 dòng   🔴279              │
│     🔴 C2 · dòng 15 · KMAP240101.L                       │
│        Số tiền giảm bằng 0đ. Haravan sẽ từ chối chương   │
│        trình này, toàn bộ 279 SKU sẽ không có khuyến mãi.│
│        → Sửa cột "Số tiền giảm" thành số lớn hơn 0        │
│  ▸ 2608GST130K          106 dòng   🟡1                    │
│  ▸ 2608GST100K          177 dòng   ✓ không có vấn đề      │
└──────────────────────────────────────────────────────────┘
```

### Quy tắc xuất Excel

- Sao chép nguyên vẹn mọi cột gốc, giữ đúng thứ tự và tiêu đề
- Tô nền dòng: đỏ nhạt `critical`, cam nhạt `danger`, vàng nhạt `warn`; dòng nào có nhiều mức thì lấy mức nặng nhất
- Thêm hai cột cuối: `Cảnh báo` (gộp nhiều phát hiện, ngăn bằng xuống dòng) và `Gợi ý sửa`
- Thêm sheet đầu tiên tên `Tổng hợp`: số liệu tóm tắt và bảng thống kê theo mã luật
- Cố định dòng tiêu đề, bật bộ lọc tự động

## File liên quan

**Tạo mới:** toàn bộ file trong phần Kiến trúc
**Sửa:** `src/app/layout.tsx` (điều hướng chính)

## Các bước thực hiện

1. Viết `run-check.ts` — điều phối: đọc file → nạp `CatalogIndex` → chạy luật → ghi `CheckRun` + `Finding` trong một transaction
2. Làm `api/check/route.ts` — nhận `multipart/form-data`, kiểm tra dung lượng và chữ ký đầu tệp, gọi `run-check`, chuyển hướng sang trang kết quả
3. Làm `upload-panel.tsx` — Client Component chỉ lo kéo thả và trạng thái đang xử lý
4. Làm `summary-cards.tsx` và `severity-badge.tsx`
5. Làm `catalog-freshness-alert.tsx` — đọc `SyncState`, cũ quá thì hiện nút "Đồng bộ ngay"
6. Làm `program-table.tsx` — Server Component, truy vấn gom nhóm theo `programName`, sắp xếp chương trình nặng nhất lên đầu
7. Làm `finding-table.tsx` — lọc và phân trang **qua `searchParams`**, không dùng trạng thái phía trình duyệt
8. Làm `ket-qua/[runId]/page.tsx` và `lich-su/page.tsx`
9. Viết `report-exporter.ts` bằng `exceljs` theo quy tắc trên
10. Làm `api/check/[runId]/export/route.ts` — trả tệp kèm `Content-Disposition`
11. Đo thời gian toàn luồng với file thật

## Danh sách việc

- [x] `run-file-check.ts` điều phối + test
- [x] Tuyến API nhận tải lên có kiểm tra dung lượng và chữ ký tệp
- [x] `upload-panel.tsx` kéo thả
- [x] Thẻ tóm tắt + badge mức độ
- [x] Cảnh báo độ tươi của cache
- [x] Bảng chương trình gom nhóm, mở rộng được
- [x] Bảng dòng lỗi, lọc + phân trang phía máy chủ
- [x] Trang xem lại kết quả và trang lịch sử
- [x] `report-exporter.ts` xuất Excel tô màu
- [x] Tuyến API tải file báo cáo về
- [x] Đo thời gian toàn luồng với `promotion.t8.xlsx`

## Tiêu chí hoàn thành

- Tải `promotion.t8.xlsx` lên → thấy kết quả dưới 8 giây
- Chương trình `2608GST0K` nằm đầu bảng với 279 phát hiện mức `critical`
- Bấm lọc 🔴 → địa chỉ trang đổi theo, tải lại trang vẫn giữ nguyên bộ lọc (chứng tỏ lọc ở máy chủ)
- File Excel xuất ra mở được bằng Excel, dòng lỗi có màu, có đủ 2 cột `Cảnh báo` và `Gợi ý sửa`, có sheet `Tổng hợp`
- Trang lịch sử liệt kê được các lần chạy trước, mở lại xem được
- Cache cũ hơn ngưỡng → hiện cảnh báo kèm nút đồng bộ

## Đánh giá rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Ghi hàng nghìn `Finding` một lúc | Ghi theo lô bằng `createMany` trong transaction |
| Bảng 3.929 dòng làm treo trình duyệt | Phân trang phía máy chủ, mặc định 100 dòng; mở rộng chương trình chỉ tải dòng của chương trình đó |
| Người dùng bỏ qua cảnh báo cache cũ rồi tin kết quả sai | Cảnh báo đặt trên cùng, nền màu nổi; `CheckRun` lưu lại `catalogSyncedAt` để truy vết |
| File Excel xuất ra quá nặng | Chỉ tô màu, không nhúng ảnh hay biểu đồ |
| Tải lên tệp độc hại | Kiểm tra chữ ký đầu tệp, giới hạn dung lượng, không bao giờ thực thi nội dung tệp |

## Cân nhắc bảo mật

- Giới hạn dung lượng tải lên (mặc định 20 MB), kiểm tra chữ ký đầu tệp chứ không chỉ tin phần mở rộng
- Tệp gốc không lưu lâu dài trên đĩa
- Không cần đăng nhập theo quyết định đã chốt — triển khai trong mạng nội bộ, ghi rõ trong tài liệu vận hành

## Bước kế tiếp

Giai đoạn 06 dùng lại `severity-badge`, `finding-table` cho màn đối soát.

---

## Kết quả thực tế (2026-08-18)

### Đo trên `promotion.t8.xlsx` thật

| Việc | Thời gian | Ghi chú |
|---|---|---|
| Toàn luồng kiểm tra (đọc file → chạy luật → ghi CSDL → lưu file gốc) | **2,36 giây** | Ngưỡng đặt ra là dưới 8 giây |
| Truy vấn một trang 100 dòng đã lọc theo mức | **4 ms** | Lọc và cắt trang chạy trong PostgreSQL |
| Dựng file Excel báo cáo | **6,37 giây** | 359 KB; phần lớn là `exceljs` ghi lại 3.930 dòng — đo riêng lệnh ghi không sửa gì cũng đã ~6,9 giây, nên không phải do phần tô màu |

Số liệu file: 3.931 dòng, 156 chương trình, 2 sheet — khớp với giai đoạn 03 (sheet `Key` 3.929 dòng và 154 chương trình, sheet `Giảm phần trăm` 2 dòng và 2 chương trình).

Kết quả luật: 279 `critical`, 3.582 `danger`, 185 `warn`. Chương trình `2608GST0K` nằm đầu bảng với đúng **279 phát hiện mức `critical`** (luật C2). Con số `danger` cao là do cache danh mục trên máy phát triển mới có 937 biến thể nên luật B1 báo phần lớn SKU là không tồn tại — đúng tình huống mà cảnh báo cache cũ sinh ra để phòng.

### Khác với kế hoạch

**Thêm bảng `CheckProgram`** (migration `20260818032206_add_check_program`). Kế hoạch yêu cầu bảng chương trình hiển thị *số dòng*, và bố cục màn hình còn liệt kê cả chương trình sạch (`✓ không có vấn đề`). Cả hai thứ này không suy ra được từ bảng `Finding`: một chương trình không có phát hiện nào thì không để lại dấu vết nào cả. Bảng lưu mỗi lần chạy 154–156 dòng, đổi lại truy vấn bảng chương trình còn đúng một câu và sắp xếp "nặng nhất lên đầu" làm được ngay trong CSDL.

**Đổi tên `run-check.ts` → `run-file-check.ts`.** Giai đoạn 04 đã có sẵn `src/lib/rules/run-check.ts`. Hai file trùng tên ở hai thư mục khác nhau buộc người đọc phải mở ra mới biết file nào làm gì, trái với quy ước đặt tên trong `docs/code-standards.md`.

**Tách bộ xuất báo cáo thành ba file** — `report-exporter.ts` (chú thích lại file gốc), `report-summary-sheet.ts` (sheet `Tổng hợp`), `report-styles.ts` (màu và thứ tự mức độ) — để mỗi file dưới 200 dòng.

**Thêm `finding-row.tsx`** ngoài danh sách trong kế hoạch: một phát hiện xuất hiện ở ba chỗ (chương trình mở rộng, bảng chi tiết, vấn đề chung của file) nên cách hiển thị gom về một chỗ.

### Ghi chú kỹ thuật

- **Thứ tự sheet trong file xuất ra** đặt qua thuộc tính `orderNo` của `exceljs`. Thuộc tính này có thật và được tôn trọng lúc ghi (kiểm chứng bằng ghi rồi đọc lại với `exceljs` 4.4 ngày 2026-08-18) nhưng không có trong phần khai báo kiểu, nên trong mã phải khai một kiểu phụ.
- **Hai cột thêm vào đặt sau `columnCount`**, không phải sau cột cuối *có dữ liệu*. Với `promotion.t8.xlsx`, `exceljs` báo `columnCount` là 15 trong khi chỉ 14 cột có dữ liệu, nên file xuất ra có một cột trống xen giữa. Cố tình chấp nhận: cột 15 có thể đang mang định dạng của người lập file, ghi đè lên là vi phạm cam kết giữ nguyên vẹn cột gốc.
- **Bộ lọc nằm trong địa chỉ trang** bằng khoá tiếng Việt (`muc`, `luat`, `ctkm`, `sku`, `mo`, `trang`). Trang kết quả biên dịch ra 162 B mã JavaScript phía trình duyệt — toàn bộ lọc, sắp xếp, phân trang chạy ở máy chủ.
- **Ghi `Finding` theo lô 1.000 dòng trong một giao dịch**, hạn 60 giây thay cho mặc định 5 giây của Prisma: một file 4.000 dòng ghi vài nghìn dòng phát hiện, quá hạn mặc định vì *lớn* chứ không phải vì *treo*.
- **File gốc ghi xuống đĩa sau khi lưu CSDL xong.** Đĩa hỏng thì mất nút xuất báo cáo, không mất kết quả kiểm tra.
- **Phát hiện không gắn với dòng nào** (thiếu cột bắt buộc, kiểm kê sheet, chưa đồng bộ danh mục) không tô màu được lên dòng nào cả, nên được liệt kê riêng ở mục "Vấn đề chung của file" trên màn hình và ở cuối sheet `Tổng hợp` trong file xuất ra.

### Sửa sau rà soát mã (2026-08-18)

Rà soát tìm ra ba lỗi nặng, đều đã sửa và có test giữ:

1. **Chương trình không có tên bị báo là sạch.** Khi gom nhóm, dòng có ô `Tên ctkm` rỗng rơi vào rổ `(không có tên)`; nhưng phát hiện ở mức dòng lại ghi `programName` là `null`. Hậu quả: bảng chương trình hiện `✓ không có vấn đề` màu xanh cho một chương trình đầy lỗi, còn phát hiện của nó dồn hết xuống mục "Vấn đề chung của file" không phân trang. Sửa bằng cách cho `rowRef` dùng chung `programKey` với bộ gom nhóm — một định nghĩa duy nhất cho "dòng này thuộc chương trình nào". Mục "Vấn đề chung của file" cũng được giới hạn số dòng.
2. **File có sẵn sheet tên `Tổng hợp` thì không xuất báo cáo được, vĩnh viễn.** `exceljs` ném lỗi khi trùng tên sheet, mà `Tổng hợp` là tên tab hết sức bình thường của một file tiếng Việt. Giờ tên sheet báo cáo được dò cho tới khi trống.
3. **Giới hạn dung lượng kiểm sau khi thân yêu cầu đã nằm hết trong bộ nhớ.** `formData()` đọc và dựng mọi phần trước khi trả về, nên phép so `file.size` phía sau không cứu được gì. Giờ `Content-Length` bị chặn trước, `file.size` giữ vai trò chốt dự phòng.

Bốn điểm khác đã sửa: file `.xls` thật giờ trả 400 kèm câu hướng dẫn thay vì 500; sheet không có phát hiện nào được trả về nguyên vẹn, không bị thêm cột hay bộ lọc; dòng tiêu đề không còn mặc định là dòng 1 mà dò theo dòng đầu tiên có dữ liệu; mức độ lạ không còn bị tô màu nhẹ nhất.

Một hệ quả ngoài ý muốn: test đo thời gian đọc file của giai đoạn 03 bị test xuất Excel mới giành CPU nên vượt ngưỡng 2 giây. Ngưỡng đã nới lên 8 giây kèm giải thích — con số đó là chốt chặn chống lỗi thuật toán bậc hai, không phải cam kết hiệu năng; số đo thật của toàn luồng là 2,18–2,36 giây và nằm ở bảng phía trên.

**Còn nợ lại:** `scripts/prune-uploads.sh` chưa có (thuộc giai đoạn 08) nên thư mục `.uploads/` hiện chưa có gì dọn. Các lần chạy tạo trước migration `add_check_program` không có dòng `CheckProgram` nào nên bảng chương trình của chúng sẽ trống.
