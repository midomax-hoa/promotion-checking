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
    page.tsx            # màn hình ① Tải file lên và kiểm tra
    ket-qua/[runId]/    # màn hình ② Kết quả một lần chạy
    lich-su/            # danh sách các lần đã kiểm tra
    dong-bo/            # màn hình ③ Đồng bộ danh mục
    doi-soat/           # màn hình ⑤ và ⑥ Đối soát sau import
    cau-hinh/           # màn hình ⑦ Cấu hình luật, kèm Server Action
    dang-nhap/          # màn hình đăng nhập, kèm Server Action đăng nhập/đăng xuất
    api/check/          # nhận file tải lên; tuyến con export trả file báo cáo
    api/sync/route.ts   # chạy đồng bộ, phát tiến trình dạng NDJSON
    api/reconcile/      # chạy đối soát, phát tiến trình dạng NDJSON
  components/shell/     # khung dùng chung: sidebar (client), danh sách màn, PageShell
  components/theme/     # script chống nháy chạy trong <head> và nút chuyển chủ đề
  components/check/     # thành phần của màn kiểm tra, chỉ upload-panel chạy ở trình duyệt
  components/reconcile/ # bảng so ba cột và bộ chạy đối soát
  components/config/    # bảng luật, ô nhập ngưỡng, công tắc theo nhóm, mục lục nhóm
  middleware.ts         # chốt chặn vòng ngoài: chưa có cookie phiên thì đá về màn đăng nhập
  lib/
    theme.ts            # khoá localStorage và cách quy đổi lựa chọn chủ đề ra lớp CSS
    auth/               # đăng nhập: băm mật khẩu, phiên, chốt chặn thật
    haravan/            # tầng gọi API và đồng bộ
    catalog/            # cache danh mục và tra cứu SKU
    excel/              # đọc, chuẩn hoá và xuất file khuyến mãi
    check/              # điều phối một lần kiểm tra, lưu trữ và truy vấn kết quả
    reconcile/          # đối soát hai lượt và 6 luật nhóm F
    config/             # đọc AppSetting có kiểm tra kiểu, và lược đồ màn cấu hình
    db/prisma.ts        # Prisma client khởi tạo trễ
    rules/              # danh mục 37 luật, bộ máy chạy luật, 31 luật nhóm A–E
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

**Thử lại — hai ngân sách tách bạch.** Lỗi mạng và 5xx là dấu hiệu có thứ hỏng thật nên bỏ cuộc sau `haravan.max_attempts` lượt (mặc định 4). Riêng 429 chỉ cần chờ là qua, nên có ngân sách riêng lớn hơn hẳn: `haravan.rate_limit_max_attempts` (mặc định 30), mỗi lần chờ theo mức **lớn hơn** giữa `Retry-After` và giãn cách luỹ tiến 500ms → 1s → 2s… trần 30 giây — `Retry-After` chỉ là sàn, vì chính header của endpoint này đã được đo là báo thiếu mức chặn thật. Lỗi 4xx khác không thử lại. Tách vậy vì đo trên shop thật 19/8/26: `/com/promotions.json` bị chặn nhịp gắt hơn nhiều mức header công bố, gom chung một ngân sách từng làm lượt kéo toàn bộ chương trình chết ở lần chặn thứ tư.

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

## Bộ máy luật (giai đoạn 04)

```
src/lib/rules/
  rule-catalog.ts        # 37 luật được khai báo - nguồn cho seed và cho màn cấu hình
  registry.ts            # 31 luật đã hiện thực (nhóm A–E); nhóm F thuộc giai đoạn 06
  engine.ts              # lọc theo cấu hình, kiểm dữ liệu đầu vào, gom và sắp xếp
  rule-config-store.ts   # đọc RuleConfig, lùi về mặc định khi giá trị hỏng
  run-check.ts           # đầu mối bất đồng bộ: cache danh mục + cấu hình + luật
  helpers/               # levenshtein, money, date-range, row-ref
  group-a-file-structure/ … group-e-overlap/   # mỗi luật một file, hàm thuần
```

Luật là **hàm thuần**: không gọi mạng, không đụng hệ thống tệp, `now` truyền từ ngoài vào. Nhờ vậy toàn bộ test luật chạy không cần kết nối CSDL.

