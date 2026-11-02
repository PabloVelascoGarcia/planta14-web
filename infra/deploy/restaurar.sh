#!/usr/bin/env bash
# Restauración asistida tras una actualización fallida que llegó a cambiar la base de datos.
#
# La clave privada age de las copias NO está en el servidor: la custodia Pablo (gestor de contraseñas y copia
# impresa). Este script la recibe por la ENTRADA ESTÁNDAR, normalmente a través de SSH desde su PC:
#
#   ssh -t planta14@planta14.com "cd /srv/planta14/app && infra/deploy/restaurar.sh"
#       (pide la clave; se pega y no se ve)
#   Get-Clipboard | ssh planta14@planta14.com "cd /srv/planta14/app && infra/deploy/restaurar.sh"
#       (PowerShell: la toma del portapapeles)
#
# La clave solo vive en la memoria de este proceso: no se escribe en disco, no aparece en la línea de órdenes
# (ni en "ps" ni en el historial) y llega a age por una tubería. Comprueba que corresponde a la clave pública
# de las copias, restaura en una base nueva la copia hecha justo antes de la migración fallida, la pone en
# servicio (la base con los cambios se conserva renombrada), reinicia la app y, SOLO si /api/health responde
# bien, desactiva el modo mantenimiento.
#
# Uso: infra/deploy/restaurar.sh [--env-file infra/.env.production] [--solo-comprobar]
#   --solo-comprobar  simulacro sin cambiar nada: comprueba la clave y que descifra la última copia de PostgreSQL
#                     (sirve para practicar y para confirmar que la clave guardada es la buena).
# Código de salida: 0 restaurada y mantenimiento desactivado; 2 restaurada o a medias pero algo no responde
# (el mantenimiento sigue activado); 3 no se cambió nada (sin restauración pendiente, clave incorrecta...).
set -Eeuo pipefail
SCRIPT_NAME=restaurar
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
infra=$(cd "$here/.." && pwd)
# shellcheck source=SCRIPTDIR/../lib/common.sh
source "$infra/lib/common.sh"
# shellcheck source=SCRIPTDIR/lib.sh
source "$here/lib.sh"
ulimit -c 0 # sin volcados de memoria que pudieran contener la clave

env_file=$infra/.env.production check_only=0
while [[ $# -gt 0 ]]; do
  case $1 in
    --env-file) env_file=${2:?}; shift 2 ;;
    --solo-comprobar) check_only=1; shift ;;
    -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
    *) die "Opción no reconocida: $1 (la clave NO se pasa como argumento: se pega cuando la pida)" ;;
  esac
done
trap 'log "ERROR inesperado en la línea $LINENO; no se ha cambiado nada"; exit 3' ERR
deploy_init "$env_file"
require_cmd age age-keygen
exec 8>"$DEPLOY_STATE_DIR/.deploy.lock"
flock -n 8 || { log "Hay un despliegue o una restauración en curso"; exit 3; }

if (( check_only )); then
  dump=$(find "$BACKUP_DIR/postgres" -maxdepth 1 -type f -name 'planta14-*.dump.age' -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -n 1 | cut -d' ' -f2-)
  [[ -n $dump ]] || { log "No hay copias cifradas de PostgreSQL en $BACKUP_DIR/postgres para el simulacro"; exit 3; }
  log "Simulacro: se comprobará la clave con la última copia, $(basename "$dump"). No se cambia nada."
else
  pending_restore_exists || { log "No hay ninguna restauración pendiente. No se ha cambiado nada."; exit 3; }
  dump=$(pending_get copia) failed=$(pending_get version_fallida) running=$(pending_get version_en_marcha)
  [[ -n $dump && -f $dump ]] || { log "No se encuentra la copia previa ($dump). No se ha cambiado nada."; exit 3; }
  [[ $(state_get current) == "$running" ]] || log "AVISO: la versión en marcha ($(state_get current)) no es la anotada ($running)"
  log "Restauración pendiente: la actualización a ${failed:0:12} falló el $(pending_get fecha)."
  log "Se restaurará la copia $(basename "$dump") y seguirá la versión ${running:0:12}."
  maintenance_is_on || maintenance_on "restauración asistida en curso"
fi

# --- Clave privada por la entrada estándar (solo en memoria) ----------------------------------------
line=''
if [[ -t 0 ]]; then
  printf 'Pega la clave privada de las copias (empieza por AGE-SECRET-KEY-1; no se verá) y pulsa Intro: ' >&2
  IFS= read -rs line || true
  printf '\n' >&2
else
  IFS= read -r line || true
fi
key=''
# Admite el final de línea de Windows, espacios o el BOM de PowerShell alrededor de la clave.
[[ $line =~ (AGE-SECRET-KEY-1[0-9A-Z]+) ]] && key=${BASH_REMATCH[1]}
line=''
[[ -n $key ]] || { log "Eso no parece una clave age (debe empezar por AGE-SECRET-KEY-1). No se ha cambiado nada."; exit 3; }
public=$(printf '%s\n' "$key" | age-keygen -y 2>/dev/null) || public=''
if [[ -z $public || $public != "${BACKUP_AGE_RECIPIENT:-}" ]]; then
  key=''
  log "La clave no corresponde a la clave pública de las copias (BACKUP_AGE_RECIPIENT). No se ha cambiado nada."
  log "Comprueba que has copiado la clave privada de Planta 14 completa. El modo mantenimiento sigue activado."
  exit 3
fi
log "Clave correcta (corresponde a $public)"
if (( check_only )); then
  resolve_pg_container
  if age -d -i /dev/fd/3 "$dump" 3< <(printf '%s\n' "$key") | docker exec -i "$PG_CONTAINER" pg_restore --list >/dev/null; then
    key=''
    log "SIMULACRO CORRECTO: la clave descifra $(basename "$dump") y el volcado es válido. No se ha cambiado nada."
    exit 0
  fi
  key=''
  log "La clave es la correcta, pero no se pudo descifrar o leer $(basename "$dump"). Avisa a la persona técnica."
  exit 2
fi

# --- Restauración -----------------------------------------------------------------------------------
trap 'key=""; log "ERROR inesperado en la línea $LINENO. El modo mantenimiento sigue activado"; exit 2' ERR
# age lee la clave de una tubería (descriptor 3), nunca de un archivo.
export BACKUP_AGE_IDENTITY=/dev/fd/3
if ! restore_dump "$dump" 3< <(printf '%s\n' "$key"); then
  key=''
  notify "Restauración asistida fallida" "No se pudo restaurar $dump. La versión ${running:0:12} sigue en marcha en modo mantenimiento."
  exit 2
fi
key=''; unset BACKUP_AGE_IDENTITY
log "Reiniciando la app con la base restaurada"
compose restart app >/dev/null
if ! wait_healthy; then
  notify "Restauración hecha, pero /api/health no responde" "Se restauró $dump pero la versión ${running:0:12} no responde. El modo mantenimiento sigue activado."
  exit 2
fi
mv "$DEPLOY_STATE_DIR/$PENDING_RESTORE_FILE" "$DEPLOY_STATE_DIR/$PENDING_RESTORE_FILE.hecha-$(date +%Y%m%d%H%M%S)"
record "restauracion-asistida $(basename "$dump") (version en marcha $running)"
maintenance_off "restauración asistida correcta y /api/health correcto"
notify "Restauración asistida completada" "Se restauró $(basename "$dump"). La versión ${running:0:12} funciona y se puede volver a escribir."
log "RESTAURACIÓN COMPLETADA. La web y el /cms funcionan con la versión ${running:0:12}; se puede volver a escribir."
