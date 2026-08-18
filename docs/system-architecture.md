# Kiến trúc hệ thống

Công cụ web nội bộ kiểm tra file Excel khuyến mãi **trước khi import** lên Haravan, và đối soát kết quả **sau khi import**.

Kế hoạch chi tiết theo từng giai đoạn nằm ở [`plans/260817-1233-promotion-import-checking-tool/plan.md`](../plans/260817-1233-promotion-import-checking-tool/plan.md). Tài liệu này chỉ mô tả cái đã dựng thật.

## Nguyên tắc xuyên suốt

1. **Chỉ đọc Haravan.** Toàn bộ công cụ chỉ dùng `GET`. Việc import do phần mềm khác đảm nhiệm.
2. **Chỉ cảnh báo, không chặn.** Liệt kê hết phát hiện, người dùng tự quyết.
3. **Không chôn cứng giá trị nghiệp vụ.** Mọi ngưỡng nằm ở bảng `AppSetting`, sửa được trên giao diện (giai đoạn 07).
4. **Render phía máy chủ.** Lọc, sắp xếp, phân trang làm ở server.
5. Mỗi file mã nguồn dưới 200 dòng, tên file kebab-case.

## Công nghệ

| Thành phần | Lựa chọn |
|---|---|
| Khung web | Next.js 15 App Router + TypeScript |
| CSDL | PostgreSQL qua Prisma 7 (driver adapter `@prisma/adapter-pg`) |
| Excel | `exceljs` |
| Giao diện | Tailwind v4 + shadcn/ui |
| Kiểm thử | Vitest |

Máy phát triển nối PostgreSQL 18 chạy trong WSL, CSDL `promotion_checking`. Mọi lệnh `psql` gọi qua WSL, không cài PostgreSQL riêng trên Windows.

## Bố cục mã nguồn

```
src/
  app/
    dong-bo/            # màn hình ③ Đồng bộ danh mục
    api/sync/route.ts   # chạy đồng bộ, phát tiến trình dạng NDJSON
  lib/
    haravan/            # tầng gọi API và đồng bộ
    catalog/            # cache danh mục và tra cứu SKU
    excel/              # đọc và chuẩn hoá file khuyến mãi
    config/             # đọc AppSetting có kiểm tra kiểu
    db/prisma.ts        # Prisma client khởi tạo trễ
    rules/              # danh mục 37 luật kiểm tra
    serialization/      # chuyển BigInt qua ranh giới server ↔ trình duyệt
prisma/                 # schema, migration, seed
test/                   # soi gương theo cấu trúc src/
```

## Tích hợp Haravan

### Sự thật đã kiểm chứng bằng gọi thật (2026-08-17)

Tài liệu chính chủ của Haravan **không khớp API thật** ở nhiều chỗ, nên mọi kiểu dữ liệu trong `src/lib/haravan/types.ts` đều viết theo phản hồi thật.

| Hạng mục | Kết quả đo được |
|---|---|
| `limit` khi phân trang | **Bị ép cứng về 50** dù truyền 250 |
| Thứ tự `products.json` | **`id` giảm dần** — không phải `updated_at` |
| `page` | Các trang rời nhau, không chồng lấn |
| `updated_at_min` | Hoạt động đúng, dùng cho đồng bộ tăng dần |
| Giới hạn nhịp | Bình chứa 80, rỉ 4 lượt/giây, header `X-Haravan-Api-Call-Limit: <đã dùng>/<sức chứa>` |
| Vượt giới hạn | Trả 429 kèm `Retry-After` |
| `products.json?sku=` khi giá trị **rỗng** | **Trả về 50 sản phẩm bất kỳ**, không báo lỗi |
| `discount_type` | Tài liệu ghi `fixed_amount`/`percentage`, API thật trả `product_amount` + `take_type` |

Vì sao thứ tự sắp xếp quan trọng: `id` giảm dần nghĩa là sửa sản phẩm giữa chừng không làm trượt trang. Sản phẩm mới tạo giữa chừng nhận `id` lớn hơn nên chen lên đầu, chỉ khiến một sản phẩm bị kéo lại hai lần — mà ghi trùng thì vô hại vì ghi theo kiểu xoá-rồi-chèn.

