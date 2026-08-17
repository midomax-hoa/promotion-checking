# Brainstorm — Công cụ kiểm tra & đối soát file import khuyến mãi Haravan

**Ngày:** 2026-08-17
**Trạng thái:** Đã thống nhất phương án, chờ lập kế hoạch chi tiết

---

## 1. Vấn đề

Quy trình import khuyến mãi lên Haravan hiện không có bước kiểm tra nào:

- Người import không biết file mình đưa lên đúng hay sai.
- SKU không tồn tại bị loại khỏi chương trình mà không để lại cảnh báo lưu được — chương trình vẫn báo tạo thành công dù thiếu SKU. Chi tiết cơ chế ở mục 2.
- Lỗi nghiệp vụ (giảm 0đ, ngày quá khứ, trùng dữ liệu) không ai phát hiện cho tới khi khách phàn nàn.

### Dữ liệu thực tế — `promotion.t8.xlsx`

| Chỉ số | Giá trị |
|---|---|
| Sheet | 2 (`Key`, `Giảm phần trăm`) |
| Dòng dữ liệu (sheet `Key`) | 3.929 |
| Số chương trình (`Tên ctkm`) | 154 |
| Kiểu KM | 100% "Giảm giá theo số tiền" |
| Khoảng ngày | 2026-08-01 → 2026-08-31 (đồng nhất) |
| Cột `Số dư`, `Phần trăm giảm` | trống toàn bộ |

Cột: `Mã`, `Mã hiệu` (SKU), `Mặt hàng`, `Đặc tính`, `Bộ đóng gói`, `Giá niêm yết`, `Số dư`, `Giá sau giảm`, `Số tiền giảm`, `Phần trăm giảm`, `Kiểu ctkm`, `Thời gian bắt đầu`, `Thời gian kết thúc`, `Tên ctkm`.

**Bất thường phát hiện khi khảo sát:**
- `2608GST0K`: 279 dòng có `Số tiền giảm = 0` → khuyến mãi giảm 0 đồng.
- Ngày bắt đầu 01/08 đã trôi qua (khảo sát ngày 17/08).
- Phần còn lại sạch: toán `Giá niêm yết − Số tiền giảm = Giá sau giảm` đúng 100%, không SKU trùng trong cùng chương trình, không SKU nằm ở 2 chương trình.

---

## 2. Khảo sát API Haravan (đã kiểm chứng bằng gọi thật)

| Hạng mục | Kết quả kiểm chứng |
|---|---|
| Token dev | Hoạt động |
| `limit` phân trang | **Bị ép về 50** dù truyền 250 |
| `GET /com/products.json?sku=` | **Khớp chính xác**, không khớp mò. SKU sai → trả 0 kết quả |
| `GET /com/products.json?sku=` (rỗng) | **Trả về 50 sản phẩm bất kỳ** — tuyệt đối không để lọt query SKU rỗng |
| Rate limit | bucket 80, rỉ 4 req/giây, header `X-Haravan-Api-Call-Limit` |
| `discount_type` thực tế | `product_amount` + `take_type` = `percentage`/`fixed_amount` |
| `GET /promotions.json` với CTKM **đã tắt** | **Vẫn trả về**, đọc được `status: "disabled"` |
| `GET /promotions.json` với CTKM **đã hết hạn** | **Vẫn trả về** |
| Tạo CTKM **trùng tên** | Haravan **cho phép**, không chặn |
| **Trễ chỉ mục danh sách** | CTKM mới tạo **~5 giây** sau mới xuất hiện trong `GET /promotions.json`. `GET /promotions/{id}.json` thì tức thì |

**Cảnh báo:** tài liệu Haravan mô tả `discount_type` là `fixed_amount`/`percentage` — **không khớp API thật**. Tài liệu cũng ghi endpoint danh sách là *"List enabling promotions"*, nhưng kiểm chứng thực tế cho thấy nó trả về cả CTKM đã tắt lẫn đã hết hạn. Mọi field phải kiểm chứng bằng gọi thật, không tin tài liệu.

**Cách kiểm chứng:** tạo CTKM thử trên store dev cho từng trường hợp, đọc lại phản hồi, rồi xoá sạch. Store dev đã trở về nguyên trạng.

