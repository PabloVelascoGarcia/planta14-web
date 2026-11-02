#!/usr/bin/env bash
# Funciones del despliegue de producción. Se carga con "source" desde deploy.sh y status.sh.
# shellcheck shell=bash
# Requiere: infra/lib/common.sh cargado antes; variables $infra y $repo.

DEPLOY_COMPOSE_FILE=${DEPLOY_COMPOSE_FILE:-$infra/compose.production.yaml}
# DEPLOY_COMPOSE_EXTRA: archivo Compose adicional (solo para ensayos, p. ej. un S3 sustituto).

deploy_init() { # ARCHIVO_ENV
  local env_file=$1
  [[ -f $env_file ]] || die "No existe $env_file (créalo con infra/deploy/generate-production-env.sh)"
  [[ $(stat -c %a "$env_file") =~ ^[67]00$ ]] || die "$env_file debe tener permisos 600 (contiene secretos)"
  load_env_file "$env_file"
  DEPLOY_ENV_FILE=$env_file
  export DEPLOY_ENV_FILE
  case ${SITE_INDEXABLE:-} in
    true|false) ;;
    *) die "SITE_INDEXABLE debe ser \"true\" o \"false\": es una decisión explícita (ver docs/PUESTA-EN-MARCHA-IONOS.md)" ;;
  esac
  if [[ ${BACKUP_ENCRYPTION:-none} == none && ${DEPLOY_ALLOW_UNENCRYPTED_BACKUP:-0} != 1 ]]; then
    die "En producción las copias van cifradas: define BACKUP_ENCRYPTION=age y BACKUP_AGE_RECIPIENT"
  fi
  : "${SITE_DOMAIN:?}" "${BACKUP_DIR:?Define BACKUP_DIR}"
  DEPLOY_STATE_DIR=${DEPLOY_STATE_DIR:-/srv/planta14/state}
  mkdir -p "$DEPLOY_STATE_DIR" "$BACKUP_DIR"
  export COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-planta14}
  resolve_pg_container
}

image_tag() { printf 'planta14-app:%s' "${1:0:12}"; }
state_get() { cat "$DEPLOY_STATE_DIR/$1" 2>/dev/null || true; }
state_set() { if [[ -n $2 ]]; then printf '%s\n' "$2" > "$DEPLOY_STATE_DIR/$1"; else rm -f "$DEPLOY_STATE_DIR/$1"; fi; }
record() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S %Z')" "$*" >> "$DEPLOY_STATE_DIR/historial.log"; }

# docker compose de producción. APP_IMAGE: la indicada, o la de la versión actual (o un marcador si no hay).
compose() {
  local current; current=$(state_get current)
  APP_IMAGE=${APP_IMAGE:-$(if [[ -n $current ]]; then image_tag "$current"; else echo planta14-app:sin-version; fi)} \
    docker compose -f "$DEPLOY_COMPOSE_FILE" ${DEPLOY_COMPOSE_EXTRA:+-f "$DEPLOY_COMPOSE_EXTRA"} --env-file "$DEPLOY_ENV_FILE" "$@"
}

sql_super() { # SQL [BASE]
  docker exec -i "$PG_CONTAINER" psql -U "${POSTGRES_USER:-planta14}" -d "${2:-${POSTGRES_DB:-planta14}}" -XAtq -v ON_ERROR_STOP=1 -c "$1"
}

wait_postgres() {
  local _
  for _ in $(seq 1 60); do
    docker exec "$PG_CONTAINER" pg_isready -U "${POSTGRES_USER:-planta14}" -d "${POSTGRES_DB:-planta14}" >/dev/null 2>&1 && return 0
    sleep 2
  done
  return 1
}

# Migraciones registradas por Payload (vacío si la tabla aún no existe).
applied_migrations() {
  if [[ -n $(sql_super "SELECT to_regclass('public.payload_migrations')") ]]; then
    sql_super "SELECT name FROM payload_migrations ORDER BY name"
  fi
}

# /api/health a través de Caddy (HTTPS real del dominio, resuelto al propio servidor).
health_once() {
  local -a args=(--silent --show-error --max-time 10 --noproxy '*' --resolve "$SITE_DOMAIN:443:127.0.0.1")
  [[ ${CADDY_TLS_MODE:-acme} == internal || ${DEPLOY_HEALTH_INSECURE:-0} == 1 ]] && args+=(--insecure)
  local body; body=$(curl "${args[@]}" -w '\n%{http_code}' "https://$SITE_DOMAIN/api/health" 2>/dev/null) || return 1
  [[ ${body##*$'\n'} == 200 && $body == *'"status":"ok"'* ]]
}
wait_healthy() {
  local deadline=$((SECONDS + ${DEPLOY_HEALTH_TIMEOUT:-180}))
  while (( SECONDS < deadline )); do health_once && { log "/api/health: ok"; return 0; }; sleep 3; done
  return 1
}

# Restaura la copia en una base nueva y la pone en servicio; la base actual se conserva con otro nombre.
restore_dump() { # COPIA
  local stamp db newdb failed
  stamp=$(date +%Y%m%d%H%M%S); db=${POSTGRES_DB:-planta14}; newdb=${db}_vuelta_$stamp; failed=${db}_fallida_$stamp
  "$infra/restore/restore-postgres.sh" --env-file "$DEPLOY_ENV_FILE" --create "$1" "$newdb" || return 1
  sql_super "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$db' AND pid <> pg_backend_pid()" postgres >/dev/null
  sql_super "ALTER DATABASE \"$db\" RENAME TO \"$failed\"" postgres || return 1
  sql_super "ALTER DATABASE \"$newdb\" RENAME TO \"$db\"" postgres || { sql_super "ALTER DATABASE \"$failed\" RENAME TO \"$db\"" postgres; return 1; }
  log "Base restaurada desde $(basename "$1"); la base con los cambios queda como $failed (bórrala cuando ya no haga falta)"
}

# Conserva las imágenes de la versión actual, la anterior y las DEPLOY_KEEP_IMAGES más recientes.
prune_images() { # ACTUAL ANTERIOR
  local keep=${DEPLOY_KEEP_IMAGES:-3} tag
  local -a protect=("$(image_tag "$1")")
  [[ -n ${2:-} ]] && protect+=("$(image_tag "$2")")
  while IFS= read -r tag; do
    [[ " ${protect[*]} " == *" $tag "* ]] && continue
    docker image rm "$tag" >/dev/null 2>&1 && log "Imagen antigua eliminada: $tag"
  done < <(docker image ls planta14-app --format '{{.Repository}}:{{.Tag}}' | grep -v ':sin-version$' | tail -n +"$((keep + 1))")
}

# Alerta por correo si existe infra/lib/alert.sh (preparada en la rama de lanzamiento); si no, solo registro.
notify() { # ASUNTO CUERPO
  log "AVISO: $1. $2"
  if [[ -f $infra/lib/alert.sh ]]; then
    # shellcheck source=/dev/null
    source "$infra/lib/alert.sh"
    send_alert "$1" "$2" || true
  fi
}
