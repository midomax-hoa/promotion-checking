# Kiểm chứng `GET promotions` trên store dev — 2026-08-18

Bằng chứng cho bước 1 của [giai đoạn 06](../260817-1233-promotion-import-checking-tool/phase-06-man-doi-soat-sau-import.md).
Toàn bộ chỉ dùng `GET`, không tạo/sửa/xoá gì trên store.

## Cách kiểm chứng

Script tạm đọc `HARAVAN_API_TOKEN` từ `.env`, gọi thẳng `https://apis.haravan.com`.
Không lưu trong repo (chạy từ thư mục tạm của phiên làm việc).

## Kết quả

| Thăm dò | Mã trả về | Kết luận |
|---|---|---|
| `GET /promotions.json` | 404 (nginx) | **Kế hoạch ghi sai đường dẫn** |
| `GET /com/promotions.json?limit=50&page=1` | 200 | Đường dẫn đúng, bọc trong khoá `promotions` |
| `GET /com/promotions.json?limit=50&page=2` | 200, 0 phần tử | Phân trang bằng `page` chạy đúng |
| `GET /com/promotions.json?limit=250` | 200 | Store dev chỉ có 1 CTKM nên **chưa xác định được `limit` có bị ép về 50 hay không** |
| `GET /com/promotions/count.json` | **422** `Dữ liệu không hợp lệ` | **Không có endpoint đếm** — khác với `products/count.json` |
| `GET /com/promotions.json?status=disabled` | 200, vẫn trả CTKM `enabled` | **Máy chủ bỏ qua bộ lọc** |
| `GET /com/promotions.json?zzz_bogus=x` | 200 | Tham số lạ bị bỏ qua im lặng, không báo lỗi |
| `GET /com/promotions/{id}.json` | 200, bọc trong khoá `promotion` | Đọc một CTKM được |

Header `X-Haravan-Api-Call-Limit` trả `1/80`, khớp với ghi nhận ở giai đoạn 02.

## Hình dạng thật của một CTKM

Bản ghi duy nhất trên store dev, cắt bớt phần không dùng:

```json
{
  "id": 1083826310,
  "name": "Bùng nổ năng lượng hè - Giảm 15%",
  "starts_at": "2026-07-22T08:11:00Z",
  "ends_at": null,
  "value": 10,
  "discount_type": "product_amount",
  "take_type": "percentage",
  "status": "enabled",
  "usage_limit": null,
  "set_time_active": false,
  "products_selection": "product_prerequisite",
  "entitled_variant_ids": [],
  "entitled_product_ids": [1075669621, 1075669619, "... 18 phần tử"],
  "variants": []
}
```

Danh sách trường đầy đủ: `name, ends_at, id, starts_at, value, discount_type,
applies_to_resource, applies_to_quantity, applies_to_id, set_time_active, order_over,
promotion_apply_type, variants, created_at, updated_at, first_name, last_name, create_user,
applies_customer_group_id, status, products_selection, customers_selection, provinces_selection,
channels_selection, locations_selection, entitled_collection_ids, entitled_product_ids,
entitled_variant_ids, entitled_customer_ids, entitled_customer_segment_ids, entitled_province_ids,
entitled_channels, entitled_location_ids, rule_customs, take_type, usage_limit`

## Bốn chỗ lệch với kế hoạch, và cách xử lý

1. **Đường dẫn** — dùng `/com/promotions.json`.
2. **Không có endpoint đếm** — không đối chiếu được tổng số như đồng bộ danh mục. Vòng lặp
   phân trang dừng khi gặp trang ngắn, và học kích thước trang thật từ trang đầu (giống
   `catalog-sync.ts`) thay vì tin giá trị cấu hình.
3. **Máy chủ không lọc** — yêu cầu "giới hạn theo khoảng ngày lấy từ file" phải làm sau khi
   kéo về, lọc trong bộ nhớ. Không giảm được số lượt gọi, chỉ giảm nhiễu ở luật F6.
4. **CTKM đính theo sản phẩm** — bản ghi thật có `entitled_variant_ids` rỗng còn
   `entitled_product_ids` 18 phần tử. Nếu luật F5 chỉ đếm `entitled_variant_ids` thì sẽ báo
   "Excel 18 dòng, Haravan nhận 0" — báo oan. **Đã chốt:** quy đổi cả hai về số biến thể qua
   cache danh mục; cache chưa đồng bộ thì bỏ qua F5 và ghi rõ lý do.

## Ba quyết định đã chốt 2026-08-18

| Vấn đề | Chốt |
|---|---|
| F5 đếm SKU kiểu gì | Quy đổi `entitled_variant_ids` + `entitled_product_ids` về số biến thể qua cache; thiếu cache thì bỏ qua, không kết luận |
| D8/E3 ở màn kiểm tra file | Nối danh sách CTKM vào luôn; gọi API hỏng thì vẫn kiểm tra bình thường, hai luật đó ghi là bỏ qua |
| Cơ chế hai lượt | Lượt 1 không có chương trình nào "không tìm thấy" thì bỏ lượt 2, khỏi chờ 8 giây |

## Câu chưa trả lời được

- `limit` của `/com/promotions.json` có bị ép về 50 không — store dev chỉ có 1 CTKM.
  Cách xử lý hiện tại (học kích thước trang từ trang đầu) an toàn với cả hai khả năng.
- `set_time_active` ảnh hưởng ra sao tới `starts_at`/`ends_at` — bản ghi duy nhất để `false`.
- Múi giờ của `starts_at`: bản ghi trả `2026-07-22T08:11:00Z` tức 15:11 giờ Việt Nam, không
  phải mốc nửa đêm, nên chưa dùng nó để xác nhận quy ước quy đổi được. So sánh vẫn đi qua một
  hàm dùng chung với độ lệch múi giờ lấy từ cấu hình.
