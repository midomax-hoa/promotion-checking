# Giai đoạn 07 — Màn cấu hình luật & tài liệu

## Liên kết bối cảnh

- [Tổng quan kế hoạch](plan.md) · [Giai đoạn 01](phase-01-nen-tang-du-an-va-luoc-do-du-lieu.md) · [Giai đoạn 04](phase-04-bo-may-luat-nhom-a-den-e.md)
- [Báo cáo brainstorm](../reports/brainstorm-260817-1019-promotion-import-checking-tool.md) — mục 4 (nguyên tắc không hard-code)

## Tổng quan

- **Ưu tiên:** Trung bình — **có thể cắt bỏ nếu gấp**
- **Trạng thái:** ✅ Xong 2026-08-18
- Giao diện sửa cấu hình 37 luật và các thiết lập chung, cộng với bộ tài liệu dự án.

**Vì sao cắt được:** ngưỡng đã nằm đúng chuẩn trong DB từ giai đoạn 01. Không có màn này thì vẫn sửa được bằng `prisma studio` hoặc sửa seed. Màn này chỉ để người không rành kỹ thuật tự chỉnh.

## Nhận định quan trọng

- Đây là màn hiện thực hoá nguyên tắc **không hard-code giá trị nghiệp vụ**. Mọi con số nêu trong kế hoạch (70%, 90 ngày, 1.000đ, 24 giờ, 8 giây) đều chỉ là **giá trị mặc định gợi ý**.
- D1 và D2 mặc định tắt vì quy tắc đặt tên chương trình **không phải quy định bắt buộc**. Ai muốn tự áp quy ước riêng thì bật lên.
- Cần một công tắc **tắt cả nhóm D và E** cho trường hợp quy trình đổi sang chế độ import khác — khi đó cột `Tên ctkm` và cột ngày trong Excel không còn được dùng.

## Yêu cầu

**Chức năng**
- Liệt kê 37 luật gom theo nhóm A–F
- Sửa được: bật/tắt, mức cảnh báo, tham số riêng của từng luật
- Sửa được các `AppSetting` chung
- Công tắc tắt nhanh cả nhóm
- Nút khôi phục mặc định cho từng luật và cho toàn bộ
- Hiện rõ giá trị nào đang khác mặc định

**Phi chức năng**
- Lưu bằng Server Action, không cần API riêng
- Kiểm tra hợp lệ bằng `zod` trước khi ghi DB

## Kiến trúc

```
src/app/cau-hinh/page.tsx
src/app/cau-hinh/actions.ts        # Server Action lưu cấu hình
src/components/config/
  rule-config-table.tsx
  rule-param-editor.tsx            # dựng ô nhập theo lược đồ tham số
  app-setting-form.tsx
  group-toggle.tsx
src/lib/config/rule-config-schema.ts  # lược đồ zod cho params từng luật
docs/
  codebase-summary.md
  system-architecture.md
  code-standards.md
  project-changelog.md
  development-roadmap.md
  huong-dan-su-dung.md             # dành cho người dùng cuối, tiếng Việt
  van-hanh-va-trien-khai.md
```

### Lược đồ tham số

Mỗi luật có tham số thì khai lược đồ `zod` trong `rule-config-schema.ts`, giao diện dựng ô nhập từ lược đồ đó. Tránh phải viết tay từng biểu mẫu.

```ts
export const ruleParamSchemas = {
  C4: z.object({ maxDiscountPercent: z.number().min(1).max(100) }),
  C7: z.object({ roundingUnit: z.number().int().min(1) }),
  D7: z.object({ maxDurationDays: z.number().int().min(1) }),
  B1: z.object({ suggestMaxDistance: z.number().int().min(1).max(5) }),
} as const
```

### Bố cục màn hình

```
┌────────────────────────────────────────────────────────────┐
│ Thiết lập chung                                            │
│   Cảnh báo khi danh mục cũ hơn      [ 24 ] giờ             │
│   Số yêu cầu mỗi giây gửi Haravan   [  3 ]                 │
│   Chờ giữa 2 lượt đối soát          [ 8000 ] mili giây     │
├────────────────────────────────────────────────────────────┤
│ Nhóm A — Cấu trúc file                      [tắt cả nhóm]  │
│   ☑ A1  Thiếu cột bắt buộc              [🔴 ▾]             │
│   ☑ A2  Liệt kê sheet                   [🟡 ▾]             │
│ ...                                                        │
│ Nhóm D — Theo chương trình                  [tắt cả nhóm]  │
│   ☐ D1  Tên không khớp giá trị giảm     [🟡 ▾]  (mặc định tắt) │
│   ☑ D7  Thời lượng bất thường           [🟡 ▾]             │
│         Tối đa [ 90 ] ngày                    ⟳ mặc định   │
└────────────────────────────────────────────────────────────┘
```

