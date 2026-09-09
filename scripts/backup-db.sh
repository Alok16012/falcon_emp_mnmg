#!/usr/bin/env bash
# Full backup of the Supabase database to ~/Desktop/falconerp-backups.
#
# Usage:  ./scripts/backup-db.sh
# Restore: pg_restore --clean --if-exists --no-owner --no-acl \
#            -d "$DIRECT_URL" ~/Desktop/falconerp-backups/<file>.dump
#
# Dumps through DIRECT_URL (session pooler, :5432) — the pooled :6543 URL
# does not support pg_dump.

set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
    echo "error: .env.local not found (needs DIRECT_URL)" >&2
    exit 1
fi

set -a
# shellcheck disable=SC1091
source .env.local
set +a

: "${DIRECT_URL:?DIRECT_URL is not set in .env.local}"

DEST="$HOME/Desktop/falconerp-backups"
mkdir -p "$DEST"
OUT="$DEST/falconerp-$(date +%Y%m%d-%H%M).dump"

echo "Backing up to $OUT ..."
pg_dump "$DIRECT_URL" --schema=public --no-owner --no-acl -Fc -f "$OUT"

if [ ! -s "$OUT" ]; then
    echo "error: backup file is empty" >&2
    rm -f "$OUT"
    exit 1
fi

# Fail loudly if the dump restored to nothing useful — an empty-but-valid dump
# is the failure mode that silently ruins a backup routine.
ROWS=$(pg_restore --data-only --table=Employee -f - "$OUT" 2>/dev/null \
    | awk '/^COPY /{f=1;next} /^\\\.$/{f=0} f{c++} END{print c+0}')
if [ "$ROWS" -eq 0 ]; then
    echo "error: dump contains no Employee rows — not a usable backup" >&2
    exit 1
fi

echo "OK: $(du -h "$OUT" | cut -f1), Employee rows: $ROWS"

# Keep the 14 most recent dumps.
ls -t "$DEST"/falconerp-*.dump 2>/dev/null | tail -n +15 | xargs -r rm --
