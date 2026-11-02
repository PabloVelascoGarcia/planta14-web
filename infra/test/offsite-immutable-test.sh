#!/usr/bin/env bash
# La copia externa (infra/backup/offsite-sync.sh) NUNCA intenta borrar ni sobrescribir ni crear el bucket.
# Contra un S3 sustituto (rclone serve s3) se registran todas las peticiones HTTP de rclone (RCLONE_DUMP)
# (solo en este ensayo: muestra también la clave sintética) y se comprueba, sin depender de que el proveedor lo impida:
#   1. primera copia: solo PUT de objetos nuevos, ningún DELETE, ningún PUT del bucket;
#   2. repetición: ninguna escritura;
#   3. copia local borrada: no se borra fuera;
#   4. copia local cambiada con el mismo nombre: error, sin escribir, y el objeto remoto intacto;
#   5. con una sola clave (OFFSITE_* vacíos) usa la de la aplicación (S3_*).
# Uso: infra/test/offsite-immutable-test.sh   (Docker; sin red externa salvo la imagen de rclone)
set -Eeuo pipefail
SCRIPT_NAME=offsite-immutable-test
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
root=$(cd "$here/../.." && pwd)
# shellcheck source=SCRIPTDIR/../lib/common.sh
source "$root/infra/lib/common.sh"
require_cmd docker openssl
id=$(openssl rand -hex 4)
work=$(mktemp -d) net=p14oi-$id s3=p14oi-s3-$id
failures=0
check() { local desc=$1; shift; if "$@"; then log "OK    $desc"; else log "FALLO $desc"; failures=$((failures + 1)); fi; }
cleanup() { [[ ${OFFSITE_TEST_KEEP:-0} == 1 ]] && { log "Conservado: $work"; return; }; docker rm -f -v "$s3" >/dev/null 2>&1 || true; docker network rm "$net" >/dev/null 2>&1 || true; docker run --rm -v "$work:/w" alpine:3 true >/dev/null 2>&1 || true; rm -rf -- "$work" 2>/dev/null || true; }
trap cleanup EXIT
image=rclone/rclone:1.71.2@sha256:3103526c506266a9ecdf064efe99bf3677d92ef6407af124d8c56b4f49cbaa51
key=prueba$id secret=$(openssl rand -hex 16)
mkdir -p "$work/s3/planta14-copias" "$work/backups/postgres" "$work/backups/storage"
chmod -R a+rwX "$work"
docker network create "$net" >/dev/null
docker run -d --name "$s3" --network "$net" --network-alias s3 --user "$(id -u):$(id -g)" -v "$work/s3:/data" \
  "$image" serve s3 --addr :8080 --force-path-style=true --auth-key "$key,$secret" /data >/dev/null
for f in postgres/planta14-postgres-planta14-20261101T031500Z.dump.age storage/planta14-storage-20261101T033000Z.tar.gz.age; do
  head -c 2048 /dev/urandom > "$work/backups/$f"; (cd "$(dirname "$work/backups/$f")" && sha256sum "$(basename "$f")" > "$(basename "$f").sha256")
done
export BACKUP_DIR=$work/backups OFFSITE_BUCKET=planta14-copias OFFSITE_PREFIX=planta14/produccion OFFSITE_ENDPOINT=http://s3:8080
export OFFSITE_REGION=eu-central-4 OFFSITE_FORCE_PATH_STYLE=true S3_ACCESS_KEY_ID=$key S3_SECRET_ACCESS_KEY=$secret
export BACKUP_EGRESS_NETWORK=$net PG_CONTAINER=p14oi-sin-postgres PLANTA14_RCLONE_DUMP=headers LOCK_DIR=$work/locks
unset OFFSITE_ACCESS_KEY_ID OFFSITE_SECRET_ACCESS_KEY
for _ in $(seq 1 20); do docker logs "$s3" 2>&1 | grep -qi 'serving\|listening\|started' && break; sleep 0.5; done; sleep 1
remote=$work/s3/planta14-copias/planta14/produccion
run() { local code=0; bash "$root/infra/backup/offsite-sync.sh" > "$work/$1.log" 2>&1 || code=$?; echo "$code"; }
# Peticiones HTTP que escriben o borran (método al principio de la línea de petición volcada).
writes() { grep -oE 'DEBUG : (PUT|POST|DELETE) /[^ ]*' "$work/$1.log" | sed 's/^DEBUG : //' || true; }
deletes() { writes "$1" | grep -c '^DELETE' || true; }
object_puts() { writes "$1" | grep -E '^PUT /planta14-copias/.+' | grep -vc 'partNumber' || true; }
bucket_puts() { writes "$1" | grep -cE '^PUT /planta14-copias/?(\?|$)' || true; }

check "1. primera copia correcta" test "$(run primera)" = 0
check "1. se usó la clave de la aplicación (una sola clave)" grep -q 'Copia externa con la clave de la aplicación' "$work/primera.log"
check "1. se registran las peticiones HTTP (prueba válida)" grep -qE 'DEBUG : (GET|HEAD|PUT) /' "$work/primera.log"
check "1. solo PUT de los 4 objetos nuevos (2 copias + 2 .sha256)" test "$(object_puts primera)" = 4
check "1. ningún DELETE" test "$(deletes primera)" = 0
check "1. no intenta crear el bucket" test "$(bucket_puts primera)" = 0
check "1. copias en el destino" test -f "$remote/postgres/planta14-postgres-planta14-20261101T031500Z.dump.age"

check "2. repetición correcta" test "$(run repeticion)" = 0
check "2. repetición: ninguna escritura ni borrado" test -z "$(writes repeticion)"

rm "$work/backups/postgres/planta14-postgres-planta14-20261101T031500Z.dump.age"*
check "3. con una copia local borrada sigue correcta" test "$(run borrada)" = 0
check "3. ningún DELETE fuera" test "$(deletes borrada)" = 0
check "3. la copia sigue en el destino" test -f "$remote/postgres/planta14-postgres-planta14-20261101T031500Z.dump.age"

before=$(sha256sum < "$remote/storage/planta14-storage-20261101T033000Z.tar.gz.age")
head -c 2048 /dev/urandom > "$work/backups/storage/planta14-storage-20261101T033000Z.tar.gz.age"
check "4. copia local cambiada con el mismo nombre: error" bash -c "[[ \$(bash -c 'bash \"$root/infra/backup/offsite-sync.sh\" > \"$work/cambiada.log\" 2>&1; echo \$?') != 0 ]]"
check "4. el error dice que no coincide (immutable)" grep -qi 'immutable\|do not match\|not match' "$work/cambiada.log"
check "4. ninguna escritura ni borrado" test -z "$(writes cambiada)"
check "4. el objeto remoto queda intacto" test "$(sha256sum < "$remote/storage/planta14-storage-20261101T033000Z.tar.gz.age")" = "$before"
check "las órdenes de rclone nunca son sync, move ni delete" bash -c "! grep -nE 'run_rclone_on .* (sync|move|delete|deletefile|purge|rmdirs?) ' '$root/infra/backup/offsite-sync.sh'"

if (( failures == 0 )); then log "RESULTADO: copia externa sin borrados ni sobrescrituras SUPERADA"; else log "RESULTADO: $failures comprobaciones FALLIDAS"; exit 1; fi
