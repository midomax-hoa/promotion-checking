# Giai đoạn 08 — Triển khai bằng Docker Compose

## Liên kết bối cảnh

- [Tổng quan kế hoạch](plan.md) · [Giai đoạn 01](phase-01-nen-tang-du-an-va-luoc-do-du-lieu.md) · [Giai đoạn 05](phase-05-man-kiem-tra-file-va-xuat-bao-cao.md) · [Giai đoạn 07](phase-07-man-cau-hinh-luat-va-tai-lieu.md)
- [Báo cáo brainstorm](../reports/brainstorm-260817-1019-promotion-import-checking-tool.md) — mục 4 (kiến trúc)

## Tổng quan

- **Ưu tiên:** Trung bình — làm sau khi ứng dụng chạy được ở máy cá nhân
- **Trạng thái:** Chưa làm
- **Phụ thuộc:** Giai đoạn 05 (luồng chính đã chạy được). Không cần chờ 06/07.
- Đóng gói ứng dụng thành image, dựng bằng Docker Compose trên **máy chủ Linux**: một lệnh `docker compose up -d` là có web chạy sau reverse proxy có HTTPS. CSDL **nằm ở máy chủ khác**, chỉ trỏ tới bằng chuỗi kết nối.

## Điều kiện đã chốt

| Hạng mục | Chốt |
|---|---|
| Máy chủ triển khai | Linux |
| CSDL | Đặt ở máy chủ khác — **không** dựng service `postgres` trong compose. Cấu hình kết nối do bên quản trị CSDL cung cấp |
| Reverse proxy + HTTPS | Có — dùng Caddy trong cùng compose |
| File Excel đã nạp | **Giữ lại** trên đĩa, nằm trong volume; loại khỏi kho mã nguồn qua `.gitignore` |

## Nhận định quan trọng

- **Ứng dụng không sở hữu CSDL.** CSDL dùng chung ở máy chủ khác → mọi lệnh có ghi (`prisma migrate deploy`, seed) phải **xác nhận trước khi chạy**, và phải in ra host + tên CSDL đang nhắm tới. Ứng dụng chỉ được cấp một CSDL riêng, không đụng schema của dự án khác trên cùng máy chủ đó.
- **Next.js phải bật `output: 'standalone'`** thì image mới gọn (~200 MB thay vì ~1,2 GB). Đã bật sẵn trong `next.config.ts` từ giai đoạn 01.
- ~~**Prisma + Alpine cần `binaryTargets`** `linux-musl-openssl-3.0.x`.~~ **Không còn cần** — bản cài thực tế là Prisma 7.9.1, client sinh ra là mã TypeScript thuần, không kèm engine nhị phân (đã kiểm chứng: thư mục `src/generated/prisma` không có file `.node` nào). Thay vào đó phải chú ý ba điểm khác: client nằm ở `src/generated/prisma` nên **phải chạy `prisma generate` trong bước build của Dockerfile**; chuỗi kết nối đọc từ `prisma.config.ts` chứ không phải `schema.prisma`; và runtime cần gói `@prisma/adapter-pg`.
- **Migration không chạy được trong image chạy thật.** Bản `standalone` không kèm Prisma CLI. Tách service `migrate` chạy một lần rồi thoát; `app` chỉ khởi động sau khi service này kết thúc thành công.
- **Chạy sau reverse proxy làm Server Action bị chặn nếu không khai `allowedOrigins`.** Next.js 15 đối chiếu `Origin` với `Host`; qua proxy hai giá trị này lệch nhau → báo `Invalid Server Actions request`. Bắt buộc khai tên miền thật vào `experimental.serverActions.allowedOrigins`.
- **File Excel giữ lại nằm trong volume, không nằm trong image, không nằm trong repo.** Đây là dữ liệu kinh doanh thật (giá vốn, giá bán) → cần dọn định kỳ và sao lưu tách khỏi CSDL.
- **Múi giờ `Asia/Ho_Chi_Minh`** cho mọi service. Nhóm luật D so sánh ngày; container chạy UTC sẽ lệch 7 giờ, báo sai ở các mốc quanh nửa đêm.

## Yêu cầu

**Chức năng**
- `docker compose up -d` → truy cập được qua HTTPS ở tên miền nội bộ đã cấp
- Migration và seed tự chạy trước khi ứng dụng nhận yêu cầu
- File Excel đã nạp và kết quả kiểm tra còn nguyên sau `docker compose down` rồi `up` lại
- Nâng cấp: `docker compose build && docker compose up -d` — không mất dữ liệu, không thao tác tay
- Có lệnh sao lưu / phục hồi CSDL và sao lưu thư mục file tải lên
- Có cơ chế dọn file Excel cũ theo số ngày cấu hình được