### Tầng gọi API

```
rate-limiter.ts   → bình chứa token, đồng hồ tiêm được từ ngoài để test
haravan-errors.ts → phân loại lỗi
haravan-client.ts → chỉ GET, gắn Bearer token, thử lại khi 429/5xx
types.ts          → kiểu dữ liệu theo phản hồi thật
```

**Điều tiết nhịp.** Bình chứa token nạp lại theo `haravan.requests_per_second` (mặc định 3, dưới mức rỉ 4/giây cho an toàn). Mỗi phản hồi đưa header `X-Haravan-Api-Call-Limit` ngược vào `noteHeader`; khi bình chứa phía máy chủ vượt 80% thì bình chứa phía mình bị dốc cạn để giãn nhịp. **Mỗi địa chỉ API dùng chung một bộ điều tiết** cho cả tiến trình — Haravan đếm lượt gọi theo cửa hàng, không theo từng đối tượng client.

**Phân loại lỗi.** Đây là điểm mấu chốt: một lượt 429 là chuyện giới hạn nhịp, **không phải dữ liệu sai**, và phải không bao giờ bị báo nhầm thành lỗi dữ liệu.

| Lớp lỗi | Khi nào |
|---|---|
| `HaravanRateLimitError` | 429 sau khi hết lượt thử lại |
| `HaravanApiError` | Phản hồi không phải 2xx khác, kèm mã và nội dung |
| `HaravanNetworkError` | Lỗi mạng sau khi hết lượt thử lại |
| `HaravanBlankQueryError` | Có tham số truy vấn rỗng — chặn **trước khi** gửi đi |
| `HaravanRawQueryError` | Đường dẫn đã tự chứa sẵn `?...` — chặn để không lách được chốt trên |
| `HaravanTokenMissingError` | Thiếu `HARAVAN_API_TOKEN` |

**Thử lại.** Tối đa `haravan.max_attempts` lượt (mặc định 4). Gặp 429 hoặc 5xx thì chờ theo `Retry-After`, không có thì giãn cách luỹ tiến 500ms → 1s → 2s. Lỗi 4xx khác không thử lại.

### Đồng bộ danh mục

```
catalog-sync.ts     → duyệt trang, kiểm tra tính trọn vẹn
sync-cursor.ts      → tính mốc cho lượt đồng bộ tăng dần
run-catalog-sync.ts → ráp client thật + kho lưu thật + cấu hình
catalog-store.ts    → ghi xuống Prisma, tính số liệu thống kê
```

**Vì sao phải có cache.** Kiểm tra một SKU có tồn tại hay không **bắt buộc đọc cache**, không bao giờ gọi API từng SKU: 3.929 lượt gọi lẻ mất khoảng 20 phút và không phân biệt được lỗi giới hạn nhịp với "SKU không tồn tại" — đúng cái cách làm khiến dữ liệu mất mà không ai hay.

**Luồng chạy một lượt đồng bộ đầy đủ:**

1. Đọc `GET /com/products/count.json` để biết trước phải kéo về bao nhiêu sản phẩm.
2. Duyệt `GET /com/products.json` từ trang 1, kèm `fields` chọn sẵn các cột cần dùng.
3. **Kích trang kế tiếp trước, rồi mới ghi trang hiện tại xuống CSDL** — cho phần ghi đè lên phần chờ mạng thay vì cộng dồn.
4. Dừng khi trang rỗng, hoặc ngắn hơn kích thước trang **thật** học được từ trang 1.
5. Kéo về ít hơn `count − dung sai` thì **ném lỗi ngay**, trước khi dọn dẹp.
6. Xoá các dòng không được chạm tới trong lượt này (sản phẩm đã bị xoá trên Haravan).
7. Tính lại số liệu và đóng dấu `lastFullSyncAt`.

