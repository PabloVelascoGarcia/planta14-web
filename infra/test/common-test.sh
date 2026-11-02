#!/usr/bin/env bash
# Regression checks for backup error propagation, env parsing and unfinished retention files.
set -Eeuo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=SCRIPTDIR/../lib/common.sh
source "$here/../lib/common.sh"
work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT
printf 'data\n' > "$work/source"

# Failures inside command substitution must not print a successful backup filename.
age() { return 17; }
gpg() { return 18; }
if result=$(BACKUP_ENCRYPTION=age BACKUP_AGE_RECIPIENT=test encrypt_file "$work/source" 2>/dev/null); then die 'age failure was ignored'; fi
[[ -z $result && -f $work/source && ! -f $work/source.age ]] || die 'age failure reported a completed copy'
if result=$(BACKUP_ENCRYPTION=gpg BACKUP_GPG_RECIPIENT=test encrypt_file "$work/source" 2>/dev/null); then die 'gpg failure was ignored'; fi
[[ -z $result && -f $work/source && ! -f $work/source.gpg ]] || die 'gpg failure reported a completed copy'
unset -f age gpg

printf "REVIEW_ENV_HASH='\$2a\$14\$literal'\r\nREVIEW_ENV_LABEL=\"value\"\r\n" > "$work/test.env"
load_env_file "$work/test.env"
# shellcheck disable=SC2016 # Dollar signs are literal hash characters, not shell variables.
[[ $REVIEW_ENV_HASH == '$2a$14$literal' && $REVIEW_ENV_LABEL == value ]] || die 'quoted/CRLF env parsing failed'

mkdir "$work/backups"
for d in 20 30 40; do touch "$work/backups/test-$(date -u -d "-$d days" +%Y%m%dT%H%M%SZ).dump.age"; done
touch "$work/backups/test-$(timestamp).dump.age.partial"
BACKUP_KEEP_MIN=2 BACKUP_RETENTION_DAYS=14 prune_backups "$work/backups" test
[[ $(find "$work/backups" -name '*.dump.age' | wc -l) -eq 2 ]] || die 'partial files counted as completed backups'
echo 'PASS: encryption failures stop the backup, quoted env parsing and partial-file retention'

# Checksums are mandatory for restores unless explicitly waived, and must name the exact file.
printf 'dump\n' > "$work/a.dump"; printf 'otro\n' > "$work/b.dump"
if (verify_checksum "$work/a.dump") 2>/dev/null; then die 'missing checksum was accepted'; fi
(ALLOW_MISSING_CHECKSUM=true verify_checksum "$work/a.dump") 2>/dev/null || die 'explicit --allow-missing-checksum was refused'
write_checksum "$work/a.dump"; (verify_checksum "$work/a.dump") 2>/dev/null || die 'valid checksum rejected'
(cd "$work" && sha256sum b.dump > a.dump.sha256)
if (verify_checksum "$work/a.dump") 2>/dev/null; then die 'checksum of another file was accepted'; fi
ln -s "$work/a.dump" "$work/link.dump"
if (safe_input_file "$work/link.dump") 2>/dev/null; then die 'symlink accepted as backup file'; fi
echo 'PASS: mandatory checksum (explicit override only), exact file name, symlinks rejected'

[[ $(PG_CONTAINER=''; COMPOSE_PROJECT_NAME=review; resolve_pg_container; printf '%s' "$PG_CONTAINER") == review-postgres-1 ]] || die 'empty PG_CONTAINER did not resolve to the project'
[[ $(PG_CONTAINER=none; resolve_pg_container; printf '%s' "$PG_CONTAINER") == '' ]] || die 'none did not select host tools'
[[ $(PG_CONTAINER=custom; resolve_pg_container; printf '%s' "$PG_CONTAINER") == custom ]] || die 'explicit container changed'
echo 'PASS: PG_CONTAINER empty, none and explicit container'