Thêm luật mới = tạo file + khai vào `index.ts` của nhóm. Không sửa bộ máy. `registry.ts` và `rule-catalog.ts` lệch nhau là test đỏ, vì một luật được khai báo, bật sẵn, nhưng không bao giờ chạy sẽ trông y hệt một file sạch.

### Thiếu dữ liệu thì báo là thiếu

Luật khai báo dữ liệu ngoài mà nó cần qua trường `requires`. Bộ máy bỏ qua đúng những luật thiếu dữ liệu và ghi vào `skippedRules`:

| Tình huống | Bỏ qua | Báo gì |
|---|---|---|
| `catalog.syncedAt === null` hoặc cache rỗng | B1, B2, B3, B5, B6 | Cảnh báo `SYS-CATALOG-EMPTY` mức `critical` |
| `haravanPromotions === null` | D8, E3 | Chỉ ghi vào `skippedRules` |

B4 nằm trong nhóm B nhưng chỉ đọc dữ liệu trong file nên vẫn chạy khi cache rỗng.

Không có chốt chặn này thì lần dùng đầu tiên sẽ cho ra 3.929 cảnh báo sai "SKU không tồn tại", và người dùng mất niềm tin ngay.

### Phạm vi báo lỗi

- **Nhóm A, B, C** — theo dòng, kèm `rowNumber` để bấm về đúng ô trong file
- **Nhóm D** — theo chương trình. Haravan tạo một chương trình cho mỗi `Tên ctkm`, nên một ngày kết thúc sai là **một** lỗi, không phải 279 lỗi. Riêng D9 (`Số dư`) theo dòng vì đó là ô của từng dòng
- **Nhóm E** — theo cặp chồng lấn

### Gợi ý mã hiệu gần giống (luật B1)

Mã hiệu của cửa hàng dồn cục: đo trên file thật ngày 2026-08-18, 3.931 mã chỉ rơi vào **24 rổ** 3 ký tự, rổ lớn nhất ôm 31% — gần như mã nào cũng bắt đầu bằng `km`. Nên lọc theo 3 ký tự đầu cộng độ dài là chưa đủ.

| Tình huống | Trước | Sau |
|---|---|---|
| Danh mục ~59.000 biến thể, không chứa mã nào của file | 83 giây | **365 ms** |
| Danh mục đầy đủ | — | 22 ms |
| 20 mã sai giữa danh mục đầy đủ | — | 26 ms, 9/20 mã có gợi ý |

Cách xử lý: tham số `suggestMaxComparisons` (mặc định 2.000.000) giới hạn công sức tìm mã gần giống cho **cả lượt kiểm tra**. Hết hạn mức thì ngừng gợi ý — cảnh báo vẫn phát đủ, và phần gợi ý nói thẳng là đã ngừng vì có quá nhiều mã không tra ra, nhiều khả năng danh mục chưa đồng bộ. Không cắt ngầm.

### Quy ước viết thông báo

Mỗi thông báo nêu **số liệu cụ thể** và hậu quả, kèm gợi ý sửa:

- ✅ `"Dòng 51: số tiền giảm 0đ. Haravan sẽ từ chối (lỗi 422), toàn bộ chương trình này không được tạo."`
- ✅ `"Dòng 12: mã hiệu 'KMAP231728F.XXL' không có trên Haravan..."` → `"Có phải ý là 'kmap231728f.xl' không?"`

Phần trăm trong file **luôn là thập phân** (0.5 = 50%); chỉ chỗ định dạng thông báo và chỗ dựng payload Haravan mới nhân 100.

### Số đo

| Hạng mục | Kết quả |
|---|---|
| 31 luật trên 3.931 dòng, danh mục đầy đủ | ~30 ms (ngưỡng: dưới 3 giây) |
| Ca xấu nhất — mọi mã hiệu đều không tra ra | 365 ms |

## Dữ liệu

Mười bảng, khai đầy đủ ở [`prisma/schema.prisma`](../prisma/schema.prisma):

