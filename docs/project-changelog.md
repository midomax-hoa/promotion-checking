# Nhật ký thay đổi

Ghi lại các thay đổi đáng kể của dự án. Mới nhất ở trên.

## 2026-08-19 — Đo lại API chương trình khuyến mãi, chỉnh nhịp kéo dữ liệu

### Bối cảnh

Mỗi lần tải file lên, `checkWorkbook` kéo toàn bộ danh sách chương trình từ Haravan để phục vụ **2 trên 31 luật**: D8 (trùng tên chương trình) và E3 (SKU đang nằm trong chương trình khác đang chạy).

Đợt rà soát ban đầu dựng trên ước lượng shop có ~300.000 chương trình, và kết luận rằng lượt kéo này luôn vượt trần `MAX_PAGES = 200` rồi thất bại. **Kết luận đó sai.** Đo trực tiếp trên shop thật ngày 2026-08-19 (chỉ `GET`, xem [báo cáo kiểm chứng](../plans/reports/verification-260819-0906-haravan-promotions-api-tren-shop-that.md)):

| | Ước lượng ban đầu | Số đo thật |
|---|---|---|
| Số chương trình | ~300.000 | **2.290** |
| Số trang ở `limit=50` | 6.000 | **46** |
| Chạm trần 200 trang | Có | **Không** |
| D8, E3 | Không bao giờ chạy | **Vẫn chạy bình thường** |

Nói gọn: lượt kéo vốn vẫn hoạt động, chỉ là chậm hơn cần thiết.

### Phát hiện từ đợt đo

Báo cáo kiểm chứng cũ (2026-08-18) chạy trên store dev có **đúng 1 chương trình**, nên nhiều câu hỏi không thể trả lời và một kết luận bị khái quát quá tay:

- Kết luận "máy chủ bỏ qua mọi bộ lọc" **chỉ đúng với `status`**. `updated_at_min`, `created_at_min`, `since_id` và `ids` đều có tác dụng thật
- Riêng `query` / `name` / `title` thì đúng là bị bỏ qua, nên **không tìm chương trình theo tên được** — đối soát khớp theo tên nên vẫn buộc phải kéo cả danh sách rồi so trong bộ nhớ. Ở cỡ 2.290 thì việc đó rẻ
- **`limit` của endpoint chương trình nhận tới 250**, khác endpoint sản phẩm bị ép về 50. Vượt 250 thì máy chủ lặng lẽ trả về 50

### Thay đổi

- Thêm `haravan.promotion_page_size` (mặc định `250`). Trước đây endpoint chương trình dùng chung `haravan.page_size` vốn bị chặn ở 50 vì endpoint sản phẩm. Tách ra: **46 lượt gọi còn 10**, thời gian kéo từ ~15 giây xuống ~3,3 giây
- Thêm `haravan.promotion_max_pages` (mặc định `200`). `MAX_PAGES` trước đây chôn cứng trong `promotion-fetcher.ts`, trái quy ước cấu hình động. Hằng số cũ giữ lại thành `DEFAULT_MAX_PAGES`, chỉ dùng khi caller không truyền gì
- Thêm `PromotionPageLimitError`, lớp con của `PromotionFetchError`. Chạm trần thì thông báo nói rõ nguyên nhân và cách xử lý, thay vì câu "dừng ở trang 200" vốn đọc như trục trặc mạng khiến người dùng bấm lại vô ích. Là lớp con nên mọi chỗ đang bắt `PromotionFetchError` — kể cả `SAFE_ERRORS` của tuyến đối soát — vẫn bắt được
- Thêm `check.fetch_promotions` (mặc định `true`) để tắt hẳn lượt kéo khi cần ưu tiên tốc độ. Tắt thì D8 và E3 được ghi vào `skippedRules`, không bao giờ bị hiểu nhầm thành "không phát hiện vấn đề"
- `run-check.ts` chỉ gọi API khi qua **hai cửa**: thiết lập trên đang bật, **và** có ít nhất một luật cần danh sách đang bật. Cửa thứ hai vá một lãng phí có sẵn — trước đây tắt D8/E3 trên màn cấu hình thì vẫn kéo dữ liệu về rồi vứt đi
- Tập mã luật cần danh sách suy ra từ `RULES` (lọc theo `requires`), không liệt kê tay
- Tách `shouldFetchPromotions` thành hàm thuần và xuất ra, theo lối `buildFindingWhere` / `mergeRuleConfigs`, để kiểm thử hai cửa mà không cần cơ sở dữ liệu hay mạng

### Kết quả

- Lượt kéo danh sách chương trình nhanh gấp ~4,5 lần (46 lượt gọi còn 10)
- D8 và E3 vẫn chạy như trước, không mất luật nào
- Danh mục thiết lập chung tăng từ 11 lên 14 mục
- Không cần di trú lược đồ. `AppSetting` là bảng khoá/giá trị, hàng thiếu rơi về mặc định trong danh mục; chạy `npm run db:seed` sẽ thêm hàng mới mà không đụng giá trị đã tinh chỉnh
- Thêm 19 test: 6 cho hai cửa lọc, 5 cho trần phân trang động và thông báo lỗi, phần còn lại cho các thiết lập mới

### Chân dung kho chương trình, đo được nhân tiện

| Chỉ số | Giá trị |
|---|---|
| Tổng | 2.290 |
| Đang bật (`status = enabled`) | 2.252 |
| Kết thúc trong tương lai | **182** |
| Tên duy nhất | 2.013 |
| Tên bị trùng (≥2 CTKM cùng tên) | **250** |

Hai điểm cần theo dõi:

- **~2.100 chương trình đã hết hạn nhưng vẫn để `enabled`**, nên `status` gần như vô nghĩa để biết còn hiệu lực; phải dựa vào `ends_at`. Luật E3 vốn đã lọc theo cửa sổ thời gian nên không bị ảnh hưởng
- **250 tên bị trùng.** Đối soát khớp theo tên, gặp trùng thì trả `ambiguous` kèm mọi ứng viên. Cần chạy thử một lượt đối soát thật để xem màn hình có bị ngập `ambiguous` không

### Chưa xử lý

