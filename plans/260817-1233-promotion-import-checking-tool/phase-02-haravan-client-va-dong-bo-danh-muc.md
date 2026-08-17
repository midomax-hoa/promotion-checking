# Giai đoạn 02 — Haravan client & đồng bộ danh mục

## Liên kết bối cảnh

- [Tổng quan kế hoạch](plan.md) · [Giai đoạn 01](phase-01-nen-tang-du-an-va-luoc-do-du-lieu.md)
- [Báo cáo brainstorm](../reports/brainstorm-260817-1019-promotion-import-checking-tool.md) — mục 2 (khảo sát API), mục 6 (chiến lược đồng bộ)

## Tổng quan

- **Ưu tiên:** Cao — luật B và F đều dựa vào dữ liệu ở đây
- **Trạng thái:** Chưa làm
- Xây tầng gọi API Haravan có kiểm soát nhịp, kéo toàn bộ danh mục về cache, và làm màn hình ③ Đồng bộ danh mục.

## Nhận định quan trọng

Toàn bộ đã kiểm chứng bằng gọi thật, **không suy đoán từ tài liệu**:

- `limit` **bị ép về 50** dù truyền 250 → luôn phân trang 50.
- Giới hạn nhịp: bucket 80, rỉ **4 req/giây**, header `X-Haravan-Api-Call-Limit` dạng `32/80`, khi vượt trả 429 kèm `Retry-After`.
- `products.json?sku=` **khớp chính xác**; nhưng `sku=` rỗng **trả về 50 sản phẩm bất kỳ** → phải chặn cứng, tuyệt đối không gửi truy vấn SKU rỗng.
- Biến thể có thể có `sku = null`; SKU cũng có thể trùng giữa các biến thể.
- Tài liệu ghi `discount_type` là `fixed_amount`/`percentage` nhưng API thật trả `product_amount` + `take_type`.

### Trường của sản phẩm — đã kiểm chứng trên store dev

Đều chọn được qua tham số `fields`:

| Trường | Kiểu | Ghi nhận thực tế | Dùng cho |
|---|---|---|---|
| `published_at` | ngày hoặc `null` | **24/74 sản phẩm đang `null`** = chưa đăng bán | Luật B2 |
| `not_allow_promotion` | boolean | Store dev toàn `false`; **chưa kiểm chứng được Haravan xử lý ra sao khi bật** | Luật B6 |
| `published_scope` | `'global'` \| `'pos'` \| `null` | 50 global · 23 pos · 1 null | Ngoài phạm vi — đã chốt không đối soát kênh bán |
| `only_hide_from_list` | boolean | Toàn `false` | Chưa dùng |

Cả bốn trường đều phải lưu vào `VariantCache` (hoặc bảng sản phẩm kèm theo) ngay từ giai đoạn này, kể cả trường chưa dùng tới — kéo lại toàn bộ danh mục chỉ vì thiếu một cột thì rất phí.

**Điểm mấu chốt:** kiểm tra SKU tồn tại phải dựa vào **cache**, không gọi API từng SKU. Lý do: 3.929 SKU gọi lẻ mất khoảng 20 phút và không phân biệt được lỗi giới hạn nhịp với "SKU không tồn tại" — đây chính là cách sai lầm khiến dữ liệu bị mất mà không ai biết.

## Yêu cầu

**Chức năng**
- Đồng bộ đầy đủ: duyệt hết `products.json`, lưu mọi biến thể vào `VariantCache`
- Đồng bộ tăng dần theo `updated_at_min` dựa trên `SyncState.lastCursor`
- Màn hình ③ hiện: thời điểm đồng bộ gần nhất, số sản phẩm/biến thể, số SKU rỗng, số SKU trùng, nút chạy đồng bộ, thanh tiến trình
- Cảnh báo nổi bật khi cache cũ hơn `catalog.max_age_hours`

**Phi chức năng**
- Đồng bộ 3.000 sản phẩm hoàn tất dưới 30 giây
- Gặp 429 phải chờ theo `Retry-After` rồi thử lại, **không** coi là lỗi dữ liệu
- Bốn lần thử thất bại liên tiếp mới dừng, và phải báo rõ đã dừng ở trang nào

## Kiến trúc

```
src/lib/haravan/
  haravan-client.ts       # fetch có xác thực, đọc header nhịp, thử lại khi 429
  rate-limiter.ts         # bộ điều tiết dạng token bucket
  catalog-sync.ts         # duyệt trang, ghi vào VariantCache
  promotion-fetcher.ts    # kéo CTKM (giai đoạn 06 dùng)
  types.ts                # kiểu dữ liệu phản hồi thật, KHÔNG theo tài liệu
src/lib/catalog/
  catalog-index.ts        # nạp cache ra Map để tra cứu tức thì
src/app/dong-bo/page.tsx  # màn hình ③
src/app/api/sync/route.ts # chạy đồng bộ, phát tiến trình
```

### Hợp đồng chính

