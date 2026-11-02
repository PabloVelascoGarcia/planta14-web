#!/usr/bin/env bash
# Despliegue de una versión concreta (etiqueta o commit) de Planta 14 en el servidor de producción.
#
# Uso (como el usuario administrador, desde la copia del repositorio en el servidor, p. ej. /srv/planta14/app):
#   infra/deploy/deploy.sh --env-file infra/.env.production v2.0.0
#   infra/deploy/deploy.sh --env-file infra/.env.production 1a2b3c4d
#
# Pasos:
#   1. Resuelve la versión a un commit y construye su imagen en el servidor (infra/app.Dockerfile de esa versión).
#   2. Activa el MODO MANTENIMIENTO (/cms, API de escritura y paneles municipales en solo lectura; la web pública
#      sigue) y hace la copia de PostgreSQL ANTES de migrar (infra/backup/backup-postgres.sh). Sin copia no se migra.
#   3. Migra con el usuario migrador, arranca la nueva versión y espera a que /api/health diga "ok". Solo entonces
#      desactiva el modo mantenimiento.
#   4. Si algo falla, vuelve a la imagen anterior:
#      - si la migración NO cambió la base, todo es automático y el mantenimiento se desactiva;
#      - si la migración SÍ la cambió, NO restaura solo (la clave privada de las copias no está en el servidor):
#        deja la versión anterior funcionando en modo mantenimiento e indica en lenguaje llano cómo hacer la
#        restauración asistida (infra/deploy/restaurar.sh, con la clave por la entrada estándar desde el PC).
# Las herramientas de despliegue (este script, Compose y Caddy) son las de la copia del servidor; la aplicación
# es la de la versión pedida. Estado en DEPLOY_STATE_DIR (versión actual, anterior, historial y restauración
# pendiente) y MAINTENANCE_DIR (modo mantenimiento).
#
# Código de salida: 0 desplegada; 1 falló y se volvió a la anterior sola (web y /cms funcionando); 2 requiere
# intervención (p. ej. restauración asistida pendiente: lee las instrucciones); 3 no se cambió nada (error previo).
set -Eeuo pipefail
SCRIPT_NAME=deploy
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
infra=$(cd "$here/.." && pwd)
repo=$(cd "$infra/.." && pwd)
# shellcheck source=SCRIPTDIR/../lib/common.sh
source "$infra/lib/common.sh"
# shellcheck source=SCRIPTDIR/lib.sh
source "$here/lib.sh"

env_file=$infra/.env.production
while [[ $# -gt 0 ]]; do
  case $1 in
    --env-file) env_file=${2:?}; shift 2 ;;
    -h|--help) sed -n '2,27p' "$0"; exit 0 ;;
    -*) die "Opción no reconocida: $1" ;;
    *) break ;;
  esac
