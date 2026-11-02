#!/usr/bin/env bash
# Alerta si algún disco vigilado supera el umbral de uso (por defecto 80 %).
# Uso (cron cada hora): infra/monitor/check-disk.sh [--env-file infra/.env.staging]
# Variables: ALERT_DISK_THRESHOLD (80), ALERT_DISK_PATHS (rutas separadas por espacios; por defecto
#            "/ /var/lib/docker $BACKUP_DIR"), y las de infra/lib/alert.sh.
set -Eeuo pipefail
SCRIPT_NAME=check-disk
# shellcheck source=SCRIPTDIR/../lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/../lib/common.sh"
# shellcheck source=SCRIPTDIR/../lib/alert.sh
source "$(dirname "${BASH_SOURCE[0]}")/../lib/alert.sh"
if [[ ${1:-} == --env-file ]]; then load_env_file "${2:?Falta la ruta tras --env-file}"; shift 2; fi
threshold=${ALERT_DISK_THRESHOLD:-80}
[[ $threshold =~ ^[0-9]+$ ]] || die "ALERT_DISK_THRESHOLD debe ser un número"
read -ra paths <<< "${ALERT_DISK_PATHS:-/ /var/lib/docker ${BACKUP_DIR:-}}"
status=0
for path in "${paths[@]}"; do
  [[ -e $path ]] || continue
  usage=$(df -P "$path" | awk 'NR==2 {gsub("%","",$5); print $5}')
  if (( usage >= threshold )); then
    send_alert "Disco al ${usage}% en $path" "El disco que contiene $path está al ${usage}% (umbral ${threshold}%). Libera espacio o amplía el disco. Ver docs/MANUAL-OPERACION.md." || true
    status=2
  else
    log "Disco $path: ${usage}% (umbral ${threshold}%)"
  fi
done
exit "$status"