### Haravan chấp nhận / từ chối cái gì (đã kiểm chứng)

| Đầu vào | Haravan | Ghi chú |
|---|---|---|
| `entitled_variant_ids` chứa ID không tồn tại | 🚫 **422** `"Sản phẩm áp dụng không hợp lệ"` | **Từ chối cả CTKM**, không loại bỏ im lặng |
| `entitled_variant_ids` có ID trùng lặp | 🚫 **422** `"Sản phẩm áp dụng bị trùng lặp"` | |
| `entitled_variant_ids` rỗng | 🚫 **422** `"Biến thể sản phẩm giảm không hợp lệ"` | |
| `value = 0` | 🚫 **422** `"Giá trị khuyến mãi không hợp lệ"` | |
| `value` âm | 🚫 **422** | |
| `value` lớn hơn giá bán | ✅ **Chấp nhận** | Không có chốt chặn — rủi ro tiền bạc |
| `take_type=percentage`, `value=50` | ✅ Nhận, hiểu là 50% | |
| `take_type=percentage`, `value=150` | 🚫 **422** | |
| `starts_at` trong quá khứ | ✅ **Chấp nhận** | |
| `ends_at` < `starts_at` | 🚫 **422** `"Ngày kết thúc không hợp lệ"` | |
| `usage_limit` | Là **một số duy nhất cho cả CTKM** | Không có trường giới hạn riêng từng biến thể |

### Trường của sản phẩm (kiểm chứng khi lập kế hoạch)

Đều chọn được qua tham số `fields` của `products.json`:

| Trường | Kiểu | Ghi nhận trên store dev | Dùng cho |
|---|---|---|---|
| `published_at` | ngày hoặc `null` | 24/74 sản phẩm `null` = chưa đăng bán | Luật B2 |
| `not_allow_promotion` | boolean | Toàn `false`; **chưa rõ Haravan xử lý ra sao khi bật** | Luật B6 (mới) |
| `published_scope` | `'global'` \| `'pos'` \| `null` | 50 global · 23 pos · 1 null | Ngoài phạm vi |
| `only_hide_from_list` | boolean | Toàn `false` | Chưa dùng |

### Suy luận về cơ chế "SKU bị mất"

Giả định ban đầu — *"Haravan tự loại trừ SKU không tồn tại mà không cảnh báo"* — **không đúng**. Haravan từ chối nguyên CTKM bằng lỗi 422.

Cơ chế thật: công cụ import tra SKU qua `products.json?sku=` **trước**, SKU nào không tra ra thì không đưa vào danh sách gửi lên. Haravan chỉ nhận được các SKU hợp lệ nên tạo CTKM bình thường — **thiếu SKU nhưng vẫn báo thành công**.

Hệ quả cho thiết kế: luật **B1 (SKU không tồn tại trên Haravan)** là luật quan trọng nhất của toàn bộ công cụ. Bắt được nó trước khi import là xử lý trọn vẹn vấn đề gốc.

---

## 3. Các phương án đã cân nhắc

| Phương án | Ưu | Nhược | Kết luận |
|---|---|---|---|
| **Next.js 15 + SQLite/Prisma** | Render bảng phía server đúng chuẩn dự án; 1 tiến trình; Prisma đã quen | Nặng hơn công cụ CLI | **Chọn** |
| Python FastAPI + pandas | Xử lý Excel mạnh | Lệch hệ sinh thái JS/TS của nhóm, khó bàn giao | Loại |
| Script CLI đơn thuần | Rẻ nhất | Không đáp ứng yêu cầu web nội bộ nhiều người dùng | Loại |
| Mô phỏng thuật toán công cụ import ("chạy khô") | Báo trước chính xác kết quả import | Phụ thuộc chặt vào công cụ import, phải cập nhật theo | **Loại — chủ dự án quyết định ngày 2026-08-17** |

---

## 4. Phương án chốt

### Kiến trúc

```
Next.js 15 (App Router) + TypeScript
  ├─ Server Component  → render bảng kết quả, lọc/phân trang phía server
  ├─ Server Action     → nhận upload .xlsx, chạy bộ luật
  ├─ Prisma + SQLite   → cache danh mục SKU, lịch sử kiểm tra, cấu hình luật
  ├─ exceljs           → đọc .xlsx, xuất báo cáo có tô màu dòng lỗi
  └─ Tailwind + shadcn/ui
```

