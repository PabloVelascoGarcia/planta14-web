#!/usr/bin/env bash
# Restaura un volcado de backup-postgres.sh sobre una base VACÍA.
# Se niega a continuar si la base de destino contiene tablas. Nunca restaura encima de datos.
#
# Uso: infra/restore/restore-postgres.sh [--env-file F] [--create] [--allow-missing-checksum] ARCHIVO BASE_DESTINO
#   ARCHIVO       .dump, .dump.age o .dump.gpg; su ARCHIVO.sha256 es obligatorio
#   BASE_DESTINO  nombre de la base en el servidor de destino
#   --create      crea BASE_DESTINO si no existe
#   --allow-missing-checksum  restaura sin .sha256 (solo copias propias de origen conocido)
# Variables: POSTGRES_USER (superusuario), PG_CONTAINER (o PGHOST/PGPORT/PGPASSWORD), BACKUP_AGE_IDENTITY (age).
# Con POSTGRES_MIGRATOR_USER y POSTGRES_APP_USER, los objetos restaurados pertenecen al usuario de
# migraciones y el de aplicación recibe solo permisos de datos (infra/postgres/grants.sql).
set -Eeuo pipefail
SCRIPT_NAME=restore-postgres
# shellcheck source=SCRIPTDIR/../lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/../lib/common.sh"

create=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --env-file) load_env_file "${2:?Falta la ruta tras --env-file}"; shift 2 ;;
    --create) create=true; shift ;;
    --allow-missing-checksum) export ALLOW_MISSING_CHECKSUM=true; shift ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    --) shift; break ;;
    -*) die "Opción no reconocida: $1" ;;
    *) break ;;
  esac
done
[[ $# -eq 2 ]] || die "Uso: $0 [--env-file F] [--create] [--allow-missing-checksum] ARCHIVO BASE_DESTINO"
src=$1 target=$2
user=${POSTGRES_USER:-planta14}
safe_input_file "$src"
[[ $src == *.dump || $src == *.dump.age || $src == *.dump.gpg ]] || die "Extensión no válida (se espera .dump, .dump.age o .dump.gpg): $src"
owner=${POSTGRES_MIGRATOR_USER:-}
if [[ -n $owner ]]; then
  [[ $owner =~ ^[a-z_][a-z0-9_]{0,62}$ && ${POSTGRES_APP_USER:-} =~ ^[a-z_][a-z0-9_]{0,62}$ ]] || die "POSTGRES_MIGRATOR_USER y POSTGRES_APP_USER deben ser identificadores simples"
fi
[[ $target =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || die "Nombre de base no válido: $target"
if [[ -n ${PG_CONTAINER:-} ]]; then require_cmd docker; else require_cmd psql pg_restore; fi

verify_checksum "$src"
work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT
plain="$work/restore.dump"
decrypt_file "$src" "$plain"
pg_tool pg_restore --list < "$plain" > /dev/null || die "El archivo no es un volcado válido de pg_restore"

psql_q() { pg_tool psql -U "$user" -d "$1" -v ON_ERROR_STOP=1 -XAtq -c "$2"; }

exists=$(psql_q postgres "SELECT 1 FROM pg_database WHERE datname = '$target'")
if [[ $exists != 1 ]]; then
  $create || die "La base $target no existe (usa --create)"
  log "Creando la base $target"
  psql_q postgres "CREATE DATABASE \"$target\" OWNER \"$user\"" > /dev/null
fi

grants() {
  [[ -n $owner ]] || return 0
  if [[ -n ${PG_CONTAINER:-} ]]; then
    docker exec -i -e POSTGRES_MIGRATOR_USER -e POSTGRES_APP_USER "$PG_CONTAINER" psql -U "$user" -d "$target" -XAtq < "$(dirname "${BASH_SOURCE[0]}")/../postgres/grants.sql" > /dev/null
  else
    psql -U "$user" -d "$target" -XAtq -f "$(dirname "${BASH_SOURCE[0]}")/../postgres/grants.sql" > /dev/null
  fi
}

tables=$(psql_q "$target" "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind IN ('r','p','v','m','S') AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'")
[[ $tables == 0 ]] || die "La base $target no está vacía ($tables relaciones). No se restaura encima de datos."

grants
log "Restaurando en $target${owner:+ (propietario $owner)}"
pg_tool pg_restore -U "$user" -d "$target" --no-owner --no-privileges ${owner:+--role="$owner"} --exit-on-error --single-transaction < "$plain"
grants
pg_tool psql -U "$user" -d "$target" -XAtq -c "ANALYZE" > /dev/null
log "Restauración completada en $target"
