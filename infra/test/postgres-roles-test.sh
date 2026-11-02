#!/usr/bin/env bash
# Prueba de usuarios PostgreSQL separados, con contenedores desechables:
#   A. Base NUEVA con infra/postgres/initdb: migraciones como migrador, Payload como aplicación.
#   B. Base EXISTENTE (todo del superusuario): procedimiento infra/postgres/apply-roles.sh.
# En ambos casos: la aplicación funciona (altas, sesiones, cambios, bajas) y NO puede crear,
# borrar, vaciar ni alterar tablas; el migrador sí, y lo nuevo que cree es usable por la aplicación.
# Requiere Docker y node_modules (npm ci) en la raíz para ejecutar Payload.
set -Eeuo pipefail
SCRIPT_NAME=postgres-roles-test
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
infra=$(cd "$here/.." && pwd)
root=$(cd "$infra/.." && pwd)
# shellcheck source=SCRIPTDIR/../lib/common.sh
source "$infra/lib/common.sh"
require_cmd docker openssl
[[ -x $root/node_modules/.bin/payload ]] || die "Falta node_modules (npm ci) para ejecutar Payload"
PG_IMAGE=${POSTGRES_IMAGE:-postgres:17.6-alpine@sha256:ef257d85f76e48da1c64832459b59fcaba1a4dac97bf5d7450c77753542eee94}
id=$(openssl rand -hex 4)
new=p14roles-new-$id old=p14roles-old-$id
export POSTGRES_MIGRATOR_USER=planta14_migrator POSTGRES_APP_USER=planta14_app
POSTGRES_MIGRATOR_PASSWORD=$(openssl rand -hex 16) POSTGRES_APP_PASSWORD=$(openssl rand -hex 16) superpw=$(openssl rand -hex 16)
export POSTGRES_MIGRATOR_PASSWORD POSTGRES_APP_PASSWORD
failures=0
cleanup() { docker rm -f "$new" "$old" >/dev/null 2>&1 || true; }
trap cleanup EXIT
check() { local desc=$1; shift; if "$@"; then log "OK    $desc"; else log "FALLO $desc"; failures=$((failures + 1)); fi; }

start_pg() { # NOMBRE [init]
  local -a extra=()
  if [[ ${2:-} == init ]]; then
    extra=(-e POSTGRES_MIGRATOR_USER -e POSTGRES_MIGRATOR_PASSWORD -e POSTGRES_APP_USER -e POSTGRES_APP_PASSWORD
      -v "$infra/postgres:/planta14:ro" -v "$infra/postgres/initdb:/docker-entrypoint-initdb.d:ro")
  fi
  docker run -d --name "$1" -p 127.0.0.1::5432 -e POSTGRES_USER=planta14 -e POSTGRES_DB=planta14 -e POSTGRES_PASSWORD="$superpw" "${extra[@]}" "$PG_IMAGE" >/dev/null
  for _ in $(seq 1 90); do docker exec "$1" pg_isready -h 127.0.0.1 -U planta14 -d planta14 >/dev/null 2>&1 && return 0; sleep 1; done
  docker logs "$1" | tail -20; die "PostgreSQL $1 no arrancó"
}
port() { docker port "$1" 5432/tcp | head -n1 | sed 's/.*://'; }
payload_env() { # CONTENEDOR USUARIO CONTRASEÑA
  printf '%s\n' CMS_ENABLED=true NODE_ENV=development PLANTA14_ROLE_CHECK=true "PAYLOAD_SECRET=$(openssl rand -hex 32)" \
    "DATABASE_URL=postgres://$2:$3@127.0.0.1:$(port "$1")/planta14" CMS_SERVER_URL=http://localhost:3000 \
    S3_BUCKET=roles-test S3_REGION=us-east-1 S3_ACCESS_KEY_ID=roles-test S3_SECRET_ACCESS_KEY=roles-test
}
payload_as() { # CONTENEDOR USUARIO CONTRASEÑA args...
  local -a vars
  mapfile -t vars < <(payload_env "$1" "$2" "$3"); shift 3
  (cd "$root" && env "${vars[@]}" ./node_modules/.bin/payload "$@") 2>&1 | sed 's/\x1b\[[0-9;]*m//g'
}
sql_as() { # CONTENEDOR USUARIO CONTRASEÑA SQL
  docker exec -e PGPASSWORD="$3" "$1" psql -h 127.0.0.1 -U "$2" -d planta14 -XAtq -v ON_ERROR_STOP=1 -c "$4" 2>&1
}
denied() { local out; out=$(sql_as "$@") && return 1; grep -Eq 'permission denied|must be owner' <<< "$out"; }
app_works() { local out; out=$(payload_as "$1" "$POSTGRES_APP_USER" "$POSTGRES_APP_PASSWORD" run infra/test/payload-app-check.mjs); grep -E '^PASS|Error' <<< "$out" | sed 's/^/    /' >&2; grep -q '^PASS' <<< "$out"; }
app_cannot_migrate() {
  local before; before=$(sql_as "$1" planta14 "$superpw" 'SELECT count(*) FROM payload_migrations')
  payload_as "$1" "$POSTGRES_APP_USER" "$POSTGRES_APP_PASSWORD" migrate:fresh --force-accept-warning >/dev/null || true
  [[ $(sql_as "$1" planta14 "$superpw" 'SELECT count(*) FROM payload_migrations') == "$before" && $before -ge 1 ]] && sql_as "$1" planta14 "$superpw" 'SELECT 1 FROM users LIMIT 1' >/dev/null
}
new_table_usable() {
  local c=$1
  sql_as "$c" "$POSTGRES_MIGRATOR_USER" "$POSTGRES_MIGRATOR_PASSWORD" 'CREATE TABLE nueva (id serial primary key, v text)' >/dev/null &&
  [[ $(sql_as "$c" "$POSTGRES_APP_USER" "$POSTGRES_APP_PASSWORD" "INSERT INTO nueva (v) VALUES ('x'); SELECT count(*) FROM nueva") == 1 ]] &&
  sql_as "$c" "$POSTGRES_MIGRATOR_USER" "$POSTGRES_MIGRATOR_PASSWORD" 'DROP TABLE nueva' >/dev/null
}
others_cannot_connect() {
  sql_as "$1" planta14 "$superpw" "DROP ROLE IF EXISTS intruso; CREATE ROLE intruso LOGIN PASSWORD 'intruso-1234567890'" >/dev/null
  ! sql_as "$1" intruso intruso-1234567890 'SELECT 1' >/dev/null
}
migrate() { payload_as "$@" migrate | grep -E 'Migrated|Done|ERROR|rror' | sed 's/^/    /' >&2; }
verify() { # CONTENEDOR ETIQUETA
  local c=$1 tag=$2 app=$POSTGRES_APP_USER apppw=$POSTGRES_APP_PASSWORD
  check "$tag: Payload funciona con el usuario de aplicación" app_works "$c"
  check "$tag: la app no crea tablas" denied "$c" "$app" "$apppw" 'CREATE TABLE intrusa (id int)'
  check "$tag: la app no borra tablas" denied "$c" "$app" "$apppw" 'DROP TABLE users'
  check "$tag: la app no vacía tablas" denied "$c" "$app" "$apppw" 'TRUNCATE users'
  check "$tag: la app no altera tablas" denied "$c" "$app" "$apppw" 'ALTER TABLE users ADD COLUMN x int'
  check "$tag: la app no crea esquemas" denied "$c" "$app" "$apppw" 'CREATE SCHEMA intruso'
  check "$tag: la app no crea tablas temporales" denied "$c" "$app" "$apppw" 'CREATE TEMP TABLE t (id int)'
  check "$tag: la app no puede reiniciar ni migrar la base" app_cannot_migrate "$c"
  check "$tag: todas las tablas de public son del migrador" test "$(sql_as "$c" planta14 "$superpw" "SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tableowner <> '$POSTGRES_MIGRATOR_USER'")" = 0
  check "$tag: el migrador crea y borra tablas" sql_as "$c" "$POSTGRES_MIGRATOR_USER" "$POSTGRES_MIGRATOR_PASSWORD" 'CREATE TABLE prueba_migrador (id serial primary key, v text); DROP TABLE prueba_migrador'
  check "$tag: lo que cree el migrador después es usable por la app" new_table_usable "$c"
  check "$tag: otros usuarios no pueden conectarse a la base" others_cannot_connect "$c"
}