Không chọn `xlsx` (SheetJS) vì bản trên npm đã cũ và có CVE.

### Bốn màn hình

| # | Màn hình | Chức năng |
|---|---|---|
| 1 | Kiểm tra file | Upload .xlsx → chạy bộ luật → bảng kết quả gom theo chương trình → xuất Excel tô màu |
| 2 | Đối soát sau import | Chọn file gốc → kéo CTKM từ Haravan → so lệch từng dòng |
| 3 | Đồng bộ danh mục | Kéo toàn bộ SKU về cache; hiện rõ thời điểm đồng bộ gần nhất |
| 4 | Cấu hình luật | Bật/tắt từng luật, đổi mức cảnh báo, chỉnh ngưỡng |

### Nguyên tắc bắt buộc

- **Chỉ cảnh báo, không chặn.** Mọi phát hiện đều liệt kê, người dùng tự quyết.
- **Toàn bộ thông báo bằng tiếng Việt**, kèm gợi ý cách sửa.
- **Đọc tất cả sheet** trong file, không bỏ sót sheet nào.
- **Không hard-code giá trị nghiệp vụ.** Mọi ngưỡng nằm trong bảng cấu hình sửa được trên UI; số trong tài liệu này chỉ là giá trị mặc định gợi ý.
- **Không ghi gì lên Haravan.** Công cụ chỉ đọc (`GET`). Việc import do công cụ hiện có đảm nhiệm.

---

## 5. Bộ luật kiểm tra (37 luật)

> Cập nhật 2026-08-17 khi lập kế hoạch: bổ sung **B5** (SKU khớp nhiều biến thể trên Haravan) và **B6** (sản phẩm bị đánh dấu `not_allow_promotion`). Danh mục chi tiết kèm căn cứ nằm ở [giai đoạn 04 của kế hoạch](../260817-1233-promotion-import-checking-tool/phase-04-bo-may-luat-nhom-a-den-e.md).

Phạm vi áp dụng: chế độ **"Tạo nhóm sản phẩm khuyến mãi"** — gom theo cột `Tên ctkm`. Đây là chế độ duy nhất đang được dùng để thiết lập CTKM.
Nhóm A/B/C là luật cấp dòng, không phụ thuộc chế độ. Nhóm D/E phụ thuộc cột `Tên ctkm` và cột ngày, nên chỉ có nghĩa với chế độ gom nhóm — thiết kế cho phép tắt cả nhóm D/E qua màn Cấu hình nếu quy trình đổi.

**Ba mức cảnh báo**, phân loại dựa trên hành vi Haravan đã kiểm chứng ở mục 2:

| Mức | Nghĩa |
|---|---|
| 🔴 **Chắc chắn thất bại** | Haravan sẽ trả 422 — CTKM không được tạo |
| 🟠 **Tạo được nhưng nguy hiểm** | Haravan chấp nhận, nhưng sai nghiệp vụ hoặc gây thiệt hại tiền |
| 🟡 **Nên xem lại** | Có thể là cố ý |

### Nhóm A — Cấu trúc file

| Mã | Luật | Mức |
|---|---|---|
| A1 | Thiếu cột bắt buộc (`Mã hiệu`, `Kiểu ctkm`, `Tên ctkm`) | 🔴 |
| A2 | File có nhiều sheet — liệt kê rõ từng sheet và số dòng đã đọc | 🟡 |
| A3 | Ô ngày sai định dạng / không đọc được | 🟠 |
| A4 | Ô SKU rỗng hoặc chỉ có khoảng trắng | 🟡 |
| A5 | Dòng trống xen giữa vùng dữ liệu | 🟡 |

### Nhóm B — Đối chiếu với danh mục Haravan