**Vì sao học kích thước trang từ trang 1.** Haravan ép `limit` về 50. Nếu cấu hình đặt 100 thì một trang đầy 50 phần tử sẽ bị hiểu nhầm là trang cuối → dừng sớm → bước dọn dẹp xoá sạch phần còn lại của cache mà vẫn đóng dấu thành công. Chặn hai lớp: kẹp trần cấu hình xuống 50, **và** không tin cấu hình mà đo từ trang đầu.

**Đồng bộ tăng dần** truyền `updated_at_min` lấy từ `SyncState.lastCursor`, không dọn dẹp, không đóng dấu `lastFullSyncAt`. Mốc mới **lùi lại** `catalog.cursor_overlap_ms` (mặc định 5 phút): sản phẩm bị sửa lúc lượt đồng bộ đã đi qua trang của nó sẽ có `updated_at` thấp hơn mốc mới và vĩnh viễn không được kéo lại. Kéo trùng vài sản phẩm là vô hại.

**Cách ghi.** Một trang ghi bằng xoá-rồi-chèn trong một giao dịch: hai câu lệnh mỗi trang thay vì một `upsert` cho mỗi biến thể. Câu xoá quét theo cả `productId` (bắt biến thể đã bị gỡ khỏi sản phẩm) lẫn `variantId` (bắt biến thể chuyển sang sản phẩm khác).

### Tra cứu SKU

`catalog-index.ts` nạp toàn bộ cache vào `Map`, có bộ nhớ đệm trong tiến trình 60 giây.

- Khoá tra cứu là SKU đã chuẩn hoá; giá trị là **mảng** vì Haravan cho phép SKU trùng giữa các biến thể (luật B5 sẽ cảnh báo).
- SKU rỗng đếm riêng, không bao giờ vào chỉ mục.
- Bộ nhớ đệm bị xoá ngay sau mỗi lượt đồng bộ.

## Tầng đọc Excel (giai đoạn 03)

Một đầu mối duy nhất: `readPromotionWorkbook(bytes, fileName)` trong `src/lib/excel/promotion-workbook.ts` → `WorkbookReadResult`.

```
bytes → kiểm chữ ký đầu tệp + giới hạn 20 MB
      → excel-reader   đọc mọi sheet, giữ số dòng thật, băm SHA-256
      → column-mapper  dò cột theo từ khoá, không phụ thuộc vị trí
      → row-normalizer dòng thô → PromotionRow, ghi issues cho ô hỏng
      → program-grouper gom theo Tên ctkm
```

### Nguyên tắc: không bao giờ thay thầm lặng

Ô không đọc được thì để `null` và ghi vào `issues`, tuyệt đối không thay bằng giá trị mặc định. Phân biệt rõ **ô trống** (`missing`) với **ô rác** (`unparsable-*`): `Số dư` trống nghĩa là không giới hạn, còn `Số dư = "abc"` là gõ sai. Lỗi công thức (`#DIV/0!`) được giữ nguyên dạng chuỗi để lộ ra thành cảnh báo, không quy về rỗng.

Sheet thiếu cột bắt buộc thì ghi vào `missingRequiredColumns` rồi bỏ qua, **không ném lỗi** — sheet hướng dẫn là chuyện bình thường, và người dùng vẫn cần thấy nó đã được tìm thấy.

### An toàn múi giờ

`exceljs` trả ngày ở mốc **nửa đêm UTC**. Đọc bằng `getDate()` ở múi giờ âm sẽ ra ngày hôm trước — chương trình khuyến mãi chạy sớm 24 giờ. Mọi đường phân tích ngày đều **dựng lại `Date` từ thành phần lịch UTC**, nên ngày người soạn gõ vào là ngày được giữ, bất kể múi giờ máy chủ. Có test chạy dưới `TZ=America/New_York` để khẳng định.

### Ba lỗi của `exceljs` đã né

Đối chiếu với XML gốc của file mẫu, **mỗi bộ đọc sai một kiểu**:

