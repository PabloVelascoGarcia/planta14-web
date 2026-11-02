#!/usr/bin/env bash
# Prueba de restauración de extremo a extremo, con contenedores desechables:
#   1. PostgreSQL 17 de origen + migraciones de Payload (si hay node_modules) + datos sintéticos.
#   2. Copia con backup-postgres.sh (cifrada con una clave age efímera) y prueba de retención.
#   3. PostgreSQL 17 NUEVO y vacío; restore-postgres.sh --create.
#   4. Comparación del recuento exacto de filas por tabla (debe ser idéntico).
#   5. Comprobación de que la restauración se niega sobre una base con datos.
#   6. (Opcional) Almacenamiento: servidor S3 de pruebas (rclone serve s3), copia con
#      backup-storage.sh, restauración en un bucket vacío y comparación de objetos.
#
# Uso: infra/test/restore-test.sh
# Variables: POSTGRES_IMAGE, RCLONE_IMAGE, RESTORE_TEST_PAYLOAD=auto|0|1,
#            RESTORE_TEST_STORAGE=auto|0|1, RESTORE_TEST_KEEP=1 (conserva infra/test/out).
# No usa ningún recurso real: todo se crea y se borra en esta máquina.
set -Eeuo pipefail
SCRIPT_NAME=restore-test
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
infra=$(cd "$here/.." && pwd)
root=$(cd "$infra/.." && pwd)
# shellcheck source=SCRIPTDIR/../lib/common.sh
source "$infra/lib/common.sh"
# shellcheck source=SCRIPTDIR/../lib/rclone.sh
source "$infra/lib/rclone.sh"
require_cmd docker openssl age age-keygen sha256sum diff

PG_IMAGE=${POSTGRES_IMAGE:-postgres:17.6-alpine}
export RCLONE_IMAGE=${RCLONE_IMAGE:-rclone/rclone:1.71.2}
id=$(openssl rand -hex 4)
net=p14rt-net-$id src=p14rt-src-$id dst=p14rt-dst-$id s3=p14rt-s3-$id
out=$here/out/$id
mkdir -p "$out"
pw=$(openssl rand -hex 16)
failures=0

cleanup() {
  docker rm -f "$src" "$dst" "$s3" >/dev/null 2>&1 || true
  docker network rm "$net" >/dev/null 2>&1 || true
  if [[ ${RESTORE_TEST_KEEP:-0} != 1 ]]; then rm -rf -- "$out"; fi
}
trap cleanup EXIT

check() { # check DESCRIPCIÓN CONDICIÓN...
  local desc=$1; shift
  if "$@"; then log "OK    $desc"; else log "FALLO $desc"; failures=$((failures + 1)); fi
}

start_pg() {
  docker run -d --name "$1" --network "$net" -p 127.0.0.1::5432 \
    -e POSTGRES_USER=planta14 -e POSTGRES_DB=planta14 -e POSTGRES_PASSWORD="$pw" "$PG_IMAGE" >/dev/null
  local i
  for i in $(seq 1 60); do
    docker exec "$1" pg_isready -h 127.0.0.1 -U planta14 -d planta14 >/dev/null 2>&1 && return 0
    sleep 1
  done
  die "PostgreSQL $1 no arrancó"
}

counts() { docker exec -i "$1" psql -U planta14 -d "$2" -XAtq -v ON_ERROR_STOP=1 < "$here/count-rows.sql"; }

docker network create "$net" >/dev/null
log "== PostgreSQL de origen ($PG_IMAGE)"
start_pg "$src"
docker exec "$src" postgres --version

payload=${RESTORE_TEST_PAYLOAD:-auto}
if [[ $payload == auto ]]; then [[ -x $root/node_modules/.bin/payload ]] && payload=1 || payload=0; fi
if [[ $payload == 1 ]]; then
  port=$(docker port "$src" 5432/tcp | head -n1 | sed 's/.*://')
  log "Aplicando migraciones de Payload (cms/migrations) en la base de origen"
  (cd "$root" && env CMS_ENABLED=true NODE_ENV=development PAYLOAD_SECRET="$(openssl rand -hex 32)" \
     DATABASE_URL="postgres://planta14:$pw@127.0.0.1:$port/planta14" CMS_SERVER_URL=http://localhost:3000 \
     S3_BUCKET=restore-test S3_REGION=us-east-1 S3_ACCESS_KEY_ID=restore-test S3_SECRET_ACCESS_KEY=restore-test \
     ./node_modules/.bin/payload migrate) 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E 'Migrat|Done|ERROR' | sed 's/^/    /'
else
  log "AVISO: sin migraciones de Payload (falta node_modules); solo datos sintéticos"
fi
log "Cargando datos sintéticos (infra/test/fixture.sql)"
docker exec -i "$src" psql -U planta14 -d planta14 -Xq -v ON_ERROR_STOP=1 < "$here/fixture.sql" >/dev/null
counts "$src" planta14 > "$out/origen.txt"
log "Tablas en origen: $(wc -l < "$out/origen.txt"); filas: $(awk -F'|' '{s+=$2} END {print s}' "$out/origen.txt")"

log "== Copia de seguridad (cifrada con clave age efímera)"
age-keygen -o "$out/age-key.txt" 2>/dev/null
export BACKUP_DIR=$out/backups BACKUP_ENCRYPTION=age BACKUP_AGE_IDENTITY=$out/age-key.txt
BACKUP_AGE_RECIPIENT=$(age-keygen -y "$out/age-key.txt"); export BACKUP_AGE_RECIPIENT
export POSTGRES_DB=planta14 POSTGRES_USER=planta14 BACKUP_RETENTION_DAYS=14 BACKUP_KEEP_MIN=2
# Copias ficticias antiguas para probar la retención: 3 y 5 días (se conservan), 20/30/40 días (se borran).
mkdir -p "$BACKUP_DIR/postgres"
for d in 3 5 20 30 40; do
  touch "$BACKUP_DIR/postgres/planta14-postgres-planta14-$(date -u -d "-$d days" +%Y%m%dT%H%M%SZ).dump.age"