```ts
// rate-limiter.ts — mặc định 3 req/s, đọc từ AppSetting
export function createRateLimiter(perSecond: number): {
  acquire(): Promise<void>
  noteHeader(header: string | null): void   // đọc "32/80", tự giảm tốc khi gần đầy
}

// haravan-client.ts
export class HaravanClient {
  get<T>(path: string, query?: Record<string, string | number>): Promise<T>
  // Ném HaravanRateLimitError khi hết lượt thử lại
  // Ném HaravanApiError kèm status + body cho các lỗi khác
}

// catalog-sync.ts
export type SyncProgress = {
  page: number; products: number; variants: number; done: boolean
}
export async function syncCatalog(
  opts: { full: boolean; onProgress?: (p: SyncProgress) => void }
): Promise<SyncResult>

// catalog-index.ts
export type CatalogEntry = {
  variantId: bigint; productId: bigint; sku: string
  productTitle: string; variantTitle: string | null
  price: number; publishedAt: Date | null
}
export type CatalogIndex = {
  bySku: Map<string, CatalogEntry[]>   // mảng vì SKU có thể trùng
  allSkus: string[]                    // phục vụ gợi ý SKU gần giống
  syncedAt: Date | null
}
```

### Quy tắc chuẩn hoá SKU

Dùng thống nhất ở mọi nơi: `sku.trim().toLowerCase()`. Bản gốc vẫn lưu nguyên để hiển thị. SKU rỗng sau khi chuẩn hoá thì **bỏ qua và đếm riêng**, không bao giờ đưa vào truy vấn.

## File liên quan

**Tạo mới:** toàn bộ file trong phần Kiến trúc, kèm test `src/lib/haravan/*.test.ts`, `src/lib/catalog/catalog-index.test.ts`
**Sửa:** `src/app/layout.tsx` (thêm điều hướng)

## Các bước thực hiện

1. Viết `types.ts` bám đúng phản hồi thật đã ghi nhận ở báo cáo brainstorm mục 2 và bảng trường sản phẩm bên dưới
2. Viết `rate-limiter.ts`: token bucket, nạp lại theo `requests_per_second`; `noteHeader` phân tích `X-Haravan-Api-Call-Limit`, khi tỉ lệ vượt 80% thì chủ động giãn nhịp
3. Viết `haravan-client.ts`: header `Authorization: Bearer`, thử lại tối đa 4 lần khi gặp 429/5xx theo `Retry-After` và giãn cách luỹ tiến; ném lỗi có phân loại rõ
4. Viết `catalog-sync.ts`: duyệt `page` từ 1, `limit=50`, `fields=id,title,published_at,published_scope,not_allow_promotion,variants`; dừng khi trang trả về ít hơn 50 phần tử; ghi theo lô bằng transaction; cập nhật `SyncState`
5. Đếm và lưu `blankSkuCount`, `duplicateSkuCount` trong lúc đồng bộ
6. Viết `catalog-index.ts`: nạp toàn bộ `VariantCache` vào Map, có bộ nhớ đệm trong tiến trình kèm thời hạn ngắn
7. Làm `src/app/dong-bo/page.tsx` — Server Component đọc `SyncState`, hiện số liệu và cảnh báo cache cũ
8. Làm `src/app/api/sync/route.ts` — chạy đồng bộ, phát tiến trình qua luồng streaming
9. Viết test: bộ điều tiết nhịp, xử lý 429, phân trang dừng đúng chỗ, chuẩn hoá SKU
10. Chạy đồng bộ thật trên store dev, đối chiếu số sản phẩm với `products/count.json`

## Danh sách việc

- [ ] `types.ts` theo phản hồi API thật
- [ ] `rate-limiter.ts` + test
- [ ] `haravan-client.ts` có thử lại khi 429 + test
- [ ] `catalog-sync.ts` phân trang, ghi theo lô + test
- [ ] Đếm SKU rỗng / SKU trùng
- [ ] `catalog-index.ts` + test
- [ ] Màn hình ③ Đồng bộ danh mục
- [ ] Tuyến API chạy đồng bộ có tiến trình
- [ ] Chạy thật trên store dev, đối chiếu với `products/count.json`

## Tiêu chí hoàn thành

- Đồng bộ store dev xong, số sản phẩm khớp `GET /com/products/count.json`
- Đồng bộ 3.000 sản phẩm dưới 30 giây
- Mô phỏng 429 trong test → client chờ rồi thử lại, **không** báo là dữ liệu sai
- Màn hình ③ hiện đúng thời điểm đồng bộ và cảnh báo khi cache cũ
- Không có đường đi nào cho phép gửi `?sku=` rỗng (có test khẳng định điều này)

## Đánh giá rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Truy vấn `?sku=` rỗng trả về 50 sản phẩm bất kỳ, gây gắn nhầm sản phẩm | Chặn ngay trong `haravan-client`; có test khẳng định |
| Gặp 429 giữa chừng làm cache thiếu dữ liệu | Thử lại theo `Retry-After`; nếu vẫn thất bại thì **không** cập nhật `lastFullSyncAt` và báo rõ đồng bộ chưa trọn vẹn |
| SKU trùng giữa nhiều biến thể | `bySku` trả về mảng; luật B5 sẽ cảnh báo |
| Đồng bộ tăng dần bỏ sót sản phẩm bị xoá | Đồng bộ đầy đủ định kỳ; màn hình ③ có nút "đồng bộ lại từ đầu" |

## Cân nhắc bảo mật

- Token chỉ tồn tại phía máy chủ; tuyến API không bao giờ trả token về trình duyệt
- Thông báo lỗi hiển thị cho người dùng phải lược bỏ header xác thực
- Chỉ dùng phương thức `GET` trong toàn bộ giai đoạn này

## Bước kế tiếp

Giai đoạn 04 dùng `CatalogIndex` cho nhóm luật B. Giai đoạn 06 dùng `promotion-fetcher.ts`.