| Bảng | Vai trò |
|---|---|
| `VariantCache` | Cache danh mục, khoá chính `variantId` (không phải `sku`, vì SKU trùng và rỗng đều có thật) |
| `SyncState` | Một dòng duy nhất: mốc đồng bộ, số liệu thống kê |
| `CheckRun` / `Finding` | Lịch sử kiểm tra và từng phát hiện |
| `CheckProgram` | Mỗi chương trình của một lần chạy: số dòng và số phát hiện từng mức |
| `ReconcileMatch` | Đối soát: chụp lại hai phía của một cặp (chương trình trong file, CTKM trên Haravan) |
| `RuleConfig` | 37 luật, bật/tắt và ngưỡng riêng |
| `AppSetting` | Ngưỡng dùng chung toàn ứng dụng |
| `User` | Người được phép dùng công cụ: username, email, mật khẩu đã băm, bộ đếm sai mật khẩu |
| `Session` | Mỗi trình duyệt đang đăng nhập, khoá chính là **băm** của token trong cookie |

`CheckProgram` lưu cả chương trình **không có phát hiện nào**. Đó là lý do nó tồn tại: chương trình sạch không để lại dấu vết trong `Finding`, nên nếu không lưu thì màn kết quả vừa không hiện được số dòng của chương trình, vừa không nói được câu "chương trình này không có vấn đề gì".

`ReconcileMatch` chụp lại giá trị chứ không tham chiếu. Vài tháng sau CTKM trên Haravan có thể đã bị sửa và file gốc đã bị dọn, mà báo cáo vẫn phải nói được lúc đối chiếu hai bên trông ra sao. Tên chương trình trùng nhau thì ghi một dòng cho mỗi ứng viên, để màn hình liệt kê hết thay vì tự chọn một cái.

Một lần đối soát cũng là một dòng `CheckRun`, phân biệt bằng cột `mode = "reconcile"`. Nhờ vậy phát hiện của nhóm F dùng chung bảng `Finding` và chung mọi truy vấn sẵn có.

`price` lưu kiểu `Float`. Tiền VND là số nguyên dưới 10⁹ nên `double` biểu diễn chính xác; mọi phép so tiền vẫn dùng ngưỡng sai số `check.money_tolerance_vnd`.

## Cấu hình

`AppSetting` hiện có 18 khoá. Mọi giá trị đọc qua `getAppConfig()`, kiểm bằng `zod` và có giá trị dự phòng — ô trống hay giá trị vô nghĩa rơi về mặc định chứ không lọt số 0 vào bộ điều tiết nhịp hay bộ phân trang.

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
| `shop.timezone_offset_minutes` | 420 | −720…840 | Lệch múi giờ cửa hàng so với UTC, dùng khi so mốc thời gian với Haravan |
| `report.max_rows_per_page` | 100 | 1…1000 | Phân trang bảng kết quả |
| `check.money_tolerance_vnd` | 0.5 | >0…1000 | Ngưỡng sai số khi so tiền |
| `check.fetch_promotions` | `true` | `true` hoặc `false` | Bật thì mỗi lần kiểm tra tải danh sách CTKM về để chạy D8 và E3 |
| `haravan.promotion_page_size` | 250 | 1…**250** | Endpoint chương trình nhận tới 250, khác endpoint sản phẩm |
| `haravan.promotion_max_pages` | 200 | 1…10000 | Trần số trang khi kéo danh sách chương trình |
| `haravan.promotion_delay_ms` | 1200 | 0…60000 | Nghỉ giữa hai trang khi kéo danh sách chương trình — endpoint này chặn nhịp gắt hơn mức header công bố |
| `haravan.rate_limit_max_attempts` | 30 | 1…100 | Ngân sách thử lại riêng cho 429, tách khỏi `haravan.max_attempts` |
| `auth.session_ttl_hours` | 24 | 1…8760 | Một lần đăng nhập dùng được bao lâu |
| `auth.max_failed_attempts` | 5 | 1…100 | Sai mật khẩu mấy lần thì khoá tạm |
| `auth.lockout_minutes` | 15 | 1…1440 | Khoá tạm bao lâu |
| `auth.min_password_length` | 8 | 6…128 | Độ dài tối thiểu khi đặt mật khẩu mới |

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

### `POST /api/check`

