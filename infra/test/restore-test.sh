#!/usr/bin/env bash
# Prueba de restauración de extremo a extremo, con contenedores desechables:
#   1. PostgreSQL 17 de origen + migraciones de Payload (si hay node_modules) + datos sintéticos.
#   2. Copia con backup-postgres.sh (cifrada con una clave age efímera) y prueba de retención.
#   3. PostgreSQL 17 NUEVO y vacío; restore-postgres.sh --create.
#   4. Comparación del recuento exacto de filas por tabla (debe ser idéntico).
#   5. Comprobación de que la restauración se niega sobre una base con datos.
#   6. (Opcional) Almacenamiento: servidor S3 de pruebas (rclone serve s3), copia con
#      backup-storage.sh, restauración en un bucket vacío y comparación de objetos.
#   7. Restauración segura: sin .sha256 se niega salvo --allow-missing-checksum; suma de otro archivo,
#      enlaces simbólicos, tar con enlaces o "..": rechazados.
#   8. Copia FUERA DEL SERVIDOR: otro S3 de pruebas en una red de salida aislada, offsite-sync.sh,
#      borrado de las copias locales, fetch-offsite.sh y restauración desde el destino externo.
# PostgreSQL arranca con infra/postgres/initdb: migraciones como migrador; la restauración deja los
# objetos al migrador y la aplicación solo con permisos de datos.
#
# Uso: infra/test/restore-test.sh
# Variables: POSTGRES_IMAGE, RCLONE_IMAGE, RESTORE_TEST_PAYLOAD=auto|0|1,
#            RESTORE_TEST_STORAGE=auto|0|1, RESTORE_TEST_KEEP=1 (conserva infra/test/out).
#            RESTORE_TEST_APP_IMAGE: imagen local de la app para migrar en la red aislada.
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

PG_IMAGE=${POSTGRES_IMAGE:-postgres:17.6-alpine@sha256:ef257d85f76e48da1c64832459b59fcaba1a4dac97bf5d7450c77753542eee94}
export RCLONE_IMAGE=${RCLONE_IMAGE:-rclone/rclone:1.71.2@sha256:3103526c506266a9ecdf064efe99bf3677d92ef6407af124d8c56b4f49cbaa51}
id=$(openssl rand -hex 4)
net=p14rt-net-$id src=p14rt-src-$id dst=p14rt-dst-$id s3=p14rt-s3-$id
egress=p14rt-egress-$id off=p14rt-offsite-$id
export POSTGRES_MIGRATOR_USER=planta14_migrator POSTGRES_APP_USER=planta14_app
POSTGRES_MIGRATOR_PASSWORD=$(openssl rand -hex 16) POSTGRES_APP_PASSWORD=$(openssl rand -hex 16)
export POSTGRES_MIGRATOR_PASSWORD POSTGRES_APP_PASSWORD
out=$here/out/$id
mkdir -p "$out"
pw=$(openssl rand -hex 16)
failures=0

cleanup() {
  docker rm -f "$src" "$dst" "$s3" "$off" >/dev/null 2>&1 || true
  docker network rm "$net" "$egress" >/dev/null 2>&1 || true
  if [[ ${RESTORE_TEST_KEEP:-0} != 1 ]]; then rm -rf -- "$out"; fi
}
trap cleanup EXIT

check() { # check DESCRIPCIÓN CONDICIÓN...
  local desc=$1; shift
  if "$@"; then log "OK    $desc"; else log "FALLO $desc"; failures=$((failures + 1)); fi
}