**Phi chức năng**
- Image ứng dụng dưới 400 MB
- Không nhúng bí mật vào image (token, chuỗi kết nối đọc lúc chạy)
- Container ứng dụng chạy bằng người dùng không phải `root`
- Chỉ Caddy mở cổng ra ngoài (80/443); ứng dụng không công bố cổng 3000
- HTTP tự chuyển hướng sang HTTPS
- `healthcheck` cho `app`, container hỏng thì tự khởi động lại
- Nhật ký giới hạn dung lượng

## Kiến trúc

```
Dockerfile                    # 4 chặng: deps → builder → migrator → runner
.dockerignore
docker-compose.yml
docker-compose.override.yml.example
Caddyfile
.env.production.example
scripts/
  backup-db.sh                # pg_dump qua container tiện ích
  restore-db.sh
  backup-uploads.sh           # đóng gói volume file tải lên
  prune-uploads.sh            # dọn file Excel quá hạn
src/app/api/health/route.ts   # trả 200 kèm trạng thái CSDL
```

### Sơ đồ dịch vụ

```
        Internet / mạng nội bộ công ty
                    │  443 (HTTPS), 80 → chuyển hướng
                    ▼
┌──────────────────────────────────────────────────────────┐
│ docker compose (máy chủ Linux)                           │
│                                                          │
│   ┌─────────┐        ┌──────────────┐                    │
│   │  caddy  │───────▶│     app      │                    │
│   │ 80/443  │  3000  │ next         │                    │
│   │ tự cấp  │        │ standalone   │                    │
│   │ chứng   │        │ (không mở    │                    │
│   │ chỉ TLS │        │  cổng ra)    │                    │
│   └────┬────┘        └──────┬───────┘                    │
│        │                    │  chạy sau  ┌─────────────┐ │
│        │                    └────────────│   migrate   │ │
│        │                                 │  (một lần)  │ │
│        ▼                                 └──────┬──────┘ │
│  volume caddy-data                              │        │
│  (chứng chỉ TLS)      volume uploads ◀──────────┘        │
│                       (file Excel đã nạp)                │
└─────────────────────────────┬────────────────────────────┘
                              │ 5432
                              ▼
                  PostgreSQL ở máy chủ khác
                  (bên quản trị CSDL cấp cấu hình)
```

### `next.config.ts` — sửa từ giai đoạn 01

```ts
const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb', // file Excel khuyến mãi có thể vài MB
      // Bắt buộc khi chạy sau reverse proxy. Đọc từ biến môi trường,
      // không ghi cứng tên miền vào mã nguồn.
      allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'localhost:3000').split(','),
    },
  },
}
```

`allowedOrigins` đọc lúc **dựng**, nên `ALLOWED_ORIGINS` phải truyền vào bước build (`build.args` trong compose), không phải chỉ lúc chạy.

### Dockerfile

```dockerfile
# ---------- deps ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- builder ----------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ARG ALLOWED_ORIGINS
ENV ALLOWED_ORIGINS=$ALLOWED_ORIGINS
# Chuỗi kết nối giả, chỉ để qua bước dựng — không kết nối thật lúc build
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"
RUN npm run build

# ---------- migrator (một lần, không phục vụ web) ----------
FROM node:22-alpine AS migrator
WORKDIR /app
ENV TZ=Asia/Ho_Chi_Minh
RUN apk add --no-cache tzdata
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma
COPY src/lib/rules ./src/lib/rules
COPY package.json tsconfig.json ./
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts"]

# ---------- runner ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV TZ=Asia/Ho_Chi_Minh
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache tzdata \
 && addgroup -g 1001 -S nodejs \
 && adduser -u 1001 -S nextjs -G nodejs

# Tạo sẵn /data với đúng chủ sở hữu — Docker nhân bản quyền này khi tạo volume lần đầu
RUN mkdir -p /data/uploads && chown -R nextjs:nodejs /data

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

### `docker-compose.yml`

```yaml
services:
  migrate:
    build:
      context: .
      target: migrator
    environment:
      DATABASE_URL: ${DATABASE_URL:?thiếu DATABASE_URL}
    restart: "no"
    logging: &log-opts
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  app:
    build:
      context: .
      target: runner
      args:
        ALLOWED_ORIGINS: ${APP_DOMAIN:?thiếu APP_DOMAIN}
    env_file: .env.production
    environment:
      UPLOAD_DIR: "/data/uploads"
    expose:
      - "3000"          # chỉ trong mạng compose, không ánh xạ ra máy chủ
    volumes:
      - uploads:/data/uploads
    depends_on:
      migrate:
        condition: service_completed_successfully
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s
    restart: unless-stopped
    logging: *log-opts

  caddy:
    image: caddy:2-alpine
    environment:
      APP_DOMAIN: ${APP_DOMAIN}
      TZ: Asia/Ho_Chi_Minh
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data          # chứng chỉ TLS — mất là phải xin cấp lại
      - caddy-config:/config
    depends_on:
      app:
        condition: service_healthy
    restart: unless-stopped
    logging: *log-opts

  # Chỉ chạy khi cần: docker compose --profile tools run --rm dbtools ...
  dbtools:
    image: postgres:18-alpine
    profiles: ["tools"]
    environment:
      DATABASE_URL: ${DATABASE_URL}
      TZ: Asia/Ho_Chi_Minh
    volumes:
      - ./backups:/backups
    entrypoint: ["sh", "-c"]
    command: ["echo 'dùng docker compose run --rm dbtools \"pg_dump ...\"'"]

