#!/usr/bin/env bash
# Copia FUERA DEL SERVIDOR: sube las copias locales (PostgreSQL y almacenamiento) a un S3 externo.
#
# Uso: infra/backup/offsite-sync.sh [--env-file infra/.env.staging]
# Variables: BACKUP_DIR, OFFSITE_BUCKET, OFFSITE_PREFIX, OFFSITE_ENDPOINT, OFFSITE_REGION,
#            OFFSITE_FORCE_PATH_STYLE, OFFSITE_ACCESS_KEY_ID, OFFSITE_SECRET_ACCESS_KEY,
#            OFFSITE_ALLOW_UNENCRYPTED (false), BACKUP_EGRESS_NETWORK, RCLONE_IMAGE.
#
# - Solo AÑADE: usa "rclone copy --immutable", nunca "sync". Un borrado local o una copia local
#   dañada no se propaga, y un archivo remoto con el mismo nombre y distinto contenido es un error.
# - Solo sube copias cifradas (.age/.gpg) y sus .sha256, salvo OFFSITE_ALLOW_UNENCRYPTED=true.
# - La retención y la protección contra borrado del destino se configuran en el proveedor
#   (ciclo de vida + versionado/bloqueo de objetos). La clave de este script no debe poder borrar.
# - Se ejecuta en la red de salida de copias, sin acceso a la red interna ni a PostgreSQL.
set -Eeuo pipefail
SCRIPT_NAME=offsite-sync
# shellcheck source=SCRIPTDIR/../lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/../lib/common.sh"
# shellcheck source=SCRIPTDIR/../lib/rclone.sh
source "$(dirname "${BASH_SOURCE[0]}")/../lib/rclone.sh"

if [[ ${1:-} == --env-file ]]; then load_env_file "${2:?Falta la ruta tras --env-file}"; shift 2; fi
[[ $# -eq 0 ]] || die "Argumento no reconocido: $1"
: "${BACKUP_DIR:?Define BACKUP_DIR}"
[[ -d $BACKUP_DIR ]] || die "No existe BACKUP_DIR: $BACKUP_DIR"
acquire_lock offsite-sync
rclone_setup_offsite
network=$(egress_network) || exit 1
remote=$(offsite_path) || exit 1

declare -a filters=(--filter '- *.partial' --filter '- .*')
if [[ ${OFFSITE_ALLOW_UNENCRYPTED:-false} == true ]]; then
  log "AVISO: OFFSITE_ALLOW_UNENCRYPTED=true; se suben también copias sin cifrar"
  filters+=(--filter '+ planta14-*')
else
  filters+=(--filter '+ planta14-*.age' --filter '+ planta14-*.age.sha256' --filter '+ planta14-*.gpg' --filter '+ planta14-*.gpg.sha256')
  unencrypted=$(find "$BACKUP_DIR" -mindepth 2 -maxdepth 2 -type f -name 'planta14-*' ! -name '*.age' ! -name '*.gpg' ! -name '*.sha256' ! -name '*.partial' | wc -l)
  (( unencrypted == 0 )) || log "AVISO: $unencrypted copias sin cifrar NO se suben (configura BACKUP_ENCRYPTION=age)"
fi
filters+=(--filter '- *')

uploaded=0
for kind in postgres storage; do
  [[ -d $BACKUP_DIR/$kind ]] || continue
  log "Subiendo $kind a $remote/$kind"
  run_rclone_on "$network" "$BACKUP_DIR/$kind:ro" copy /work "$remote/$kind" --immutable --checksum "${filters[@]}"
  run_rclone_on "$network" "$BACKUP_DIR/$kind:ro" check /work "$remote/$kind" --one-way "${filters[@]}" || die "La verificación del destino externo ha fallado ($kind)"
  uploaded=$((uploaded + 1))
done
(( uploaded > 0 )) || die "No hay copias locales en $BACKUP_DIR/postgres ni $BACKUP_DIR/storage"
log "Copia externa verificada en $remote"