Nhận `multipart/form-data` với đúng một trường `file`, trả `{ runId, storedFileName }` kèm mã 201. Trình duyệt sau đó chuyển sang `/ket-qua/{runId}` — trang này dựng phía máy chủ, nên không có phát hiện nào đi qua JSON của tuyến này.

Chốt chặn:

- **Yêu cầu khác nguồn bị từ chối** qua `Sec-Fetch-Site`, trả 403 — cùng lý do như tuyến đồng bộ.
- **Dung lượng kiểm trước khi nạp vào bộ nhớ**, quá 20 MB trả 413.
- **Chữ ký đầu tệp kiểm trên byte**, không tin phần mở rộng — đổi tên một file `.zip` thành `.xlsx` không lọt tới bộ phân tích XML. Sai định dạng trả 400 kèm câu giải thích.
- Lỗi ngoài dự kiến chỉ để lại câu chung cho người dùng, chi tiết nằm trong log máy chủ.

### `GET /api/check/{runId}/export`

Nạp lại file gốc từ `UPLOAD_DIR`, chú thích lên rồi trả về kèm `Content-Disposition`. Tên file tiếng Việt đi qua `filename*` theo RFC 5987, `filename` thường chỉ là bản rút gọn ASCII.

Ba mã trả về đáng lưu ý: 404 khi không có lần chạy đó, **410 khi file gốc đã bị dọn theo hạn lưu** (lần chạy vẫn còn, kết quả vẫn xem được — chỉ không xuất báo cáo được nữa), 500 cho lỗi ngoài dự kiến.

## Màn kiểm tra file (giai đoạn 05)

Luồng một lần kiểm tra, từ byte tới màn hình:

```
byte tải lên
  -> readPromotionWorkbook()     # kiểm chữ ký, đọc mọi sheet, chuẩn hoá dòng
  -> checkWorkbook()             # nạp cache danh mục + RuleConfig, chạy 31 luật
  -> saveCheckRun()              # CheckRun + CheckProgram + Finding, một giao dịch
  -> saveUploadedFile()          # đẩy file gốc lên MinIO, hoặc ghi xuống UPLOAD_DIR
```

**Thứ tự hai bước cuối là cố ý.** Lần chạy được ghi vào CSDL trước, file gốc lưu sau: một lần chạy không có file vẫn hiện đủ mọi phát hiện trên màn hình, còn một file không có lần chạy thì chẳng hiện được gì. Kho lưu trữ trục trặc làm mất nút xuất báo cáo, không làm mất kết quả kiểm tra.

`Finding` ghi theo lô 1.000 dòng, hạn giao dịch nâng lên 60 giây thay cho mặc định 5 giây của Prisma — một file 4.000 dòng ghi vài nghìn dòng phát hiện, quá hạn mặc định vì *lớn* chứ không phải vì *treo*.

### Lọc và phân trang phía máy chủ

Bộ lọc nằm trong địa chỉ trang, khoá tiếng Việt: `muc` (mức độ), `luat` (mã luật), `ctkm` (tên chương trình), `sku`, `mo` (chương trình đang mở rộng), `trang`. Mọi nút lọc là thẻ liên kết hoặc biểu mẫu `GET` — không có `onChange`, không có trạng thái phía trình duyệt.

Đổi lại được ba thứ: tải lại trang giữ nguyên bộ lọc, gửi đường dẫn cho đồng nghiệp là họ thấy đúng cái mình đang xem, và **trang kết quả biên dịch ra 162 B mã JavaScript** — 3.931 dòng không bao giờ rời khỏi máy chủ.

Mở rộng một chương trình cũng là một liên kết. Phát hiện của chương trình đó nạp riêng phía máy chủ, mở một chương trình không kéo theo 153 chương trình còn lại.

### Xuất báo cáo Excel

File xuất ra là để **gửi lại cho người lập file sửa**, nên file gốc được nạp lại rồi chú thích lên, không dựng lại từ đầu. Chỉ thêm ba thứ:

1. Tô nền dòng theo mức nặng nhất của dòng đó — một dòng vừa `warn` vừa `critical` phải đỏ, tô vàng là giấu mất chỗ chặn import.
2. Hai cột cuối `Cảnh báo` và `Gợi ý sửa`, gộp nhiều phát hiện trên cùng một dòng, gợi ý trùng chỉ ghi một lần.
3. Sheet `Tổng hợp` đặt trước các sheet của người dùng, kèm thống kê theo mã luật và danh sách phát hiện không gắn với dòng nào.

