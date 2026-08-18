#!/bin/sh
# Deletes uploaded workbooks older than UPLOAD_RETENTION_DAYS.
#
# The CheckRun rows stay: the result screen already treats a missing file as an
# expected state ("file gốc đã hết hạn lưu") rather than an error, so there is
# nothing to update in the database.
#
# Runs inside the app container because that is the only service with write
# access to the volume - dbtools mounts it read-only.
#
# Usage:
#   scripts/prune-uploads.sh              số ngày lấy từ UPLOAD_RETENTION_DAYS
#   scripts/prune-uploads.sh --days 0     xoá hết (dùng để thử, xem tiêu chí giai đoạn 08)
#   scripts/prune-uploads.sh --dry-run    chỉ liệt kê, không xoá
set -eu

. "$(dirname "$0")/lib-deploy-env.sh"

DAYS=""
DRY_RUN=0
while [ $# -gt 0 ]; do
  case "$1" in
    --days) DAYS="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    *) echo "Tham số không nhận ra: $1" >&2; exit 1 ;;
  esac
done

[ -n "$DAYS" ] || DAYS="$(read_env UPLOAD_RETENTION_DAYS)"
[ -n "$DAYS" ] || DAYS=90
case "$DAYS" in
  ''|*[!0-9]*) echo "Số ngày phải là số nguyên không âm, nhận được: $DAYS" >&2; exit 1 ;;
esac

# Minutes rather than days: -mtime +0 would spare everything younger than 24
# hours, which is not what "giữ 0 ngày" means.
MINUTES=$((DAYS * 1440))

echo "==> Dọn file cũ hơn $DAYS ngày trong /data/uploads"
compose exec -T app find /data/uploads -type f -name '*.xlsx' -mmin "+$MINUTES" -print

if [ "$DRY_RUN" = "1" ]; then
  echo "==> --dry-run: không xoá gì."
  exit 0
fi

# -exec rm rather than -delete: BusyBox find carries -delete but it is not
# guaranteed, and a pruning script must not fail silently on a base image bump.
compose exec -T app find /data/uploads -type f -name '*.xlsx' -mmin "+$MINUTES" -exec rm -f {} +

echo "==> Xong. Còn lại:"
compose exec -T app sh -c 'ls -1 /data/uploads | wc -l'