volumes:
  uploads:
  caddy-data:
  caddy-config:
```

### `Caddyfile`

```caddyfile
{$APP_DOMAIN} {
	reverse_proxy app:3000

	# File Excel vài MB — nới giới hạn thân yêu cầu
	request_body {
		max_size 25MB
	}

	encode gzip
	log {
		output stdout
		format console
	}
}
```

**Chứng chỉ TLS — chọn một trong hai, tuỳ tên miền:**

| Tình huống | Cấu hình | Ghi chú |
|---|---|---|
| Tên miền công khai, phân giải được từ Internet | Để nguyên như trên | Caddy tự xin Let's Encrypt và tự gia hạn |
| Tên miền chỉ dùng trong mạng nội bộ | Thêm `tls internal` vào khối site | Caddy tự dựng CA riêng; máy người dùng phải cài chứng chỉ gốc của CA đó, không thì trình duyệt vẫn báo đỏ |
| Công ty đã có chứng chỉ riêng | `tls /etc/caddy/cert.pem /etc/caddy/key.pem` | Gắn thêm volume chứa file chứng chỉ; tự lo việc gia hạn |

Chọn đường nào thì ghi rõ trong `docs/van-hanh-va-trien-khai.md`, kèm cách gia hạn.

### `.env.production.example`

```dotenv
# Tên miền công bố — dùng cho cả Caddy và allowedOrigins của Server Action
APP_DOMAIN=promotion.noi-bo.example.com

# CSDL đặt ở máy chủ khác — do bên quản trị CSDL cung cấp.
# Ký tự đặc biệt trong mật khẩu phải mã hoá URL (@ → %40).
# Nên bật SSL nếu đường truyền ra khỏi máy chủ: ?sslmode=require
DATABASE_URL=postgresql://USER:PASSWORD@db-host:5432/promotion_checking?sslmode=require

# Token Haravan — chỉ dùng quyền đọc
HARAVAN_API_TOKEN=

# Số ngày giữ file Excel đã nạp trước khi dọn
UPLOAD_RETENTION_DAYS=90
```

### `.dockerignore`

```
node_modules
.next
.git
.env
.env.*
!.env.production.example
check-promotion/
promotion*.xlsx
*.xlsx
uploads/
backups/
*.dump
plans/
docs/
test/
```

### Lưu file Excel đã nạp

- Đường dẫn lấy từ `UPLOAD_DIR`; máy phát triển dùng dự phòng `./.uploads` (đã nằm trong `.gitignore`)
- Tên file lưu theo `{runId}-{tên gốc đã làm sạch}.xlsx` — `runId` là `cuid` nên không đụng nhau, và tra ngược về `CheckRun` được ngay
- `CheckRun` thêm cột `storedFileName String?` để biết file còn hay đã bị dọn; dọn rồi thì màn kết quả hiện "file gốc đã hết hạn lưu, tải lên lại để xuất báo cáo"
- Làm sạch tên file trước khi ghi: bỏ đường dẫn, chỉ giữ chữ/số/gạch, ép đuôi `.xlsx` — tránh lỗi ghi đè ra ngoài thư mục
- `scripts/prune-uploads.sh` xoá file cũ hơn `UPLOAD_RETENTION_DAYS`, đặt cron chạy hằng ngày trên máy chủ

### Sao lưu và phục hồi

```bash
# CSDL — chạy qua container tiện ích, không cần cài psql lên máy chủ
mkdir -p backups
docker compose --profile tools run --rm dbtools \
  "pg_dump \"$DATABASE_URL\" -Fc -f /backups/promotion_checking-$(date +%F-%H%M).dump"

