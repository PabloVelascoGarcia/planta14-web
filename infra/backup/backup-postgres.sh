#!/usr/bin/env bash
# Copia de PostgreSQL con pg_dump (formato custom), fecha en el nombre, suma SHA-256,
# cifrado opcional (age/gpg) y retención configurable.
#
# Uso: infra/backup/backup-postgres.sh [--env-file infra/.env.staging]
# Variables: BACKUP_DIR, POSTGRES_DB, POSTGRES_USER, PG_CONTAINER (o PGHOST/PGPORT/PGPASSWORD
#            para pg_dump local), BACKUP_ENCRYPTION, BACKUP_AGE_RECIPIENT, BACKUP_GPG_RECIPIENT,
#            BACKUP_RETENTION_DAYS, BACKUP_KEEP_MIN.
set -Eeuo pipefail
SCRIPT_NAME=backup-postgres
# shellcheck source=SCRIPTDIR/../lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/../lib/common.sh"

if [[ ${1:-} == --env-file ]]; then load_env_file "${2:?Falta la ruta tras --env-file}"; shift 2; fi
[[ $# -eq 0 ]] || die "Argumento no reconocido: $1"

: "${BACKUP_DIR:?Define BACKUP_DIR}"
db=${POSTGRES_DB:-planta14}
user=${POSTGRES_USER:-planta14}
out_dir="$BACKUP_DIR/postgres"
prefix="planta14-postgres-$db"
mkdir -p "$out_dir"
acquire_lock backup-postgres
if [[ -n ${PG_CONTAINER:-} ]]; then require_cmd docker; else require_cmd pg_dump pg_restore; fi

stamp=$(timestamp)
final="$out_dir/$prefix-$stamp.dump"
tmp="$final.partial"
trap 'rm -f -- "$tmp"' EXIT

log "Volcando la base $db (usuario $user)"
pg_tool pg_dump -U "$user" -d "$db" --format=custom --compress=6 --no-owner --no-privileges > "$tmp"
[[ -s $tmp ]] || die "El volcado está vacío"

# Comprobación: el archivo debe ser legible por pg_restore.
pg_tool pg_restore --list < "$tmp" > /dev/null || die "pg_restore no puede leer el volcado"

mv -- "$tmp" "$final"
final=$(encrypt_file "$final")
write_checksum "$final"
log "Copia creada: $final ($(du -h "$final" | cut -f1))"

prune_backups "$out_dir" "$prefix"
printf '%s\n' "$final"
