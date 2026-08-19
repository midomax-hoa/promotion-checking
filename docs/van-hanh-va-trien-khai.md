# Vận hành và triển khai

Dành cho người quản trị hệ thống. Chạy được hai kiểu: bằng tay ở máy phát triển, hoặc bằng Docker Compose trên máy chủ Linux.

**Phân biệt hai CSDL — đọc trước khi gõ bất cứ lệnh nào đụng dữ liệu:**

| | Máy phát triển | Máy chủ triển khai |
|---|---|---|
| CSDL | PostgreSQL trong WSL, ngay trên máy cá nhân | PostgreSQL **ở máy chủ khác**, dùng chung với dự án khác |
| Cấu hình đọc từ | `.env` | `.env` (Dokploy tự sinh từ tab Environment) |
| Lệnh migration | `npm run db:migrate` | Service `migrate` trong compose, tự chạy |
| Rủi ro chạy nhầm | Mất dữ liệu thử nghiệm | **Đụng dữ liệu dự án khác** |

Ứng dụng **không sở hữu** CSDL trên máy chủ. Mọi lệnh có ghi phải in ra host + tên CSDL rồi xác nhận trước khi chạy — các script trong `scripts/` đã làm sẵn việc đó.

## Biến môi trường

Chép `.env.example` thành `.env` rồi điền. **Không commit `.env`.**

| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `DATABASE_URL` | Có | Chuỗi kết nối PostgreSQL. Ký tự đặc biệt trong mật khẩu phải mã hoá URL — `@` viết thành `%40` |
| `HARAVAN_API_TOKEN` | Có | Token ứng dụng riêng của Haravan. **Chỉ dùng ở phía máy chủ**, tuyệt đối không đặt tiền tố `NEXT_PUBLIC_` |
| `UPLOAD_DIR` | Không | Thư mục giữ file `.xlsx` đã tải lên khi **không** dùng MinIO. Mặc định `.uploads` |
| `MINIO_ENDPOINT` | Không | Máy chủ MinIO. **Chỉ có tác dụng khi `NODE_ENV=production`** — máy phát triển luôn ghi xuống `UPLOAD_DIR` dù điền đủ khoá |
| `MINIO_PORT` | Không | Cổng MinIO. Mặc định `9000` |
| `MINIO_ACCESS_KEY` | Khi có endpoint | Khoá truy cập MinIO |
| `MINIO_SECRET_KEY` | Khi có endpoint | Khoá bí mật MinIO |
| `MINIO_BUCKET` | Khi có endpoint | Tên bucket, ví dụ `promotion-checking` |
| `MINIO_USE_SSL` | Không | Chỉ đúng chữ `true` mới bật TLS. Mặc định `false` |
| `MINIO_PREFIX` | Không | Thư mục con trong bucket. Mặc định `uploads`. Đổi sau khi đã chạy thật sẽ làm các lần chạy cũ không đọc lại được |
| `AUTH_SEED_USERNAME` | Không | Tên đăng nhập của tài khoản đầu tiên. `npm run db:seed` chỉ đọc khi bảng `User` còn rỗng |
| `AUTH_SEED_EMAIL` | Không | Email của tài khoản đầu tiên |
| `AUTH_SEED_PASSWORD` | Không | Mật khẩu của tài khoản đầu tiên. Xoá khỏi tệp sau lần đăng nhập đầu |

Khi triển khai thì dùng `.env.production.example` làm danh sách kiểm: dán các biến đó vào tab **Environment** của Dokploy (Dokploy ghi ra `.env` nằm cạnh `docker-compose.yml`), hoặc chép thành `.env` nếu chạy compose bằng tay. **Không commit tệp đã điền.**

| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `APP_DOMAIN` | Có | Tên miền công bố. Phải trùng với tên miền khai trong tab Domains của Dokploy. Dùng cho `allowedOrigins` của Server Action — **đổi là phải dựng lại image** |
| `UPLOAD_RETENTION_DAYS` | Không | Số ngày giữ file `.xlsx` đã nạp. Mặc định `90` |
| `UPLOAD_DIR` | Có | Trong container là `/data/uploads`, khớp với volume trong `docker-compose.yml`. Khi dùng MinIO thì chỉ còn dùng để đọc lại các lần chạy cũ |
| `MINIO_*` | Nên có | Xem bảng trên. Điền endpoint thì file tải lên nằm trên MinIO, không phụ thuộc vòng đời container. Ảnh Docker đã đặt sẵn `NODE_ENV=production` nên khỏi khai thêm |

