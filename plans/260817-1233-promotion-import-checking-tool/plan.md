---
title: Công cụ kiểm tra & đối soát file import khuyến mãi Haravan
status: in-progress
created: 2026-08-17
mode: hard
scope: hold
blockedBy: []
blocks: []
---

# Công cụ kiểm tra & đối soát file import khuyến mãi Haravan

Web nội bộ giúp người phụ trách biết file Excel khuyến mãi đúng hay sai **trước khi import**, và kiểm chứng kết quả **sau khi import**.

## Bối cảnh

- Brainstorm gốc: [`plans/reports/brainstorm-260817-1019-promotion-import-checking-tool.md`](../reports/brainstorm-260817-1019-promotion-import-checking-tool.md)
- File mẫu: `promotion.t8.xlsx` — 2 sheet, 3.929 dòng, 154 chương trình
- Dự án **greenfield**: chưa có `package.json`, `docs/`, chưa init git

## Nguyên tắc xuyên suốt

1. **Chỉ cảnh báo, không chặn** — liệt kê hết, người dùng tự quyết
2. **Chỉ đọc Haravan** (`GET`) — không bao giờ ghi
3. **Không hard-code giá trị nghiệp vụ** — mọi ngưỡng nằm trong DB, sửa được trên UI
4. **Render phía server** — lọc/sắp/phân trang làm ở server
5. **Đọc tất cả sheet**, không bỏ sót
6. Thông báo tiếng Việt, kèm gợi ý sửa cụ thể
7. Mỗi file mã nguồn **dưới 200 dòng**

## Các giai đoạn

| # | Giai đoạn | Phụ thuộc | Trạng thái |
|---|---|---|---|
| 01 | [Nền tảng dự án & lược đồ dữ liệu](phase-01-nen-tang-du-an-va-luoc-do-du-lieu.md) | — | ✅ Xong 2026-08-17 |
| 02 | [Haravan client & đồng bộ danh mục](phase-02-haravan-client-va-dong-bo-danh-muc.md) | 01 | ✅ Xong 2026-08-17 |
| 03 | [Đọc & chuẩn hoá file Excel](phase-03-doc-va-chuan-hoa-file-excel.md) | 01 | ✅ Xong 2026-08-18 |
| 04 | [Bộ máy luật (nhóm A–E)](phase-04-bo-may-luat-nhom-a-den-e.md) | 02, 03 | ⬜ Chưa làm |
| 05 | [Màn kiểm tra file & xuất báo cáo](phase-05-man-kiem-tra-file-va-xuat-bao-cao.md) | 04 | ⬜ Chưa làm |
| 06 | [Màn đối soát sau import (nhóm F)](phase-06-man-doi-soat-sau-import.md) | 04 | ⬜ Chưa làm |
| 07 | [Màn cấu hình luật & tài liệu](phase-07-man-cau-hinh-luat-va-tai-lieu.md) | 01 | ⬜ Chưa làm |
| 08 | [Triển khai bằng Docker Compose](phase-08-trien-khai-bang-docker-compose.md) | 05 | ⬜ Chưa làm |

Giai đoạn 07 có thể cắt bỏ nếu gấp — ngưỡng vẫn nằm đúng chuẩn trong DB, chỉ là chưa sửa được trên giao diện.

Giai đoạn 08 chỉ cần 05 là chạy được, không phải chờ 06/07. `next.config.ts` đã bật sẵn `output: 'standalone'` ở giai đoạn 01. Riêng `binaryTargets` cho Alpine **không cần nữa**: bản cài thực tế là Prisma 7, không còn engine nhị phân — chi tiết ở [giai đoạn 01](phase-01-nen-tang-du-an-va-luoc-do-du-lieu.md#kết-quả-thực-tế-2026-08-17).

## Công nghệ

| Thành phần | Lựa chọn | Lý do |
|---|---|---|
| Khung web | Next.js 15 App Router + TypeScript | Server Component render bảng phía server |
| CSDL | PostgreSQL qua Prisma | Máy phát triển nối PostgreSQL 18 sẵn có trong WSL; triển khai thật nối CSDL đặt ở máy chủ khác (cấu hình do bên quản trị cung cấp) |
| Đọc/ghi Excel | `exceljs` | Ghi được file tô màu; không dùng `xlsx` (bản npm cũ, có CVE) |
| Giao diện | Tailwind + shadcn/ui | Có sẵn bảng, badge, bộ lọc |
| Kiểm thử | Vitest | Nhẹ, chạy được TypeScript trực tiếp |

## Định nghĩa hoàn thành

- Nạp `promotion.t8.xlsx` → phát hiện đúng **279 dòng giảm 0đ** của `2608GST0K`, báo rõ chương trình này sẽ bị Haravan từ chối
- Liệt kê đầy đủ SKU không tồn tại trên Haravan kèm gợi ý SKU gần giống
- Kiểm tra một file **dưới 5 giây** khi cache danh mục đã sẵn sàng
- Đối soát sau import không báo oan do trễ chỉ mục
- Không phát sinh bất kỳ lệnh ghi nào lên Haravan

## Việc cần hỏi trước khi làm

- ~~**Khởi tạo git**~~ — đã chốt 2026-08-17: dùng tài khoản `midomax-hoa` (`dev03@midomax.vn`, đặt ở mức local từng kho), tên kho `promotion-checking`, remote qua SSH alias `git@github.com:...`. `git init` đã chạy xong.
- `.gitignore` loại trừ ngay từ commit đầu tiên:
  - `check-promotion/` — phần mềm import nội bộ, khoảng 177 MB, chỉ để tham khảo
  - `promotion*.xlsx` và mọi `*.xlsx` ở thư mục gốc — dữ liệu kinh doanh thật
  - `.env`, `.env.production`, mọi file kết xuất CSDL (`*.dump`, `backups/`)
  - `src/generated/` — client Prisma sinh tự động
  - Các thư mục công cụ AI: `.claude/`, `.opencode/`, `.agents/`, `.agent/`, `.cursor/` (chốt 2026-08-17)
  Chi tiết ở [giai đoạn 01](phase-01-nen-tang-du-an-va-luoc-do-du-lieu.md#nội-dung-gitignore-bắt-buộc).