| Mã | Luật | Mức | Gợi ý |
|---|---|---|---|
| **B1** | **SKU không tồn tại trên Haravan** — luật quan trọng nhất của công cụ | 🟠 | Chỉ ra SKU gần giống nhất (khoảng cách Levenshtein). CTKM vẫn tạo được nhưng **thiếu SKU này** |
| B2 | SKU tồn tại nhưng sản phẩm đang ẩn / chưa đăng bán | 🟡 | Khuyến mãi sẽ không hiển thị với khách |
| B3 | `Giá niêm yết` trong file ≠ giá thật trên Haravan | 🟠 | Hiện song song 2 giá — giá sau giảm thực tế sẽ khác dự tính |
| B4 | `Mã hiệu` không bắt đầu bằng `Mã` | 🟡 | Nghi lệch dòng khi sao chép |

### Nhóm C — Số học

| Mã | Luật | Mức | Căn cứ |
|---|---|---|---|
| C1 | `Giá niêm yết − Số tiền giảm ≠ Giá sau giảm` | 🟠 | Haravan không đọc cột `Giá sau giảm`; lệch nghĩa là file sai |
| C2 | `Số tiền giảm` = 0 hoặc âm | 🔴 | Haravan trả 422 `"Giá trị khuyến mãi không hợp lệ"` |
| C3 | Số tiền giảm ≥ giá niêm yết (giá sau giảm ≤ 0) | 🟠 | Haravan **chấp nhận** — thiệt hại tiền thật |
| C4 | Giảm sâu quá ngưỡng (mặc định > 70%) | 🟡 | |
| C5 | Cột phần trăm ghi `50` thay vì `0.5` | 🔴 | Thành 5000% → Haravan trả 422 |
| C6 | `Kiểu ctkm` là "số tiền" nhưng điền cột phần trăm, hoặc ngược lại | 🔴 | Giá trị đọc ra bằng 0 → 422 |
| C7 | Giá sau giảm không tròn 1.000đ | 🟡 | |

### Nhóm D — Theo chương trình

| Mã | Luật | Mức | Mặc định | Căn cứ |
|---|---|---|---|---|
| D1 | Tên CTKM không khớp giá trị giảm (suy từ quy tắc đặt tên) | 🟡 | **Tắt** | |
| D2 | Tên CTKM ghi tháng khác với ngày trong dòng | 🟡 | **Tắt** | |
| D3 | Cùng tên CTKM nhưng các dòng ghi ngày / mức giảm khác nhau | 🟠 | Bật | Bị tách thành nhiều CTKM trùng tên |
| D4 | Ngày bắt đầu đã trôi qua | 🟡 | Bật | Haravan **chấp nhận** ngày quá khứ |
| D5 | Ngày kết thúc đã qua — import không còn ý nghĩa | 🟠 | Bật | Haravan chấp nhận, nhưng CTKM vô dụng |
| D6 | Ngày kết thúc < ngày bắt đầu | 🔴 | Bật | Haravan trả 422 `"Ngày kết thúc không hợp lệ"` |
| D7 | Thời lượng bất thường (mặc định > 90 ngày, hoặc = 0 ngày) | 🟡 | Bật | |
| D8 | Tên CTKM đã tồn tại trên Haravan → import sẽ tạo trùng | 🟠 | Bật | Haravan **cho phép** trùng tên |

> D1/D2 mặc định tắt: **đã xác nhận quy tắc đặt tên (`2608GST130K`) KHÔNG phải quy định bắt buộc**. Không suy diễn từ pattern. Giữ lại dạng luật tuỳ chọn cho nhóm nào muốn tự áp quy ước riêng.

**Luật bổ sung — cột `Số dư`.** Đã xác nhận nghĩa là *giới hạn số lượng khuyến mãi*, và kiểm chứng trên API: `usage_limit` là **một con số duy nhất cho cả CTKM**, Haravan không có trường giới hạn riêng từng biến thể. Do đó giá trị ghi theo từng dòng không thể áp riêng cho từng SKU.

| Mã | Luật | Mức |
|---|---|---|
| D9 | `Số dư` âm, hoặc bằng 0 mà không để trống (0 ≠ "không giới hạn") | 🟡 |
| D10 | Trong cùng 1 CTKM, các dòng ghi `Số dư` khác nhau — chỉ một giá trị duy nhất áp cho cả chương trình | 🟠 |

### Nhóm E — Chồng lấn

| Mã | Luật | Mức |
|---|---|---|
| E1 | 1 SKU nằm trong ≥2 CTKM có khoảng thời gian giao nhau | 🟠 |
| E2 | SKU trùng lặp trong cùng 1 CTKM | 🔴 |
| E3 | SKU đang thuộc CTKM khác đang chạy thật trên Haravan | 🟡 |