Địa chỉ gốc của API Haravan **không** nằm trong biến môi trường — nó là thiết lập `haravan.api_base` trong CSDL, sửa được trên màn cấu hình. Giá trị nhập vào bị ràng buộc phải là `https` và thuộc tên miền `haravan.com`, để không ai vô tình gửi token sang máy chủ khác.

## Cài đặt lần đầu (máy phát triển)

```bash
npm install
npx prisma migrate deploy     # dựng lược đồ
npm run db:seed               # nạp 37 luật, các thiết lập mặc định và tài khoản đầu tiên
npm run user:create           # nếu chưa đặt AUTH_SEED_* trong .env
npm run build
npm start
```

`npm run db:seed` chạy lại được nhiều lần: bản ghi đã có giữ nguyên giá trị người vận hành đã chỉnh, chỉ làm mới phần mô tả. Tài khoản đầu tiên chỉ được tạo khi bảng `User` còn rỗng, nên chạy lại seed không hồi sinh tài khoản đã xoá.

## Quản lý tài khoản

Công cụ không có màn hình quản trị người dùng. Cấp và thu hồi tài khoản bằng lệnh, chạy trên máy đang trỏ đúng `DATABASE_URL`.

| Lệnh | Việc |
|---|---|
| `npm run user:create` | Tạo tài khoản mới |
| `npm run user:list` | Liệt kê tài khoản, lần đăng nhập cuối, tình trạng khoá tạm |
| `npm run user:passwd` | Đặt lại mật khẩu |
| `npm run user:delete` | Xoá tài khoản |

Tên đăng nhập và email nhận qua tham số; mật khẩu **luôn** hỏi trên màn hình và không hiện lại khi gõ — truyền qua tham số dòng lệnh sẽ nằm lại trong lịch sử shell và trong danh sách tiến trình.

```bash
npm run user:create -- --username hoa --email hoa@example.com
npm run user:passwd -- --username hoa
npm run user:delete -- --username hoa      # gõ lại đúng tên để xác nhận
```

Đặt lại mật khẩu sẽ **đăng xuất mọi phiên đang mở** của tài khoản đó, và gỡ luôn tình trạng khoá tạm nếu đang bị khoá.

Quên mật khẩu thì không có luồng tự phục hồi qua email — người quản trị chạy `npm run user:passwd` là xong. Đây là lựa chọn có chủ ý: gửi email đòi thêm hạ tầng cho một việc hiếm khi xảy ra trong nhóm nhỏ.

### Khi có người nghỉ việc

Chạy `npm run user:delete`. Phiên đăng nhập của tài khoản bị xoá theo (khoá ngoại đặt `onDelete: Cascade`), nên trình duyệt đang mở của người đó mất quyền ngay ở lần tải trang kế tiếp.

## Đổi giá trị mặc định của luật

Sửa `src/lib/rules/rule-catalog.ts` rồi chạy:

```bash
npm run db:seed:reset
```

Lệnh này **ghi đè** mọi tinh chỉnh trên màn cấu hình bằng giá trị trong danh mục. Đây là cách được hỗ trợ để phát hành một giá trị mặc định mới — nếu không, thay đổi sẽ không bao giờ chạm tới CSDL đã seed trước đó.

## Migration CSDL

- **Tuyệt đối không dùng `prisma db push`.** Mọi thay đổi lược đồ phải tạo migration.
- Máy phát triển: `npm run db:migrate`
- Máy chủ: `npm run db:deploy`
- Cần xem SQL trước khi chạy: `npx prisma migrate dev --create-only --name <ten>`, đọc file rồi mới `db:deploy`.

Kiểm tra đang trỏ vào CSDL nào trước khi chạy bất cứ lệnh nào đụng dữ liệu. Dòng đã bị chú thích bằng `#` trong `.env` là cấu hình đã bỏ, không phải cấu hình đang dùng.

