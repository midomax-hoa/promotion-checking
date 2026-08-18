# Giai đoạn 01 — Hệ thiết kế và dark mode

## Liên kết bối cảnh

- [Tổng quan kế hoạch](plan.md)
- File đụng tới: `src/app/globals.css`, `src/app/layout.tsx`, `src/components/check/severity-badge.tsx`

## Tổng quan

- **Ưu tiên:** Cao — mọi giai đoạn sau đều dựa trên token của giai đoạn này
- **Trạng thái:** Chưa làm
- **Phụ thuộc:** Không
- Đặt nền màu, chữ, khoảng cách cho cả ứng dụng, và làm dark mode bật được thật.

## Nhận định quan trọng

- **Bảng màu hiện tại là bản mặc định của shadcn, toàn xám.** Mọi biến đều dạng `oklch(x 0 0)` — số 0 giữa là độ bão hoà. Không có màu thương hiệu nào, nên nút chính, link và trạng thái đang chọn đều đen như nhau và không phân biệt được với chữ thường.
- **Hệ màu mức cảnh báo đã đúng, đừng đụng ngữ nghĩa.** `severity-badge.tsx` đang dùng đỏ (chắc chắn thất bại) / cam (nguy hiểm) / vàng (nên xem lại), `summary-cards.tsx` thêm lục (sạch). Bốn màu này mang nghĩa nghiệp vụ, không phải trang trí. Chỉ được tinh chỉnh sắc độ cho đủ tương phản trong dark mode.
- **Vì vậy màu thương hiệu phải là xanh dương.** Nó là tông duy nhất còn trống, không ai nhầm nút "Lưu" màu xanh dương với một mức cảnh báo.
- **Dark mode chống nháy phải làm bằng script chạy trước khi trang vẽ.** Đọc lựa chọn từ `localStorage` trong một `<script>` đặt ở `<head>`; để tới `useEffect` mới đọc thì người dùng thấy trang trắng loé lên rồi mới tối.
- **Không dùng `prefers-color-scheme` làm lựa chọn duy nhất.** Cần ba trạng thái: theo hệ thống, ép sáng, ép tối — người vận hành hay chiếu màn hình cho người khác xem nên phải ép được.
- **`--font-heading` đang trỏ về cùng font với `--font-sans`.** Giữ vậy: thêm một font tiêu đề riêng là thêm một lượt tải mà không giải quyết vấn đề nào đang có.

## Yêu cầu

**Chức năng**
- Có màu thương hiệu xanh dương dùng cho nút chính, link, viền ô đang chọn, mục sidebar đang mở
- Bật/tắt dark mode được, nhớ lựa chọn qua lần tải sau, có cả lựa chọn "theo hệ thống"
- Không nháy màu khi tải trang ở chế độ tối

**Phi chức năng**
- Tương phản chữ trên nền đạt WCAG AA (4.5:1 cho chữ thường, 3:1 cho chữ lớn) ở **cả hai** chế độ
- Không thêm phụ thuộc mới
- `globals.css` vẫn dưới 200 dòng

## Kiến trúc

```
src/app/globals.css                    # sửa: token màu, thang chữ
src/components/theme/theme-script.tsx  # tạo: script chạy sớm, chống nháy
src/components/theme/theme-toggle.tsx  # tạo: nút ba trạng thái, client component
src/lib/theme.ts                       # tạo: khoá localStorage + kiểu dữ liệu dùng chung
```

### Token màu

Giữ nguyên cấu trúc biến của shadcn, chỉ thay giá trị. Xanh dương đậm cho `--primary`, nền và viền nhích khỏi xám tuyệt đối một chút để bớt gắt:

```css
:root {
  --primary: oklch(0.48 0.16 255);          /* xanh dương đậm */
  --primary-foreground: oklch(0.99 0 0);
  --ring: oklch(0.48 0.16 255);             /* viền focus cùng tông primary */
  --background: oklch(0.99 0.002 255);      /* trắng ngả xanh cực nhẹ */
  --muted: oklch(0.96 0.004 255);
  /* ... các biến còn lại giữ cấu trúc cũ */
}

.dark {
  --primary: oklch(0.68 0.15 255);          /* sáng hơn để đủ tương phản trên nền tối */
  --primary-foreground: oklch(0.15 0.02 255);
  --background: oklch(0.16 0.008 255);      /* xanh đen, không phải đen tuyệt đối */
}
```