Sheet **không có phát hiện nào thì không bị đụng tới** — một tab hướng dẫn hay ghi chú phải trở về đúng như lúc gửi đi, không dính thêm hai cột lạ và mũi tên lọc. Dòng tiêu đề cũng không mặc định là dòng 1 mà dò theo dòng đầu tiên có dữ liệu, khớp với cách tầng đọc xác định tiêu đề.

Ba điểm phải né:

- **Trùng tên sheet.** `exceljs` ném lỗi khi thêm một sheet trùng tên sheet có sẵn, mà `Tổng hợp` là tên tab hết sức bình thường của một file tiếng Việt. Tên sheet báo cáo được dò cho tới khi trống, nếu không thì file như vậy sẽ kiểm tra bình thường rồi không bao giờ xuất báo cáo được.

- **Thứ tự sheet** đặt qua thuộc tính `orderNo` của `exceljs`. Thuộc tính có thật và được tôn trọng lúc ghi (kiểm chứng bằng ghi rồi đọc lại, `exceljs` 4.4, 2026-08-18) nhưng thiếu trong phần khai báo kiểu, nên mã phải khai một kiểu phụ.
- **Hai cột thêm vào đặt sau `columnCount`**, không phải sau cột cuối có dữ liệu. Với `promotion.t8.xlsx`, `exceljs` báo `columnCount` là 15 trong khi chỉ 14 cột có dữ liệu, nên file xuất ra có một cột trống xen giữa. Chấp nhận có chủ đích: cột 15 có thể đang mang định dạng của người lập file.

### Lưu file gốc

Hai nơi lưu, chọn theo **nơi mã đang chạy** chứ không theo cờ bật/tắt:

| Điều kiện | Nơi lưu | Giá trị ghi vào `CheckRun.storedFileName` |
|---|---|---|
| `NODE_ENV=production` **và** `MINIO_ENDPOINT` có giá trị | MinIO (kho đối tượng S3) | Khoá đối tượng: `{prefix}/{năm}/{tháng}/{runId}-{tên đã làm sạch}.xlsx` |
| Mọi trường hợp còn lại | Đĩa của máy chủ ứng dụng, thư mục `UPLOAD_DIR` (mặc định `./.uploads`) | Tên phẳng: `{runId}-{tên đã làm sạch}.xlsx` |

**MinIO chỉ dùng cho bản chạy thật.** Chạy `next dev`, chạy test hay chạy script thì file luôn ghi xuống thư mục local, kể cả khi `.env` chép từ máy chủ về và điền đủ khoá — người phát triển thử nghiệm không lỡ tay đẩy file vào bucket của bản chạy thật được. Ảnh Docker đặt sẵn `NODE_ENV=production` nên bản triển khai không phải khai thêm gì.

Cấu hình MinIO điền nửa vời thì **báo lỗi** thay vì lặng lẽ rơi về đĩa — đó luôn là cấu hình sai, và im lặng chỉ lộ ra vào ngày có người đi tìm file trong bucket.

`saveUploadedFile()` **trả về** định danh mà nơi lưu thật sự đã dùng, và đó mới là giá trị được ghi vào `CheckRun`. Nơi gọi không tự đoán tên.

Đọc lại thì phân biệt bằng chính giá trị đã lưu: có dấu `/` là khoá đối tượng, không có là tên trên đĩa. An toàn vì tên đã làm sạch chỉ còn `[A-Za-z0-9-]` nên không bao giờ chứa dấu `/`. Nhờ vậy các lần chạy lưu từ trước khi có MinIO **vẫn đọc được từ đĩa**, không cần chuyển đổi dữ liệu.

Định danh này là chuỗi duy nhất trong tính năng có thể biến thành một lượt đọc tuỳ ý, nên bị chặn hai lớp — kể cả khi giá trị lấy từ CSDL:

- **Lúc ghi:** tên gốc bị viết lại chỉ còn `[A-Za-z0-9-]` và ép đuôi `.xlsx`.
- **Lúc đọc:** đường dẫn trên đĩa phải còn nằm trong `UPLOAD_DIR`; khoá đối tượng phải còn nằm trong prefix của dự án. Bucket dùng chung với dự án khác, nên chặn prefix là để một dòng CSDL bị sửa tay không đọc được file của dự án bên cạnh.

File chứa giá vốn và giá bán, nên **không phát hành liên kết công khai**: `MINIO_PUBLIC_URL` cố tình không được đọc, mọi lượt đọc đi qua máy chủ sau lớp kiểm tra phiên đăng nhập.

File mất (bị dọn theo hạn lưu, hoặc chưa từng ghi được) **không phải lỗi**: màn kết quả thay nút xuất bằng câu "file gốc đã hết hạn lưu, tải lên lại để xuất báo cáo".

## Màn cấu hình luật (giai đoạn 07)

Màn hình hiện thực hoá nguyên tắc **không chôn cứng giá trị nghiệp vụ**: 37 luật và 11 thiết lập chung đều sửa được mà không cần đụng vào mã nguồn.

### Một biểu mẫu cho cả 37 luật

Cả bảng luật là **một** `<form>` gắn Server Action, không phải 37 biểu mẫu rời. Lý do: nút "Tắt cả nhóm" và nút "Về mặc định" là nút gửi mang theo một *ý định*, nên chúng đi kèm toàn bộ chỉnh sửa đang dở thay vì làm mất chúng.

Ý định đọc từ trường `intent`, ngữ pháp đóng: `save`, `reset-all`, `reset:<mã luật>`, `group-on:<nhóm>`, `group-off:<nhóm>`. Bất cứ giá trị nào khác bị từ chối — mã luật và mã nhóm được đối chiếu với danh mục trong mã nguồn, không bao giờ lấy thẳng từ biểu mẫu.

Riêng nút khôi phục mặc định **bỏ qua khâu kiểm tra** ô nhập của chính luật đó, vì giá trị trong ô đang sai mới là lý do người dùng bấm nút. Nút thoát hiểm mà bị chặn bởi thứ nó sinh ra để sửa thì vô dụng.

### Ngưỡng mô tả một lần, dùng cho cả hai việc

`rule-config-schema.ts` khai mỗi ngưỡng một lần với nhãn tiếng Việt, đơn vị, chặn trên và chặn dưới. Lược đồ `zod` **dựng ra từ chính mô tả đó**, nên thông báo lỗi luôn nói đúng khoảng mà mã nguồn thật sự áp:

> Mức giảm tối đa coi là bình thường phải nằm trong khoảng 1 đến 100 %.

Một test đối chiếu danh sách mô tả với `rule-catalog.ts`: ngưỡng có giá trị mặc định mà thiếu mô tả thì không sửa được, mô tả thừa thì sinh ra tham số không luật nào đọc. Cả hai đều là test đỏ.

### Chỉ ghi dòng thật sự đổi

Server Action đọc cấu hình hiện tại, so từng dòng, chỉ ghi dòng khác. Nhờ vậy `RuleConfig.updatedAt` giữ đúng nghĩa "luật này được chỉnh lúc nào" thay vì "ai đó mở màn hình lúc nào" — đây là dấu vết duy nhất của công cụ, vì không có đăng nhập.

### Giá trị bị từ chối vẫn nằm lại trên màn hình

React tự `reset` biểu mẫu sau khi Server Action trả về. Không xử lý gì thì ô nhập sẽ bật về giá trị cũ trong khi thông báo lỗi lại trỏ vào nó — người dùng đọc thấy một ô trông hoàn toàn bình thường. Vì vậy trạng thái trả về mang theo nguyên văn những gì đã gửi, và biểu mẫu dựng lại từ đó.

Biểu mẫu đặt `noValidate`: trình duyệt sẽ chặn trước bằng bong bóng tiếng Anh, che mất thông báo tiếng Việt của công cụ. Thuộc tính `min`/`max` vẫn giữ để bộ tăng giảm và trình đọc màn hình biết khoảng hợp lệ.

### Đọc và ghi đi qua cùng một đường

Màn hình đọc qua chính `loadRuleConfigs()` mà bộ máy luật dùng, và nút khôi phục ghi lại đúng giá trị trong `rule-catalog.ts` mà `prisma/seed.ts` dùng. Nhờ vậy màn hình không thể bất đồng với bộ máy về giá trị đang chạy, cũng không thể bất đồng với seed về thế nào là "mặc định".