> E2 nâng lên 🔴: Haravan trả 422 `"Sản phẩm áp dụng bị trùng lặp"` khi danh sách biến thể có ID lặp.

> E1/E3 chỉ cảnh báo, không kết luận. Chưa xác định được Haravan chọn CTKM nào khi một SKU thuộc nhiều chương trình.

### Nhóm F — Đối soát sau import

| Mã | Luật | Mức |
|---|---|---|
| F1 | Dòng có trong Excel nhưng không tìm thấy trên Haravan | 🔴 |
| F2 | Giá trị giảm trên Haravan lệch với Excel | 🔴 |
| F3 | Ngày bắt đầu / kết thúc lệch | 🔴 |
| F4 | CTKM đã tạo nhưng đang ở trạng thái tắt | 🟡 |
| F5 | Số SKU đính kèm lệch (Excel N dòng, Haravan nhận M) | 🔴 |
| F6 | Haravan có CTKM mà Excel không có | 🟡 |

---

## 6. Chiến lược đồng bộ danh mục

- Phân trang `limit=50` (Haravan ép cứng). Store production **< 3.000 sản phẩm** → tối đa ~60 lượt gọi.
- Ở mức 4 req/s: đồng bộ đầy đủ mất **dưới 30 giây**, chạy nền có thanh tiến trình.
- Lần sau đồng bộ tăng dần theo `updated_at_min`.
- Dùng `fields=id,title,variants,published_at` để giảm tải payload.
- Cache SQLite: `sku → variant_id, product_id, tên SP, giá, tồn kho, trạng thái đăng bán`.
- **Bắt buộc hiển thị nổi bật thời điểm đồng bộ gần nhất**, tự cảnh báo khi cache quá cũ.
- Tra SKU dựa vào cache, **không gọi API từng SKU** → tránh nhầm lẫn giữa lỗi rate-limit và "SKU không tồn tại".

---

## 7. Rủi ro

| # | Rủi ro | Mức | Giảm thiểu |
|---|---|---|---|
| 1 | ~~`GET /promotions.json` chỉ trả CTKM đang bật~~ | **Đã loại bỏ** | Kiểm chứng thực tế: trả về cả CTKM đã tắt lẫn đã hết hạn. Nhóm luật F thực hiện được đầy đủ |
| 2 | **Trễ chỉ mục ~5 giây**: đối soát ngay sau khi import sẽ báo oan hàng loạt "không tìm thấy trên Haravan" (F1) | **Cao** | Màn đối soát **tự kiểm lại lần hai** cách lần đầu vài giây; chỉ báo đỏ khi cả hai lần đều không thấy. Cách này an toàn với mọi độ trễ, không cần đo trước con số cụ thể |
| 3 | Tài liệu Haravan không khớp API thật | Trung bình | Kiểm chứng từng field bằng gọi thật; viết test ghim lại cấu trúc phản hồi |
| 4 | Cache danh mục cũ gây báo sai | Trung bình | Bắt buộc đồng bộ trước khi kiểm tra; hiện cảnh báo khi cache quá ngưỡng tuổi |
| 5 | Chưa rõ Haravan xử lý xung đột CTKM ra sao | Thấp | Luật E1/E3 chỉ liệt kê, không phán quyết |
| 6 | Đối soát khớp theo tên CTKM — Haravan **cho phép trùng tên** nên có thể khớp nhầm | Trung bình | Cảnh báo khi phát hiện tên trùng (D8); khi 1 tên khớp nhiều CTKM thì liệt kê hết, không tự chọn |
| 7 | Chưa kiểm chứng `limit`/phân trang của `GET /promotions.json` (store dev quá ít dữ liệu) | Thấp | Giả định ép 50 giống `products.json`, phân trang bằng `page`; kiểm chứng lại trên store production |

---

## 8. Tiêu chí thành công

