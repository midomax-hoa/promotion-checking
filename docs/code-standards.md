# Chuẩn mã nguồn

Áp dụng cho toàn bộ mã trong kho này. Nguyên tắc nền: **YAGNI — KISS — DRY**.

## Quy ước chung

- **Tên file kebab-case**, đặt tên mô tả đúng việc file làm. Dài cũng được, miễn đọc tên là biết nội dung.
- **Mỗi file dưới 200 dòng.** Vượt thì tách theo ranh giới trách nhiệm, đừng cắt bừa cho đủ số.
- **Comment trong mã viết bằng tiếng Anh**, giải thích **tại sao** chứ không phải **cái gì**. Ngoại lệ giữ tiếng Việt: thuật ngữ nghiệp vụ Việt Nam và chuỗi người dùng đọc thấy.
- **Thông báo cho người dùng viết tiếng Việt**, kèm gợi ý sửa cụ thể.
- **Commit message viết tiếng Anh**, theo chuẩn conventional commit.
- **Tài liệu trong `docs/` và `plans/` viết tiếng Việt**, giọng trung lập, không nhân xưng.

## Không chôn cứng giá trị nghiệp vụ

Mọi ngưỡng, mệnh giá, khung thời gian, số lượt thử đều phải nằm trong `AppSetting` hoặc `RuleConfig.params`, đọc qua `getAppConfig()`. Con số viết trong tài liệu chỉ là **giá trị mặc định**, không phải hằng số.

Được phép chôn cứng khi là ràng buộc kỹ thuật thật, và phải ghi rõ lý do ngay tại chỗ:

```ts
/** Safety net against a misconfigured page size turning the loop into an infinite one. */
const MAX_PAGES = 2000
```

Mọi giá trị đọc từ CSDL phải kiểm bằng `zod` và có giá trị dự phòng. Lý do: `Number('')` bằng 0 và vẫn là số hữu hạn, nên cách kiểm ngây thơ sẽ để lọt số 0 vào bộ điều tiết nhịp hoặc bộ phân trang.

```ts
// Đúng: có kiểm tra, có chặn trên chặn dưới, sai thì rơi về mặc định
haravanPageSize: [APP_SETTING_KEYS.haravanPageSize, positiveInt.max(50)]
```

## Chuẩn hoá SKU — chỉ một luật duy nhất

Toàn bộ mã nguồn dùng chung `src/lib/catalog/sku.ts`. Không viết lại luật này ở bất kỳ đâu khác.

| Hàm | Dùng cho |
|---|---|
| `normalizeSku` | Khoá tra cứu: cắt khoảng trắng rồi hạ chữ thường; rỗng → `null` |
| `displaySku` | Hiển thị: cắt khoảng trắng, giữ nguyên hoa thường; rỗng → `null` |
| `isBlankSku` | Kiểm nhanh |

**SKU rỗng không bao giờ được đưa vào truy vấn Haravan.** Lý do đã kiểm chứng bằng gọi thật: `GET /com/products.json?sku=` với giá trị rỗng trả về **50 sản phẩm bất kỳ** thay vì báo lỗi, đủ để gắn nhầm một dòng khuyến mãi vào sản phẩm không liên quan. Chốt chặn nằm ở hai lớp trong `haravan-client.ts` và đều có test khẳng định:

1. Bộ dựng truy vấn từ chối mọi giá trị rỗng.
2. Đường dẫn tự chứa sẵn `?` bị từ chối, để không ai lách bằng cách nối chuỗi tay.

SKU rỗng lưu xuống CSDL thành `NULL`, để "không có SKU dùng được" chỉ còn một điều kiện thay vì lẫn lộn giữa `null` và chuỗi khoảng trắng.

## Gọi API Haravan

- **Chỉ `GET`.** Không thêm phương thức ghi vào `HaravanClient`.
- **Kiểu dữ liệu viết theo phản hồi thật**, không theo tài liệu chính chủ — tài liệu đã sai ở ít nhất một chỗ. Ghi kèm ngày kiểm chứng và mẫu phản hồi thật trong comment.
- **Mọi tham số truyền qua đối số `query`**, không nối vào đường dẫn.
- **429 là chuyện giới hạn nhịp, không phải dữ liệu sai.** Nó có lớp lỗi riêng và phải không bao giờ bị báo thành lỗi dữ liệu.
- Thông báo lỗi không bao giờ chứa token. Nội dung phản hồi nhúng vào lỗi đã được thay token bằng `***`.

