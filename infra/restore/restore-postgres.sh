#!/usr/bin/env bash
# Restaura un volcado de backup-postgres.sh sobre una base VACÍA.
# Se niega a continuar si la base de destino contiene tablas. Nunca restaura encima de datos.
#
# Uso: infra/restore/restore-postgres.sh [--env-file F] [--create] ARCHIVO BASE_DESTINO
#   ARCHIVO       .dump, .dump.age o .dump.gpg (se verifica su .sha256 si existe)
#   BASE_DESTINO  nombre de la base en el servidor de destino
#   --create      crea BASE_DESTINO si no existe
# Variables: POSTGRES_USER, PG_CONTAINER (o PGHOST/PGPORT/PGPASSWORD), BACKUP_AGE_IDENTITY (age).
set -Eeuo pipefail
SCRIPT_NAME=restore-postgres
# shellcheck source=SCRIPTDIR/../lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/../lib/common.sh"

create=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --env-file) load_env_file "${2:?Falta la ruta tras --env-file}"; shift 2 ;;
    --create) create=true; shift ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    --) shift; break ;;
    -*) die "Opción no reconocida: $1" ;;
    *) break ;;
  esac
done
[[ $# -eq 2 ]] || die "Uso: $0 [--env-file F] [--create] ARCHIVO BASE_DESTINO"
src=$1 target=$2
user=${POSTGRES_USER:-planta14}
[[ -f $src ]] || die "No existe: $src"
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

tables=$(psql_q "$target" "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind IN ('r','p','v','m','S') AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'")
[[ $tables == 0 ]] || die "La base $target no está vacía ($tables relaciones). No se restaura encima de datos."

log "Restaurando en $target"
pg_tool pg_restore -U "$user" -d "$target" --no-owner --no-privileges --exit-on-error --single-transaction < "$plain"
pg_tool psql -U "$user" -d "$target" -XAtq -c "ANALYZE" > /dev/null
log "Restauración completada en $target"
