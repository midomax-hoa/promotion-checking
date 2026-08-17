# Giai đoạn 02 — Haravan client & đồng bộ danh mục

## Liên kết bối cảnh

- [Tổng quan kế hoạch](plan.md) · [Giai đoạn 01](phase-01-nen-tang-du-an-va-luoc-do-du-lieu.md)
- [Báo cáo brainstorm](../reports/brainstorm-260817-1019-promotion-import-checking-tool.md) — mục 2 (khảo sát API), mục 6 (chiến lược đồng bộ)

## Tổng quan

- **Ưu tiên:** Cao — luật B và F đều dựa vào dữ liệu ở đây
- **Trạng thái:** ✅ Hoàn thành (2026-08-17)
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

- [x] `types.ts` theo phản hồi API thật
- [x] `rate-limiter.ts` + test
- [x] `haravan-client.ts` có thử lại khi 429 + test
- [x] `catalog-sync.ts` phân trang, ghi theo lô + test
- [x] Đếm SKU rỗng / SKU trùng
- [x] `catalog-index.ts` + test
- [x] Màn hình ③ Đồng bộ danh mục
- [x] Tuyến API chạy đồng bộ có tiến trình
- [x] Chạy thật trên store dev, đối chiếu với `products/count.json`

## Kết quả thực tế (2026-08-17)

Sáu điểm lệch so với kế hoạch, đã xử lý và kiểm chứng:

| Kế hoạch ghi | Thực tế | Cách xử lý |
|---|---|---|
| Test đặt cạnh nguồn, vd `src/lib/haravan/haravan-client.test.ts` | Test đặt ở `test/haravan/`, `test/catalog/`, soi gương theo cấu trúc `src/` | Theo đúng quy ước đã dùng ở giai đoạn 01, không tách hai kiểu trong cùng một kho |
| `haravan.page_size` được phép nhận tới 250 (`positiveInt.max(250)`) | Haravan **ép cứng `limit` về 50** phía máy chủ. Đặt 100 thì trang đầy 50 phần tử bị hiểu nhầm là trang cuối → dừng sớm → `deleteStale` xoá phần còn lại của cache mà vẫn đóng dấu thành công | Chặn hai lớp: kẹp trần cấu hình xuống 50, **và** cho bộ phân trang tự học kích thước trang thật từ trang 1 thay vì tin cấu hình. Có test khẳng định |
| 7 khoá `AppSetting` (giai đoạn 01) | Thêm 3 khoá: `haravan.max_attempts` (mặc định 4), `catalog.cursor_overlap_ms` (mặc định 300000), `catalog.sync_shortfall_tolerance` (mặc định 0) → tổng **10 khoá** | Giữ ngưỡng vận hành ngoài mã nguồn, sửa được ở giai đoạn 07 |
| Duyệt hết trang là coi như đồng bộ xong | Có thể duyệt hết mà vẫn thiếu dữ liệu, không hề ném lỗi nào | Đọc `GET /com/products/count.json` trước, sau khi duyệt xong mà kéo về ít hơn `count − tolerance` thì **ném lỗi trước** khi `deleteStale`, không đóng dấu `lastFullSyncAt` |
| Mốc đồng bộ tăng dần đặt đúng bằng `updated_at` lớn nhất đã thấy | Sản phẩm bị sửa lúc đang đồng bộ, nằm ở trang đã đi qua, sẽ có `updated_at` thấp hơn mốc mới → **vĩnh viễn không được kéo lại** | Lùi mốc lại `catalog.cursor_overlap_ms` (mặc định 5 phút). Kéo trùng vài sản phẩm là vô hại vì ghi theo kiểu xoá-rồi-chèn |
| Lưu `sku` nguyên si | SKU rỗng lưu thành chuỗi rỗng thì "không có SKU" phải kiểm bằng hai điều kiện | Chuẩn hoá rỗng thành `NULL` ngay khi ghi; `bySku` không bao giờ có khoá rỗng |

Kiểm chứng trên store dev (74 sản phẩm, 937 biến thể):
- Full sync: 2 page, page 1 = 50 items, page 2 = 24 items, khớp `GET /com/products/count.json` (74 sản phẩm)
- Thời gian: 0.7–1.1s, trong ngân sách 30s
- SKU: 3 biến thể có SKU rỗng, 0 nhóm SKU trùng lặp, 238 biến thể cha có `published_at = null`
- Đồng bộ tăng dần: 1 sản phẩm (15 biến thể) trong 65ms
- Guard: HTTP 409 khi chạy sync 2 lần đồng thời; HTTP 403 khi POST từ origin khác (Sec-Fetch-Site)
- Build: `npm run typecheck`, `npm run lint`, `npm run build` không lỗi; `npm test` 62 test pass

Đã kiểm chứng thêm **thứ tự trả về của `products.json`: sắp theo `id` giảm dần** (soi đủ 74 sản phẩm qua 2 trang ngày 2026-08-17), không phải theo `updated_at` như từng lo. Nhờ vậy sửa sản phẩm giữa chừng không làm trượt trang; sản phẩm mới tạo giữa chừng nhận `id` lớn hơn nên chen lên đầu, chỉ khiến một sản phẩm bị kéo lại hai lần chứ không bị bỏ sót — mà ghi trùng thì vô hại. Ghi chú này nằm trong `src/lib/haravan/types.ts`.