## Prisma

- **Tuyệt đối không dùng `prisma db push`.** Mọi thay đổi lược đồ phải tạo migration: `prisma migrate dev --name ...`. `package.json` cố tình không có script `db:push`.
- Prisma client khởi tạo **trễ** qua `Proxy` — khởi tạo ngay lúc nạp module sẽ làm `next build` đứt khi không có CSDL, và không viết test được nếu thiếu CSDL sống.
- Ghi theo lô: xoá-rồi-chèn trong một giao dịch, thay vì `upsert` từng dòng.
- **`BigInt` phải chuyển thành chuỗi tại ranh giới server ↔ trình duyệt** qua `src/lib/serialization/bigint.ts`. `JSON.stringify` ném lỗi khi gặp `BigInt`, và lỗi này chỉ lộ ra lúc chạy thật.

## Kiểm thử

- Test đặt trong `test/`, soi gương theo cấu trúc `src/`.
- **Tách phần thuần khỏi phần chạm ra ngoài** để test không cần CSDL hay mạng. Ví dụ `catalog-store.ts` tách khỏi `catalog-sync.ts`, nhờ vậy toàn bộ logic phân trang test được bằng kho lưu giả.
- **Tiêm đồng hồ và hàm ngủ từ ngoài** cho những chỗ phụ thuộc thời gian, để test chạy tức thì thay vì chờ thật.
- Tên test nói rõ hành vi được bảo vệ, không nói tên hàm.
- **Không bỏ qua test hỏng cho qua bản dựng.** Không dùng dữ liệu giả, mẹo vặt hay giải pháp tạm để làm xanh CI.

## Màn cấu hình và Server Action

- **Giá trị nghiệp vụ mô tả một lần.** Ngưỡng của luật khai trong `rule-config-schema.ts` kèm nhãn, đơn vị và khoảng cho phép; lược đồ `zod` dựng ra từ mô tả đó chứ không viết tay song song. Hai nguồn thì sớm muộn cũng lệch.
- **Mã luật và mã nhóm lấy từ danh mục trong mã nguồn, không lấy từ biểu mẫu.** Biểu mẫu chỉ cung cấp *giá trị*; danh sách *khoá* luôn là `RULE_CATALOG`.
- **Chỉ ghi dòng thật sự đổi**, để `updatedAt` giữ đúng nghĩa.
- **Nút khôi phục mặc định không bị chặn bởi giá trị đang sai** của chính ô nó khôi phục.
- **Trả lại nguyên văn giá trị bị từ chối** trong trạng thái của Server Action. React tự `reset` biểu mẫu sau khi action trả về, không làm vậy thì ô nhập bật về giá trị cũ trong khi lỗi vẫn trỏ vào nó.
- **Biểu mẫu đặt `noValidate`** để thông báo tiếng Việt của công cụ được hiện, thay vì bong bóng tiếng Anh của trình duyệt.
- Module `'use server'` **chỉ được export hàm async**. Kiểu và hằng dùng chung phải đặt ở file khác.
- Phần đọc biểu mẫu tách khỏi phần chạm CSDL (`rule-config-form.ts` so với `actions.ts`), để toàn bộ đường kiểm tra hợp lệ test được không cần CSDL.

## Giao diện

- **Render phía máy chủ.** Truy vấn, lọc, sắp xếp, phân trang làm ở server; Server Component dựng sẵn bảng. Không kéo hết dữ liệu về trình duyệt rồi mới lọc bằng JS.
- Thành phần phía trình duyệt chỉ dùng khi thật cần tương tác, và giữ càng nhỏ càng tốt.
- Trang đọc CSDL đặt `export const dynamic = 'force-dynamic'`.

## Trước khi commit

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest run
npm run build       # next build
```

Tất cả phải sạch. **Không commit** file `.env`, khoá API, thông tin CSDL, hay file Excel dữ liệu thật.