- Con số 300.000 chủ repo nêu không khớp shop vừa đo (2.290). Có thể là số **dòng** khuyến mãi (2.290 CTKM × hơn trăm SKU mỗi cái), hoặc một shop khác. Cần xác nhận
- Chưa đo chi phí bộ nhớ thật của `mapPromotions` ở cỡ 2.290 bản ghi

## 2026-08-18 — Giai đoạn 09: Refactor giao diện và hệ thiết kế

Đợt này chỉ đụng giao diện. Không sửa luật, không sửa truy vấn, không đổi lược đồ; 495 test giữ nguyên và vẫn xanh.

### Thêm mới

**Hệ thiết kế**

- `src/lib/theme.ts`, `src/components/theme/` — ba trạng thái chủ đề: theo hệ thống, ép sáng, ép tối. Script đặt lớp `dark` chạy đồng bộ trong `<head>` nên chế độ tối không loé trắng lúc tải
- Bảng màu chuyển từ xám hoàn toàn sang xanh dương làm màu thương hiệu. Xanh dương là tông duy nhất còn trống — đỏ/cam/vàng/lục đã mang nghĩa mức cảnh báo, dùng chúng cho nút bấm sẽ bị đọc nhầm thành kết luận
- Mọi cặp chữ/nền, gồm cả bốn màu mức cảnh báo, đã đo đạt WCAG AA ở cả hai chế độ

**Khung ứng dụng**

- `src/components/shell/` — `PageShell` (tiêu đề, mô tả, vùng thao tác, ba mức bề rộng), `AppSidebar`, `nav-items.ts`
- Sidebar trái thay thanh điều hướng ngang; mục đang mở so khớp theo tiền tố nên đứng ở `/ket-qua/<id>` thì **Kiểm tra file** vẫn sáng. Dưới 1024px thu về ngăn kéo
- Liên kết "Nhảy tới nội dung" đứng trước sidebar trong thứ tự `Tab`

**Màn hình**

- `src/components/check/recent-runs.tsx` — 5 lần kiểm gần nhất ngay trang chủ, dùng lại truy vấn lịch sử đã có
- `src/components/config/rule-group-jump.tsx` — mục lục sáu nhóm luật, đặt **ngoài** thẻ `<form>` để không đụng cách gửi

### Thay đổi

- Bảy trang bỏ khung tự dựng (`mx-auto flex max-w-4xl flex-col gap-6 p-8` chép ở cả bảy) và chuyển sang `PageShell`. Màn kết quả và màn đối soát chi tiết dùng hết chiều ngang thay vì bị ép trong 896px
- Danh sách phát hiện chia hai cột trên màn rộng: dữ liệu nhận dạng cố định bên trái, thông báo và gợi ý bên phải. Ở 1920px phần lớn thông báo nằm gọn một dòng
- Ô thả file đếm số lần `dragenter`/`dragleave` thay vì bật tắt một biến luận lý — cách cũ tắt highlight ngay khi con trỏ đi qua nút ở giữa
- Bảng đối soát: hai cột giá trị được chia đều, dòng lệch tô nền cả hàng, mỗi khối ghi số mục lệch. Màu vẫn không bao giờ là tín hiệu duy nhất — chữ "lệch" giữ nguyên
- Chương trình sạch làm nhạt đi để chương trình có lỗi nổi lên
- `docs/images/man-cau-hinh.png` chụp lại theo giao diện mới

### Sửa lỗi

- **Test đọc file Excel thật hết chập chờn.** Hai file `test/excel/excel-reader.test.ts` và `promotion-workbook.test.ts` có lúc vượt `testTimeout` mặc định 5.000 ms khi chạy song song. Nguyên nhân: mỗi test đọc lại và phân tích lại cùng một workbook 3.931 dòng — riêng `readWorkbook` tốn ~1,7 s và `readBuffered` ~1,25 s trên máy rảnh, nên tám lượt phân tích chia cho tám test là chắc chắn có lượt vượt ngưỡng khi máy bận
- Cách sửa: phân tích **một lần** trong `beforeAll` của từng khối rồi dùng chung. Không nâng `testTimeout` chung — phần việc nặng chuyển vào hook có ngân sách riêng, còn từng test vẫn nằm trong ngưỡng 5.000 ms mặc định
- Kết quả: tám lượt phân tích còn ba; `tests` giảm từ ~40 s xuống ~22 s. Chạy năm lượt liên tiếp bằng timeout mặc định đều 495/495 xanh. Mọi khẳng định giữ nguyên, gồm 279 dòng giảm 0đ, 154 chương trình và ngưỡng chống phình 8 s

### Ghi chú

- Màn cấu hình vẫn giữ đúng cấu trúc cũ: một biểu mẫu cho 11 thiết lập chung, một biểu mẫu cho toàn bộ 37 luật. Không tách nhỏ thêm, vì tách ra sẽ đẻ ra chuyện lưu nửa vời
- Tên trường trong biểu mẫu không đổi, nên Server Action đọc y như cũ

## 2026-08-18 — Giai đoạn 08: Đóng gói Docker Compose

### Thêm mới

**Đóng gói**

- `Dockerfile` — năm chặng `deps` → `migrator-deps` → `builder` → `migrator` → `runner`. Chặng `runner` chạy bằng người dùng `nextjs` (uid 1001), image **326 MB**
- `docker-compose.yml` — `migrate` (chạy một lần) → `app` (chờ `healthcheck`) → `caddy`; profile `tools` cho việc sao lưu. Không có service `postgres`: CSDL nằm ở máy chủ khác
- `Caddyfile` — cách cấp chứng chỉ TLS chọn bằng biến `CADDY_TLS`, không phải sửa file
- `.dockerignore` — viết trước lần build đầu; không có nó thì `check-promotion/` (177 MB) bị nhồi vào ngữ cảnh build
- `.env.production.example`, `docker-compose.override.yml.example`

**Điểm kiểm tra sức khoẻ**

- `src/app/api/health/route.ts` — `SELECT 1` xuống CSDL; trả 503 khi không nối được. Thông báo lỗi giữ trong log vì nó mang theo host và thông tin đăng nhập

