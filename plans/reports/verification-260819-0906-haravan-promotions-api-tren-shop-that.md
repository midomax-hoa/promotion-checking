# Kiểm chứng lại `GET /com/promotions.json` trên shop thật — 2026-08-19

Bổ sung cho [báo cáo 2026-08-18](verification-260818-1046-haravan-promotions-api.md), vốn chỉ chạy
được trên store dev có **đúng 1 chương trình** nên bỏ ngỏ nhiều câu hỏi.

Toàn bộ chỉ dùng `GET`. Không tạo/sửa/xoá gì. Script chạy từ thư mục tạm ngoài repo, token
truyền qua biến môi trường, không ghi vào file nào trong dự án.

## Con số quan trọng nhất

**Shop có 2.290 chương trình khuyến mãi, không phải 300.000.**

Đo hai lần độc lập, khớp nhau:

| Cách đo | Kết quả |
|---|---|
| Dò nhị phân trang cuối, `limit=50` | trang 46 là trang cuối có dữ liệu → ≈ 2.290 |
| Duyệt tuần tự, `limit=250` | 9 trang đầy + 1 trang 40 phần tử = **2.290**, 2.290 id duy nhất |

Hệ quả: `MAX_PAGES = 200` trong `promotion-fetcher.ts` **không hề bị chạm tới**.
Ở `limit=50` chỉ cần 46 trang. Lượt kéo danh sách chương trình **chạy được bình thường**.

## Bảng tham số — cái nào máy chủ thật sự nghe

Cách kiểm: so danh sách id trả về với trang 1 không tham số. Giống hệt = bị bỏ qua.
Có đối chứng `zzz_bogus=x` để chắc chắn phép so là đáng tin.

| Tham số | Kết quả | Kết luận |
|---|---|---|
| `limit=250` | trả đúng 250 | **Có tác dụng.** Trần thật là 250 |
| `limit=500/1000/2000/5000` | tụt về 50 | Vượt 250 thì rơi về mặc định 50 |
| `page` | phân trang đúng | Có tác dụng (đã biết từ trước) |
| `updated_at_min` | 2026-01-01→250, 07-30→174, 08-01→3 | **Có tác dụng, đơn điệu đúng nghĩa** |
| `created_at_min` | 2026-08-01 → 0 | **Có tác dụng** |
| `since_id` | `id` lớn nhất→0, `id` nhỏ nhất−1→250 | **Có tác dụng**, nghĩa là `id >` mốc |
| `ids=` | gửi 3/50/100/250 id → trả đúng bấy nhiêu | **Có tác dụng**, nhận ít nhất 250 id một lượt |
| `status=enabled` / `status=disabled` | giống hệt trang 1 | Bị bỏ qua |
| `query=` / `name=` / `title=` | giống hệt trang 1 | **Bị bỏ qua — không tìm theo tên được** |
| `fields=` | giống hệt trang 1 | Bị bỏ qua |
| `zzz_bogus=x` (đối chứng) | giống hệt trang 1 | Tham số lạ bị nuốt im lặng, đúng như ghi nhận cũ |
| `GET /com/promotions/{id}.json` | 200, bọc khoá `promotion` | Đọc một bản ghi được |

Kết luận cũ "máy chủ bỏ qua bộ lọc" **chỉ đúng với `status`**. Lọc theo thời gian và theo id
đều chạy. Riêng lọc theo tên thì thật sự không có — mà đối soát lại khớp theo tên, nên vẫn
buộc phải kéo cả danh sách rồi so trong bộ nhớ. Ở cỡ 2.290 thì việc đó rẻ.

## Chân dung kho chương trình

| Chỉ số | Giá trị |
|---|---|
| Tổng | 2.290 |
| Đang bật (`status = enabled`) | 2.252 |
| Có ngày kết thúc | 2.281 |
| **Kết thúc trong tương lai** | **182** |
| Tên duy nhất | 2.013 |
| **Tên bị trùng (≥2 CTKM cùng tên)** | **250** |

Hai dòng in đậm đáng chú ý:

- **~2.100 chương trình đã hết hạn nhưng vẫn để `enabled`.** Không ảnh hưởng luật E3 (E3 lọc
  theo cửa sổ thời gian trước khi so), nhưng nghĩa là `status` gần như vô nghĩa để phân biệt
  còn hiệu lực hay không — phải dựa vào `ends_at`.
- **250 tên bị trùng.** Đối soát khớp theo tên, gặp trùng thì trả `ambiguous` và ghi một dòng
  cho mỗi ứng viên. Cần theo dõi xem màn đối soát có bị ngập `ambiguous` không.

## Nhịp gọi

Header `X-Haravan-Api-Call-Limit` báo giỏ 80 lượt, rỉ 4 lượt/giây — khớp ghi nhận giai đoạn 02.
Lần đo thứ hai gọi cách nhau 350 ms thì dính 429 ở trang 7; giãn lên 1.100 ms thì 10 trang
chạy trơn, giỏ giữ ở mức 1/80. Bộ giới hạn nhịp trong `rate-limiter.ts` đã xử lý đúng chuyện này.

## Chi phí kéo danh sách, tính theo số đo thật

| Cấu hình | Số trang | Thời gian ước tính ở 3 lượt/giây |
|---|---|---|
| `limit=50` (hiện tại) | 46 | ~15 giây |
| `limit=250` | 10 | **~3,3 giây** |

## Câu chưa trả lời

- Con số 300.000 mà chủ repo nêu không khớp shop này (2.290). Có thể là số **dòng** khuyến mãi
  (2.290 CTKM × trung bình hơn trăm SKU mỗi cái ≈ vài trăm nghìn cặp CTKM–biến thể), hoặc là
  một shop khác. Cần xác nhận token vừa dùng trỏ tới shop nào.
- `limit` trên endpoint sản phẩm bị ép về 50, còn endpoint chương trình cho tới 250. Hai
  endpoint khác trần nhau, nên không dùng chung một thiết lập kích thước trang được.
- Chưa đo `entitled_product_ids`/`entitled_variant_ids` trung bình mỗi CTKM, tức chưa biết
  chi phí bộ nhớ thật của `mapPromotions` ở cỡ 2.290 bản ghi.