# Phục hồi
docker compose --profile tools run --rm dbtools \
  "pg_restore -d \"$DATABASE_URL\" --clean --if-exists /backups/<tên file>.dump"

# File Excel đã nạp
docker run --rm -v promotion-checking_uploads:/data -v "$PWD/backups":/backups alpine \
  tar czf "/backups/uploads-$(date +%F).tar.gz" -C /data .
```

CSDL nằm ở máy chủ khác nên **phải hỏi bên quản trị đã có sẵn lịch sao lưu chưa** — nếu có thì script này chỉ là bản dự phòng của phía ứng dụng, khỏi làm trùng.

## File liên quan

**Tạo mới**
- `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `docker-compose.override.yml.example`
- `Caddyfile`, `.env.production.example`
- `scripts/backup-db.sh`, `scripts/restore-db.sh`, `scripts/backup-uploads.sh`, `scripts/prune-uploads.sh`
- `src/app/api/health/route.ts`

**Sửa**
- `next.config.ts` — `output: 'standalone'`, `bodySizeLimit`, `allowedOrigins`
- `package.json` — thêm `tsx` (phụ thuộc phát triển); script `docker:build`, `docker:up`, `docker:down`, `docker:logs`, `docker:backup`
- `.gitignore` — thêm `.env.production`, `backups/`, `*.dump`, `.uploads/`
- Giai đoạn 05, chỗ nhận file tải lên — ghi file vào `UPLOAD_DIR`, lưu `storedFileName`; chỗ xuất báo cáo — đọc lại file gốc từ đó, thiếu file thì báo rõ
- `docs/van-hanh-va-trien-khai.md` — phần triển khai, chứng chỉ, sao lưu

## Các bước thực hiện

1. Sửa `next.config.ts`: `output: 'standalone'`, `bodySizeLimit`, `allowedOrigins` đọc từ `ALLOWED_ORIGINS`
2. Xác nhận `schema.prisma` có cột `CheckRun.storedFileName` (đã khai từ giai đoạn 01) và Dockerfile có chạy `prisma generate` ở tầng build
3. Kiểm lại phần giai đoạn 05: ghi file vào `UPLOAD_DIR` với tên đã làm sạch, lưu `storedFileName`; màn kết quả xử lý trường hợp file đã bị dọn
4. Viết `src/app/api/health/route.ts`
5. Viết `.dockerignore` **trước** lần build đầu (không có nó thì `check-promotion/` 177 MB bị nhồi vào ngữ cảnh build)
6. Viết `Dockerfile` 4 chặng
7. `docker build --target runner --build-arg ALLOWED_ORIGINS=... -t promotion-checking .`; xem dung lượng bằng `docker images`
8. Viết `docker-compose.yml`, `Caddyfile`, `.env.production.example`
9. **Xin cấu hình CSDL từ bên quản trị**: host, cổng, tên CSDL, tài khoản, có bắt buộc SSL không, tài khoản có đủ quyền tạo bảng không
10. Sao `.env.production.example` → `.env.production`, điền `DATABASE_URL`, `APP_DOMAIN`, token (file này **không commit**)
11. **Trước khi chạy `migrate` lần đầu: in ra host + tên CSDL, xác nhận đúng CSDL của dự án rồi mới chạy** — máy chủ CSDL dùng chung, chạy nhầm là đụng dữ liệu dự án khác
12. `docker compose up -d`; xem `docker compose logs migrate` xác nhận migration và seed chạy đúng
13. Kiểm tra HTTPS: mở tên miền, xác nhận chứng chỉ hợp lệ và HTTP tự chuyển hướng sang HTTPS
14. Chạy hết luồng qua tên miền thật: đồng bộ danh mục → nạp file mẫu → xuất Excel. **Kiểm kỹ Server Action** (nút lưu cấu hình) vì đây là chỗ dễ dính lỗi `allowedOrigins`
15. `docker compose down` rồi `up -d` — xác nhận lịch sử `CheckRun` và file Excel còn nguyên
16. Viết và chạy thử `backup-db.sh`, `restore-db.sh`, `backup-uploads.sh`, `prune-uploads.sh`
17. Đặt cron trên máy chủ: sao lưu hằng ngày, dọn file quá hạn hằng ngày
18. Diễn tập nâng cấp: sửa một dòng mã → `docker compose build app && docker compose up -d app` → dữ liệu vẫn nguyên
19. Ghi `docs/van-hanh-va-trien-khai.md`: cách chạy, xem nhật ký, sao lưu, phục hồi, đổi token, gia hạn chứng chỉ, và **phân biệt rõ CSDL máy phát triển (WSL) với CSDL máy chủ**