**Script vận hành** (`scripts/`)

- `lib-deploy-env.sh` — đọc `.env.production` bằng cách phân tích chứ không `source`; grep neo `^` nên dòng đã chú thích bị bỏ qua. `db_target()` in `host:cổng/tên-csdl` đã lược mật khẩu
- `backup-db.sh`, `backup-uploads.sh` — chạy `pg_dump`/`tar` qua container `postgres:18-alpine`, máy chủ khỏi cài `psql`
- `restore-db.sh` — **cố tình không có cờ bỏ qua xác nhận**: nó xoá toàn bộ bảng của dự án, và CSDL nằm trên máy chủ dùng chung
- `prune-uploads.sh` — dọn file quá hạn theo `UPLOAD_RETENTION_DAYS`, có `--dry-run` và `--days`

### Thay đổi

- `next.config.ts` — thêm `experimental.serverActions`: `bodySizeLimit: '25mb'` và `allowedOrigins` đọc từ `ALLOWED_ORIGINS`. Bắt buộc khi chạy sau reverse proxy
- `package.json` — thêm bảy script `docker:*`, tất cả đã kèm `--env-file .env.production`
- `.gitignore` — thêm `*.tar.gz`, `docker-compose.override.yml`
- `docs/van-hanh-va-trien-khai.md` — thêm mục triển khai Docker, chứng chỉ TLS, sao lưu và phục hồi, bảng phân biệt CSDL máy phát triển với CSDL máy chủ

### Ba chỗ phải sửa sau khi build thật

| Hiện tượng | Xử lý |
|---|---|
| Kế hoạch nói Prisma 7 không còn engine nhị phân nên định dùng `npm ci --ignore-scripts` | Đúng với **client**, sai với **CLI**: `prisma migrate deploy` cần `schema-engine-linux-musl-openssl-3.0.x` do `@prisma/engines` tải trong postinstall. Chặng `deps` chép sẵn `prisma/schema.prisma` + `prisma.config.ts` trước `npm ci` để hook chạy trọn |
| Xoá `node_modules/next` trong chặng `migrator` mà image vẫn 1,51 GB | Layer sau xoá không thu hồi dung lượng layer trước. Tách chặng `migrator-deps` để cắt, rồi `COPY --from` sang — còn 931 MB |
| `docker compose up` dừng ở `thiếu APP_DOMAIN` dù `.env.production` đã có | `env_file:` chỉ truyền biến vào container; phần `${...}` lấy từ `--env-file`. Đưa cờ này vào toàn bộ script `docker:*` và ghi rõ trong tài liệu |

### Kiểm chứng

Chạy thử toàn phần với một PostgreSQL tạm (container tự tạo, xoá sau khi thử):

| Hạng mục | Kết quả |
|---|---|
| Image ứng dụng | 326 MB — dưới ngưỡng 400 MB |
| Migration + seed | 5 migration áp đúng, seed nạp 37 luật + 11 thiết lập |
| `/api/health` | `{"status":"ok","database":"up"}` |
| `/cau-hinh` | 200, 85 KB HTML, mã luật đọc từ CSDL đã seed |
| `whoami` / `date` | `nextjs` / `+07` |
| Volume `uploads` | Ghi được bằng người dùng `nextjs` |
| `docker history` | Không lộ token hay chuỗi kết nối |
| `docker compose config` | Hợp lệ; **chỉ `caddy`** ánh xạ cổng 80/443 ra ngoài |
| `caddy validate` | Hợp lệ ở cả hai chế độ TLS, tự bật chuyển hướng HTTP → HTTPS |
| `allowedOrigins` | `grep` thấy trong `server.js` — xác nhận đổi `APP_DOMAIN` là phải dựng lại image |

Toàn dự án: 495 test pass, `typecheck` và `lint` sạch.

### Chưa làm

Cần máy chủ Linux và thông tin CSDL thật: chạy `docker compose up` trên máy chủ, kiểm HTTPS bằng tên miền thật, chạy hết luồng qua proxy, diễn tập nâng cấp, đặt cron sao lưu và dọn file.

## 2026-08-18 — Giai đoạn 07: Màn cấu hình luật & tài liệu

### Thêm mới

**Màn hình & Server Action**

- `src/app/cau-hinh/page.tsx` — Server Component, đọc `RuleConfig` qua chính `loadRuleConfigs()` mà bộ máy luật dùng
- `src/app/cau-hinh/actions.ts` — hai Server Action lưu luật và lưu thiết lập chung
- `src/components/config/rule-config-table.tsx` — 37 luật gom sáu nhóm trong **một** biểu mẫu
- `src/components/config/rule-param-editor.tsx` — ô nhập ngưỡng dựng từ mô tả, không viết tay từng luật
- `src/components/config/group-toggle.tsx` — công tắc bật/tắt cả nhóm
- `src/components/config/app-setting-form.tsx` — 11 thiết lập chung

**Tầng cấu hình** (`src/lib/config/`)

- `rule-config-schema.ts` — mô tả ngưỡng sửa được của từng luật (nhãn, đơn vị, chặn trên chặn dưới); lược đồ `zod` dựng ra từ chính mô tả đó
- `rule-config-form.ts` — đọc biểu mẫu thành các bản cập nhật, thuần hoàn toàn nên test được không cần CSDL
- `config-form-state.ts` — hình dạng dùng chung, tách khỏi module `'use server'` vì module đó chỉ được export hàm async

**Tài liệu** — `codebase-summary.md`, `huong-dan-su-dung.md` (cho người dùng cuối, kèm ảnh chụp màn hình), `van-hanh-va-trien-khai.md`

**Kiểm thử** — thêm 20 test trong `test/config/rule-config-form.test.ts`; tổng dự án 495 test

### Thay đổi

- `src/lib/config/app-config.ts` — thêm `validateSettingValue`, dùng **đúng lược đồ** mà lúc chạy thật đang áp, kèm bộ dịch thông báo `zod` sang tiếng Việt. Giá trị đã qua đây thì chắc chắn không rơi vào nhánh dự phòng
- `src/lib/rules/rule-catalog.ts` — thêm `GROUP_TITLES`, `GROUP_CODES`, `isGroupCode`. Tên nhóm nằm cùng chỗ với mã nhóm
- `src/app/layout.tsx` — thêm mục điều hướng **Cấu hình luật**