## Triển khai bằng Dokploy

Dokploy chạy `docker-compose.yml` của dự án và tự lo phần proxy: **Traefik của Dokploy** nhận 80/443, cấp chứng chỉ TLS, rồi chuyển tiếp vào container. Dự án **không** tự dựng reverse proxy nữa.

Hai dịch vụ chạy theo thứ tự: `migrate` (chạy một lần, phải thoát mã 0) → `app` (phải khoẻ). CSDL **không** nằm trong compose.

```
Internet / mạng nội bộ
        │ 443, 80 → chuyển hướng
        ▼
  Traefik (của Dokploy)
        │ qua network `dokploy-network`
        ▼ 3000
       app ──┐ chạy sau
              └── migrate (một lần)
                    │
                    ▼ 5432
       PostgreSQL ở máy chủ khác
```

`app` chỉ `expose` cổng 3000 trong mạng nội bộ Docker, **không** ánh xạ cổng nào ra máy chủ. Đường vào duy nhất là qua Traefik.

### Trước khi chạy lần đầu

Xin bên quản trị CSDL: host, cổng, tên CSDL, tài khoản, có bắt buộc SSL không, tài khoản có quyền `CREATE TABLE` để chạy migration không, và **họ đã có lịch sao lưu chưa** — có rồi thì phía ứng dụng khỏi làm trùng.

Dựng dịch vụ trong Dokploy theo thứ tự này:

1. **Tạo service kiểu Compose**, trỏ vào repo này, đường dẫn compose để `docker-compose.yml`.
2. **Tab Environment** — dán toàn bộ biến trong `.env.production.example` rồi điền giá trị. Bắt buộc có `APP_DOMAIN`, `DATABASE_URL`, `HARAVAN_API_TOKEN`; thêm `AUTH_SEED_USERNAME` / `AUTH_SEED_EMAIL` / `AUTH_SEED_PASSWORD` cho tài khoản đầu tiên.
3. **Tab Domains** — khai tên miền cho service `app`, cổng `3000`, bật HTTPS. Tên miền ở đây **phải trùng** `APP_DOMAIN` ở bước 2.
4. **Deploy.**

