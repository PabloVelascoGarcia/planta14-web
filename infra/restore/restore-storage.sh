#!/usr/bin/env bash
# Restaura una copia de backup-storage.sh en un bucket VACÍO y verifica el manifiesto SHA-256.
#
# Uso: infra/restore/restore-storage.sh [--env-file F] [--allow-missing-checksum] ARCHIVO BUCKET_DESTINO
# ARCHIVO.sha256 es obligatorio salvo --allow-missing-checksum. Antes de extraer se valida el tar:
# solo INFO, MANIFEST.sha256 y objects/..., sin enlaces, archivos especiales, rutas absolutas ni "..".
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

while [[ $# -gt 0 ]]; do
  case $1 in
    --env-file) load_env_file "${2:?Falta la ruta tras --env-file}"; shift 2 ;;
    --allow-missing-checksum) export ALLOW_MISSING_CHECKSUM=true; shift ;;
    --) shift; break ;;
    -*) die "Opción no reconocida: $1" ;;
    *) break ;;
  esac
done
[[ $# -eq 2 ]] || die "Uso: $0 [--env-file F] [--allow-missing-checksum] ARCHIVO BUCKET_DESTINO"
src=$1 bucket=$2
safe_input_file "$src"
[[ $src == *.tar.gz || $src == *.tar.gz.age || $src == *.tar.gz.gpg ]] || die "Extensión no válida (se espera .tar.gz[.age|.gpg]): $src"
[[ $bucket =~ ^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$ && $bucket != *..* ]] || die "Nombre de bucket no válido: $bucket"
require_cmd tar sha256sum

verify_checksum "$src"
work=$(mktemp -d)
chmod 755 "$work"
trap 'rm -rf -- "$work"' EXIT
mkdir "$work/archive" "$work/data"
decrypt_file "$src" "$work/archive/archive.tar.gz"
extract_storage_archive "$work/archive/archive.tar.gz" "$work/data"
rm -rf -- "$work/archive"
(cd "$work/data/objects" && sha256sum --quiet -c ../MANIFEST.sha256) || die "El contenido no coincide con el manifiesto"
expected=$(find "$work/data/objects" -type f | wc -l)
# Credenciales solo después de validar la copia: un archivo rechazado no toca el almacenamiento.
rclone_setup "${STORAGE_RESTORE_ACCESS_KEY_ID:-${S3_ACCESS_KEY_ID:-}}" "${STORAGE_RESTORE_SECRET_ACCESS_KEY:-${S3_SECRET_ACCESS_KEY:-}}"

existing=$(run_rclone "$work/data" lsf -R --files-only "p14:$bucket" | wc -l)
[[ $existing == 0 ]] || die "El bucket $bucket no está vacío ($existing objetos). No se restaura encima."

log "Subiendo $expected objetos a $bucket"
run_rclone "$work/data:ro" copy /work/objects "p14:$bucket" --transfers 8
run_rclone "$work/data:ro" check /work/objects "p14:$bucket" --one-way --download || die "La verificación tras restaurar ha fallado"
log "Restauración del almacenamiento completada: $expected objetos verificados en $bucket"
