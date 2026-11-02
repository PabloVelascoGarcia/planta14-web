#!/usr/bin/env bash
# Ejecuta una tarea (p. ej. una copia de seguridad) y envía una alerta si falla.
# Uso: infra/monitor/run-with-alert.sh NOMBRE -- ORDEN [ARGUMENTOS...]
# Ejemplo (cron): infra/monitor/run-with-alert.sh "Copia de PostgreSQL" -- infra/backup/backup-postgres.sh --env-file infra/.env.staging
# Las variables de correo se leen de ALERT_ENV_FILE (o del entorno). La salida de la tarea sigue yendo a su log.
set -Euo pipefail
SCRIPT_NAME=run-with-alert
# shellcheck source=SCRIPTDIR/../lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/../lib/common.sh"
# shellcheck source=SCRIPTDIR/../lib/alert.sh
source "$(dirname "${BASH_SOURCE[0]}")/../lib/alert.sh"
[[ $# -ge 3 && $2 == -- ]] || die "Uso: $0 NOMBRE -- ORDEN [ARGUMENTOS...]"
name=$1; shift 2
[[ -n ${ALERT_ENV_FILE:-} ]] && load_env_file "$ALERT_ENV_FILE"
"$@"
code=$?
if (( code != 0 )); then
  send_alert "FALLO: $name" "La tarea \"$name\" ha terminado con error (código $code) a las $(date '+%H:%M del %d/%m/%Y'). Revisa el log de copias y docs/MANUAL-OPERACION.md." || true
fi
exit "$code"