| Ô | Giá trị thật trong XML | Bộ đọc luồng | Bộ đọc buffered |
|---|---|---|---|
| `Key!I51` | `<v>0</v>` | `0` ✅ | mất luôn số `0` ❌ |
| `Key!C801` | `Quả bóng chuyền trẻ em…` | hỏng thành `tr??em` ❌ | đúng ✅ |

1. **Buffered đánh rơi kết quả `0` của ô công thức chia sẻ** — trúng 279 ô, tức toàn bộ chương trình `2608GST0K`. Vì vậy **bộ đọc luồng là nguồn giá trị duy nhất**.
2. **Luồng làm hỏng ký tự UTF-8 vắt qua ranh giới chunk** (`lib/utils/parse-sax.js:21` giải mã từng chunk riêng, không dùng `StringDecoder`). Phát hiện `U+FFFD` thì đọc thêm buffered và **chỉ thay riêng chuỗi hỏng** — số liệu không bao giờ lấy từ buffered.
3. **Luồng sập với file do chính `exceljs` ghi** (`workbook-reader.js:303`, `xl/workbook.xml` nằm cuối zip nên `this.model` chưa khởi tạo). Có đường lui sang buffered.

Cả ba đều có test khoá lại, nên khi nâng `exceljs` mà lỗi nào được sửa thì test sẽ báo chứ không trôi qua âm thầm.

### Số đo

| Hạng mục | Kết quả |
|---|---|
| Đọc trọn file thật, kể cả bước vá chữ | ~1.100–1.300 ms (ngưỡng: dưới 2 giây) |
| Riêng bộ đọc luồng | ~100 ms |
| Bước vá chữ | ~1.000 ms, chỉ chạy khi phát hiện chữ hỏng |

## Dữ liệu

Sáu bảng, khai đầy đủ ở [`prisma/schema.prisma`](../prisma/schema.prisma):

| Bảng | Vai trò |
|---|---|
| `VariantCache` | Cache danh mục, khoá chính `variantId` (không phải `sku`, vì SKU trùng và rỗng đều có thật) |
| `SyncState` | Một dòng duy nhất: mốc đồng bộ, số liệu thống kê |
| `CheckRun` / `Finding` | Lịch sử kiểm tra và từng phát hiện |
| `RuleConfig` | 37 luật, bật/tắt và ngưỡng riêng |
| `AppSetting` | Ngưỡng dùng chung toàn ứng dụng |

`price` lưu kiểu `Float`. Tiền VND là số nguyên dưới 10⁹ nên `double` biểu diễn chính xác; mọi phép so tiền vẫn dùng ngưỡng sai số `check.money_tolerance_vnd`.

## Cấu hình

`AppSetting` hiện có 10 khoá. Mọi giá trị đọc qua `getAppConfig()`, kiểm bằng `zod` và có giá trị dự phòng — ô trống hay giá trị vô nghĩa rơi về mặc định chứ không lọt số 0 vào bộ điều tiết nhịp hay bộ phân trang.

| Khoá | Mặc định | Ràng buộc | Ý nghĩa |
|---|---|---|---|
| `catalog.max_age_hours` | 24 | 1…8760 | Cache cũ hơn thì cảnh báo |
| `catalog.cursor_overlap_ms` | 300000 | 0…86400000 | Lùi mốc đồng bộ tăng dần |
| `catalog.sync_shortfall_tolerance` | 0 | 0…10000 | Số sản phẩm được phép thiếu so với `count.json` |
| `haravan.api_base` | `https://apis.haravan.com` | bắt buộc `https` và thuộc `haravan.com` | |
| `haravan.page_size` | 50 | 1…**50** | Haravan ép cứng 50 |
| `haravan.requests_per_second` | 3 | >0…4 | Dưới mức rỉ 4/giây |
| `haravan.max_attempts` | 4 | 1…10 | Số lượt thử một lời gọi |
| `reconcile.recheck_delay_ms` | 8000 | 1…120000 | Chờ giữa hai lần kiểm chống trễ chỉ mục |
| `report.max_rows_per_page` | 100 | 1…1000 | Phân trang bảng kết quả |
| `check.money_tolerance_vnd` | 0.5 | >0…1000 | Ngưỡng sai số khi so tiền |