Bước 2 và 3 phải khớp nhau. Lệch nhau thì trang vẫn mở được, vẫn đăng nhập được, nhưng mọi nút Lưu sẽ báo `Invalid Server Actions request` — xem mục [Nâng cấp](#nâng-cấp).

Không đặt `AUTH_SEED_*` thì sau khi khởi động vẫn tạo tài khoản được, bằng cách chạy trong container (qua Terminal của Dokploy, hoặc SSH vào máy chủ):

```bash
docker compose exec app npm run user:create
```

### Lệnh thường dùng

Việc thường ngày làm trên giao diện Dokploy: Deploy, xem Logs, mở Terminal của container. Khi cần gõ tay thì SSH vào máy chủ, `cd` tới thư mục compose của Dokploy (mặc định `/etc/dokploy/compose/<tên-service>/`) rồi:

```bash
docker compose ps                 # trạng thái các service
docker compose logs -f app        # nhật ký ứng dụng, Ctrl+C để thoát
docker compose logs migrate       # kiểm migration + seed chạy đúng chưa
```

Không cần cờ `--env-file`: Dokploy ghi biến ra `.env` nằm ngay cạnh `docker-compose.yml`, mà `docker compose` tự đọc `.env`.

Chạy stack bằng tay ở nơi khác (ví dụ dựng lại sự cố trên máy cá nhân) thì chép `.env.production.example` thành `.env`, điền giá trị, rồi dùng các script npm:

```bash
npm run docker:build        # dựng image
npm run docker:up           # khởi động, migrate tự chạy trước
npm run docker:logs         # xem nhật ký
npm run docker:ps           # xem trạng thái
npm run docker:down         # dừng — volume vẫn còn, dữ liệu không mất
```

Ngoài Dokploy thì network `dokploy-network` không tồn tại; xem `docker-compose.override.yml.example` để biết cách tháo ra.

**Kiểm CSDL đang nhắm tới trước khi khởi động lần đầu:**

```bash
grep -E "^DATABASE_URL=" .env
```

Neo `^` là bắt buộc: dòng đã chú thích bằng `#` là cấu hình đã bỏ, không phải cấu hình đang dùng.

### Nâng cấp

Bấm **Deploy** trong Dokploy; nó tự `git pull`, dựng lại image rồi khởi động lại. Migration mới tự áp qua service `migrate`. Volume `uploads` không bị đụng, dữ liệu còn nguyên.

**Đổi `APP_DOMAIN` thì phải dựng lại image**, không chỉ khởi động lại. `allowedOrigins` của Server Action bị nướng vào `server.js` lúc build — đã kiểm chứng bằng cách `grep` trong image. Khởi động lại suông thì nút Lưu ở màn cấu hình sẽ báo `Invalid Server Actions request`: trang vẫn mở, vẫn đăng nhập được, chỉ mỗi thao tác ghi là hỏng, nên lỗi này rất dễ lọt.

Đổi tên miền thì đổi đủ **ba chỗ**: tab Domains của Dokploy, biến `APP_DOMAIN`, và một lượt Deploy có dựng lại image.

### Chứng chỉ TLS

Traefik của Dokploy lo hết: khai tên miền ở tab Domains, bật HTTPS, Dokploy tự xin Let's Encrypt và tự gia hạn. Dự án không còn tệp cấu hình proxy nào của riêng mình.

Tên miền chỉ phân giải trong mạng nội bộ thì **không** qua được thử thách của Let's Encrypt. Khi đó phải nạp chứng chỉ do bên IT cấp vào Traefik của Dokploy, hoặc dùng thử thách DNS-01 — cả hai đều cấu hình ở phía Dokploy, không phải ở repo này.

Let's Encrypt có **giới hạn số lần cấp mỗi tuần**, nên đừng xoá đi dựng lại dịch vụ nhiều lần liên tiếp khi đang dò lỗi tên miền.

**Ba thiết lập cũ của reverse proxy đã bỏ** — đối chiếu với mặc định của Traefik v3 như sau:

| Thiết lập cũ | Mặc định Traefik v3 | Kết luận |
|---|---|---|
| Chờ ứng dụng trả lời 180 giây | `writeTimeout` mặc định `0` = không giới hạn | Không sao. Lượt kiểm file 4.000 dòng chạy lâu vẫn không bị cắt |
| Chặn body quá 25 MB | Không giới hạn (middleware `buffering` phải tự bật) | Không sao. Ứng dụng vẫn tự chặn ở 20 MB trong route handler |
| Nén gzip | Middleware `compress` mặc định tắt | Không sao. Next.js tự nén phản hồi |

Chỗ **cần để mắt**: `readTimeout` của Traefik v3 mặc định **60 giây**, tính cho toàn bộ thời gian đọc request kể cả body. File 20 MB tải qua đường truyền chậm hơn ~2,7 Mbps sẽ bị cắt giữa chừng. Trong mạng nội bộ thì dư sức; nếu người dùng nạp file qua đường truyền yếu mà gặp lỗi đứt quãng thì nâng `readTimeout` trong cấu hình Traefik của Dokploy.

### Kiểm tra sau khi triển khai

```bash
docker compose ps                    # không service nào ánh xạ cổng ra máy chủ
docker compose exec app whoami       # → nextjs
docker compose exec app date         # → giờ Việt Nam (+07)
curl -sS https://$APP_DOMAIN/api/health                # → {"status":"ok","database":"up"}
curl -sS -o /dev/null -w '%{http_code} %{redirect_url}
' https://$APP_DOMAIN/
                                                      # → 307 …/dang-nhap?tiep=%2F
```

Lượt kiểm cuối quan trọng: chưa đăng nhập mà mở trang chủ **phải** bị đẩy về `/dang-nhap`. Nếu nó trả về 200 thì lớp chặn không chạy — dừng lại, đừng công bố địa chỉ.

Rồi đăng nhập và chạy hết luồng qua tên miền thật: đồng bộ danh mục → nạp file mẫu → xuất Excel → **bấm Lưu ở màn cấu hình** (đây là chỗ dễ dính lỗi `allowedOrigins` nhất) → **bấm đăng xuất rồi đăng nhập lại**.

## Sao lưu và phục hồi

Bốn script trong `scripts/`, đều đọc `.env` và bỏ qua dòng đã chú thích. Trỏ sang tệp khác bằng biến `ENV_FILE`.

```bash
sh scripts/backup-db.sh                       # pg_dump → backups/*.dump
sh scripts/backup-uploads.sh                  # đóng gói file Excel → backups/*.tar.gz
npm run docker:backup                         # chạy cả hai
sh scripts/restore-db.sh backups/<tên>.dump   # PHỤC HỒI — xoá bảng cũ, có bước xác nhận
sh scripts/prune-uploads.sh                   # dọn file quá hạn
sh scripts/prune-uploads.sh --dry-run         # chỉ liệt kê, không xoá
```

Script chạy `pg_dump`/`pg_restore` qua container `postgres:18-alpine` nên máy chủ khỏi cài `psql`. Chuỗi kết nối được giãn **bên trong** container, không lọt vào lịch sử lệnh của máy chủ.

`restore-db.sh` **cố tình không có cờ bỏ qua xác nhận**: nó xoá toàn bộ bảng của dự án rồi dựng lại, và CSDL nằm trên máy chủ dùng chung. Phục hồi không bao giờ là việc chạy theo lịch.

Bản sao lưu chưa từng phục hồi thử thì chưa tính là có sao lưu — thử phục hồi vào một CSDL rỗng định kỳ, đối chiếu số dòng `CheckRun`, `Finding`, `RuleConfig` với bản gốc.

### Đặt lịch trên máy chủ

```cron
# sao lưu 2 giờ sáng hằng ngày
0 2 * * * cd /opt/promotion-checking && sh scripts/backup-db.sh && sh scripts/backup-uploads.sh
# dọn file Excel quá hạn 3 giờ sáng hằng ngày
0 3 * * * cd /opt/promotion-checking && sh scripts/prune-uploads.sh
```

File `*.dump` và `*.tar.gz` chứa dữ liệu kinh doanh thật (giá vốn, giá bán). Chúng đã nằm trong `.gitignore`; đưa bản sao lưu ra khỏi máy chủ theo quy định nội bộ.

Dọn file rồi thì lần chạy cũ **không xuất lại báo cáo được nữa** — màn kết quả báo "file gốc đã hết hạn lưu, tải lên lại để xuất báo cáo" chứ không lỗi. Bản ghi `CheckRun` và toàn bộ kết quả kiểm tra vẫn còn.

## Bảo mật vận hành

**Công cụ đòi đăng nhập** (từ 2026-08-19). Mọi màn hình và mọi tuyến API đều bị chặn, trừ hai chỗ:

- `/dang-nhap` — hiển nhiên.
- `/api/health` — healthcheck của container không mang cookie; bắt nó đăng nhập thì ứng dụng đang khoẻ vẫn bị báo là chết. Tuyến này chỉ trả về tình trạng kết nối CSDL, không lộ dữ liệu nào.

Những điều cần nhớ:

- Ai **đăng nhập được** đều sửa được cấu hình luật và tải file lên. Chưa có phân quyền theo vai trò.
- Mật khẩu lưu dưới dạng băm `scrypt`, không có chỗ nào đọc lại được mật khẩu gốc — kể cả người quản trị. Mất thì đặt lại, không lấy lại.
- Sai mật khẩu quá `auth.max_failed_attempts` lần thì tài khoản bị khoá `auth.lockout_minutes` phút. Cả hai sửa được trên màn cấu hình.
- Một lần đăng nhập hết hạn sau `auth.session_ttl_hours` giờ.
- Cột `RuleConfig.updatedAt` là dấu vết duy nhất cho biết cấu hình đổi lúc nào. **Nó không ghi lại ai đã đổi** — nhật ký thao tác theo người dùng chưa có. Nó chỉ nhích khi giá trị thật sự thay đổi, nên mốc thời gian ở đó có nghĩa; bấm Lưu mà không đổi gì thì không ghi gì.

Những chốt chặn đã có sẵn trong mã:

- Toàn bộ giao tiếp với Haravan chỉ dùng `GET`. Không có đường ghi nào trong mã nguồn.
- Token bị thay bằng `***` trước khi bất kỳ nội dung phản hồi nào lọt vào thông báo lỗi.
- File tải lên chỉ được đọc như dữ liệu; chữ ký đầu tệp kiểm trên byte, dung lượng chặn theo `Content-Length` trước khi đọc thân yêu cầu.
- Tên file lưu trữ bị viết lại, đường dẫn giải ra được kiểm lại ở cả chiều ghi lẫn chiều đọc.
- Mọi giá trị nhập trên màn cấu hình đều qua `zod` trước khi ghi CSDL; mã luật lấy từ danh mục trong mã nguồn chứ không lấy từ biểu mẫu.

## Việc định kỳ

| Việc | Nhịp gợi ý | Cách làm |
|---|---|---|
| Đồng bộ đầy đủ danh mục | Hằng ngày hoặc trước mỗi đợt import lớn | Màn **Đồng bộ danh mục** → **Đồng bộ lại từ đầu** |
| Đồng bộ tăng dần | Trước mỗi lần kiểm tra file | Cùng màn, nút còn lại. Nhanh hơn nhiều nhưng không thấy sản phẩm đã bị xoá |
| Dọn thư mục `UPLOAD_DIR` | Hằng ngày, đặt cron | `sh scripts/prune-uploads.sh`. Số ngày giữ lấy từ `UPLOAD_RETENTION_DAYS`. **Chỉ quét volume trên máy chủ, chưa dọn file trên MinIO** |
| Sao lưu CSDL | Hằng ngày, đặt cron | `sh scripts/backup-db.sh`. Hỏi bên quản trị CSDL trước — có sẵn lịch của họ thì khỏi làm trùng |
| Sao lưu file Excel đã nạp | Hằng ngày, đặt cron | `sh scripts/backup-uploads.sh`. Kết xuất CSDL **không** bao gồm file này. **Chỉ đóng gói volume trên máy chủ**; dùng MinIO thì sao lưu theo cơ chế của MinIO |
| Thử phục hồi bản sao lưu | Hằng quý | `sh scripts/restore-db.sh` vào một CSDL rỗng, đối chiếu số dòng |

## Điều tiết nhịp gọi Haravan

Haravan giới hạn nhịp gọi. Thiết lập `haravan.requests_per_second` mặc định `3`, đặt dưới mức rỉ 4/giây cho an toàn, và trần cho phép là 4.

Gặp `429` thì công cụ hiểu đó là chuyện giới hạn nhịp chứ không phải dữ liệu sai: nó thử lại tới `haravan.max_attempts` lần rồi mới báo hỏng.

Đồng bộ chậm bất thường thì nâng `haravan.requests_per_second` lên 4 trước, đừng động vào `haravan.page_size` — Haravan ép cứng tối đa 50 bản ghi mỗi trang, đặt lớn hơn sẽ làm vòng phân trang hiểu nhầm một trang đầy là trang cuối.

## Kiểm tra sức khoẻ trước khi phát hành

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Rồi mở lần lượt: **Đồng bộ danh mục** (số sản phẩm khớp cửa hàng), **Cấu hình luật** (đủ 37 luật, sáu nhóm), **Kiểm tra file** (nạp một file mẫu nhỏ).

## Giới hạn đã biết

- Chưa có xác thực người dùng. HTTPS chỉ bảo vệ đường truyền, không bảo vệ quyền truy cập — muốn mở ra ngoài mạng nội bộ thì phải thêm lớp xác thực trước (middleware `basicAuth` của Traefik là mức tối thiểu, tốt hơn là nối SSO công ty).
- Trang lịch sử hiện 100 lần chạy gần nhất, chưa phân trang.
- `GET /com/promotions.json` không lọc được phía máy chủ, nên mỗi lần đối soát đều kéo toàn bộ chương trình khuyến mãi của cửa hàng về rồi lọc trong bộ nhớ. Cửa hàng tích luỹ nhiều năm sẽ phải xem lại điểm này.
- Ngân sách 30 giây cho 3.000 sản phẩm chưa kiểm chứng được — cửa hàng dev chỉ có 74 sản phẩm.
- `npm audit` báo 3 lỗi mức cao ở phụ thuộc gián tiếp của Next 15. Nâng lên Next 16 là thay đổi phá vỡ, để thành một đợt riêng.
