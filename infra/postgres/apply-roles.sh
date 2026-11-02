#!/usr/bin/env bash
# Aplica la separación de usuarios a una base EXISTENTE (o la reaplica; es idempotente):
# crea/actualiza los usuarios de migraciones y de aplicación, pasa la propiedad de los objetos de
# public al migrador y deja a la aplicación solo con permisos de datos.
#
# Uso: infra/postgres/apply-roles.sh [--env-file infra/.env.staging] [BASE ...]
# Variables: POSTGRES_USER (superusuario), POSTGRES_DB, PG_CONTAINER, POSTGRES_MIGRATOR_USER,
#            POSTGRES_MIGRATOR_PASSWORD, POSTGRES_APP_USER, POSTGRES_APP_PASSWORD.
# Procedimiento completo en docs/INFRA-STAGING.md (copia previa, parada de la app, comprobación).
set -Eeuo pipefail
SCRIPT_NAME=apply-roles
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=SCRIPTDIR/../lib/common.sh
source "$here/../lib/common.sh"
if [[ ${1:-} == --env-file ]]; then load_env_file "${2:?Falta la ruta tras --env-file}"; shift 2; fi
: "${POSTGRES_MIGRATOR_USER:?}" "${POSTGRES_MIGRATOR_PASSWORD:?}" "${POSTGRES_APP_USER:?}" "${POSTGRES_APP_PASSWORD:?}"
export POSTGRES_MIGRATOR_USER POSTGRES_MIGRATOR_PASSWORD POSTGRES_APP_USER POSTGRES_APP_PASSWORD
user=${POSTGRES_USER:-planta14}
PG_CONTAINER=${PG_CONTAINER:-$(default_pg_container)}
require_cmd docker
declare -a databases=("$@")
(( ${#databases[@]} )) || databases=("${POSTGRES_DB:-planta14}")
run_sql() { # BASE ARCHIVO
  docker exec -i -e POSTGRES_MIGRATOR_USER -e POSTGRES_MIGRATOR_PASSWORD -e POSTGRES_APP_USER -e POSTGRES_APP_PASSWORD \
    "$PG_CONTAINER" psql -v ON_ERROR_STOP=1 -X -q -U "$user" -d "$1" < "$2" > /dev/null
}
log "Usuarios $POSTGRES_MIGRATOR_USER (migraciones) y $POSTGRES_APP_USER (aplicación)"
run_sql "${databases[0]}" "$here/roles.sql"
for db in "${databases[@]}"; do
  [[ $db =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || die "Nombre de base no válido: $db"
  log "Propiedad y permisos en $db"
  run_sql "$db" "$here/grants.sql"
done
log "Hecho. Comprueba con: docker exec $PG_CONTAINER psql -U $user -d ${databases[0]} -c '\\dt'"