## Đăng nhập (2026-08-19)

Đăng nhập bằng **username hoặc email** kèm mật khẩu. Không dùng thư viện xác thực nào: nhu cầu chỉ có một màn hình đăng nhập, và `node:crypto` đã đủ để băm mật khẩu.

### Hai lớp, và tại sao phải hai

```
Trình duyệt ──cookie pc_session──> middleware.ts   chỉ hỏi: có cookie không?
                                       │ không → 307 về /dang-nhap?tiep=…
                                       │        (tuyến /api/* nhận 401 thay vì chuyển hướng)
                                       ↓ có
                                  Trang · API · Server Action
                                       └─ requireUser() đối chiếu CSDL thật
```

`middleware.ts` chạy trên **Edge runtime**, nơi không có Prisma và không có `node:crypto`. Nó chỉ kiểm cookie **có tồn tại hay không**, nên tự nó không phải là chốt chặn. Chốt chặn thật là `requireUser()` / `getCurrentUser()`, gọi trong **từng** trang, **từng** tuyến API và **từng** Server Action. Không được bỏ lớp trong với lý do "middleware lo rồi".

Hệ quả trực tiếp lên mã nguồn: `SESSION_COOKIE_NAME` nằm ở `session-cookie.ts` (thuần, chạy được trên Edge), tách khỏi `session-token.ts` (dùng `node:crypto`). Cho middleware import nhầm file thứ hai thì **toàn bộ ứng dụng hỏng lúc dựng**, mọi tuyến trả 500 — kể cả `/api/health`.

### Mật khẩu

`scrypt` của thư viện chuẩn, tham số `N=16384, r=8, p=1`, khoá dẫn xuất 64 byte, muối ngẫu nhiên 16 byte. Chuỗi lưu xuống CSDL có dạng `scrypt$N$r$p$muối$băm` — **tự mang theo tham số của chính nó**, nên đổi tham số sau này vẫn kiểm được mật khẩu cũ.

Chọn `scrypt` thay vì bcrypt/argon2 vì cả hai đều cần bước biên dịch native, còn cái này Node có sẵn. So sánh bằng `timingSafeEqual`; chuỗi băm hỏng trả về "không khớp" chứ không ném lỗi.

Mật khẩu được chuẩn hoá `NFKC` trước khi băm: cùng một chữ tiếng Việt có nhiều cách mã hoá Unicode, không chuẩn hoá thì gõ đúng vẫn bị từ chối.

### Phiên

Token 32 byte ngẫu nhiên, để trong cookie `pc_session` (`httpOnly`, `sameSite=lax`, `secure` khi chạy production). CSDL lưu **SHA-256 của token**, không lưu token. Đọc trộm được bảng `Session` cũng không dựng lại được cookie dùng được.

Phiên nằm trong CSDL chứ không phải JWT tự hết hạn, vì đăng xuất và xoá tài khoản phải có hiệu lực **ngay**. Mốc hết hạn so trên cột `expiresAt` chứ không tin vào hạn của cookie — hạn cookie chỉ là gợi ý cho trình duyệt.

### Chống dò mật khẩu

Sai mật khẩu liên tiếp quá `auth.max_failed_attempts` thì khoá tạm `auth.lockout_minutes` phút. Bộ đếm nằm trên dòng `User`, không nằm trong bộ nhớ tiến trình — container khởi động lại sau mỗi lần triển khai, để trong bộ nhớ thì kẻ dò được cấp lại lượt miễn phí.

Tài khoản không tồn tại vẫn bị đem đi so với một chuỗi băm thật (dựng một lần từ byte ngẫu nhiên). Không làm vậy thì username lạ trả lời trong một mili giây còn username có thật mất trọn chi phí `scrypt` — đủ để dò ra ai có tài khoản.

Thông báo khi sai chỉ nói "tên đăng nhập hoặc mật khẩu không đúng", không tách hai vế.

### Tài khoản

