#!/bin/sh
# Restores a dump produced by backup-db.sh.
#
# DESTRUCTIVE. --clean --if-exists drops every table this project owns before
# recreating it. The database server is shared with other projects, so the
# target is printed and confirmed before anything runs; there is no --yes here
# on purpose, a restore is never a scheduled job.
#
# Usage: scripts/restore-db.sh backups/promotion_checking-2026-08-18-1030.dump
set -eu

. "$(dirname "$0")/lib-deploy-env.sh"

DUMP="${1:-}"
if [ -z "$DUMP" ]; then
  echo "Cách dùng: $0 <đường dẫn file .dump>" >&2
  echo "Có sẵn:" >&2
  ls -1 "$ROOT_DIR/backups"/*.dump 2>/dev/null >&2 || echo "  (chưa có bản sao lưu nào)" >&2
  exit 1
fi
[ -f "$DUMP" ] || { echo "Không tìm thấy file: $DUMP" >&2; exit 1; }

DATABASE_URL="$(read_env DATABASE_URL)"
[ -n "$DATABASE_URL" ] || { echo 'Thiếu DATABASE_URL trong .env.production' >&2; exit 1; }

NAME="$(basename "$DUMP")"

echo "PHỤC HỒI SẼ XOÁ TOÀN BỘ BẢNG HIỆN CÓ CỦA DỰ ÁN NÀY."
confirm_target "Phục hồi $NAME vào $(db_target "$DATABASE_URL")"

# The application must not read or write while its tables are being dropped.
echo "==> Dừng app trong lúc phục hồi"
compose stop app

# pg_restore reports non-fatal errors for objects that did not exist yet, so a
# non-zero exit is inspected rather than trusted blindly.
set +e
compose --profile tools run --rm dbtools \
  'pg_restore -d "$DATABASE_URL" --clean --if-exists "/backups/'"$NAME"'"'
STATUS=$?
set -e

echo "==> Khởi động lại app"
compose start app

if [ "$STATUS" -ne 0 ]; then
  echo "pg_restore thoát với mã $STATUS. Đọc log ở trên: lỗi \"does not exist\" khi xoá là bình thường, còn lại thì không." >&2
  exit "$STATUS"
fi
echo "==> Phục hồi xong. Đối chiếu số dòng CheckRun / Finding / RuleConfig với bản gốc."
