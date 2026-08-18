#!/bin/sh
# Archives the uploaded workbooks into ./backups.
#
# They are business data - cost prices and selling prices - and they do not
# live in the database, so a database dump alone does not cover them.
#
# The volume is reached through the dbtools service, which mounts it read-only,
# rather than by naming the volume directly: compose prefixes volume names with
# the project name, and that prefix changes with the directory.
#
# Usage: scripts/backup-uploads.sh
set -eu

. "$(dirname "$0")/lib-deploy-env.sh"

STAMP="$(date +%F-%H%M)"
OUT="uploads-$STAMP.tar.gz"

mkdir -p "$ROOT_DIR/backups"
echo "==> Đóng gói file Excel đã nạp vào backups/$OUT"

compose --profile tools run --rm dbtools \
  "tar czf '/backups/$OUT' -C /data/uploads ."

echo "==> Xong: backups/$OUT ($(du -h "$ROOT_DIR/backups/$OUT" | cut -f1))"
