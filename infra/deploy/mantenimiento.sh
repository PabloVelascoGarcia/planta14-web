#!/usr/bin/env bash
# Modo mantenimiento a mano: /cms, API de escritura y paneles municipales en solo lectura; la web pública sigue.
# deploy.sh lo activa y desactiva solo durante cada actualización; esto es para casos puntuales.
#
# Uso: infra/deploy/mantenimiento.sh [--env-file F] estado
#      infra/deploy/mantenimiento.sh [--env-file F] activar ["motivo"]
#      infra/deploy/mantenimiento.sh [--env-file F] desactivar
# Si hay una restauración asistida pendiente, "desactivar" se niega: primero hay que restaurar
# (infra/deploy/restaurar.sh). Con --forzar se renuncia a esa restauración: se desactiva y la base se queda
# como la dejó la migración fallida (decisión excepcional; ver docs/MANUAL-OPERACION.md).
set -Eeuo pipefail
SCRIPT_NAME=mantenimiento
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
infra=$(cd "$here/.." && pwd)
# shellcheck source=SCRIPTDIR/../lib/common.sh
source "$infra/lib/common.sh"
# shellcheck source=SCRIPTDIR/lib.sh
source "$here/lib.sh"

env_file=$infra/.env.production force=0
while [[ $# -gt 0 ]]; do
  case $1 in
    --env-file) env_file=${2:?}; shift 2 ;;
    --forzar) force=1; shift ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    -*) die "Opción no reconocida: $1" ;;
    *) break ;;
  esac
done
action=${1:-estado}
deploy_init "$env_file"

case $action in
  estado)
    if maintenance_is_on; then
      echo "Modo mantenimiento: ACTIVADO (solo lectura)"; sed 's/^/  /' "$MAINTENANCE_DIR/activo"
      if maintenance_enforced; then echo "  Caddy rechaza las escrituras: sí"; else echo "  Caddy rechaza las escrituras: NO (¿Caddy parado o sin la configuración actual?)"; fi
    else echo "Modo mantenimiento: desactivado (se puede escribir)"; fi
    if pending_restore_exists; then echo; restore_instructions; fi ;;
  activar)
    exec 8>"$DEPLOY_STATE_DIR/.deploy.lock"; flock -n 8 || die "Hay un despliegue o una restauración en curso"
    maintenance_is_on && { log "Ya estaba activado"; exit 0; }
    maintenance_on "${2:-activado a mano por $(id -un)}"
    maintenance_ensure_enforced || die "El archivo está puesto pero Caddy no rechaza las escrituras: revisa 'docker compose ps'"
    log "Comprobado: las escrituras se rechazan y la web pública sigue funcionando" ;;
  desactivar)
    exec 8>"$DEPLOY_STATE_DIR/.deploy.lock"; flock -n 8 || die "Hay un despliegue o una restauración en curso"
    if pending_restore_exists && (( ! force )); then
      log "Hay una restauración asistida pendiente: no se desactiva (los cambios se perderían al restaurar)."
      restore_instructions >&2
      exit 1
    fi
    if pending_restore_exists; then
      mv "$DEPLOY_STATE_DIR/$PENDING_RESTORE_FILE" "$DEPLOY_STATE_DIR/$PENDING_RESTORE_FILE.descartada-$(date +%Y%m%d%H%M%S)"
      record "restauracion-descartada por $(id -un)"
      log "Restauración pendiente DESCARTADA a petición (--forzar)"
    fi
    maintenance_is_on || { log "No estaba activado"; exit 0; }
    maintenance_off "desactivado a mano por $(id -un)" ;;
  *) die "Acción no reconocida: $action (estado, activar o desactivar)" ;;
esac
