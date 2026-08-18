#!/bin/sh
# Dumps the database into ./backups through the postgres tools container, so
# nothing has to be installed on the host.
#
# Read-only, therefore safe on a cron schedule. Ask whoever administers the
# database server whether they already back it up - if they do, this is only
# the application side's second copy.
#
# Usage: scripts/backup-db.sh
set -eu

. "$(dirname "$0")/lib-deploy-env.sh"

DATABASE_URL="$(read_env DATABASE_URL)"
[ -n "$DATABASE_URL" ] || { echo 'Thiếu DATABASE_URL trong .env.production' >&2; exit 1; }

STAMP="$(date +%F-%H%M)"
OUT="promotion_checking-$STAMP.dump"

mkdir -p "$ROOT_DIR/backups"
echo "==> Sao lưu $(db_target "$DATABASE_URL") vào backups/$OUT"

# Single quotes: $DATABASE_URL is expanded inside the container, from its own
# env_file, so the connection string never lands in the host's shell history.
compose --profile tools run --rm dbtools \
  'pg_dump "$DATABASE_URL" -Fc -f "/backups/'"$OUT"'"'

echo "==> Xong: backups/$OUT ($(du -h "$ROOT_DIR/backups/$OUT" | cut -f1))"
echo "    Bản sao lưu chưa từng phục hồi thử thì chưa tính là có sao lưu."
