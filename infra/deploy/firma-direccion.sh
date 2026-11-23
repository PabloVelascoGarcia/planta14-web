#!/usr/bin/env bash
# Firma de la dirección en el servidor: autor «El Director» y firma fija en las cuentas de Pablo (scripts/firma-direccion.ts).
# Se ejecuta en el contenedor de migraciones de la versión instalada. Se puede repetir. No toca noticias.
#
# Uso: infra/deploy/firma-direccion.sh [--env-file infra/.env.production] [--admin correo-de-administración]
set -Eeuo pipefail
SCRIPT_NAME=firma-direccion
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
infra=$(cd "$here/.." && pwd)
# shellcheck source=SCRIPTDIR/../lib/common.sh
source "$infra/lib/common.sh"
# shellcheck source=SCRIPTDIR/lib.sh
source "$here/lib.sh"

env_file=$infra/.env.production
[[ ${1:-} == --env-file ]] && { env_file=${2:?}; shift 2; }
deploy_init "$env_file"
[[ -n $(state_get current) ]] || die "La web no está instalada: despliega antes con deploy.sh"
exec 8>"$DEPLOY_STATE_DIR/.deploy.lock"; flock -n 8 || die "Hay un despliegue o una restauración en curso"
compose up -d postgres >/dev/null
wait_postgres || die "PostgreSQL no responde"
log "cms:firma-direccion $*"
compose --profile migrate run --rm -T migrate node scripts/firma-direccion-run.mjs "$@"
record "firma-direccion"