start_pg() {
  docker run -d --name "$1" --network "$net" -p 127.0.0.1::5432 \
    -e POSTGRES_USER=planta14 -e POSTGRES_DB=planta14 -e POSTGRES_PASSWORD="$pw" \
    -e POSTGRES_MIGRATOR_USER -e POSTGRES_MIGRATOR_PASSWORD -e POSTGRES_APP_USER -e POSTGRES_APP_PASSWORD \
    -v "$infra/postgres:/planta14:ro" -v "$infra/postgres/initdb:/docker-entrypoint-initdb.d:ro" "$PG_IMAGE" >/dev/null
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
if [[ $payload == auto ]]; then
  if [[ -n ${RESTORE_TEST_APP_IMAGE:-} || -x $root/node_modules/.bin/payload ]]; then payload=1; else payload=0; fi
fi
if [[ $payload == 1 ]]; then
  log "Aplicando migraciones de Payload (cms/migrations) en la base de origen"
  if [[ -n ${RESTORE_TEST_APP_IMAGE:-} ]]; then
    payload_secret=$(openssl rand -hex 32)
    CMS_ENABLED=true NODE_ENV=development PAYLOAD_SECRET="$payload_secret" \
       DATABASE_URL="postgres://$POSTGRES_MIGRATOR_USER:$POSTGRES_MIGRATOR_PASSWORD@$src:5432/planta14" CMS_SERVER_URL=http://localhost:3000 \
       S3_BUCKET=restore-test S3_REGION=us-east-1 S3_ACCESS_KEY_ID=restore-test S3_SECRET_ACCESS_KEY=restore-test \
     docker run --rm --network "$net" -e CMS_ENABLED -e NODE_ENV -e PAYLOAD_SECRET -e DATABASE_URL \
       -e CMS_SERVER_URL -e S3_BUCKET -e S3_REGION -e S3_ACCESS_KEY_ID -e S3_SECRET_ACCESS_KEY \
       "$RESTORE_TEST_APP_IMAGE" npm run cms:migrate
  else
    port=$(docker port "$src" 5432/tcp | head -n1 | sed 's/.*://')
    (cd "$root" && env CMS_ENABLED=true NODE_ENV=development PAYLOAD_SECRET="$(openssl rand -hex 32)" \
     DATABASE_URL="postgres://$POSTGRES_MIGRATOR_USER:$POSTGRES_MIGRATOR_PASSWORD@127.0.0.1:$port/planta14" CMS_SERVER_URL=http://localhost:3000 \
     S3_BUCKET=restore-test S3_REGION=us-east-1 S3_ACCESS_KEY_ID=restore-test S3_SECRET_ACCESS_KEY=restore-test \
     ./node_modules/.bin/payload migrate) 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E 'Migrat|Done|ERROR' | sed 's/^/    /'
  fi
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
app_sql() { docker exec -e PGPASSWORD="$POSTGRES_APP_PASSWORD" "$1" psql -h 127.0.0.1 -U "$POSTGRES_APP_USER" -d "$2" -XAtq -v ON_ERROR_STOP=1 -c "$3" 2>&1; }
check "restaurada: tablas de public del usuario de migraciones" test "$(docker exec "$dst" psql -U planta14 -d planta14_restaurada -XAtc "SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tableowner <> '$POSTGRES_MIGRATOR_USER'")" = 0
check "restaurada: la app lee los datos" test "$(app_sql "$dst" planta14_restaurada 'SELECT count(*) FROM users')" = "$(grep '^public.users|' "$out/origen.txt" | cut -d'|' -f2)"
check "restaurada: la app no borra tablas" bash -c "$(declare -f app_sql); POSTGRES_APP_USER=$POSTGRES_APP_USER POSTGRES_APP_PASSWORD=$POSTGRES_APP_PASSWORD; app_sql $dst planta14_restaurada 'DROP TABLE users' | grep -q 'must be owner'"

log "== Restauración segura (sumas y rutas)"
mkdir -p "$out/neg"
cp "$dump" "$out/neg/"; nosum="$out/neg/$(basename "$dump")"
check "sin .sha256 se niega" bash -c "! PG_CONTAINER=$dst '$infra/restore/restore-postgres.sh' --create '$nosum' planta14_sin_suma 2>'$out/neg.log' && grep -q 'allow-missing-checksum' '$out/neg.log'"
check "sin .sha256 no crea la base" test "$(docker exec "$dst" psql -U planta14 -XAtc "SELECT count(*) FROM pg_database WHERE datname = 'planta14_sin_suma'")" = 0
check "sin .sha256 con --allow-missing-checksum restaura" bash -c "PG_CONTAINER=$dst '$infra/restore/restore-postgres.sh' --create --allow-missing-checksum '$nosum' planta14_sin_suma 2>/dev/null"
other=$(find "$BACKUP_DIR/postgres" -name '*.dump.age' -size 0 | head -n1)
(cd "$out/neg" && sha256sum "$(basename "$nosum")" | sed "s|  .*|  $(basename "$other")|" > "$(basename "$nosum").sha256")
check "suma que nombra otro archivo: se niega" bash -c "! PG_CONTAINER=$dst '$infra/restore/restore-postgres.sh' --create '$nosum' planta14_suma_ajena 2>/dev/null"
ln -s "$dump" "$out/neg/enlace.dump.age"; cp "$dump.sha256" "$out/neg/enlace.dump.age.sha256"
check "enlace simbólico como copia: se niega" bash -c "! PG_CONTAINER=$dst '$infra/restore/restore-postgres.sh' --create '$out/neg/enlace.dump.age' planta14_enlace 2>/dev/null"
# Archivos de almacenamiento maliciosos (sin cifrar, con suma correcta): deben rechazarse ANTES de extraer.
python3 - "$out/neg" <<'PY'
import io, sys, tarfile, hashlib
d = sys.argv[1]
def make(name, members):
    path = f"{d}/{name}"
    with tarfile.open(path, "w:gz") as t:
        for m, data in members:
            if data is not None:
                m.size = len(data); t.addfile(m, io.BytesIO(data))
            else:
                t.addfile(m)
    with open(path + ".sha256", "w") as f:
        f.write(hashlib.sha256(open(path, "rb").read()).hexdigest() + "  " + name + "\n")
def reg(n, data=b"x"):
    return tarfile.TarInfo(n), data
link = tarfile.TarInfo("objects/enlace"); link.type = tarfile.SYMTYPE; link.linkname = "/etc/passwd"
make("planta14-storage-x-20260101T000000Z.tar.gz", [reg("INFO"), reg("MANIFEST.sha256", b""), (link, None)])
make("planta14-storage-y-20260101T000000Z.tar.gz", [reg("INFO"), reg("MANIFEST.sha256", b""), reg("objects/../../fuera.txt")])
make("planta14-storage-z-20260101T000000Z.tar.gz", [reg("INFO"), reg("/tmp/absoluto.txt")])
PY
for bad in x y z; do
  check "tar con enlace, '..' o ruta absoluta ($bad): se niega" bash -c "! STORAGE_RCLONE=docker '$infra/restore/restore-storage.sh' '$out/neg/planta14-storage-$bad-20260101T000000Z.tar.gz' planta14-no-usado 2>'$out/neg-$bad.log' && grep -Eq 'enlaces|peligrosa|no permitida' '$out/neg-$bad.log'"
done
check "nada se ha escrito fuera del directorio temporal" test ! -e "$out/fuera.txt" -a ! -e /tmp/absoluto.txt

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
  chmod -R a+rwX "$out/s3data" "$out/seed"
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

  log "== Copia fuera del servidor (S3 de pruebas en una red de salida aislada)"
  docker network create "$egress" >/dev/null
  offkey=p14off$(openssl rand -hex 4) offsecret=$(openssl rand -hex 16)
  mkdir -p "$out/offsite-data/planta14-copias-externas"; chmod -R a+rwX "$out/offsite-data"
  docker run -d --name "$off" --network "$egress" -v "$out/offsite-data:/data" \
    "$RCLONE_IMAGE" serve s3 --addr :8080 --auth-key "$offkey,$offsecret" /data >/dev/null
  sleep 2
  export BACKUP_EGRESS_NETWORK=$egress PG_CONTAINER=$src OFFSITE_BUCKET=planta14-copias-externas OFFSITE_PREFIX=planta14/prueba
  export OFFSITE_ENDPOINT=http://$off:8080 OFFSITE_REGION=us-east-1 OFFSITE_FORCE_PATH_STYLE=true OFFSITE_ACCESS_KEY_ID=$offkey OFFSITE_SECRET_ACCESS_KEY=$offsecret
  src_ip=$(docker inspect -f "{{(index .NetworkSettings.Networks \"$net\").IPAddress}}" "$src")
  check "la red de salida no resuelve PostgreSQL" bash -c "! docker run --rm --network $egress --entrypoint pg_isready '$PG_IMAGE' -h $src -t 3 >/dev/null 2>&1"
  check "la red de salida no llega a PostgreSQL por IP" bash -c "! docker run --rm --network $egress --entrypoint pg_isready '$PG_IMAGE' -h $src_ip -t 3 >/dev/null 2>&1"
  touch "$BACKUP_DIR/postgres/planta14-postgres-planta14-20991231T000000Z.dump"
  "$infra/backup/offsite-sync.sh"
  remote_list() { rclone_setup_offsite; run_rclone_on "$egress" "$out" lsf -R --files-only "$(offsite_path)"; }
  unencrypted_not_uploaded() { ! remote_list | grep -q '20991231T000000Z\.dump$'; }
  remote_list | sed 's/^/    /'
  check "destino externo: copias cifradas de PostgreSQL y almacenamiento con sus sumas" test "$(remote_list | grep -Ec '^(postgres|storage)/planta14-.*\.age(\.sha256)?$')" -ge 4
  check "destino externo: no se suben copias sin cifrar" unencrypted_not_uploaded
  check "repetir la copia externa no falla ni duplica" "$infra/backup/offsite-sync.sh"
  cp "$dump" "$out/dump.orig"; printf 'x' >> "$dump"
  check "un archivo local alterado no sobrescribe el externo" bash -c "! '$infra/backup/offsite-sync.sh' 2>/dev/null"
  mv "$out/dump.orig" "$dump"
  log "Borrando TODAS las copias locales y recuperando desde el destino externo"
  rm -rf -- "$BACKUP_DIR"
  mkdir -p "$out/fetched"
  fetched_pg=$("$infra/restore/fetch-offsite.sh" postgres --latest "$out/fetched")
  fetched_st=$("$infra/restore/fetch-offsite.sh" storage --latest "$out/fetched")
  check "descargadas con su .sha256" test -f "$fetched_pg.sha256" -a -f "$fetched_st.sha256"
  PG_CONTAINER=$dst "$infra/restore/restore-postgres.sh" --create "$fetched_pg" planta14_desde_externo
  counts "$dst" planta14_desde_externo > "$out/externo.txt"
  check "desde el destino externo: mismo número de filas en todas las tablas" diff -u "$out/origen.txt" "$out/externo.txt"
  run_rclone "$out/seed" mkdir "p14:planta14-prueba-externo"
  "$infra/restore/restore-storage.sh" "$fetched_st" planta14-prueba-externo
  check "desde el destino externo: contenido idéntico del almacenamiento" run_rclone "$out/seed" check "p14:$S3_BUCKET" "p14:planta14-prueba-externo" --download
else
  log "AVISO: pruebas de almacenamiento y copia externa omitidas (sin imagen $RCLONE_IMAGE)"
fi

if (( failures == 0 )); then log "RESULTADO: prueba de restauración SUPERADA"; else log "RESULTADO: $failures comprobaciones FALLIDAS"; exit 1; fi