Giá trị trên là **điểm khởi đầu**, phải đo tương phản thật rồi chỉnh, không chốt cứng theo bảng này.

### Ba trạng thái chủ đề

| Trạng thái | Ghi trong `localStorage` | Lớp trên `<html>` |
|---|---|---|
| Theo hệ thống | không ghi gì | theo `prefers-color-scheme` |
| Sáng | `light` | không có |
| Tối | `dark` | `dark` |

## File liên quan

**Tạo mới** — `src/lib/theme.ts`, `src/components/theme/theme-script.tsx`, `src/components/theme/theme-toggle.tsx`

**Sửa** — `src/app/globals.css` (token), `src/app/layout.tsx` (nhúng script), `src/components/check/severity-badge.tsx` và `src/components/check/summary-cards.tsx` (chỉ chỉnh sắc độ dark nếu đo ra thiếu tương phản)

## Các bước thực hiện

1. Viết `src/lib/theme.ts`: khoá `localStorage`, kiểu `'light' | 'dark' | 'system'`, hàm quy đổi ra lớp CSS
2. Viết `theme-script.tsx` — trả về `<script dangerouslySetInnerHTML>` đọc `localStorage` và gắn lớp `dark` **trước khi** trang vẽ
3. Nhúng script vào `<head>` trong `layout.tsx`; thêm `suppressHydrationWarning` cho `<html>` vì script sửa lớp trước khi React tiếp quản
4. Thay token màu trong `globals.css` cho `:root` và `.dark`
5. Viết `theme-toggle.tsx` — nút ba trạng thái, có nhãn cho trình đọc màn hình
6. Đo tương phản thật bằng công cụ trong trình duyệt trên các cặp: chữ thường / nền, chữ mờ / nền, chữ trên nút chính, và **cả bốn** badge mức cảnh báo ở hai chế độ
7. Chỉnh sắc độ badge nếu cặp nào rớt dưới ngưỡng; giữ nguyên màu nào đạt
8. Chụp lại 5 màn ở cả hai chế độ, đối chiếu không có chữ nào chìm vào nền

## Danh sách việc

- [ ] `src/lib/theme.ts`
- [ ] Script chống nháy, nhúng vào `<head>`
- [ ] Token màu `:root` và `.dark`
- [ ] Nút chuyển chủ đề ba trạng thái
- [ ] Đo tương phản cả hai chế độ, chỉnh chỗ rớt ngưỡng
- [ ] Chụp đối chiếu 5 màn × 2 chế độ

## Tiêu chí hoàn thành

- Tải trang ở chế độ tối: **không** thấy loé trắng
- Chọn "theo hệ thống" rồi đổi chủ đề của máy → giao diện đổi theo, không cần tải lại
- Mọi cặp chữ/nền đo được đều đạt WCAG AA ở cả hai chế độ
- Bốn màu mức cảnh báo vẫn phân biệt được bằng mắt ở cả hai chế độ, và vẫn kèm chấm tròn + nhãn chữ
- 495 test xanh; `typecheck`, `lint`, `build` sạch

## Đánh giá rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Đổi token làm hỏng màu badge mức cảnh báo | Badge dùng lớp Tailwind trực tiếp (`bg-red-100`) chứ không qua token, nên không bị ảnh hưởng dây chuyền. Vẫn phải đo lại vì nền đổi |
| Script chống nháy gây lệch hydration | `suppressHydrationWarning` trên `<html>`, và script chỉ đụng `classList` chứ không đụng nội dung |
| Xanh dương bị nhầm là một mức cảnh báo | Không bao giờ dùng xanh dương cho badge hay dòng trong bảng kết quả — chỉ cho thao tác và điều hướng |
| Người dùng tắt JavaScript | Không có script thì rơi về chế độ sáng, vẫn đọc được bình thường |

## Cân nhắc bảo mật

- Script chống nháy là chuỗi hằng viết sẵn trong mã nguồn, không ghép từ dữ liệu người dùng — `dangerouslySetInnerHTML` ở đây không mở đường cho XSS
- `localStorage` chỉ chứa một trong ba chuỗi cố định; giá trị lạ thì rơi về "theo hệ thống"

## Bước kế tiếp

Giai đoạn 02 dựng khung ứng dụng trên nền token này.
