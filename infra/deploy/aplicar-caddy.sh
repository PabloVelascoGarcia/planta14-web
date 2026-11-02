#!/usr/bin/env bash
# Aplica a Caddy los cambios del .env sin reconstruir ni tocar la web: poner o quitar la contraseña de
# preproducción (PREPRODUCTION_AUTH), cambiar su hash o la redirección del dominio anterior. Recrea solo el
# contenedor de Caddy (unos segundos) y comprueba el resultado.
# Para cambios de la web (SITE_DOMAIN, SITE_INDEXABLE...) usa deploy.sh con DEPLOY_FORCE=1 (ver la guía).
#
# Uso: infra/deploy/aplicar-caddy.sh [--env-file infra/.env.production]
set -Eeuo pipefail
SCRIPT_NAME=aplicar-caddy
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
infra=$(cd "$here/.." && pwd)
# shellcheck source=SCRIPTDIR/../lib/common.sh
source "$infra/lib/common.sh"
# shellcheck source=SCRIPTDIR/lib.sh
source "$here/lib.sh"
env_file=$infra/.env.production
[[ ${1:-} == --env-file ]] && env_file=${2:?}
deploy_init "$env_file"
[[ -n $(state_get current) ]] || die "La web no está instalada todavía: usa deploy.sh"
exec 8>"$DEPLOY_STATE_DIR/.deploy.lock"; flock -n 8 || die "Hay un despliegue o una restauración en curso"
log "Recreando Caddy con el .env actual (la web no se reconstruye ni se reinicia)"
compose up -d --no-deps --force-recreate caddy >/dev/null
code() { site_curl -o /dev/null -w '%{http_code}' "https://$SITE_DOMAIN$1" 2>/dev/null || true; }
for _ in $(seq 1 30); do [[ $(code /api/health) == 200 ]] && break; sleep 2; done
health=$(code /api/health) home=$(code /)
log "/api/health: $health · portada sin contraseña: $home"
if [[ ${PREPRODUCTION_AUTH:-off} == on ]]; then
  [[ $health == 200 && $home == 401 ]] || die "Se esperaba /api/health 200 y la portada 401 (contraseña pedida)"
  log "Contraseña de preproducción PUESTA: la web la pide; /api/health sigue abierto"
  record "preproduccion-contrasena-puesta"
else
  [[ $health == 200 && $home == 200 ]] || die "Se esperaba /api/health 200 y la portada 200 (sin contraseña)"
  log "Contraseña de preproducción QUITADA: la web es pública"
  record "preproduccion-contrasena-quitada"
fi