Không có thay đổi lược đồ dữ liệu: `RuleConfig` và `AppSetting` đã đủ từ giai đoạn 01.

### Hai chỗ phải sửa sau khi thao tác thật trên trình duyệt

| Hiện tượng | Xử lý |
|---|---|
| Nhập 500 rồi bấm Lưu, không thấy thông báo nào | Trình duyệt tự chặn theo `max` của ô số, bằng bong bóng tiếng Anh. Biểu mẫu chuyển sang `noValidate`; `min`/`max` giữ lại cho bộ tăng giảm và trình đọc màn hình |
| Báo lỗi đúng nhưng ô nhập bật về giá trị cũ | React tự `reset` biểu mẫu sau khi Server Action trả về. Trạng thái trả về nay mang theo nguyên văn giá trị đã gửi, biểu mẫu dựng lại từ đó |

### Kiểm chứng

Chạy trên bản dựng thật, CSDL thật và file mẫu `promotion.t8.xlsx`:

- Hạ ngưỡng luật C4 từ 70% xuống 50% → phát hiện C4 tăng từ **0 lên 189**
- Tắt luật C2 (đang báo 279 dòng) → còn **0**
- Tắt cả nhóm D (D3, D4, D5 đang báo) → **không còn phát hiện nào của nhóm D**
- Khôi phục mặc định toàn bộ → số phát hiện trùng khớp mốc ban đầu
- `maxDiscountPercent = 500` → bị chặn: "Mức giảm tối đa coi là bình thường phải nằm trong khoảng 1 đến 100 %."
- `haravan.page_size = 250` → bị chặn: "Giá trị tối đa cho phép là 50."
- Đổi 2 luật rồi lưu → **chỉ 2 dòng** có `updatedAt` mới, các dòng khác giữ nguyên mốc cũ

## 2026-08-18 — Giai đoạn 06: Màn đối soát sau import (nhóm F)

### Thêm mới

**Tầng Haravan** (`src/lib/haravan/`)

- `promotion-types.ts` — hình dạng phản hồi CTKM, viết từ gọi thật chứ không từ tài liệu
- `promotion-fetcher.ts` — phân trang `GET /com/promotions.json`, học kích thước trang thật từ trang đầu
- `run-promotion-fetch.ts` — nối client thật với cấu hình; gọi hỏng thì trả `null`, không ném lỗi

**Tầng đối soát** (`src/lib/reconcile/`)

- `shop-time.ts` — quy đổi mốc thời gian UTC của Haravan về giờ cửa hàng, so tới phút
- `promotion-mapper.ts` — ánh xạ CTKM thô, quy đổi cả biến thể lẫn sản phẩm về số biến thể
- `program-expectation.ts` — đọc kỳ vọng của một chương trình từ file, quy về đơn vị Haravan
- `promotion-matcher.ts` — khớp theo tên, trả về đủ 4 trạng thái
- `reconcile-engine.ts` — cơ chế hai lượt, chỉ báo phần giao
- `run-reconcile.ts` — đầu mối toàn luồng: đọc file → kéo hai lượt → chạy luật → ghi CSDL
- `match-diff.ts`, `reconcile-match-rows.ts`, `reconcile-queries.ts` — dựng và đọc lại bảng so
- `group-f-reconcile/` — 6 luật F1–F6

**Màn hình & tuyến API**

- `src/app/doi-soat/page.tsx` — chọn lần kiểm tra trước hoặc tải lại file
- `src/app/doi-soat/[runId]/page.tsx` — kết quả một lần đối soát, mở lại được bất cứ lúc nào
- `src/app/api/reconcile/route.ts` — chạy đối soát, phát tiến trình dạng NDJSON
- `src/components/reconcile/` — `diff-table.tsx`, `match-status-badge.tsx`, `reconcile-runner.tsx`

**Kiểm thử** — thêm 88 test trong `test/reconcile/` và `test/haravan/promotion-fetcher.test.ts`; tổng dự án 475 test

### Thay đổi

- `src/lib/rules/run-check.ts` — màn kiểm tra file nay kéo danh sách CTKM về, nhờ vậy **luật D8 và E3 chạy được với dữ liệu thật**. Gọi API hỏng thì việc kiểm tra vẫn chạy, hai luật đó ghi là bỏ qua chứ không kết luận "không có gì trùng"
- `src/lib/catalog/catalog-index.ts` — thêm ba bảng tra: theo id biến thể, theo id sản phẩm, và số biến thể của từng sản phẩm. Luật F5 cần chúng để quy đổi CTKM đính theo sản phẩm
- `src/lib/check/check-run-store.ts` — ghi thêm bảng `ReconcileMatch` trong cùng giao dịch
- `src/lib/ndjson-stream.ts` — tách hàm đọc NDJSON ra dùng chung cho cả màn đồng bộ lẫn màn đối soát
- Thêm cấu hình `shop.timezone_offset_minutes` (mặc định 420) và ngưỡng `percentTolerance` của luật F2

### Thay đổi lược đồ dữ liệu

- `20260818035457_add_reconcile_match` — bảng `ReconcileMatch`, mỗi dòng chụp lại một cặp (chương trình, CTKM trên Haravan). Chụp lại chứ không tham chiếu, vì vài tháng sau CTKM có thể đã bị sửa và file gốc đã bị dọn, mà báo cáo vẫn phải nói được lúc đối chiếu hai bên trông ra sao. Tên trùng thì ghi một dòng cho mỗi ứng viên, để màn hình liệt kê hết thay vì tự chọn
- `20260818040856_add_reconcile_match_sku_count` — thêm cột `excelSkuCount`. Luật F5 so trên **số mã hiệu khác nhau**, không phải số dòng: một chương trình liệt kê trùng mã hiệu chỉ gửi lên Haravan một biến thể

### Bốn chỗ tài liệu Haravan sai hoặc thiếu

Kiểm chứng bằng gọi thật ngày 2026-08-18, chi tiết ở [báo cáo kiểm chứng](../plans/reports/verification-260818-1046-haravan-promotions-api.md):