## Danh sách việc

- [ ] `output: 'standalone'` + `allowedOrigins` trong `next.config.ts`
- [ ] Lưu / đọc lại file Excel qua `UPLOAD_DIR`, xử lý file đã bị dọn
- [ ] Điểm kiểm tra sức khoẻ `/api/health`
- [ ] `.dockerignore` (trước lần build đầu)
- [ ] `Dockerfile` 4 chặng, chạy bằng người dùng không phải root
- [ ] `docker-compose.yml`: `migrate` → `app` → `caddy`, thêm profile `tools`
- [ ] `Caddyfile` + chốt cách cấp chứng chỉ TLS
- [ ] `.env.production.example` và cập nhật `.gitignore`
- [ ] Xin cấu hình CSDL và xác nhận trước khi chạy migration
- [ ] Script sao lưu CSDL, sao lưu file tải lên, dọn file quá hạn
- [ ] Chạy thử toàn luồng qua HTTPS với tên miền thật
- [ ] Cron sao lưu + dọn file
- [ ] Diễn tập nâng cấp không mất dữ liệu
- [ ] Viết tài liệu vận hành

## Tiêu chí hoàn thành

- Truy cập tên miền qua HTTPS chạy được; gõ `http://` tự chuyển sang `https://`
- Nạp `promotion.t8.xlsx` qua tên miền thật → vẫn phát hiện đúng **279 dòng giảm 0đ** của `2608GST0K` như tiêu chí ở kế hoạch tổng
- Lưu cấu hình ở màn giai đoạn 07 chạy được qua proxy (không dính `Invalid Server Actions request`)
- Xuất Excel từ lần chạy **cũ** vẫn được — chứng tỏ file gốc đã lưu và đọc lại đúng
- `docker compose down && docker compose up -d` → lịch sử kiểm tra, cache danh mục, file Excel còn nguyên
- Dựng lại image rồi khởi động → dữ liệu nguyên, migration mới tự áp
- `docker images` cho thấy image ứng dụng dưới 400 MB
- `docker compose exec app whoami` trả `nextjs`; `docker compose exec app date` trả giờ Việt Nam
- `docker compose ps` cho thấy **chỉ `caddy`** có ánh xạ cổng ra máy chủ
- `docker history` không lộ token hay chuỗi kết nối trong lớp image
- Sao lưu rồi phục hồi vào CSDL rỗng → số dòng `CheckRun`, `Finding`, `RuleConfig` khớp bản gốc
- Chạy `prune-uploads.sh` với hạn 0 ngày trên môi trường thử → file bị dọn, màn kết quả báo đúng thay vì lỗi 500