## File liên quan

**Tạo mới:** toàn bộ file trong phần Kiến trúc
**Sửa:** `src/app/layout.tsx` (điều hướng)

## Các bước thực hiện

1. Viết `rule-config-schema.ts` — lược đồ `zod` cho tham số từng luật
2. Làm `cau-hinh/page.tsx` — Server Component đọc `RuleConfig` và `AppSetting`
3. Làm `actions.ts` — Server Action kiểm tra hợp lệ rồi ghi, có `revalidatePath`
4. Làm `rule-config-table.tsx` gom theo nhóm, kèm `group-toggle.tsx`
5. Làm `rule-param-editor.tsx` dựng ô nhập từ lược đồ
6. Làm nút khôi phục mặc định, đọc giá trị gốc từ `rule-catalog.ts`
7. Đánh dấu trực quan những giá trị đang khác mặc định
8. Viết tài liệu trong `docs/`
9. Viết `huong-dan-su-dung.md` bằng tiếng Việt cho người dùng cuối, kèm ảnh chụp màn hình

## Danh sách việc

- [x] `rule-config-schema.ts` với zod
- [x] Màn cấu hình đọc `RuleConfig` + `AppSetting`
- [x] Server Action lưu cấu hình có kiểm tra hợp lệ
- [x] Bảng luật gom nhóm + công tắc theo nhóm
- [x] Ô nhập tham số dựng từ lược đồ
- [x] Nút khôi phục mặc định (từng luật và toàn bộ)
- [x] Đánh dấu giá trị khác mặc định
- [x] Viết `docs/` (7 tài liệu)
- [x] Hướng dẫn sử dụng tiếng Việt cho người dùng cuối

## Tiêu chí hoàn thành

- Đổi `maxDiscountPercent` từ 70 xuống 50 → chạy lại file mẫu, số phát hiện của C4 tăng lên
- Tắt luật C7 → không còn phát hiện nào mang mã C7
- Tắt cả nhóm E → toàn bộ E1–E3 biến mất khỏi kết quả
- Bấm khôi phục mặc định → giá trị trở về đúng như `rule-catalog.ts`
- Nhập giá trị không hợp lệ (ví dụ `maxDiscountPercent = 500`) → bị chặn kèm thông báo tiếng Việt
- `docs/` có đủ tài liệu, không tài liệu nào vượt 800 dòng

## Đánh giá rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Không có đăng nhập nên ai cũng sửa được cấu hình | Đã chốt chạy trong mạng nội bộ; ghi rõ trong tài liệu vận hành; `RuleConfig.updatedAt` lưu lại thời điểm sửa |
| Sửa cấu hình làm kết quả cũ và mới không so được | `CheckRun` lưu ảnh chụp cấu hình lúc chạy để truy vết về sau |
| Lược đồ tham số và luật lệch nhau | Test đối chiếu `ruleParamSchemas` với `rule-catalog.ts` |

## Cân nhắc bảo mật

- Mọi dữ liệu nhập vào phải qua `zod` trước khi ghi DB
- Server Action kiểm tra mã luật nằm trong danh mục hợp lệ, không nhận mã tuỳ ý
- Tài liệu **không** được chứa token thật; chỉ nêu tên biến môi trường

## Kết quả thực tế (2026-08-18)

### File đã làm

Khác kế hoạch ở ba chỗ, đều theo hướng gọn hơn:

