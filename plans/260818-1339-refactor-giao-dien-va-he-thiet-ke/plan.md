---
title: Refactor giao diện và dựng hệ thiết kế
status: planned
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
| 01 | [Hệ thiết kế và dark mode](phase-01-he-thiet-ke-va-dark-mode.md) | — | ⬜ Chưa làm |
| 02 | [Khung ứng dụng và sidebar](phase-02-khung-ung-dung-va-sidebar.md) | 01 | ⬜ Chưa làm |
| 03 | [Luồng chính: kiểm tra file và kết quả](phase-03-luong-chinh-kiem-tra-va-ket-qua.md) | 02 | ⬜ Chưa làm |
| 04 | [Các màn còn lại](phase-04-cac-man-con-lai.md) | 02 | ⬜ Chưa làm |

Giai đoạn 03 và 04 độc lập với nhau, làm song song được.

## Định nghĩa hoàn thành

- Mọi màn dùng chung một khung: sidebar, tiêu đề trang, vùng nội dung — không trang nào tự dựng khung riêng
- Bảng kết quả và bảng đối soát dùng hết chiều ngang màn hình rộng, không còn bị ép trong 896px
- Bật/tắt dark mode chạy được ở mọi màn, không nháy màu lúc tải trang
- Tương phản chữ đạt WCAG AA ở cả hai chế độ
- Đi hết 5 màn bằng bàn phím, luôn thấy rõ ô đang được chọn
- 495 test vẫn xanh; `typecheck`, `lint`, `build` sạch
