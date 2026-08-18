---
title: Refactor giao diện và dựng hệ thiết kế
status: done
created: 2026-08-18
mode: normal
scope: ui
blockedBy: []
blocks: []
---

# Refactor giao diện và dựng hệ thiết kế

Công cụ đã chạy đúng và đủ chức năng qua 8 giai đoạn, nhưng giao diện vẫn là bản dựng thô: bảng màu toàn xám, thanh điều hướng trơ, khung nội dung hẹp hơn dữ liệu cần hiển thị. Đợt này làm cho nó trông đúng như một công cụ nội bộ hoàn chỉnh.

## Bối cảnh

- Kế hoạch gốc: [`plans/260817-1233-promotion-import-checking-tool/`](../260817-1233-promotion-import-checking-tool/plan.md) — 8 giai đoạn, đã xong phần chức năng
- Không đổi hành vi nghiệp vụ. Đây là đợt **chỉ đụng giao diện**: không sửa luật, không sửa truy vấn, không đổi lược đồ

## Đã tìm thấy trước khi lập kế hoạch

| Phát hiện | Trạng thái |
|---|---|
| Toàn bộ trang render bằng Times New Roman — biến font đặt trên `<body>` nhưng `font-sans` áp cho `<html>` | ✅ Đã sửa 2026-08-18 (`f603d61`) |
| Bảng màu 100% xám, không có màu thương hiệu | Giai đoạn 01 |
| Thanh điều hướng 5 link chữ trần, không có trạng thái trang đang mở | Giai đoạn 02 |
| `max-w-4xl` (896px) quá hẹp cho bảng 4.000 dòng và bảng đối soát 3 cột | Giai đoạn 02 |
| CSS `.dark` khai đầy đủ nhưng không có gì bật nó | Giai đoạn 01 |
| `mx-auto flex max-w-4xl flex-col gap-6 p-8` chép lại ở 7 trang | Giai đoạn 02 |

## Điều kiện đã chốt

| Hạng mục | Chốt |
|---|---|
| Bố cục | Sidebar trái cố định + vùng nội dung rộng |
| Màu thương hiệu | Xanh dương đậm — không đụng hệ đỏ/cam/vàng/lục của mức cảnh báo |
| Phạm vi | Trọn 5 màn + hệ thiết kế, làm theo giai đoạn, mỗi giai đoạn commit riêng |
| Dark mode | Có, bật bằng nút trong sidebar |

## Nguyên tắc xuyên suốt

1. **Không đụng logic nghiệp vụ.** 495 test phải xanh nguyên si sau mỗi giai đoạn
2. **Hệ màu mức cảnh báo giữ nguyên ngữ nghĩa** — đỏ/cam/vàng/lục đã đúng, chỉ tinh chỉnh sắc độ cho hợp dark mode
3. **Màu không bao giờ là tín hiệu duy nhất** — giữ nguyên chấm tròn và nhãn chữ đi kèm badge
4. Render phía máy chủ như cũ; chỉ phần chuyển dark mode là client
5. Mỗi file mã nguồn dưới 200 dòng

## Các giai đoạn

| # | Giai đoạn | Phụ thuộc | Trạng thái |
|---|---|---|---|
| 01 | [Hệ thiết kế và dark mode](phase-01-he-thiet-ke-va-dark-mode.md) | — | ✅ Xong 2026-08-18 |
| 02 | [Khung ứng dụng và sidebar](phase-02-khung-ung-dung-va-sidebar.md) | 01 | ✅ Xong 2026-08-18 |
| 03 | [Luồng chính: kiểm tra file và kết quả](phase-03-luong-chinh-kiem-tra-va-ket-qua.md) | 02 | ✅ Xong 2026-08-18 |
| 04 | [Các màn còn lại](phase-04-cac-man-con-lai.md) | 02 | ✅ Xong 2026-08-18 |

Giai đoạn 03 và 04 độc lập với nhau, làm song song được. Thực tế làm tuần tự, mỗi giai đoạn một commit riêng.

## Sai lệch giữa kế hoạch và mã nguồn thật

Ba chỗ kế hoạch mô tả không khớp với mã nguồn khi bắt tay vào làm. Ghi lại để lần sau đọc kế hoạch không bị dẫn sai.