| Kỳ vọng | Thực tế |
|---|---|
| `GET /promotions.json` | Trả **404**; đường dẫn đúng là `/com/promotions.json` |
| `GET /com/promotions/count.json` | Trả **422** — không có endpoint đếm, khác với `products/count.json` |
| Lọc phía máy chủ | **Bị bỏ qua**: `?status=disabled` vẫn trả CTKM đang bật; tham số lạ cũng bị nuốt im lặng |
| `entitled_variant_ids` | CTKM thật để **rỗng**, dùng `entitled_product_ids` (18 sản phẩm) |

Chỗ thứ tư là chỗ nguy hiểm nhất: cứ đếm `entitled_variant_ids` thì luật F5 sẽ báo "file có 18 mã hiệu, Haravan nhận 0" cho một lần import hoàn toàn đúng.

### Đo trên store dev

| Mục | Kết quả |
|---|---|
| Một lượt đối soát đủ hai lượt | 8,5 giây (8 giây trong đó là khoảng chờ cố ý) |
| F3 với ca `2026-07-22T08:11:00Z` ↔ 15:11 giờ Việt Nam | Im lặng — quy đổi múi giờ đúng |
| F2 với ca file ghi `0.1`, Haravan ghi `10` | Im lặng — quy đổi đơn vị đúng |
| F5 với CTKM đính theo sản phẩm | Tra ra 232 biến thể từ `entitled_product_ids` |
| Lệnh ghi phát sinh lên Haravan | Không có |

Bước "tạo vài CTKM thử rồi xoá" trong kế hoạch ban đầu **đã bỏ**: nó mâu thuẫn với chính cam kết chỉ đọc của giai đoạn này. Kiểm thử đầu-cuối chạy trên CTKM sẵn có của store dev.

## 2026-08-18 — Giai đoạn 05: Màn kiểm tra file & xuất báo cáo

### Thêm mới

**Điều phối & lưu trữ** (`src/lib/check/`)

- `run-file-check.ts` — đầu mối toàn luồng: đọc file → chạy luật → ghi CSDL → lưu file gốc
- `check-run-store.ts` — ghi `CheckRun` + `CheckProgram` + `Finding` theo lô 1.000 dòng trong một giao dịch
- `upload-storage.ts` — lưu và đọc lại file gốc trong `UPLOAD_DIR` (mặc định `./.uploads`)
- `finding-filter.ts` — đọc và dựng bộ lọc từ địa chỉ trang, thuần, không chạm CSDL
- `finding-queries.ts` — mọi truy vấn của màn kết quả

**Xuất báo cáo Excel** (`src/lib/excel/`)

- `report-exporter.ts` — nạp lại file gốc rồi chú thích lên, không dựng lại từ đầu
- `report-summary-sheet.ts` — sheet `Tổng hợp` đặt trước các sheet của người dùng
- `report-styles.ts` — màu theo mức và luật "mức nặng nhất thắng"

**Màn hình & tuyến API**

- `src/app/page.tsx` — màn tải file lên
- `src/app/ket-qua/[runId]/page.tsx` — kết quả một lần chạy, mở lại được bất cứ lúc nào
- `src/app/lich-su/page.tsx` — 100 lần kiểm tra gần nhất
- `src/app/api/check/route.ts` — nhận `multipart/form-data`, giới hạn 20 MB, chặn yêu cầu từ trang khác
- `src/app/api/check/[runId]/export/route.ts` — trả file báo cáo kèm `Content-Disposition`
- `src/components/check/` — 7 thành phần giao diện, chỉ `upload-panel.tsx` chạy phía trình duyệt

**Kiểm thử** — thêm 46 test trong `test/check/` và `test/excel/report-exporter.test.ts`; tổng dự án 386 test

### Thay đổi lược đồ dữ liệu

Migration `20260818032206_add_check_program` thêm bảng `CheckProgram` (tên chương trình, số dòng, số phát hiện từng mức, khoá duy nhất theo `runId` + `name`).

Lý do: màn kết quả phải hiện *số dòng* của chương trình và phải liệt kê cả chương trình sạch. Chương trình không có phát hiện nào thì không để lại dấu vết trong bảng `Finding`, nên hai thứ đó không suy ra được từ dữ liệu đang có.

### Đo trên file thật `promotion.t8.xlsx`

| Việc | Thời gian |
|---|---|
| Toàn luồng kiểm tra | 2,36 giây (ngưỡng 8 giây) |
| Truy vấn một trang 100 dòng đã lọc | 4 ms |
| Dựng file Excel báo cáo | 6,37 giây, 359 KB |

3.931 dòng, 156 chương trình, 2 sheet. Chương trình `2608GST0K` đầu bảng với đúng 279 phát hiện mức `critical`.

### Sửa sau rà soát mã

- **Chương trình không có tên bị báo là sạch.** Rổ `(không có tên)` của bộ gom nhóm không khớp với `programName` `null` mà phát hiện mức dòng ghi ra, nên bảng chương trình hiện `✓ không có vấn đề` cho một chương trình đầy lỗi. `rowRef` nay dùng chung `programKey` với bộ gom nhóm.
- **File có sẵn sheet tên `Tổng hợp` thì không xuất báo cáo được.** `exceljs` ném lỗi khi trùng tên sheet; tên sheet báo cáo nay được dò cho tới khi trống.
- **Giới hạn dung lượng kiểm sau khi thân yêu cầu đã nằm hết trong bộ nhớ.** `Content-Length` nay bị chặn trước `formData()`.
- File `.xls` thật trả 400 kèm hướng dẫn thay vì 500; sheet không có phát hiện nào được trả về nguyên vẹn; dòng tiêu đề dò theo dòng đầu tiên có dữ liệu thay vì mặc định dòng 1.

### Quyết định đáng ghi