| Kế hoạch | Thực tế | Vì sao |
|---|---|---|
| `src/lib/config/rule-config-schema.ts` | Giữ nguyên, thêm `rule-config-form.ts` và `config-form-state.ts` | Phần đọc biểu mẫu tách khỏi phần chạm CSDL để test được không cần CSDL; module `'use server'` chỉ được export hàm async nên kiểu dùng chung phải nằm file khác |
| `docs/` 7 tài liệu | 3 tài liệu mới, 4 tài liệu cập nhật | `system-architecture.md`, `code-standards.md`, `project-changelog.md`, `development-roadmap.md` đã có sẵn từ các giai đoạn trước |
| Công tắc tắt cả nhóm | Làm bằng thao tác hàng loạt, không thêm cột CSDL | Không cần lược đồ mới; tắt cả nhóm chỉ là đặt `enabled = false` cho các luật thuộc nhóm |

### Đối chiếu tiêu chí hoàn thành

| Tiêu chí | Kết quả đo trên bản dựng thật, CSDL thật, file `promotion.t8.xlsx` |
|---|---|
| Hạ `maxDiscountPercent` 70 → 50, số phát hiện C4 tăng | ✅ **0 → 189** |
| Tắt một luật thì phát hiện của nó biến mất | ✅ C2 từ 279 xuống **0** (C7 mặc định không báo dòng nào trên file này nên đo bằng C2) |
| Tắt cả một nhóm thì cả nhóm biến mất | ✅ Tắt nhóm D (D3, D4, D5 đang báo) → **không còn phát hiện nào của nhóm D** (nhóm E cũng không báo dòng nào trên file này) |
| Khôi phục mặc định trả về đúng `rule-catalog.ts` | ✅ Số phát hiện trùng khớp mốc ban đầu |
| Giá trị không hợp lệ bị chặn kèm thông báo tiếng Việt | ✅ `maxDiscountPercent = 500` → "Mức giảm tối đa coi là bình thường phải nằm trong khoảng 1 đến 100 %."; `haravan.page_size = 250` → "Giá trị tối đa cho phép là 50." |
| `docs/` đủ tài liệu, không tài liệu nào vượt 800 dòng | ✅ 7 tài liệu, dài nhất 438 dòng |

Thêm một hành vi ngoài tiêu chí, phục vụ ô rủi ro về dấu vết chỉnh sửa: đổi 2 luật rồi lưu thì **chỉ 2 dòng** có `updatedAt` mới.

### Một ô giảm thiểu rủi ro chưa làm được

Bảng rủi ro phía trên ghi *"`CheckRun` lưu ảnh chụp cấu hình lúc chạy để truy vết về sau"*. Kiểm lại `prisma/schema.prisma`: **bảng `CheckRun` không có cột nào chứa ảnh chụp cấu hình**, và giai đoạn 01/05 cũng chưa từng thêm. Danh sách việc của giai đoạn này không có mục đó nên không tự ý mở rộng phạm vi.

Hệ quả thật: mở lại một lần chạy cũ vẫn thấy nguyên số phát hiện đã lưu, nhưng **không biết được lần chạy đó dùng ngưỡng nào**. So hai lần chạy cách nhau một lần chỉnh cấu hình sẽ không giải thích được vì sao số liệu lệch.

Muốn khoả lấp thì cần thêm một cột `Json` vào `CheckRun` cùng một migration, ghi lại `RuleConfig` tại thời điểm chạy — chờ xác nhận trước khi làm.

### Hai chỗ phải sửa sau khi thao tác thật trên trình duyệt

- **Biểu mẫu phải đặt `noValidate`.** Ô nhập số có `min`/`max` nên trình duyệt tự chặn trước bằng bong bóng tiếng Anh, thông báo tiếng Việt của công cụ không bao giờ hiện ra. Giữ lại `min`/`max` cho bộ tăng giảm và trình đọc màn hình.
- **Trạng thái trả về phải mang theo nguyên văn giá trị bị từ chối.** React tự `reset` biểu mẫu sau khi Server Action trả về, nên không làm vậy thì ô nhập bật về giá trị cũ trong khi lỗi vẫn trỏ vào nó — người dùng đọc thấy một ô trông hoàn toàn bình thường.

### Kiểm thử

Thêm 20 test trong `test/config/rule-config-form.test.ts`, gồm cả test đối chiếu mô tả ngưỡng với `rule-catalog.ts` theo đúng ô rủi ro đã nêu. Tổng 495 test pass; `typecheck`, `lint`, `build` sạch.

## Bước kế tiếp

Hoàn tất kế hoạch. Việc còn lại: khởi tạo git (**phải hỏi tài khoản GitHub và email commit trước**), và kiểm chứng phân trang `promotions.json` trên máy chủ thật.