| Kế hoạch viết | Thực tế trong mã | Đã xử lý |
|---|---|---|
| "Ô thả file chưa có trạng thái đang kéo qua" | `upload-panel.tsx` đã có state `dragging` từ trước, nhưng tô bằng `border-primary` — mà `--primary` hồi đó là xám gần đen nên nhìn không ra. Ngoài ra `onDragLeave` kích hoạt cả khi con trỏ đi qua phần tử con nên highlight bị nháy | Giữ state cũ, đổi sang đếm số lần vào/ra, và thêm trạng thái đang xử lý |
| Màn cấu hình có "**một** thẻ `<form>` bọc cả 11 thiết lập và 37 luật" | Có **hai** thẻ `<form>`: một của `AppSettingForm`, một của `RuleConfigTable`, hai nút Lưu riêng | Giữ nguyên đúng hai biểu mẫu. Điều cần bảo toàn là 37 luật nằm chung **một** biểu mẫu — đã kiểm chứng bằng DOM |
| Giai đoạn 03 dặn không đụng `finding-filters.tsx` | Viên lọc đang chọn dùng `bg-foreground` (đen tuyền), sót lại từ bảng màu xám | Chỉ đổi màu, không đụng href, tên tham số hay thẻ `<form>`. Đã bấm thử lại toàn bộ bộ lọc sau khi sửa |

## Đã kiểm chứng bằng chạy thật

- Tương phản WCAG AA: đo bằng script chuyển `oklch()` sang sRGB rồi tính tỷ lệ tương phản, phủ toàn bộ token và cả bốn màu mức cảnh báo ở hai chế độ — đạt hết
- Ba trạng thái chủ đề: đổi chủ đề hệ điều hành khi đang ở chế độ "theo hệ thống" thì giao diện đổi theo, không cần tải lại; ép sáng/tối thì hệ điều hành không ghi đè được nữa
- `?muc=critical` trên màn kết quả trả đúng **279** phát hiện của `2608GST0K`, chương trình này vẫn đứng đầu bảng
- Xuất Excel trả về workbook thật (200, 359 KB)
- Màn cấu hình: nhập sai vẫn báo "Phải là một con số." bằng tiếng Việt; lưu thật rồi tải lại thấy giá trị mới; đã trả lại giá trị ban đầu
- Biểu mẫu luật: tắt E1 → "Đã lưu 1 luật." → tải lại vẫn tắt → bật lại như cũ
- Đối soát chạy thật, tiến trình đi qua đủ ba giai đoạn rồi ra màn kết quả
- Thứ tự `Tab`: liên kết "Nhảy tới nội dung" đứng trước, rồi mới tới 5 mục sidebar, mỗi mục đều thấy rõ viền focus
- Sidebar cố định ở 1920px và 1366px, thu về ngăn kéo ở 1023px trở xuống; thân trang không bao giờ cuộn ngang

## Việc phát sinh, đã xử lý

- **Test đọc file Excel thật chập chờn — đã sửa.** `excel-reader.test.ts` và `promotion-workbook.test.ts` có lúc vượt `testTimeout` mặc định 5.000 ms khi chạy song song. Lỗi **có sẵn từ trước đợt này** — kiểm chứng bằng cách stash toàn bộ thay đổi rồi chạy lại trên cây mã sạch, vẫn rớt y hệt.
  - Gốc rễ: mỗi test đọc lại và phân tích lại cùng một workbook 3.931 dòng. Đo được `readWorkbook` ~1,7 s, `readBuffered` ~1,25 s, `readStreaming` ~0,12 s trên máy rảnh; tám lượt phân tích chia cho tám test nên khi máy bận là có lượt vượt ngưỡng
  - Cách sửa: phân tích một lần trong `beforeAll` rồi dùng chung, **không** nâng `testTimeout` chung. Phần nặng chuyển vào hook có ngân sách riêng 60 s, từng test vẫn nằm trong ngưỡng mặc định
  - Kết quả: tám lượt phân tích còn ba, `tests` giảm từ ~40 s xuống ~22 s, năm lượt chạy liên tiếp bằng timeout mặc định đều 495/495 xanh

## Định nghĩa hoàn thành

- Mọi màn dùng chung một khung: sidebar, tiêu đề trang, vùng nội dung — không trang nào tự dựng khung riêng
- Bảng kết quả và bảng đối soát dùng hết chiều ngang màn hình rộng, không còn bị ép trong 896px
- Bật/tắt dark mode chạy được ở mọi màn, không nháy màu lúc tải trang
- Tương phản chữ đạt WCAG AA ở cả hai chế độ
- Đi hết 5 màn bằng bàn phím, luôn thấy rõ ô đang được chọn
- 495 test vẫn xanh; `typecheck`, `lint`, `build` sạch