- **Bộ lọc nằm trong địa chỉ trang**, khoá tiếng Việt (`muc`, `luat`, `ctkm`, `sku`, `mo`, `trang`). Tải lại trang giữ nguyên bộ lọc, gửi đường dẫn cho đồng nghiệp là họ thấy đúng cái mình đang xem.
- **Lưu CSDL trước, ghi file gốc sau.** Đĩa hỏng thì mất nút xuất báo cáo, không mất kết quả kiểm tra.
- **Tên file lưu trữ bị viết lại thành `[A-Za-z0-9-]`** và đường dẫn giải ra được kiểm lại là còn nằm trong thư mục lưu, ở cả hai chiều ghi và đọc.
- **Hai cột thêm vào đặt sau `columnCount`** của `exceljs`, chấp nhận một cột trống xen giữa, để không ghi đè lên cột nào của người lập file.

## 2026-08-18 — Giai đoạn 04: Bộ máy luật (nhóm A–E)

### Thêm mới

**Bộ máy luật** (`src/lib/rules/`)

- `types.ts` — `Rule`, `RuleContext`, `RuleFinding`, `HaravanPromotion`; quy ước phần trăm trong file luôn là **thập phân**
- `registry.ts` — gom 31 luật, đối chiếu chéo với `rule-catalog.ts` bằng test
- `engine.ts` — lọc luật theo `RuleConfig`, kiểm tra dữ liệu đầu vào, gom và sắp xếp kết quả
- `rule-config-store.ts` — đọc `RuleConfig`, giá trị hỏng thì lùi về mặc định trong danh mục luật
- `run-check.ts` — đầu mối bất đồng bộ: cache danh mục + cấu hình + luật
- `helpers/` — `levenshtein.ts`, `money.ts`, `date-range.ts`, `row-ref.ts`
- `group-a-file-structure/` … `group-e-overlap/` — 31 luật, mỗi luật một file

**Kiểm thử** — 139 test trong `test/rules/`, gồm bộ kiểm chứng chạy trên file thật

### Thiếu dữ liệu thì báo là thiếu, không suy ra kết luận

Mỗi luật khai báo dữ liệu ngoài mà nó cần (`requires`). Bộ máy bỏ qua đúng những luật thiếu dữ liệu và ghi vào `skippedRules`:

| Tình huống | Luật bị bỏ qua | Báo gì |
|---|---|---|
| Cache danh mục rỗng hoặc chưa từng đồng bộ | B1, B2, B3, B5, B6 | Cảnh báo `SYS-CATALOG-EMPTY` mức `critical` |
| Chưa nạp danh sách khuyến mãi Haravan | D8, E3 | Ghi vào `skippedRules` |

Không có chốt chặn này thì lần dùng đầu tiên sẽ ra 3.929 cảnh báo sai "SKU không tồn tại".

### Rủi ro Levenshtein đã thành sự thật

Kế hoạch dự phòng bằng "lọc theo độ dài và 3 ký tự đầu". Đo trên file thật cho thấy **chưa đủ**: 3.931 mã hiệu chỉ rơi vào 24 rổ 3 ký tự, rổ lớn nhất ôm 31% — mã của cửa hàng gần như đều bắt đầu bằng `km`.

| Tình huống | Trước | Sau |
|---|---|---|
| Danh mục ~59.000 biến thể, **không** chứa mã nào của file | 83 giây | **365 ms** |
| Danh mục đầy đủ | — | 22 ms |
| 20 mã sai giữa danh mục đầy đủ | — | 26 ms, 9/20 mã có gợi ý |

Cách xử lý: tham số `suggestMaxComparisons` (mặc định 2.000.000) giới hạn công sức tìm mã gần giống cho cả lượt kiểm tra. Hết hạn mức thì ngừng gợi ý — **cảnh báo vẫn phát đủ**, và phần gợi ý nói thẳng là đã ngừng vì có quá nhiều mã không tra ra.

### Điểm lệch so với kế hoạch

- **C2** bắt thêm ô `Số tiền giảm` để trống trên dòng kiểu "theo số tiền". Chương trình `2608GST0K` có 275 dòng ghi `0` và 4 dòng để trống; cả 279 dòng cùng dẫn tới lỗi 422.
- **Nhóm B** bỏ qua theo từng luật thay vì trọn gói. B4 chỉ đọc dữ liệu trong file nên vẫn chạy khi cache rỗng.
- **Nhóm D** báo theo chương trình, không theo dòng — Haravan tạo một chương trình cho mỗi `Tên ctkm`, nên một ngày sai là một lỗi chứ không phải 279 lỗi.
- **`runRules` đồng bộ**, phần đọc CSDL tách sang `rule-config-store.ts` và `run-check.ts`. Toàn bộ test luật chạy không cần CSDL.
- **`SheetSummary` thêm `blankRowNumbers`** (sửa code giai đoạn 03) để luật A5 biết dòng trống nằm ở đâu. Chỉ ghi dòng trống nằm giữa vùng dữ liệu.

### Sửa một test chớp tắt của giai đoạn 03

`test/excel/excel-reader.test.ts` khẳng định bộ đọc luồng của `exceljs` *luôn* ném lỗi với file do chính `exceljs` ghi. Đo lại: tuần tự ném lỗi 59/60 lần, song song ném **0/60** — đua tranh trong `exceljs`, tuỳ mỗi vòng lặp sự kiện nhận được bao nhiêu dữ liệu. Test đổi sang khẳng định phần tất định: dù đường nào thắng, `readWorkbook` vẫn trả đúng dữ liệu.

### Số đo trên file thật `promotion.t8.xlsx`

- **C2 bắt đúng 279 dòng** của `2608GST0K`, thông báo nêu rõ Haravan sẽ trả 422
- **A2 liệt kê cả 2 sheet**: `Key` 3.929 dòng, `Giảm phần trăm` 2 dòng
- **D4** báo ngày bắt đầu 01/08/2026 đã trôi qua 17 ngày
- C1, E1, E2, A4, A5, B4 đều 0 phát hiện — khớp kết quả khảo sát
- Tắt luật trong `RuleConfig` → luật biến mất khỏi kết quả, xuất hiện trong `skippedRules`
- Hạ `maxDiscountPercent` → số phát hiện của C4 tăng theo
- Chạy 31 luật trên 3.931 dòng: ~30 ms (ngưỡng yêu cầu: dưới 3 giây)
- `npm run typecheck`, `lint`, `build` sạch; `npm test` 340 test pass

