#!/usr/bin/env bash
# Restaura una copia de backup-storage.sh en un bucket VACÍO y verifica el manifiesto SHA-256.
#
# Uso: infra/restore/restore-storage.sh [--env-file F] ARCHIVO BUCKET_DESTINO
# Variables: S3_ENDPOINT, S3_REGION, S3_FORCE_PATH_STYLE, credenciales con escritura en el destino
#            (STORAGE_RESTORE_ACCESS_KEY_ID / STORAGE_RESTORE_SECRET_ACCESS_KEY, o S3_ACCESS_KEY_ID /
#            S3_SECRET_ACCESS_KEY), STORAGE_RCLONE, RCLONE_IMAGE, BACKUP_DOCKER_NETWORK, BACKUP_AGE_IDENTITY.
# El bucket de destino debe existir y estar vacío.
set -Eeuo pipefail
SCRIPT_NAME=restore-storage
# shellcheck source=SCRIPTDIR/../lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/../lib/common.sh"
# shellcheck source=SCRIPTDIR/../lib/rclone.sh
source "$(dirname "${BASH_SOURCE[0]}")/../lib/rclone.sh"

if [[ ${1:-} == --env-file ]]; then load_env_file "${2:?Falta la ruta tras --env-file}"; shift 2; fi
[[ $# -eq 2 ]] || die "Uso: $0 [--env-file F] ARCHIVO BUCKET_DESTINO"
src=$1 bucket=$2
[[ -f $src ]] || die "No existe: $src"
require_cmd tar sha256sum
rclone_setup "${STORAGE_RESTORE_ACCESS_KEY_ID:-${S3_ACCESS_KEY_ID:-}}" "${STORAGE_RESTORE_SECRET_ACCESS_KEY:-${S3_SECRET_ACCESS_KEY:-}}"

verify_checksum "$src"
work=$(mktemp -d)
chmod 755 "$work"
trap 'rm -rf -- "$work"' EXIT
decrypt_file "$src" "$work/archive.tar.gz"
tar -C "$work" -xzf "$work/archive.tar.gz"
rm -f "$work/archive.tar.gz"
(cd "$work/objects" && sha256sum --quiet -c ../MANIFEST.sha256) || die "El contenido no coincide con el manifiesto"
expected=$(find "$work/objects" -type f | wc -l)

existing=$(run_rclone "$work" lsf -R --files-only "p14:$bucket" | wc -l)
[[ $existing == 0 ]] || die "El bucket $bucket no está vacío ($existing objetos). No se restaura encima."

log "Subiendo $expected objetos a $bucket"
run_rclone "$work" copy /work/objects "p14:$bucket" --transfers 8
run_rclone "$work" check /work/objects "p14:$bucket" --one-way --download || die "La verificación tras restaurar ha fallado"
log "Restauración del almacenamiento completada: $expected objetos verificados en $bucket"