log "== A. Base nueva con inicialización de usuarios"
start_pg "$new" init
check "A: roles creados sin superusuario" test "$(sql_as "$new" planta14 "$superpw" "SELECT string_agg(rolname || ':' || rolsuper || rolcreatedb || rolcreaterole, ',' ORDER BY rolname) FROM pg_roles WHERE rolname LIKE 'planta14\_%'")" = 'planta14_app:falsefalsefalse,planta14_migrator:falsefalsefalse'
log "Migraciones como $POSTGRES_MIGRATOR_USER"
migrate "$new" "$POSTGRES_MIGRATOR_USER" "$POSTGRES_MIGRATOR_PASSWORD"
verify "$new" A

log "== B. Base existente: todo del superusuario, luego apply-roles.sh"
start_pg "$old"
migrate "$old" planta14 "$superpw"
sql_as "$old" planta14 "$superpw" "INSERT INTO users (name, email, role) VALUES ('Existente', 'existente@example.test', 'admin')" >/dev/null
check "B: antes, las tablas son del superusuario" test "$(sql_as "$old" planta14 "$superpw" "SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tableowner = 'planta14'")" -gt 0
POSTGRES_USER=planta14 POSTGRES_DB=planta14 PG_CONTAINER=$old "$infra/postgres/apply-roles.sh"
POSTGRES_USER=planta14 POSTGRES_DB=planta14 PG_CONTAINER=$old "$infra/postgres/apply-roles.sh" >/dev/null 2>&1
check "B: apply-roles es idempotente y conserva los datos" test "$(sql_as "$old" "$POSTGRES_APP_USER" "$POSTGRES_APP_PASSWORD" "SELECT count(*) FROM users WHERE email = 'existente@example.test'")" = 1
verify "$old" B
log "Migraciones posteriores como migrador sobre la base convertida"
check "B: el migrador puede ejecutar migraciones" migrate "$old" "$POSTGRES_MIGRATOR_USER" "$POSTGRES_MIGRATOR_PASSWORD"

if (( failures == 0 )); then log "RESULTADO: usuarios PostgreSQL separados SUPERADA"; else log "RESULTADO: $failures comprobaciones FALLIDAS"; exit 1; fi
