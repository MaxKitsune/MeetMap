#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
backup_dir="${1:-./backups/$(date -u +%Y%m%dT%H%M%SZ)}"
mkdir -p "$backup_dir"
backup_dir="$(cd "$backup_dir" && pwd)"
docker compose stop app
trap 'docker compose start app >/dev/null' EXIT
docker compose exec -T db pg_dump -U meetmap -d meetmap -Fc > "$backup_dir/database.dump"
docker compose run --rm --no-deps -T --entrypoint tar app czf - -C /data uploads > "$backup_dir/uploads.tar.gz"
# Mark backup only after both files were written successfully.
docker compose exec -T db psql -U meetmap -d meetmap -c 'UPDATE "AppSettings" SET "lastBackupAt" = NOW();' >/dev/null
printf 'MeetMap backup complete: %s\n' "$backup_dir"
