#!/usr/bin/env bash
# Programa en el servidor las copias (PostgreSQL, almacenamiento y externa), la vigilancia del disco y la
# rotación de registros. Idempotente: reescribe /etc/cron.d/planta14 y /etc/logrotate.d/planta14.
# Uso (root): infra/deploy/schedule.sh --env-file /srv/planta14/app/infra/.env.production [--user planta14]
# Requiere los avisos por correo de infra/monitor (rama de lanzamiento, que se fusiona antes de la salida).
set -Eeuo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
repo=$(cd "$here/../.." && pwd)
env_file='' user=planta14
cron_dir=${SCHEDULE_CRON_DIR:-/etc/cron.d} logrotate_dir=${SCHEDULE_LOGROTATE_DIR:-/etc/logrotate.d}
while [[ $# -gt 0 ]]; do
  case $1 in
    --env-file) env_file=${2:?}; shift 2 ;;
    --user) user=${2:?}; shift 2 ;;
    *) echo "Opción no reconocida: $1" >&2; exit 2 ;;
  esac
done
[[ -n $env_file && -f $env_file ]] || { echo "Indica --env-file con la ruta ABSOLUTA del .env de producción" >&2; exit 2; }
[[ $env_file == /* ]] || { echo "--env-file debe ser una ruta absoluta" >&2; exit 2; }
for script in infra/monitor/run-with-alert.sh infra/monitor/check-disk.sh infra/backup/backup-postgres.sh infra/backup/backup-storage.sh infra/backup/offsite-sync.sh; do
  [[ -x $repo/$script ]] || { echo "Falta $script: fusiona antes la rama de lanzamiento (alertas)" >&2; exit 1; }
done
[[ $user =~ ^[a-z][a-z0-9_-]*$ ]] || { echo "Usuario no válido" >&2; exit 2; }
log=/var/log/planta14/tareas.log
job() { # MINUTO HORA NOMBRE ORDEN...
  local m=$1 h=$2 name=$3; shift 3
  printf '%s %s * * * %s cd %q && ALERT_ENV_FILE=%q infra/monitor/run-with-alert.sh "%s" -- %s >> %s 2>&1\n' "$m" "$h" "$user" "$repo" "$env_file" "$name" "$*" "$log"
}
tmp=$(mktemp)
{
  echo "# Planta 14: copias, copia externa y vigilancia del disco. Generado por infra/deploy/schedule.sh; no editar a mano."
  echo "SHELL=/bin/bash"
  echo "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
  echo "CRON_TZ=Europe/Madrid"
  job 15 3 "Copia de PostgreSQL" "infra/backup/backup-postgres.sh --env-file $env_file"
  job 30 3 "Copia del almacenamiento" "infra/backup/backup-storage.sh --env-file $env_file"
  job 45 3 "Copia externa" "infra/backup/offsite-sync.sh --env-file $env_file"
  printf '0 * * * * %s cd %q && ALERT_ENV_FILE=%q infra/monitor/check-disk.sh --env-file %q >> %s 2>&1\n' "$user" "$repo" "$env_file" "$env_file" "$log"
} > "$tmp"
install -D -m 0644 "$tmp" "$cron_dir/planta14"; rm -f "$tmp"
cat > "$logrotate_dir/planta14" <<ROTATE
/var/log/planta14/*.log {
  weekly
  rotate 8
  compress
  missingok
  notifempty
  copytruncate
}
ROTATE
chmod 0644 "$logrotate_dir/planta14"
echo "Programado en $cron_dir/planta14 (registro en $log) y rotación en $logrotate_dir/planta14"
