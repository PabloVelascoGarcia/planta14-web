#!/usr/bin/env bash
# Estado de producción en lenguaje llano: versión actual y anterior, contenedores, /api/health y últimas copias.
# Uso: infra/deploy/status.sh [--env-file infra/.env.production]
set -Euo pipefail
SCRIPT_NAME=status
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
infra=$(cd "$here/.." && pwd)
repo=$(cd "$infra/.." && pwd)
# shellcheck source=SCRIPTDIR/../lib/common.sh
source "$infra/lib/common.sh"
# shellcheck source=SCRIPTDIR/lib.sh
source "$here/lib.sh"
env_file=$infra/.env.production
[[ ${1:-} == --env-file ]] && env_file=${2:?}
deploy_init "$env_file"
current=$(state_get current) previous=$(state_get previous)
echo "Versión actual:   ${current:-ninguna} $( [[ -n $current ]] && git -C "$repo" log -1 --format='(%cd, %s)' --date=short "$current" 2>/dev/null)"
echo "Versión anterior: ${previous:-ninguna}"
echo "Indexación en buscadores (SITE_INDEXABLE): $SITE_INDEXABLE"
echo; compose ps --format '{{.Service}}: {{.Status}}'
echo; if health_once; then echo "/api/health: ok"; else echo "/api/health: ERROR"; fi
echo; echo "Últimas copias:"
for kind in postgres storage; do
  last=$(find "$BACKUP_DIR/$kind" -maxdepth 1 -type f -name 'planta14-*' ! -name '*.sha256' -printf '%TY-%Tm-%Td %TH:%TM  %f\n' 2>/dev/null | sort | tail -n 1)
  echo "  $kind: ${last:-ninguna}"
done
echo; echo "Últimos despliegues:"; tail -n 5 "$DEPLOY_STATE_DIR/historial.log" 2>/dev/null | sed 's/^/  /' || echo "  ninguno"