## Đánh giá rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| **Chạy nhầm migration lên CSDL dự án khác** trên máy chủ dùng chung | Chỉ đọc `DATABASE_URL` từ `.env.production`, không truyền tay vào lệnh; bước 11 bắt buộc in host + tên CSDL và xác nhận trước khi chạy; xin tài khoản chỉ có quyền trên đúng CSDL của dự án |
| Server Action bị chặn khi chạy sau proxy | Khai `allowedOrigins` từ `APP_DOMAIN`, truyền vào **lúc build**; bước 14 kiểm riêng phần này |
| Đổi tên miền mà quên dựng lại image | `allowedOrigins` cố định lúc build → tài liệu ghi rõ: đổi `APP_DOMAIN` là phải `docker compose build app` lại, không chỉ `up -d` |
| Mất CSDL do sự cố ở máy chủ CSDL — ngoài tầm kiểm soát | Hỏi bên quản trị về lịch sao lưu của họ; phía ứng dụng vẫn giữ `backup-db.sh` chạy cron làm lớp dự phòng |
| Đường truyền tới CSDL đi qua mạng, lộ dữ liệu | Bật `sslmode=require` trong `DATABASE_URL`; nếu bên quản trị cấp chứng chỉ CA riêng thì dùng `verify-full` |
| CSDL ở xa làm truy vấn chậm, vỡ mốc "dưới 5 giây" | Đo lại thời gian toàn luồng trên máy chủ thật; đông `Finding` thì ghi theo lô bằng `createMany` (đã có ở giai đoạn 05); cần thiết thì tăng `connection_limit` trong chuỗi kết nối |
| Volume `uploads` phình theo thời gian | `prune-uploads.sh` chạy cron; số ngày giữ lấy từ `UPLOAD_RETENTION_DAYS`, không ghi cứng |
| Tên file người dùng đặt gây ghi đè ra ngoài thư mục | Làm sạch tên, đặt tiền tố `runId`, ép đuôi `.xlsx` |
| Chứng chỉ nội bộ làm trình duyệt báo đỏ, người dùng bấm bừa | Chốt sớm cách cấp chứng chỉ; nếu dùng `tls internal` thì phải phát chứng chỉ gốc cho máy người dùng, ghi cách cài vào tài liệu |
| Mất volume `caddy-data` là mất chứng chỉ | Không xoá volume khi nâng cấp; Let's Encrypt có giới hạn số lần cấp mỗi tuần |
| Prisma client không có trong image | Prisma 7 sinh client ra `src/generated/prisma` (thư mục này bị `.gitignore`), nên Dockerfile **bắt buộc chạy `prisma generate`** trước `next build`; quên là build đứt ngay. Không còn vấn đề engine nhị phân trên Alpine |
| Seed chạy lại ghi đè cấu hình người dùng đã sửa | Seed `upsert` theo hướng **chỉ tạo nếu chưa có**, không ghi đè `severity`/`params` bản ghi đang tồn tại |
| Nhật ký ăn hết ổ đĩa | `logging` giới hạn `max-size: 10m`, `max-file: 3` cho mọi service |
| Bản `standalone` thiếu file tĩnh, trang mất CSS | Copy đủ `.next/static` và `public` |

## Cân nhắc bảo mật

- `HARAVAN_API_TOKEN` và `DATABASE_URL` truyền lúc chạy qua `env_file`, **không** dùng `ARG`/`ENV` lúc build (riêng `ALLOWED_ORIGINS` là tên miền, không phải bí mật, nên truyền lúc build được)
- `.env.production` không commit; chỉ commit `.env.production.example` với giá trị rỗng
- Container ứng dụng chạy bằng người dùng `nextjs` (uid 1001)
- Chỉ Caddy mở cổng; `app` dùng `expose`, không `ports`
- Bật `sslmode=require` cho kết nối CSDL đi qua mạng
- Ứng dụng **không có đăng nhập** — HTTPS chỉ bảo vệ đường truyền, không bảo vệ quyền truy cập. Muốn mở ra ngoài mạng nội bộ thì phải thêm lớp xác thực trước (Caddy `basic_auth` là mức tối thiểu, tốt hơn là nối SSO của công ty)
- Volume `uploads` chứa dữ liệu kinh doanh thật; bản sao lưu `*.dump`, `*.tar.gz` để ngoài kho mã nguồn, đã liệt kê trong `.gitignore`
- Ảnh nền `node:22-alpine`, `caddy:2-alpine`, `postgres:18-alpine` ghim theo phiên bản chính; cập nhật định kỳ để vá lỗ hổng

## Bước kế tiếp

- Đặt cron sao lưu hằng ngày và **thử phục hồi định kỳ** (bản sao lưu chưa từng phục hồi thử thì chưa tính là có sao lưu)
- Kho mã nguồn đã init git thì cân nhắc workflow dựng image; hiện triển khai bằng tay trên máy chủ nội bộ nên chưa cần

## Câu hỏi chưa chốt

1. **Tên miền công bố là gì, và phân giải được từ Internet hay chỉ trong mạng nội bộ?** Quyết định chọn Let's Encrypt hay `tls internal` — đây là chốt cuối còn thiếu để viết `Caddyfile`.
2. **Cấu hình CSDL:** host, cổng, tên CSDL, tài khoản, có bắt buộc SSL không, tài khoản có quyền `CREATE TABLE` để chạy migration không.
3. **Bên quản trị CSDL đã có lịch sao lưu chưa?** Có rồi thì phía ứng dụng khỏi làm trùng.
4. **Giữ file Excel bao lâu?** Mặc định đề xuất 90 ngày qua `UPLOAD_RETENTION_DAYS`.
