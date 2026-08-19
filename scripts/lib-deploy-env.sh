#!/bin/sh
# Shared helpers for the deployment scripts. Sourced, never run directly.
#
# The env file is parsed rather than sourced: a commented-out line is a setting
# that was abandoned, not one in use, and `.` would happily execute anything
# else that happens to be in there.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Không tìm thấy $ENV_FILE. Chép .env.production.example thành .env rồi điền giá trị." >&2
  exit 1
fi

# Only lines starting with the key, so `# DATABASE_URL=...` is ignored.
# Last assignment wins, matching how the shell and docker compose read env files.
read_env() {
  grep -E "^$1=" "$ENV_FILE" \
    | tail -n 1 \
    | cut -d= -f2- \
    | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/"
}

# host:port/database, with the password stripped - safe to print and to log.
db_target() {
  after_scheme="${1#*://}"
  after_credentials="${after_scheme#*@}"
  host_port="${after_credentials%%/*}"
  database="${after_credentials#*/}"
  printf '%s/%s' "$host_port" "${database%%\?*}"
}

# The database server is shared with other projects, so every writing command
# states its target and waits. Pass --yes to skip it in a cron job.
confirm_target() {
  if [ "$SKIP_CONFIRM" = "1" ]; then
    echo "==> $1 (đã bỏ qua xác nhận vì có --yes)"
    return 0
  fi
  echo "==> $1"
  printf 'Gõ "yes" để tiếp tục: '
  read -r answer
  [ "$answer" = "yes" ] || { echo 'Đã huỷ.'; exit 1; }
}

compose() {
  docker compose --env-file "$ENV_FILE" "$@"
}