### Còn treo

- **B6 ở mức `danger`.** Nâng lên `critical` cần bật cờ `not_allow_promotion` trên một sản phẩm ở store dev rồi thử tạo khuyến mãi — đó là lệnh **ghi** lên Haravan, trái nguyên tắc "chỉ đọc", nên chờ xác nhận trước khi làm.
- **D8, E3** chưa chạy với dữ liệu thật; `promotion-fetcher.ts` thuộc giai đoạn 06.
- **Nhóm B** chưa đối chiếu danh mục thật của cửa hàng — store dev không có 3.929 mã hiệu này.
- **D1, D2** vẫn tắt mặc định. Quy ước tên `YYMM` + `GST`/`GPT` + giá trị đúng với cả 156 chương trình của file mẫu, nhưng đó là thói quen đặt tên chứ không phải ràng buộc.

## 2026-08-18 — Giai đoạn 03: Đọc & chuẩn hoá file Excel

### Thêm mới

**Tầng đọc Excel** (`src/lib/excel/`)

- `types.ts` — `PromotionRow`, `PromotionProgram`, `WorkbookReadResult`
- `cell-value.ts` — bóc tách ô công thức, rich text, hyperlink, ô lỗi
- `number-parser.ts` — ô trống trả `null`, không trả `0`
- `date-parser.ts` — 4 định dạng ngày, dựng lại `Date` từ thành phần UTC nên không lệch múi giờ
- `column-mapper.ts` — dò cột 2 lượt (khớp chính xác trước, khớp chứa sau, từ khoá dài ưu tiên)
- `excel-reader.ts` — đọc theo luồng, băm SHA-256, kiểm chữ ký đầu tệp
- `text-repair.ts` — vá chữ hỏng do lỗi giải mã của `exceljs`
- `row-normalizer.ts` — dòng thô → `PromotionRow`, ghi `issues` cho từng ô hỏng
- `program-grouper.ts` — gom theo `Tên ctkm`, thu thập các giá trị khác nhau trong cùng chương trình
- `promotion-workbook.ts` — đầu mối duy nhất: bytes → `WorkbookReadResult`

**Kiểm thử** — 139 test, 8 file trong `test/excel/`

### Ba lỗi của `exceljs` phải né

Phát hiện khi đối chiếu với XML gốc của file mẫu. **Mỗi bộ đọc sai một kiểu khác nhau**, không bộ nào dùng một mình được:

| Lỗi | Hậu quả nếu bỏ qua | Cách xử lý |
|---|---|---|
| Bộ đọc buffered đánh rơi kết quả `0` của ô công thức chia sẻ (`Key!I51` có `<v>0</v>` nhưng trả về rỗng) | Đúng 279 ô — toàn bộ chương trình `2608GST0K`. Tính năng cốt lõi "phát hiện dòng giảm 0đ" sẽ báo ô trống thay vì 0 | Lấy bộ đọc luồng làm gốc cho mọi giá trị |
| Bộ đọc luồng làm hỏng ký tự UTF-8 vắt qua ranh giới chunk (`parse-sax.js:21` giải mã từng chunk riêng lẻ, không dùng `StringDecoder`) | Chữ tiếng Việt hỏng. Nguy hiểm nhất là cột `Kiểu ctkm`: "Giảm giá theo số tiền" hỏng sẽ sinh cảnh báo sai | Phát hiện `U+FFFD` thì đọc thêm buffered, chỉ thay riêng chuỗi hỏng |
| Bộ đọc luồng sập với file do chính `exceljs` ghi (`workbook-reader.js:303` truy cập `this.model` chưa khởi tạo, vì `xl/workbook.xml` nằm cuối zip) | Không đọc được file xuất từ phần mềm nội bộ | Đường lui sang bộ đọc buffered |

### Điểm lệch so với kế hoạch

- **Ô công thức**: đặc tả không nhắc, nhưng 100% ô `Tên ctkm` và `Số tiền giảm` trong sheet `Key` là công thức. Đọc thẳng `cell.value` sẽ gom cả 3.929 dòng vào một chương trình `[object Object]`.
- **Tiêu đề `Số dư`** là rich text `{ richText: [...] }` với ký tự `\n`, không phải chuỗi `"Số dư\r\n(...)"` như đặc tả ghi.
- **Không copy file mẫu vào `test/fixtures/`** — đó là dữ liệu kinh doanh thật và `.gitignore` đang loại trừ `*.xlsx`. Test dựng file `.xlsx` trong bộ nhớ cho ca biên; test đối chiếu file thật tự bỏ qua khi không có file.

### Số đo trên file thật `promotion.t8.xlsx`

- 2 sheet, 3.931 dòng, 154 chương trình ở sheet `Key`, **279 dòng giảm 0đ** của `2608GST0K` — khớp đúng kỳ vọng
- Đọc trọn file kể cả bước vá chữ: ~1.100–1.300 ms (ngưỡng yêu cầu: dưới 2 giây)
- Riêng bộ đọc luồng: ~100 ms. Bước vá chữ chỉ chạy khi phát hiện chữ hỏng
- `npm run typecheck`, `lint` sạch; `npm test` 201 test pass

## 2026-08-17 — Giai đoạn 02: Haravan client & đồng bộ danh mục

### Thêm mới

**Tầng gọi API Haravan** (`src/lib/haravan/`)

- `types.ts` — kiểu dữ liệu viết theo phản hồi thật, kèm mẫu và ngày kiểm chứng
- `rate-limiter.ts` — bình chứa token, đồng hồ tiêm được từ ngoài, đọc header `X-Haravan-Api-Call-Limit`
- `haravan-errors.ts` — 6 lớp lỗi phân loại rõ
- `haravan-client.ts` — chỉ `GET`, gắn Bearer token, thử lại khi 429/5xx theo `Retry-After`
- `catalog-sync.ts` — duyệt trang, tải trước trang kế, kiểm tra tính trọn vẹn
- `sync-cursor.ts` — tính mốc cho lượt đồng bộ tăng dần
- `run-catalog-sync.ts` — ráp client thật với kho lưu thật

