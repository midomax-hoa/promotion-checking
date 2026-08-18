# Giai đoạn 02 — Khung ứng dụng và sidebar

## Liên kết bối cảnh

- [Tổng quan kế hoạch](plan.md) · [Giai đoạn 01](phase-01-he-thiet-ke-va-dark-mode.md)
- File đụng tới: `src/app/layout.tsx` và cả 7 file `page.tsx`

## Tổng quan

- **Ưu tiên:** Cao — giai đoạn 03 và 04 đều dựng trên khung này
- **Trạng thái:** Chưa làm
- **Phụ thuộc:** Giai đoạn 01 (token màu)
- Thay thanh điều hướng ngang bằng sidebar trái, và rút phần khung lặp lại ở 7 trang thành một thành phần dùng chung.

## Nhận định quan trọng

- **`mx-auto flex max-w-4xl flex-col gap-6 p-8` đang chép lại ở 7 file `page.tsx`.** Sửa bề rộng nghĩa là sửa 7 chỗ, và chắc chắn sẽ sót. Rút thành một thành phần khung trang là việc phải làm trước, không phải việc làm cho đẹp.
- **896px quá hẹp cho dữ liệu của công cụ này.** Bảng phát hiện có 7 cột (mức, luật, sheet, dòng, chương trình, mã hàng, thông báo + gợi ý sửa); bảng đối soát bày ba cột so sánh Excel ↔ Haravan. Ở 896px thì thông báo tiếng Việt bị ngắt dòng liên tục, đọc rất mệt.
- **Nhưng không phải màn nào cũng cần rộng.** Màn tải file và màn cấu hình đọc dễ hơn khi hẹp. Nên khung trang phải nhận được bề rộng, đừng ép một con số cho tất cả.
- **Sidebar phải tự thu trên màn hẹp.** Máy người vận hành thường 1366px; sidebar cố định 240px ăn mất 18% chiều ngang. Dưới một ngưỡng thì thu về dạng nút mở.
- **Trạng thái "đang ở trang nào" phải lấy từ đường dẫn thật.** Dùng `usePathname()`, và so khớp có tính tới đường dẫn con: đứng ở `/ket-qua/abc` thì mục **Kiểm tra file** vẫn phải sáng, vì đó là kết quả của luồng đó.
- **Chỉ phần sidebar là client component.** Nó cần `usePathname` và trạng thái đóng/mở. Nội dung từng trang vẫn render phía máy chủ y như cũ — không được kéo cả cây trang thành client.

## Yêu cầu

**Chức năng**
- Sidebar trái liệt kê 5 màn, mục đang mở nổi rõ, có nhãn ứng dụng ở trên cùng và nút chuyển chủ đề ở dưới cùng
- Khung trang dùng chung: tiêu đề, mô tả ngắn, vùng thao tác bên phải tiêu đề, vùng nội dung
- Bề rộng nội dung đặt được theo từng màn
- Màn hẹp: sidebar thu lại, mở ra bằng nút

**Phi chức năng**
- Đi hết sidebar bằng phím `Tab`, luôn thấy rõ ô đang chọn
- Có liên kết "nhảy tới nội dung" cho người dùng bàn phím
- Mỗi file dưới 200 dòng
- Không trang nào còn tự viết `max-w-*` cho khung ngoài

## Kiến trúc

```
src/components/shell/app-sidebar.tsx   # tạo: client, usePathname + đóng/mở
src/components/shell/nav-items.ts      # tạo: danh sách màn, dùng chung server lẫn client
src/components/shell/page-shell.tsx    # tạo: tiêu đề + mô tả + thao tác + nội dung
src/app/layout.tsx                     # sửa: bỏ nav ngang, dựng lưới sidebar + nội dung
src/app/**/page.tsx                    # sửa: bỏ khung tự dựng, dùng PageShell
```

### Bề rộng theo màn