`haravan.api_base` bị ràng buộc tên miền có lý do: token được gắn vào mọi lượt gọi tới địa chỉ này, nếu sửa tự do thì ai vào được màn cấu hình là chuyển hướng được token ra máy chủ lạ.

## Tuyến API

### `POST /api/sync`

Chạy đồng bộ, phát tiến trình dạng NDJSON — mỗi dòng một đối tượng JSON. Lượt đồng bộ đầy đủ mất hàng chục giây nên phản hồi JSON thường sẽ để màn hình trắng suốt thời gian đó.

Thân yêu cầu: `{ "full": true }` cho đồng bộ đầy đủ, còn lại là tăng dần.

Các dòng phát ra: `{type:'start'}` → nhiều `{type:'progress'}` → `{type:'done'}` hoặc `{type:'error'}`.

Chốt chặn:

- **Một lượt đồng bộ tại một thời điểm** trong mỗi tiến trình, trùng thì trả 409.
- **Yêu cầu khác nguồn bị từ chối** qua header `Sec-Fetch-Site`, trả 403 — biểu mẫu gửi chéo trang là yêu cầu đơn giản nên vẫn đốt được giới hạn nhịp dù không đọc được phản hồi.
- Trình duyệt ngắt kết nối thì lượt đồng bộ **vẫn chạy tiếp** cho tới hết, để CSDL không bị bỏ dở nửa chừng.
- Lỗi ghi đầy đủ vào log máy chủ; trình duyệt chỉ nhận thông báo của các lớp lỗi trong danh sách cho phép — lỗi Prisma hay driver chứa tên máy chủ CSDL nên bị thay bằng câu chung.

## Bảo mật

- `HARAVAN_API_TOKEN` chỉ đọc phía máy chủ, không có tiền tố `NEXT_PUBLIC_`, chỉ đọc ở đúng một chỗ trong `haravan-client.ts`.
- Token bị thay bằng `***` trong nội dung phản hồi nhúng vào thông báo lỗi — biến lời hứa thành ràng buộc thật, không phải quy ước.
- `BigInt` chuyển thành chuỗi tại ranh giới server ↔ trình duyệt (`src/lib/serialization/bigint.ts`). `SyncResult` không mang `BigInt` nào.
- Không có lệnh ghi nào lên Haravan trong toàn bộ mã nguồn.

## Số liệu đo được (store dev, 2026-08-17)

| Chỉ số | Giá trị |
|---|---|
| `GET /com/products/count.json` | 74 |
| Đồng bộ đầy đủ | 74 sản phẩm / 937 biến thể, 2 trang, 0,7–1,1 giây — **khớp chính xác** |
| Đồng bộ tăng dần | 1 sản phẩm / 15 biến thể, 65 mili giây |
| Biến thể có SKU rỗng | 3 |
| Nhóm SKU trùng | 0 |
| Biến thể có sản phẩm cha `published_at = null` | 238 |

**Chưa kiểm chứng:** ngân sách 30 giây cho 3.000 sản phẩm — store dev chỉ có 74. Ước tính 3.000 sản phẩm ≈ 60 trang, ở nhịp 3 lượt/giây thì riêng phần điều tiết đã khoảng 20 giây, biên an toàn mỏng. Đòn bẩy nếu chậm: nâng `haravan.requests_per_second` (cho phép tới 4), hoặc nới cửa sổ tải trước.

## Giới hạn đã biết

- Đồng bộ tăng dần không thấy sản phẩm bị xoá — chạy đồng bộ đầy đủ định kỳ, màn hình ③ có sẵn nút.
- Biến thể chuyển từ sản phẩm A sang B có thể biến mất khỏi cache tới lượt đồng bộ đầy đủ kế tiếp, nếu Haravan không cập nhật `updated_at` của B. **Chưa kiểm chứng được** vì công cụ này chỉ đọc.
- `duplicateSkuCount` đếm số **nhóm** SKU trùng, không phải số biến thể dính trùng.