done
[[ $# -eq 1 ]] || die "Uso: $0 [--env-file F] VERSIÓN (etiqueta o commit)"
ref=$1
trap 'log "ERROR inesperado en la línea $LINENO"; exit 3' ERR
deploy_init "$env_file"
exec 8>"$DEPLOY_STATE_DIR/.deploy.lock"
flock -n 8 || { log "Ya hay un despliegue en curso"; exit 3; }
if pending_restore_exists; then
  log "Hay una restauración asistida pendiente de una actualización fallida. Hazla antes de desplegar otra versión:"
  restore_instructions >&2
  exit 3
fi

# --- 1. Versión e imagen ---------------------------------------------------------------------------
if [[ ${DEPLOY_NO_FETCH:-0} != 1 ]]; then git -C "$repo" fetch --quiet --tags origin || log "AVISO: no se pudo actualizar desde origin; se usa lo local"; fi
sha=$(git -C "$repo" rev-parse --verify --quiet "$ref^{commit}") || { log "No existe la versión $ref"; exit 3; }
tag=$(image_tag "$sha")
previous=$(state_get current)
log "Versión pedida: $ref ($sha). Actual: ${previous:-ninguna}"
if [[ $sha == "$previous" && ${DEPLOY_FORCE:-0} != 1 ]]; then log "Esa versión ya está desplegada (DEPLOY_FORCE=1 para repetir)"; exit 0; fi
if docker image inspect "$tag" >/dev/null 2>&1; then log "Imagen $tag ya construida"
else
  build=$(mktemp -d); trap 'rm -rf -- "$build"' EXIT
  git -C "$repo" archive "$sha" | tar -x -C "$build"
  [[ -f $build/infra/app.Dockerfile ]] || { log "La versión $ref no tiene infra/app.Dockerfile"; exit 3; }
  log "Construyendo $tag (puede tardar varios minutos)"
  if [[ -n ${DEPLOY_BUILD_COMMAND:-} ]]; then "$DEPLOY_BUILD_COMMAND" "$build" "$tag"
  else bash "$here/build-image.sh" "$build" "$tag"; fi || { log "Falló la construcción; no se ha cambiado nada"; exit 3; }
fi

# --- 2. Base de datos en marcha, modo mantenimiento y copia previa ----------------------------------
compose up -d postgres >/dev/null
wait_postgres || { log "PostgreSQL no responde; no se ha cambiado nada"; exit 3; }
before=$(applied_migrations)
# Mantenimiento: lo activa este despliegue (y lo desactiva al terminar bien) salvo que ya estuviera activado a
# mano, en cuyo caso se respeta. En la primera instalación no hay nada que proteger.
maint_ours=0
if [[ -n $previous ]]; then
  if maintenance_is_on; then log "El modo mantenimiento ya estaba activado: se mantiene al terminar"
  else
    maintenance_on "actualización a $ref (${sha:0:12})"; maint_ours=1
  fi
  maintenance_ensure_enforced || {
    (( maint_ours )) && maintenance_off "no se pudo aplicar; despliegue cancelado"
    log "Caddy no aplica el modo mantenimiento; no se ha cambiado nada"; exit 3; }
fi
# Error antes de migrar: no ha cambiado nada; se quita el mantenimiento puesto por este despliegue.
abort_unchanged() { # MOTIVO
  log "$1; no se ha cambiado nada"
  (( maint_ours )) && maintenance_off "despliegue cancelado sin cambios"
  exit 3
}
trap 'abort_unchanged "error inesperado en la línea $LINENO"' ERR
dump=''
if [[ -n $(sql_super "SELECT 1 FROM pg_tables WHERE schemaname = 'public' LIMIT 1") ]]; then
  log "Copia de seguridad previa a la migración"
  dump=$("$infra/backup/backup-postgres.sh" --env-file "$env_file") || abort_unchanged "Falló la copia previa; no se migra"
  log "Copia previa: $dump"
else log "Base vacía (primera instalación): no hay nada que copiar"; fi

rollback() { # MOTIVO
  trap - ERR
  log "FALLO: $1"
  local after; after=$(applied_migrations || true)
  local changed_data=0; [[ $after != "$before" ]] && changed_data=1
  if [[ -z $previous ]]; then
    compose stop app >/dev/null 2>&1 || true
    record "fallo-sin-anterior $sha"
    notify "FALLO en el primer despliegue de $ref" "No hay versión anterior a la que volver. La web está parada. Motivo: $1"
    exit 2
  fi
  log "Volviendo a la versión anterior ${previous:0:12}"
  compose stop app >/dev/null 2>&1 || true
  if (( changed_data )); then
    # La base ya tiene cambios de la versión nueva. No se restaura sola: la clave privada no está en el servidor.
    maintenance_is_on || maintenance_on "restauración pendiente tras fallar $ref"
    [[ -n $dump ]] || { notify "FALLO grave en el despliegue de $ref" "La migración cambió datos y no hay copia previa. Modo mantenimiento activado; la web está parada."; exit 2; }
    pending_set "$dump" "$sha" "$previous" "$1"
    local web=no
    if APP_IMAGE=$(image_tag "$previous") compose up -d app caddy >/dev/null && wait_healthy; then web=sí; fi
    record "vuelta-atras-sin-restaurar $sha -> $previous (restauracion asistida pendiente; copia $dump)"
    log "La migración llegó a cambiar la base: NO se restaura automáticamente. Modo mantenimiento ACTIVADO."
    log "Versión anterior ${previous:0:12} en marcha. Web pública respondiendo: $web"
    restore_instructions >&2
    notify "Actualización a $ref fallida: restauración asistida pendiente" "Motivo: $1. La versión ${previous:0:12} está en marcha (web pública respondiendo: $web) en modo mantenimiento (solo lectura). Falta restaurar la copia $dump con la clave privada desde tu PC: $(restore_instructions)"
    exit 2
  fi
  log "La migración no cambió datos: no hace falta restaurar"
  if APP_IMAGE=$(image_tag "$previous") compose up -d app caddy >/dev/null && wait_healthy; then
    record "vuelta-atras $sha -> $previous (sin cambios en la base)"
    (( maint_ours )) && maintenance_off "vuelta atrás automática correcta"
    notify "Despliegue de $ref fallido; vuelta atrás correcta" "Motivo: $1. La web sigue con la versión ${previous:0:12}. No hizo falta restaurar datos."
    log "La web funciona con la versión anterior ${previous:0:12}"
    exit 1
  fi
  notify "FALLO grave: la versión anterior tampoco responde" "Tras fallar $ref, la versión ${previous:0:12} no pasa /api/health. El modo mantenimiento sigue activado."
  exit 2
}
trap 'rollback "error inesperado en la línea $LINENO"' ERR

# --- 3. Migración, arranque y comprobación ---------------------------------------------------------
log "Migrando con el usuario de migraciones"
if ! APP_IMAGE=$tag compose --profile migrate run --rm -T migrate > "$DEPLOY_STATE_DIR/last-migrate.log" 2>&1; then
  tail -n 15 "$DEPLOY_STATE_DIR/last-migrate.log" | sed 's/^/    /' >&2
  rollback "la migración falló"
fi
after=$(applied_migrations)
if [[ $after == "$before" ]]; then log "Sin migraciones nuevas"; else log "Migraciones aplicadas: $(comm -13 <(echo "$before") <(echo "$after") | tr '\n' ' ')"; fi
log "Arrancando $tag"
APP_IMAGE=$tag compose up -d app caddy >/dev/null || rollback "no arrancó"
wait_healthy || rollback "/api/health no responde \"ok\" en ${DEPLOY_HEALTH_TIMEOUT:-180} s"

# --- 4. Hecho --------------------------------------------------------------------------------------
trap - ERR
state_set previous "$previous"
state_set current "$sha"
record "desplegada $sha ($ref)"
(( maint_ours )) && maintenance_off "versión $ref en marcha y /api/health correcto"
prune_images "$sha" "$previous"
log "Desplegada $ref ($sha). Anterior: ${previous:-ninguna}"