| Màn | Bề rộng | Vì sao |
|---|---|---|
| Kiểm tra file | hẹp | Một ô thả file, đọc dễ hơn khi không dàn ngang |
| Kết quả kiểm tra | rộng hết cỡ | Bảng 7 cột, thông báo tiếng Việt dài |
| Lịch sử | vừa | Bảng ít cột |
| Đối soát (danh sách) | vừa | |
| Đối soát (chi tiết) | rộng hết cỡ | Ba cột so sánh |
| Đồng bộ danh mục | hẹp | Vài nút và một khối trạng thái |
| Cấu hình luật | vừa | Biểu mẫu, đọc dễ hơn khi không quá dài dòng |

Ba mức này là **token đặt trong `page-shell.tsx`**, không rải số pixel ra từng trang.

## File liên quan

**Tạo mới** — `src/components/shell/nav-items.ts`, `app-sidebar.tsx`, `page-shell.tsx`

**Sửa** — `src/app/layout.tsx`; `src/app/page.tsx`, `lich-su/page.tsx`, `doi-soat/page.tsx`, `doi-soat/[runId]/page.tsx`, `dong-bo/page.tsx`, `cau-hinh/page.tsx`, `ket-qua/[runId]/page.tsx`

## Các bước thực hiện

1. Rút danh sách màn từ `layout.tsx` ra `nav-items.ts`, thêm cho mỗi mục một biểu tượng `lucide-react` (đã cài sẵn) và tiền tố đường dẫn dùng để so khớp trang con
2. Viết `page-shell.tsx` — nhận `title`, `description`, `actions`, `width`, `children`
3. Viết `app-sidebar.tsx` — `usePathname`, so khớp theo tiền tố, trạng thái đóng/mở, nút chuyển chủ đề của giai đoạn 01
4. Dựng lại `layout.tsx` thành lưới hai cột, thêm liên kết "nhảy tới nội dung"
5. Chuyển từng trang một sang `PageShell`, xoá `max-w-*` và `p-8` tự viết. Chạy `build` sau mỗi trang
6. Kiểm bằng bàn phím: `Tab` đi hết sidebar, `Enter` mở được, ô đang chọn luôn thấy rõ
7. Kiểm ở 1366px và 1920px; thu nhỏ dần xem sidebar thu đúng ngưỡng

## Danh sách việc

- [ ] `nav-items.ts` kèm biểu tượng và tiền tố so khớp
- [ ] `page-shell.tsx` với ba mức bề rộng
- [ ] `app-sidebar.tsx`, trạng thái đang mở lấy từ đường dẫn
- [ ] `layout.tsx` dựng lưới, có liên kết nhảy tới nội dung
- [ ] Chuyển đủ 7 trang sang `PageShell`
- [ ] Kiểm bàn phím và các mốc bề rộng màn hình

## Tiêu chí hoàn thành

- `grep -rn "max-w-4xl" src/app` không còn kết quả nào ở khung ngoài trang
- Đứng ở `/ket-qua/<id>` thì mục **Kiểm tra file** vẫn sáng
- Bảng kết quả ở màn 1920px dùng hết chiều ngang, thông báo không còn ngắt dòng vụn
- `Tab` từ đầu trang: gặp liên kết nhảy tới nội dung trước, rồi mới tới sidebar
- Ở 1366px sidebar vẫn dùng được, nội dung không bị bóp méo
- 495 test xanh; `typecheck`, `lint`, `build` sạch

## Đánh giá rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Chuyển 7 trang cùng lúc rồi hỏng, không biết hỏng ở đâu | Chuyển từng trang một, `build` sau mỗi trang |
| Sidebar là client component kéo theo cả cây trang thành client | Sidebar nằm cạnh `{children}` trong layout chứ không bọc quanh; các trang vẫn là Server Component |
| Bảng rộng làm vỡ bố cục trên màn hẹp | Bảng cuộn ngang trong khung riêng, thân trang không bao giờ cuộn ngang |
| Bỏ sót một trang, còn hai kiểu khung song song | Tiêu chí `grep` ở trên bắt được ngay |

## Cân nhắc bảo mật

Không có bề mặt mới: giai đoạn này không thêm đầu vào, không thêm truy vấn, không đụng dữ liệu.

## Bước kế tiếp

Giai đoạn 03 và 04 áp nội dung từng màn lên khung này; hai giai đoạn đó độc lập, làm song song được.
