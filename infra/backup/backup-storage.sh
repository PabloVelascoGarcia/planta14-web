#!/usr/bin/env bash
# Copia del almacenamiento S3 (bucket de Payload) con rclone: descarga todos los objetos,
# genera un manifiesto con SHA-256, empaqueta en .tar.gz con fecha, cifra (opcional) y aplica retención.
#
# Uso: infra/backup/backup-storage.sh [--env-file infra/.env.staging]
# Variables: BACKUP_DIR, S3_BUCKET, S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY,
#            S3_FORCE_PATH_STYLE, STORAGE_RCLONE (docker|host, por defecto docker), RCLONE_IMAGE,
#            BACKUP_DOCKER_NETWORK, BACKUP_ENCRYPTION..., BACKUP_RETENTION_DAYS, BACKUP_KEEP_MIN.
# Para copiar con permisos de solo lectura, usa una clave distinta: STORAGE_BACKUP_ACCESS_KEY_ID /
# STORAGE_BACKUP_SECRET_ACCESS_KEY (si no se definen, se usan S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY).
set -Eeuo pipefail
SCRIPT_NAME=backup-storage
# shellcheck source=SCRIPTDIR/../lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/../lib/common.sh"
# shellcheck source=SCRIPTDIR/../lib/rclone.sh
source "$(dirname "${BASH_SOURCE[0]}")/../lib/rclone.sh"

if [[ ${1:-} == --env-file ]]; then load_env_file "${2:?Falta la ruta tras --env-file}"; shift 2; fi
[[ $# -eq 0 ]] || die "Argumento no reconocido: $1"

: "${BACKUP_DIR:?Define BACKUP_DIR}"
bucket=${S3_BUCKET:?Define S3_BUCKET}
out_dir="$BACKUP_DIR/storage"
prefix="planta14-storage-$bucket"
mkdir -p "$out_dir"
acquire_lock backup-storage
require_cmd tar sha256sum
rclone_setup "${STORAGE_BACKUP_ACCESS_KEY_ID:-${S3_ACCESS_KEY_ID:-}}" "${STORAGE_BACKUP_SECRET_ACCESS_KEY:-${S3_SECRET_ACCESS_KEY:-}}"

stamp=$(timestamp)
work=$(mktemp -d "$out_dir/.work-XXXXXX")
trap 'rm -rf -- "$work"' EXIT
mkdir -p "$work/objects"

log "Descargando objetos del bucket $bucket"
run_rclone "$work" copy "p14:$bucket" /work/objects --checksum --transfers 8
count=$(find "$work/objects" -type f | wc -l)
(cd "$work/objects" && find . -type f -print0 | sort -z | xargs -0 -r sha256sum) > "$work/MANIFEST.sha256"
printf 'bucket=%s\nfecha=%s\nobjetos=%s\n' "$bucket" "$stamp" "$count" > "$work/INFO"
log "Objetos descargados: $count"

final="$out_dir/$prefix-$stamp.tar.gz"
tar -C "$work" -czf "$final.partial" INFO MANIFEST.sha256 objects
mv -- "$final.partial" "$final"
final=$(encrypt_file "$final")
write_checksum "$final"
log "Copia creada: $final ($(du -h "$final" | cut -f1))"

prune_backups "$out_dir" "$prefix"
printf '%s\n' "$final"
