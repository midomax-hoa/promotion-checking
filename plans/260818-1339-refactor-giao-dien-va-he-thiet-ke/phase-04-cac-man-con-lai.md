# Giai đoạn 04 — Các màn còn lại

## Liên kết bối cảnh

- [Tổng quan kế hoạch](plan.md) · [Giai đoạn 02](phase-02-khung-ung-dung-va-sidebar.md)
- File đụng tới: `src/app/lich-su/`, `src/app/doi-soat/`, `src/app/dong-bo/`, `src/app/cau-hinh/`

## Tổng quan

- **Ưu tiên:** Trung bình
- **Trạng thái:** Chưa làm
- **Phụ thuộc:** Giai đoạn 02 (khung trang). Độc lập với giai đoạn 03
- Áp khung mới lên bốn màn còn lại: lịch sử, đối soát, đồng bộ danh mục, cấu hình luật.

## Nhận định quan trọng

- **Màn cấu hình là màn dày nhất và đang khó đọc nhất.** 11 thiết lập chung cộng 37 luật chia sáu nhóm, tất cả nằm trong **một** biểu mẫu duy nhất. Ở dạng danh sách phẳng như hiện tại, người dùng phải cuộn rất lâu mới tìm ra luật cần sửa, và không biết mình đang ở nhóm nào.
- **Nhưng không được tách thành nhiều biểu mẫu.** Một nút Lưu cho tất cả là quyết định có chủ ý từ giai đoạn 07 — tách ra sẽ đẻ ra chuyện lưu nửa vời. Chỉ được cải thiện cách **bày**, không đổi cách **gửi**.
- **Màn đối soát chi tiết bày ba cột Excel ↔ Haravan ↔ chênh lệch.** Đây là màn hưởng lợi nhiều nhất từ bề rộng mới; hiện đang bị ép rất chật.
- **Màn đồng bộ có phần chạy dài và có thanh tiến trình.** Nó là client component có trạng thái; đụng vào phải giữ nguyên luồng cập nhật tiến trình, chỉ đổi phần hiển thị.
- **Màn lịch sử đang hiện 100 lần chạy gần nhất, chưa phân trang.** Đây là hạn chế đã ghi nhận, **không** giải quyết trong đợt này — đợt này chỉ đụng giao diện.

## Yêu cầu

**Chức năng**
- Bốn màn dùng `PageShell`, bề rộng theo bảng ở giai đoạn 02
- Màn cấu hình: thấy được đang ở nhóm luật nào, nhảy nhanh tới một nhóm, vẫn **một** nút Lưu duy nhất
- Màn đối soát chi tiết: ba cột so sánh đọc thoải mái, chỗ chênh lệch nổi rõ
- Màn đồng bộ: trạng thái và tiến trình dễ đọc hơn, luồng cập nhật giữ nguyên
- Màn lịch sử: bảng gọn, mở lại kết quả cũ nhanh

**Phi chức năng**
- Không đổi cách gửi biểu mẫu ở màn cấu hình
- Không đổi luồng cập nhật tiến trình ở màn đồng bộ
- Mỗi file dưới 200 dòng

## Kiến trúc

```
src/app/lich-su/page.tsx                       # sửa: PageShell
src/app/doi-soat/page.tsx                      # sửa: PageShell
src/app/doi-soat/[runId]/page.tsx              # sửa: PageShell, ba cột rộng ra
src/app/dong-bo/page.tsx                       # sửa: PageShell
src/app/cau-hinh/page.tsx                      # sửa: PageShell + mục lục nhóm luật
src/components/config/rule-config-table.tsx    # sửa: mật độ, phân tách nhóm
src/components/config/app-setting-form.tsx     # sửa: bố cục nhãn và ô nhập
src/components/reconcile/diff-table.tsx        # sửa: ba cột, làm nổi chênh lệch
src/components/reconcile/reconcile-runner.tsx  # sửa: chỉ phần hiển thị
src/components/check/program-table.tsx         # dùng lại, không sửa thêm
```

## Các bước thực hiện

1. Chuyển `lich-su`, `doi-soat`, `dong-bo` sang `PageShell`; `build` sau mỗi trang
2. `doi-soat/[runId]` — chuyển khung, rồi đặt lại ba cột cho bề rộng mới, làm nổi ô chênh lệch
3. `cau-hinh` — chuyển khung; thêm mục lục sáu nhóm luật, bấm là nhảy tới nhóm. **Không** đụng thẻ `<form>` hay Server Action
4. `rule-config-table.tsx` — tách nhóm rõ hơn, tăng mật độ, giữ nguyên tên trường trong biểu mẫu
5. `app-setting-form.tsx` — nhãn và ô nhập bày lại cho dễ quét mắt, giữ nguyên tên trường
6. `reconcile-runner.tsx` — chỉ đổi phần vẽ, không đụng phần gọi và cập nhật tiến trình
7. Bấm Lưu thật ở màn cấu hình, xác nhận lưu đúng và thông báo lỗi tiếng Việt vẫn hiện
8. Chạy đối soát thật, xác nhận tiến trình vẫn nhảy và kết quả vẫn đúng

## Danh sách việc

- [ ] Bốn màn dùng `PageShell`
- [ ] Mục lục nhóm luật ở màn cấu hình
- [ ] Bảng luật tách nhóm rõ, mật độ vừa mắt
- [ ] Ba cột so sánh ở màn đối soát chi tiết
- [ ] Màn đồng bộ: trạng thái và tiến trình dễ đọc
- [ ] Bấm Lưu thật, chạy đối soát thật để xác nhận không hỏng luồng

## Tiêu chí hoàn thành

- Bấm Lưu ở màn cấu hình: giá trị vào CSDL đúng, nhập sai vẫn báo lỗi tiếng Việt như cũ
- Vẫn đúng **một** thẻ `<form>` bọc cả 11 thiết lập và 37 luật
- Từ đầu màn cấu hình nhảy tới nhóm E trong một cú bấm
- Màn đối soát chi tiết ở 1920px: ba cột đọc thoải mái, không ngắt dòng vụn
- Chạy đối soát: thanh tiến trình vẫn nhảy, kết quả vẫn đúng
- 495 test xanh; `typecheck`, `lint`, `build` sạch

## Đánh giá rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Sửa bảng luật làm đổi tên trường, Server Action đọc không ra | `rule-config-form.ts` đọc theo tên trường; có 20 test phủ phần này. Chạy test sau mỗi lần sửa và không đụng thuộc tính `name` |
| Thêm mục lục vô tình tách thành nhiều biểu mẫu | Mục lục chỉ là liên kết neo trong trang, nằm **trong** cùng thẻ `<form>` hoặc ngoài hẳn — không bao giờ đẻ thêm `<form>` |
| Sửa `reconcile-runner.tsx` làm đứt luồng cập nhật tiến trình | Chỉ đụng phần vẽ; chạy đối soát thật để xác nhận |
| Bốn màn cùng lúc, hỏng không biết ở đâu | Chuyển từng màn một, `build` sau mỗi màn |

## Cân nhắc bảo mật

- Không đổi đường gửi dữ liệu, nên phần kiểm tra bằng `zod` ở màn cấu hình giữ nguyên hiệu lực
- Mục lục nhóm luật chỉ là liên kết neo, không nhận đầu vào

## Bước kế tiếp

Xong giai đoạn này thì chụp lại toàn bộ ảnh minh hoạ trong `docs/huong-dan-su-dung.md` — ảnh cũ chụp giao diện trước refactor, để nguyên sẽ sai lệch so với thực tế.