**Cache danh mục** (`src/lib/catalog/`)

- `sku.ts` — luật chuẩn hoá SKU duy nhất cho toàn bộ mã nguồn
- `catalog-store.ts` — ghi xuống Prisma theo lô, tính số liệu bằng một câu SQL
- `catalog-index.ts` — tra cứu bằng `Map`, đệm 60 giây, `bySku` trả mảng

**Giao diện và tuyến API**

- `src/app/api/sync/route.ts` — chạy đồng bộ, phát tiến trình NDJSON
- `src/app/dong-bo/` — màn hình ③ Đồng bộ danh mục
- Thanh điều hướng trong `src/app/layout.tsx`

**Kiểm thử** — 62 test, thêm 6 file trong `test/haravan/` và `test/catalog/`

### Thay đổi

- `haravan.page_size` giới hạn xuống tối đa **50** (trước là 250). Haravan ép cứng `limit` về 50 phía máy chủ; đặt lớn hơn sẽ khiến một trang đầy 50 phần tử bị hiểu nhầm là trang cuối → đồng bộ dừng sớm → bước dọn dẹp xoá phần còn lại của cache mà vẫn đóng dấu thành công. Bộ phân trang giờ còn tự học kích thước trang thật từ trang 1 thay vì tin cấu hình.
- `AppSetting` tăng từ 7 lên **10 khoá**: thêm `haravan.max_attempts` (4), `catalog.cursor_overlap_ms` (300000), `catalog.sync_shortfall_tolerance` (0).

### Sửa lỗi tiềm ẩn — phát hiện khi rà soát mã nguồn

| Vấn đề | Vì sao nguy hiểm |
|---|---|
| Cấu hình kích thước trang lớn hơn 50 làm đồng bộ cụt rồi xoá sạch cache, vẫn đóng dấu thành công | Đây đúng là kịch bản "mất dữ liệu mà không ai biết"; sau đó toàn bộ nhóm luật B báo hàng ngàn "SKU không tồn tại" giả |
| Duyệt hết trang mà vẫn thiếu dữ liệu thì không ném lỗi nào | Nay đọc `products/count.json` trước, kéo về thiếu quá dung sai thì ném lỗi **trước khi** dọn dẹp và không đóng dấu `lastFullSyncAt` |
| Mốc đồng bộ tăng dần bỏ sót vĩnh viễn sản phẩm sửa lúc đang đồng bộ | Nay lùi mốc lại `catalog.cursor_overlap_ms` |
| Trình duyệt ngắt kết nối làm lượt đồng bộ đứt giữa chừng | Nay nuốt lỗi ghi ra luồng, lượt đồng bộ chạy tới hết để CSDL về trạng thái nhất quán |
| Thông báo lỗi nội bộ đi thẳng ra trình duyệt, máy chủ không ghi log gì | Lỗi Prisma và driver chứa tên máy chủ CSDL. Nay ghi log đầy đủ phía máy chủ, trình duyệt chỉ nhận thông báo trong danh sách cho phép |
| Chốt chặn SKU rỗng lách được bằng cách nối `?sku=` vào đường dẫn | Nay từ chối luôn đường dẫn tự chứa `?`, có test khẳng định |
| Mỗi client tạo bộ điều tiết nhịp riêng | Hai bên gọi song song thành 6 lượt/giây, vượt mức rỉ 4/giây. Nay dùng chung một bộ điều tiết cho mỗi địa chỉ API |
| `POST /api/sync` nhận được yêu cầu gửi chéo trang | Nay từ chối qua header `Sec-Fetch-Site` |
| Token có thể lọt vào thông báo lỗi qua nội dung phản hồi | Nay thay bằng `***` ngay tại chỗ dựng lỗi |

### Kiểm chứng bằng gọi thật (store dev)

- `GET /com/products/count.json` → 74; đồng bộ đầy đủ kéo về đúng **74 sản phẩm / 937 biến thể** trong 0,7–1,1 giây qua 2 trang
- 3 biến thể có SKU rỗng, 0 nhóm SKU trùng, 238 biến thể có sản phẩm cha `published_at = null`
- `limit=250` xác nhận bị ép về 50; `page=2` trả 24 phần tử không chồng lấn trang 1; `updated_at_min` chạy đúng
- **Thứ tự `products.json` là `id` giảm dần** — không phải `updated_at` như từng lo, nên phân trang ổn định trước các thao tác sửa
- Đồng bộ tăng dần: 1 sản phẩm / 15 biến thể trong 65 mili giây
- Chạy hai lượt đồng bộ cùng lúc → HTTP 409; gửi yêu cầu chéo trang → HTTP 403
- `npm run typecheck`, `lint`, `build` sạch; `npm test` 62 test pass

### Chưa kiểm chứng

Ngân sách 30 giây cho 3.000 sản phẩm — store dev chỉ có 74 sản phẩm.

## 2026-08-17 — Giai đoạn 01: Nền tảng dự án & lược đồ dữ liệu

### Thêm mới

- Khung Next.js 15 App Router + TypeScript + Tailwind v4 + shadcn/ui
- Prisma 7 nối PostgreSQL trong WSL, 6 bảng, migration `init`
- `rule-catalog.ts` — 37 luật kèm mặc định, dùng chung cho seed và bộ máy luật
- `prisma/seed.ts` dùng `upsert`, chạy lại nhiều lần không nhân đôi dữ liệu
- `app-config.ts` — đọc `AppSetting` có kiểm bằng `zod` và giá trị dự phòng
- `bigint.ts` — chuyển `BigInt` qua ranh giới server ↔ trình duyệt

### Điểm lệch so với kế hoạch

- Prisma cài về là bản 7: chuỗi kết nối nằm ở `prisma.config.ts`, generator đổi thành `provider = "prisma-client"`, bắt buộc driver adapter. Bản 7 không còn engine nhị phân nên `binaryTargets` không còn tác dụng.
- Tailwind v4 cấu hình bằng CSS, không sinh file config.
- Đổi font Geist sang Inter + JetBrains Mono — Geist không có subset `vietnamese` nên chữ có dấu rơi về font hệ thống.
