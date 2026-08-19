# promotion-checking

Công cụ kiểm tra file Excel khuyến mãi **trước khi import vào Haravan**, và đối soát lại **sau khi import**.

Trả lời hai câu hỏi:

1. File này import vào Haravan được chưa — sai chỗ nào, sửa thế nào?
2. Haravan đã nhận đúng như file chưa?

Công cụ **chỉ đọc** dữ liệu Haravan. Không có lệnh ghi nào trong toàn bộ mã nguồn.

## Công nghệ

Next.js 15 (App Router) · React 19 · TypeScript · Prisma 7 + PostgreSQL · Tailwind CSS 4 · Vitest

## Chạy trên máy phát triển

```bash
npm install
cp .env.example .env          # điền DATABASE_URL và HARAVAN_API_TOKEN
npx prisma migrate deploy     # dựng lược đồ
npm run db:seed               # nạp 37 luật, thiết lập mặc định, tài khoản đầu tiên
npm run user:create           # nếu chưa đặt AUTH_SEED_* trong .env
npm run dev
```

Mọi màn hình đều đòi đăng nhập. Tài khoản cấp bằng lệnh `npm run user:create`, không tự đăng ký được.

## Lệnh hay dùng

```bash
npm run dev          # máy phát triển
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # vitest run
npm run db:migrate   # tạo migration mới
npm run user:list    # xem danh sách tài khoản
```

Triển khai bằng Docker Compose: xem [`docs/van-hanh-va-trien-khai.md`](docs/van-hanh-va-trien-khai.md).

## Tài liệu

| Tài liệu | Dành cho |
|---|---|
| [`docs/huong-dan-su-dung.md`](docs/huong-dan-su-dung.md) | Người nhập khuyến mãi — không cần biết lập trình |
| [`docs/van-hanh-va-trien-khai.md`](docs/van-hanh-va-trien-khai.md) | Quản trị hệ thống: biến môi trường, Docker, sao lưu, tài khoản |
| [`docs/system-architecture.md`](docs/system-architecture.md) | Kiến trúc và lý do đằng sau từng quyết định |
| [`docs/codebase-summary.md`](docs/codebase-summary.md) | Bản đồ mã nguồn, điểm vào nhanh cho người mới |
| [`docs/code-standards.md`](docs/code-standards.md) | Quy ước viết mã |
| [`docs/project-changelog.md`](docs/project-changelog.md) | Nhật ký thay đổi |

## Lưu ý

- **Không dùng `prisma db push`.** Mọi thay đổi lược đồ phải tạo migration.
- **Không commit** `.env`, `.env.production`, hay file `.xlsx` dữ liệu thật.
