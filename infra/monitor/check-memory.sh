#!/usr/bin/env bash
# Cron each minute. MemAvailable counts reclaimable cache, so cache alone is not an alarm.
set -Eeuo pipefail
SCRIPT_NAME=check-memory
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=SCRIPTDIR/../lib/common.sh
source "$here/../lib/common.sh"
# shellcheck source=SCRIPTDIR/../lib/alert.sh
source "$here/../lib/alert.sh"
if [[ ${1:-} == --env-file ]]; then load_env_file "${2:?}"; fi
require_cmd flock awk date
threshold=${ALERT_MEMORY_THRESHOLD:-85} sustained=${ALERT_MEMORY_SECONDS:-600}
[[ $threshold =~ ^[0-9]+$ && $threshold -lt 100 && $sustained =~ ^[0-9]+$ ]] || die 'Umbral/duración de memoria no válidos'
state_dir=${ALERT_MEMORY_STATE_DIR:-${BACKUP_DIR:-/var/backups/planta14}/monitor}
mkdir -p "$state_dir"
exec 9>"$state_dir/memory.lock"; flock -n 9 || exit 0
now=${MEMORY_TEST_NOW:-$(date +%s)}
[[ $now =~ ^[0-9]+$ ]] || die 'Fecha de muestra no válida'
usage=$(awk '/^MemTotal:/ {t=$2} /^MemAvailable:/ {a=$2; found=1} END {if (!t || !found) exit 1; v=100*(t-a)/t; printf "%.0f", int(v)+(v>int(v))}' "${MEMORY_MEMINFO_FILE:-/proc/meminfo}")
since=0 last=0 alerted=0
if [[ -f $state_dir/memory.state ]]; then read -r since last alerted < "$state_dir/memory.state"; fi
[[ $since =~ ^[0-9]+$ && $last =~ ^[0-9]+$ && $alerted =~ ^[0-9]+$ ]] || die 'Estado de memoria no válido'
status=0
if (( usage > threshold )); then
  if (( since == 0 || now - last > 180 || now < last )); then since=$now; alerted=0; fi
  if (( now - since >= sustained )); then
    status=2
    if (( alerted == 0 || now - alerted >= 21600 )); then
      send_alert 'RAM sostenida: preparar mudanza del VPS' "Memoria al $usage% durante al menos $sustained segundos. El VPS M+ no se amplía: preparar otro servidor y migrar con copia y restauración. Revisar primero procesos y carga; no borrar datos para liberar RAM." || true
      alerted=$now
    fi
  fi
else since=0; alerted=0; fi
printf '%s %s %s\n' "$since" "$now" "$alerted" > "$state_dir/memory.state.tmp"
mv "$state_dir/memory.state.tmp" "$state_dir/memory.state"
log "RAM $usage%; umbral $threshold%; inicio de exceso $since"
exit "$status"