- Kiểm tra hết 3.929 dòng × 154 chương trình, không bỏ sót sheet nào.
- Phát hiện đúng 279 dòng giảm 0đ của `2608GST0K` và báo rõ: chương trình này **chắc chắn bị Haravan từ chối**, toàn bộ 279 SKU sẽ không có khuyến mãi.
- Phát hiện đủ mọi SKU không tồn tại trên Haravan (luật B1) trước khi import.
- Thời gian kiểm tra một file < 5 giây (sau khi cache danh mục đã sẵn sàng).
- Mọi thông báo bằng tiếng Việt, có gợi ý cách sửa cụ thể.
- Xuất được file Excel báo cáo tô màu để gửi lại người lập file.
- Không phát sinh bất kỳ lệnh ghi nào lên Haravan.

---

## 9. Bước tiếp theo

1. Lập kế hoạch triển khai chi tiết theo từng giai đoạn.
2. Khi có quyền truy cập store production: kiểm chứng phân trang của `GET /promotions.json` (store dev quá ít dữ liệu để xác định).

## 10. Câu hỏi còn treo

Không còn câu hỏi chặn tiến độ. Các câu trước đó đã được giải quyết:

| Câu hỏi | Trả lời |
|---|---|
| Quy tắc đặt tên CTKM có bắt buộc? | Không → D1/D2 mặc định tắt |
| Cột `Số dư` nghĩa là gì, áp cho SKU hay chương trình? | Giới hạn số lượng khuyến mãi; kiểm chứng API: **áp cho cả chương trình**, không tách theo SKU |
| Có cần đối soát kênh bán hàng / cửa hàng? | Không |
| Cần hỗ trợ chế độ import nào? | Chỉ "Tạo nhóm sản phẩm khuyến mãi" |
| `GET /promotions.json` có trả CTKM đã tắt / hết hạn? | Có, trả về đầy đủ |
| Có cần đo độ trễ chỉ mục trên production? | Không — xử lý bằng cơ chế kiểm lại hai lần |

---

## Phụ lục — Quyết định đã chốt (2026-08-17)

| Quyết định | Nội dung |
|---|---|
| Phạm vi | Kiểm tra trước import **và** đối soát sau import |
| Triển khai | Web nội bộ, nhiều người dùng chung, không cần đăng nhập |
| Quy mô catalog | **< 3.000 sản phẩm** |
| Có import luôn không | **Không** — chỉ kiểm tra |
| Ngày bắt đầu đã qua | Có cảnh báo |
| Mô phỏng thuật toán công cụ import | **Không làm** |
| Quy tắc đặt tên CTKM | **Không bắt buộc** → D1/D2 mặc định tắt |
| Nghĩa cột `Số dư` | Giới hạn số lượng khuyến mãi |
| Đối soát kênh bán hàng / cửa hàng | **Không cần** |
| Chế độ import cần hỗ trợ | Chỉ **"Tạo nhóm sản phẩm khuyến mãi"** (gom theo `Tên ctkm`) |
| Mức cảnh báo | **3 mức**: chắc chắn thất bại / tạo được nhưng nguy hiểm / nên xem lại |

### Vì sao không hỗ trợ chế độ "Tạo sản phẩm khuyến mãi"

Đối chiếu hai chế độ của công cụ import hiện có:

| | Tạo **nhóm** sản phẩm khuyến mãi | Tạo sản phẩm khuyến mãi |
|---|---|---|
| Kết quả | 1 nhóm → 1 CTKM | 1 dòng → 1 CTKM riêng |
| Tên CTKM | Lấy từ cột `Tên ctkm` | Lấy từ ô nhập trên form |
| Ngày bắt đầu / kết thúc | Lấy từ Excel | Lấy từ ô nhập trên form |
| Giới hạn lượt dùng | Cộng dồn cả nhóm | Riêng từng dòng |

Ở chế độ "Tạo sản phẩm khuyến mãi", ba cột `Tên ctkm` / `Thời gian bắt đầu` / `Thời gian kết thúc` trong Excel bị bỏ qua hoàn toàn — người dùng nhập tay trên form. Nhóm luật D và E đều dựa trên ba cột đó nên không còn ý nghĩa. Nhóm A/B/C là luật cấp dòng, vốn đã chạy chung cho mọi chế độ, không cần code thêm.

Kết luận: chỉ làm một chế độ. Nếu quy trình đổi, chỉ cần thêm công tắc tắt nhóm D/E trong màn Cấu hình.
