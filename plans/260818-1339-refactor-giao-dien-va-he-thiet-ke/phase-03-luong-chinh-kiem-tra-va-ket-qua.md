# Giai đoạn 03 — Luồng chính: kiểm tra file và kết quả

## Liên kết bối cảnh

- [Tổng quan kế hoạch](plan.md) · [Giai đoạn 02](phase-02-khung-ung-dung-va-sidebar.md)
- File đụng tới: `src/app/page.tsx`, `src/app/ket-qua/[runId]/page.tsx`, `src/components/check/*`

## Tổng quan

- **Ưu tiên:** Cao — đây là hai màn người dùng nhìn nhiều nhất
- **Trạng thái:** ✅ Xong 2026-08-18
- **Phụ thuộc:** Giai đoạn 02 (khung trang)
- Làm màn tải file và màn kết quả cho ra dáng, tận dụng bề rộng vừa mở ra.

## Nhận định quan trọng

- **Màn kết quả là nơi công cụ trả lời câu hỏi duy nhất của nó** — "file này import được chưa". `summary-cards.tsx` đã đặt câu trả lời đó lên trên cùng và to nhất; đấy là quyết định đúng, giữ nguyên tinh thần, chỉ nâng cách thể hiện.
- **Bảng phát hiện là thứ chiếm nhiều diện tích nhất.** Với 279 dòng cùng một lỗi, việc quan trọng không phải xem từng dòng mà là **nhìn ra chúng cùng một cụm**. Gom theo mã luật hoặc theo chương trình cho thấy điều đó nhanh hơn một danh sách phẳng.
- **Trang chủ đang trống một khoảng rất lớn dưới ô thả file.** Chỗ đó nên là những lần kiểm gần đây — người dùng vào lại thường là để mở lại kết quả cũ chứ không phải luôn luôn nạp file mới.
- **Ô thả file chưa có trạng thái "đang kéo qua".** Kéo file vào mà giao diện không phản ứng thì người dùng không biết thả được hay chưa.
- **Không đụng truy vấn.** Lọc, sắp, phân trang đang chạy phía máy chủ và đúng rồi; giai đoạn này chỉ đổi cách bày ra.

## Yêu cầu

**Chức năng**
- Ô thả file phản ứng rõ khi kéo file qua, và khi đang xử lý
- Trang chủ hiện vài lần kiểm gần nhất, bấm vào mở lại được
- Màn kết quả: câu trả lời "được / chưa được" nổi bật, ba con số mức cảnh báo đọc được từ xa
- Bảng phát hiện dùng hết bề rộng, cột thông báo và gợi ý sửa không bị bóp
- Bảng chương trình phân biệt rõ chương trình sạch với chương trình có lỗi

**Phi chức năng**
- Không thêm truy vấn nào vào đường đi hiện tại ngoài phần "lần kiểm gần nhất" ở trang chủ
- Bảng cuộn ngang trong khung riêng; thân trang không cuộn ngang
- Mỗi file dưới 200 dòng

## Kiến trúc

```
src/app/page.tsx                              # sửa: PageShell + khối lần kiểm gần nhất
src/app/ket-qua/[runId]/page.tsx              # sửa: PageShell, bố cục lại
src/components/check/upload-panel.tsx         # sửa: trạng thái kéo qua, đang xử lý
src/components/check/summary-cards.tsx        # sửa: nâng cách thể hiện phần kết luận
src/components/check/finding-table.tsx        # sửa: mật độ, chiều rộng cột
src/components/check/program-table.tsx        # sửa: phân biệt chương trình sạch
src/components/check/recent-runs.tsx          # tạo: khối lần kiểm gần nhất
```

Khối "lần kiểm gần nhất" đọc qua `check-run-history.ts` đã có sẵn — không viết truy vấn mới.

## Các bước thực hiện

1. Chuyển hai trang sang `PageShell`, đặt bề rộng: trang chủ hẹp, màn kết quả rộng hết cỡ
2. `recent-runs.tsx` — Server Component, dùng lại hàm đọc lịch sử đã có, giới hạn 5 dòng
3. `upload-panel.tsx` — thêm trạng thái kéo qua và đang xử lý; giữ nguyên phần kiểm dung lượng và kiểu file
4. `summary-cards.tsx` — nâng phần kết luận, giữ nguyên bốn nhánh và nguyên văn thông báo
5. `finding-table.tsx` — đặt lại chiều rộng cột cho khung rộng, tăng mật độ dòng, giữ nguyên nội dung
6. `program-table.tsx` — làm chương trình sạch nhạt đi để chương trình có lỗi nổi lên
7. Nạp `promotion.t8.xlsx` chạy thật, chụp lại màn kết quả ở cả hai chế độ màu
8. Kiểm lại đúng **279 dòng giảm 0đ** của `2608GST0K` vẫn hiện đủ và vẫn đứng đầu bảng

## Danh sách việc

- [x] Hai trang dùng `PageShell`
- [x] Khối lần kiểm gần nhất ở trang chủ
- [x] Ô thả file có trạng thái kéo qua và đang xử lý
- [x] Nâng phần kết luận ở màn kết quả
- [x] Bảng phát hiện dùng hết bề rộng
- [x] Bảng chương trình phân biệt chương trình sạch
- [x] Chạy thật với file mẫu — dùng lần chạy `promotion.t8.xlsx` đã có sẵn trong CSDL thay vì nạp lại
  file mới; kiểm lại đủ 3.931 dòng / 156 chương trình, `?muc=critical` ra đúng 279, xuất Excel trả về
  workbook thật. Chụp đối chiếu hai chế độ màu

## Tiêu chí hoàn thành

- Nạp `promotion.t8.xlsx` → vẫn đúng 279 dòng `critical` của `2608GST0K`, chương trình này vẫn đứng đầu bảng
- Ở màn 1920px, cột thông báo đọc thẳng một dòng cho phần lớn phát hiện
- Trang chủ không còn khoảng trống lớn dưới ô thả file
- Kéo file qua ô thả: giao diện phản ứng thấy rõ
- Xuất Excel từ màn kết quả vẫn chạy
- 495 test xanh; `typecheck`, `lint`, `build` sạch

## Đánh giá rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Sửa `summary-cards.tsx` làm lệch nội dung kết luận | Chỉ đụng phần hiển thị; bốn nhánh và nguyên văn thông báo giữ nguyên từng chữ |
| Khối lần kiểm gần nhất thêm một truy vấn vào trang chủ | Dùng lại hàm đọc lịch sử đã có, giới hạn 5 dòng, đã có chỉ mục trên `createdAt` |
| Đổi bảng làm hỏng bộ lọc trên URL | Bộ lọc nằm ở `finding-filters.tsx` và `finding-filter.ts`, không đụng tới; kiểm lại bằng cách bấm lọc sau khi sửa |
| Tăng mật độ dòng làm khó bấm trên màn cảm ứng | Công cụ nội bộ dùng chuột và bàn phím; vẫn giữ vùng bấm tối thiểu cho các liên kết trong bảng |

## Cân nhắc bảo mật

Khối lần kiểm gần nhất chỉ hiện tên file và số đếm — đúng những gì màn lịch sử đã hiện. Không phơi thêm dữ liệu nào.

## Bước kế tiếp

Giai đoạn 04 làm bốn màn còn lại; hai giai đoạn độc lập nên chạy song song được.