**Ngân sách 30 giây cho 3.000 sản phẩm chưa kiểm chứng** — store dev chỉ có 74 sản phẩm. Ước tính: 3.000 sản phẩm ≈ 60 trang, ở nhịp 3 lượt/giây thì riêng phần điều tiết nhịp đã khoảng 20 giây, biên an toàn khá mỏng. Nếu chạy thật bị chậm thì có hai đòn bẩy: nâng `haravan.requests_per_second` (đã cho phép tới 4), hoặc nới cửa sổ tải trước.

## Tiêu chí hoàn thành

- Đồng bộ store dev xong, số sản phẩm khớp `GET /com/products/count.json` ✓
- Đồng bộ 3.000 sản phẩm dưới 30 giây — *chưa kiểm chứng trên live store*
- Mô phỏng 429 trong test → client chờ rồi thử lại, **không** báo là dữ liệu sai ✓
- Màn hình ③ hiện đúng thời điểm đồng bộ và cảnh báo khi cache cũ ✓
- Không có đường đi nào cho phép gửi `?sku=` rỗng (có test khẳng định điều này) ✓

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

## Giới hạn đã biết

| Giới hạn | Tác động | Hướng xử lý |
|---|---|---|
| Đồng bộ tăng dần không thấy sản phẩm bị xoá | Sản phẩm đã xoá trên Haravan vẫn nằm trong cache, luật B1 tưởng là còn tồn tại | Chạy đồng bộ đầy đủ định kỳ — chỉ lượt đầy đủ mới dọn các dòng không được chạm tới trong lượt đó |
| Biến thể chuyển từ sản phẩm A sang B mà Haravan không cập nhật `updated_at` của B | Ở lượt tăng dần, trang chứa A xoá luôn dòng của biến thể đó rồi chèn lại A không có nó → biến thể biến mất khỏi cache, luật B1 báo oan | **Chưa kiểm chứng được** Haravan có cập nhật `updated_at` của B hay không (cần tạo dữ liệu thử, mà công cụ này chỉ đọc). Đồng bộ đầy đủ khắc phục được |
| `duplicateSkuCount` đếm **số nhóm** SKU trùng, không phải số biến thể dính trùng | Giai đoạn 04 luật B5 phải chọn dùng con số nào | Chốt khi làm B5; đổi câu SQL đếm là xong |
| `catalog-store.ts` ghi `price: variant.price ?? 0` | Giá thiếu thành 0 thay vì "không biết"; giai đoạn 04 so tiền có thể so nhầm với 0 | Store dev luôn trả `price` là số nên chưa gặp. Muốn phân biệt thì phải đổi cột sang `Float?`, cần migration — quyết trước khi làm nhóm luật C |
| Ba điểm nhỏ từ đợt rà soát mã nguồn | `noteHeader` chỉ dốc cạn bình chứa của mình chứ chưa giãn nhịp theo tốc độ rỉ của máy chủ; `catalog-index` không gộp các lượt nạp trùng lúc cache lạnh; `MAX_BACKOFF_MS` cố định 30 giây nên `Retry-After` lớn hơn không được tôn trọng trọn vẹn | Hiện không ảnh hưởng vì chỉ chạy 3 lượt/giây, dưới mức rỉ 4/giây, và mỗi lúc chỉ một lượt đồng bộ. Xem lại khi giai đoạn 06 có thêm bên gọi thứ hai |

## Việc chuyển tiếp cho giai đoạn sau

**Giai đoạn 03 (độc lập với phase này):** có thể chạy song song; kết quả là mô hình `PromotionProgram[]` để phase 04 dùng.

**Giai đoạn 04 (bộ máy luật):** `CatalogIndex` sẵn sàng, `bySku(sku)` trả `CatalogEntry[]` (mảng vì SKU có thể trùng). Nhóm B dùng để kiểm SKU tồn tại, phát hiện SKU trùng, và truy các trường `price`, `publishedAt`, `notAllowPromotion`.

**Giai đoạn 06 (màn đối soát):** `promotion-fetcher.ts` **chưa viết** — kế hoạch có nêu trong phần Kiến trúc nhưng danh sách việc thì không, và chỉ giai đoạn 06 mới dùng tới. Viết khi làm giai đoạn 06, dùng lại `HaravanClient` sẵn có.

**Việc cần kiểm chứng trước khi đi tiếp:**
- [ ] Chạy đồng bộ đầy đủ trên store thật có vài nghìn sản phẩm, đo thời gian so với ngân sách 30 giây
- [x] ~~Xác định thứ tự sắp xếp của `products.json`~~ — đã đo 2026-08-17: **`id` giảm dần**
- [ ] Xác nhận Haravan có cập nhật `updated_at` của sản phẩm đích khi biến thể chuyển sản phẩm hay không

## Bước kế tiếp

Mở khoá giai đoạn 03 (Đọc Excel) và 04 (Bộ máy luật). Giai đoạn 03 độc lập; giai đoạn 04 chờ 03 + 02 (đã xong).
