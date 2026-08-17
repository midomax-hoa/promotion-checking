# Giai đoạn 05 — Màn kiểm tra file & xuất báo cáo

## Liên kết bối cảnh

- [Tổng quan kế hoạch](plan.md) · [Giai đoạn 04](phase-04-bo-may-luat-nhom-a-den-e.md)
- [Báo cáo brainstorm](../reports/brainstorm-260817-1019-promotion-import-checking-tool.md) — mục 4 (màn hình), mục 8 (tiêu chí thành công)

## Tổng quan

- **Ưu tiên:** Cao — đây là màn hình người dùng chạm vào hằng ngày
- **Trạng thái:** Chưa làm
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

- [ ] `run-check.ts` điều phối + test
- [ ] Tuyến API nhận tải lên có kiểm tra dung lượng và chữ ký tệp
- [ ] `upload-panel.tsx` kéo thả
- [ ] Thẻ tóm tắt + badge mức độ
- [ ] Cảnh báo độ tươi của cache
- [ ] Bảng chương trình gom nhóm, mở rộng được
- [ ] Bảng dòng lỗi, lọc + phân trang phía máy chủ
- [ ] Trang xem lại kết quả và trang lịch sử
- [ ] `report-exporter.ts` xuất Excel tô màu
- [ ] Tuyến API tải file báo cáo về
- [ ] Đo thời gian toàn luồng với `promotion.t8.xlsx`

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
