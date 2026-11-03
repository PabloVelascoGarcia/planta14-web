#!/usr/bin/env bash
# Carga y retirada del contenido de ensayo en el servidor (contenido-ensayo/, ver docs/ENSAYO-CONTENIDO.md).
# Ejecuta npm run cms:ensayo:cargar|retirar en el contenedor de migraciones de la versión instalada.
# Antes de RETIRAR hace la copia de seguridad con las herramientas existentes (backup-postgres.sh y
# backup-storage.sh): la retirada borra imágenes del almacenamiento y no se hace sin esa copia.
#
# Uso: infra/deploy/ensayo.sh [--env-file infra/.env.production] cargar|retirar [--solo-comprobar] [--usuario correo-admin]
set -Eeuo pipefail
SCRIPT_NAME=ensayo
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
infra=$(cd "$here/.." && pwd)
# shellcheck source=SCRIPTDIR/../lib/common.sh
source "$infra/lib/common.sh"
# shellcheck source=SCRIPTDIR/lib.sh
source "$here/lib.sh"

env_file=$infra/.env.production
[[ ${1:-} == --env-file ]] && { env_file=${2:?}; shift 2; }
action=${1:-}; shift || true
[[ $action == cargar || $action == retirar ]] || die "Uso: $0 [--env-file F] cargar|retirar [--solo-comprobar] [--usuario correo-admin]"
check_only=0
for arg in "$@"; do [[ $arg == --solo-comprobar ]] && check_only=1; done
deploy_init "$env_file"
[[ -n $(state_get current) ]] || die "La web no está instalada: despliega antes con deploy.sh"
exec 8>"$DEPLOY_STATE_DIR/.deploy.lock"; flock -n 8 || die "Hay un despliegue o una restauración en curso"
compose up -d postgres >/dev/null
wait_postgres || die "PostgreSQL no responde"

copy=''
if [[ $action == retirar && $check_only == 0 ]]; then
  log "Copia de seguridad previa a la retirada"
  pg_dump_file=$("$infra/backup/backup-postgres.sh" --env-file "$env_file") || die "Falló la copia de PostgreSQL; no se retira nada"
  storage_file=$("$infra/backup/backup-storage.sh" --env-file "$env_file") || die "Falló la copia del almacenamiento; no se retira nada"
  copy="$(basename "$pg_dump_file") + $(basename "$storage_file")"
  log "Copias previas: $pg_dump_file y $storage_file"
fi
log "cms:ensayo:$action $*"
# ENSAYO_FOTOS_BASE solo existe en ensayos locales sin acceso a Commons. Se llama al lanzador sin npm (un proceso
# menos en el contenedor de migraciones); es lo mismo que npm run cms:ensayo:$action.
ENSAYO_COPIA_PREVIA=$copy compose --profile migrate run --rm -T -e ENSAYO_COPIA_PREVIA ${ENSAYO_FOTOS_BASE:+-e ENSAYO_FOTOS_BASE} \
  migrate node scripts/ensayo-run.mjs "$action" "$@"
[[ $check_only == 1 ]] || record "ensayo-$action${copy:+ (copia previa: $copy)}"