Không có màn hình quản trị người dùng: cấp tài khoản là việc hiếm, mà làm màn hình cho nó thì kéo theo phải làm phân quyền để quyết ai được mở. Thay vào đó là lệnh chạy trên máy chủ — `npm run user:create`, `user:list`, `user:passwd`, `user:delete`. Xem [`van-hanh-va-trien-khai.md`](van-hanh-va-trien-khai.md).

Tài khoản đầu tiên do `npm run db:seed` tạo từ `AUTH_SEED_*`, và **chỉ khi bảng `User` còn rỗng** — chạy lại seed trên CSDL đang sống không được phép hồi sinh tài khoản đã bị xoá có chủ đích.

Username và email đều lưu **chữ thường**, chuẩn hoá `NFKC`, nên "Hoa" và "hoa" không thể thành hai tài khoản. Đăng nhập nhận cả hai bằng một truy vấn `OR` duy nhất.

## Bảo mật

- Toàn bộ màn hình và tuyến API đều đòi đăng nhập, trừ `/dang-nhap` và `/api/health`. `/api/health` mở vì healthcheck của container không có cookie — bắt nó đăng nhập thì ứng dụng đang khoẻ vẫn bị báo là chết.
- `HARAVAN_API_TOKEN` chỉ đọc phía máy chủ, không có tiền tố `NEXT_PUBLIC_`, chỉ đọc ở đúng một chỗ trong `haravan-client.ts`.
- Token bị thay bằng `***` trong nội dung phản hồi nhúng vào thông báo lỗi — biến lời hứa thành ràng buộc thật, không phải quy ước.
- `BigInt` chuyển thành chuỗi tại ranh giới server ↔ trình duyệt (`src/lib/serialization/bigint.ts`). `SyncResult` không mang `BigInt` nào.
- Không có lệnh ghi nào lên Haravan trong toàn bộ mã nguồn.
- File tải lên chỉ được đọc như dữ liệu, không bao giờ thực thi. Chữ ký đầu tệp kiểm trên byte; dung lượng chặn theo `Content-Length` **trước** khi chạm vào thân yêu cầu, vì `formData()` đã dựng xong mọi phần trong bộ nhớ rồi mới trả về — kiểm sau đó là kiểm khi đã trả giá.
- Tên file lưu trữ bị viết lại và đường dẫn giải ra được kiểm lại ở cả chiều ghi lẫn chiều đọc, nên một dòng CSDL bị sửa tay cũng không đọc được file ngoài thư mục lưu.

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
- Xuất báo cáo Excel mất ~6,4 giây cho file 3.930 dòng. Gần như toàn bộ là thời gian `exceljs` ghi lại tệp: đo riêng lệnh ghi mà không sửa gì cũng ~6,9 giây, nên tối ưu phần chú thích không giúp gì.
- `scripts/prune-uploads.sh` thuộc giai đoạn 08, chưa viết — hiện chưa có gì dọn thư mục `.uploads/`.
- Các lần chạy tạo trước migration `add_check_program` không có dòng `CheckProgram` nào, nên bảng chương trình của chúng hiện trống.
- Trang lịch sử hiện 100 lần chạy gần nhất, chưa có phân trang. Đủ dùng ở nhịp hiện tại, sẽ phải xem lại nếu chuyển sang kiểm tra hằng ngày nhiều file.
- `GET /com/promotions.json` **không lọc được phía máy chủ** — mọi tham số lọc bị bỏ qua im lặng. Đối soát vì vậy luôn kéo toàn bộ CTKM của cửa hàng rồi lọc trong bộ nhớ. Cửa hàng tích luỹ nhiều năm sẽ phải xem lại điểm này.
- Chưa xác định được `limit` của `promotions.json` có bị ép về 50 hay không — store dev chỉ có 1 CTKM. Vòng phân trang học kích thước trang thật từ trang đầu nên đúng với cả hai khả năng, đổi lại tốn thêm đúng một lượt gọi khi trang đầu ngắn.
- Luật F5 cần cache danh mục để quy đổi CTKM đính theo sản phẩm thành số biến thể. Cache chưa đồng bộ thì luật này im lặng chứ không kết luận.
- Màn đối soát hiện tất cả chương trình trên một trang, chưa phân trang. File mẫu 154 chương trình vẫn đọc được, file lớn hơn nhiều thì phải xem lại.