done
dump=$(PG_CONTAINER=$src "$infra/backup/backup-postgres.sh")
find "$BACKUP_DIR/postgres" -maxdepth 1 -type f -printf '    %f (%s bytes)\n' | sort
check "nombre con fecha y cifrado" grep -Eq 'planta14-postgres-planta14-[0-9]{8}T[0-9]{6}Z\.dump\.age$' <<< "$dump"
check "el volcado cifrado no es legible sin la clave" bash -c "! docker exec -i $src pg_restore --list < '$dump' >/dev/null 2>&1"
check "retención: quedan 3 copias (nueva + 3 y 5 días)" test "$(find "$BACKUP_DIR/postgres" -name '*.dump.age' | wc -l)" -eq 3

log "== PostgreSQL NUEVO y vacío; restauración"
start_pg "$dst"
PG_CONTAINER=$dst "$infra/restore/restore-postgres.sh" --create "$dump" planta14_restaurada
counts "$dst" planta14_restaurada > "$out/restaurada.txt"
log "Comparación de filas por tabla (origen | restaurada):"
join -t'|' -a1 -a2 -e FALTA -o 0,1.2,2.2 "$out/origen.txt" "$out/restaurada.txt" | awk -F'|' '{printf "    %-48s %8s | %8s\n", $1, $2, $3}'
check "mismo número de filas en todas las tablas" diff -u "$out/origen.txt" "$out/restaurada.txt"
check "hay tablas y filas que comparar" test "$(awk -F'|' '$2 > 0' "$out/origen.txt" | wc -l)" -ge 3
check "se niega a restaurar sobre una base con datos" \
  bash -c "! PG_CONTAINER=$dst '$infra/restore/restore-postgres.sh' '$dump' planta14_restaurada 2>'$out/rechazo.log'"
sed 's/^/    /' "$out/rechazo.log" | tail -n 1

storage=${RESTORE_TEST_STORAGE:-auto}
if [[ $storage == auto ]]; then
  if docker image inspect "$RCLONE_IMAGE" >/dev/null 2>&1 || docker pull -q "$RCLONE_IMAGE" >/dev/null 2>&1; then storage=1; else storage=0; fi
fi
if [[ $storage == 1 ]]; then
  log "== Almacenamiento: servidor S3 de pruebas (rclone serve s3, $RCLONE_IMAGE)"
  key=p14test$(openssl rand -hex 4) secret=$(openssl rand -hex 16)
  mkdir -p "$out/s3data" "$out/seed/media/2026/11"
  docker run -d --name "$s3" --network "$net" -v "$out/s3data:/data" \
    "$RCLONE_IMAGE" serve s3 --addr :8080 --auth-key "$key,$secret" /data >/dev/null
  sleep 2
  export S3_ENDPOINT=http://$s3:8080 S3_REGION=us-east-1 S3_FORCE_PATH_STYLE=true
  export S3_ACCESS_KEY_ID=$key S3_SECRET_ACCESS_KEY=$secret BACKUP_DOCKER_NETWORK=$net STORAGE_RCLONE=docker
  export S3_BUCKET=planta14-prueba
  for n in $(seq 1 40); do head -c $((1000 + n * 137)) /dev/urandom > "$out/seed/media/2026/11/imagen-$n.webp"; done
  for n in $(seq 1 5); do head -c 4096 /dev/urandom > "$out/seed/media/original-$n.jpg"; done
  chmod -R a+rwX "$out"
  rclone_setup "$key" "$secret"
  run_rclone "$out/seed" mkdir "p14:$S3_BUCKET"
  run_rclone "$out/seed" copy /work "p14:$S3_BUCKET"
  src_objs=$(run_rclone "$out/seed" lsf -R --files-only "p14:$S3_BUCKET" | wc -l)
  log "Objetos en el bucket de origen: $src_objs"
  archive=$("$infra/backup/backup-storage.sh")
  check "copia de almacenamiento con fecha y cifrada" grep -Eq 'planta14-storage-planta14-prueba-[0-9]{8}T[0-9]{6}Z\.tar\.gz\.age$' <<< "$archive"
  run_rclone "$out/seed" mkdir "p14:planta14-prueba-restaurado"
  "$infra/restore/restore-storage.sh" "$archive" planta14-prueba-restaurado
  dst_objs=$(run_rclone "$out/seed" lsf -R --files-only "p14:planta14-prueba-restaurado" | wc -l)
  log "Objetos: origen $src_objs | restaurado $dst_objs"
  check "mismo número de objetos" test "$src_objs" -eq "$dst_objs"
  check "contenido idéntico (rclone check origen/restaurado)" run_rclone "$out/seed" check "p14:$S3_BUCKET" "p14:planta14-prueba-restaurado" --download
  check "se niega a restaurar sobre un bucket con objetos" \
    bash -c "! '$infra/restore/restore-storage.sh' '$archive' planta14-prueba-restaurado 2>/dev/null"
else
  log "AVISO: prueba de almacenamiento omitida (sin imagen $RCLONE_IMAGE)"
fi

if (( failures == 0 )); then log "RESULTADO: prueba de restauración SUPERADA"; else log "RESULTADO: $failures comprobaciones FALLIDAS"; exit 1; fi
