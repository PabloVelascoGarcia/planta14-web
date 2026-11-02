#!/usr/bin/env bash
# Prueba de extremo a extremo del staging en Docker con el código integrado:
#   1. Stack de infra/compose.staging.yaml (+ override de prueba con rclone en lugar de MinIO), con la
#      imagen de la app ya construida (APP_IMAGE, por defecto planta14-app:staging).
#   2. Migraciones (usuario migrador), bootstrap del administrador, importación municipal y sync-public.
#   3. Navegador real (staging-browser.mjs) detrás de Caddy: contraseña, web, editor, panel de Lena,
#      aviso con imagen y declaración, retirada, imagen 404 y rechazo del panel de Mieres.
#   4. Copia (PostgreSQL + almacenamiento, cifradas con age), BORRADO del entorno (down -v y datos S3),
#      restauración y comprobación de que la web y los datos vuelven iguales.
# Todo es sintético y local. Usa los puertos 80/443 de 127.0.0.1 y el proyecto Compose planta14-staging.
set -Eeuo pipefail
SCRIPT_NAME=staging-e2e
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
infra=$(cd "$here/.." && pwd)
root=$(cd "$infra/.." && pwd)
# shellcheck source=SCRIPTDIR/../lib/common.sh
source "$infra/lib/common.sh"
require_cmd docker openssl age age-keygen curl node diff
cd "$root"

domain=localhost
id=$(openssl rand -hex 4)
out=$here/out/e2e-$id
mkdir -p "$out/s3" "$out/backups" "$out/pages-before" "$out/pages-after"
envf=$out/staging.env
export E2E_S3_DIR=$out/s3 COMPOSE_PROFILES='' S3_ENDPOINT=http://s3:8080 S3_FORCE_PATH_STYLE=true
export APP_IMAGE=${APP_IMAGE:-planta14-app:staging} HTTP_BIND=127.0.0.1 HTTPS_BIND=127.0.0.1
caddy_image=caddy:2.10.2-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d
dc() { docker compose -p planta14-staging -f infra/compose.staging.yaml -f infra/test/compose.staging-e2e.yaml --env-file "$envf" "$@"; }
cleanup() {
  if [[ ${E2E_KEEP:-0} != 1 ]]; then dc down -v --remove-orphans >/dev/null 2>&1 || true; rm -rf -- "$out"; fi
}
trap cleanup EXIT
docker image inspect "$APP_IMAGE" >/dev/null 2>&1 || die "Falta la imagen $APP_IMAGE (ver docs/V2-INTEGRACION.md)"

log "== Entorno: contraseña de staging, secretos aleatorios, buckets vacíos"
basic_password=$(openssl rand -hex 12)
CADDY_BASIC_AUTH_HASH=$(printf '%s\n' "$basic_password" | docker run --rm -i "$caddy_image" caddy hash-password)
export CADDY_BASIC_AUTH_HASH
"$infra/generate-env.sh" "$domain" internal "$envf"
unset CADDY_BASIC_AUTH_HASH
load_env_file "$envf"
mkdir -p "$E2E_S3_DIR/$S3_BUCKET" "$E2E_S3_DIR/$PUBLIC_MEDIA_BUCKET"
curl_s() { curl -sk --noproxy '*' --resolve "$domain:443:127.0.0.1" -u "planta14:$basic_password" "$@"; }
wait_web() {
  for _ in $(seq 1 120); do [[ $(curl_s -o /dev/null -w '%{http_code}' "https://$domain/robots.txt") == 200 ]] && return 0; sleep 2; done
  dc ps; dc logs --tail 40 app caddy migrate; die "La web no respondió"
}

log "== Arranque: postgres, s3, migraciones (migrador), app y Caddy"
dc up -d --no-build
wait_web
dc ps --format '{{.Service}}: {{.State}} {{.Status}}' | sed 's/^/    /'
dc logs migrate 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E 'Migrated|Done' | sed 's/^/    /'

log "== Bootstrap del administrador, importación municipal y sincronización de imágenes"
E2E_ADMIN_EMAIL=admin@staging.example.test E2E_ADMIN_PASSWORD=$(openssl rand -hex 16)
export E2E_ADMIN_EMAIL E2E_ADMIN_PASSWORD
CMS_BOOTSTRAP_EMAIL=$E2E_ADMIN_EMAIL CMS_BOOTSTRAP_PASSWORD=$E2E_ADMIN_PASSWORD dc run --rm -T -e CMS_BOOTSTRAP_EMAIL -e CMS_BOOTSTRAP_PASSWORD migrate npm run cms:bootstrap 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E 'Administrador|rror' | sed 's/^/    /'
dc run --rm -T -e NODE_ENV=development -e IMPORT_MUNICIPAL_DEMO=true migrate npm run cms:import:municipal 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E 'importad|rror' | sed 's/^/    /'
dc run --rm -T migrate npm run cms:media:sync-public 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E 'revisadas|rror' | sed 's/^/    /'
check_db_user() { docker exec planta14-staging-app-1 node -e "const u=new URL(process.env.DATABASE_URL);console.log(u.username)"; }
[[ $(check_db_user) == "$POSTGRES_APP_USER" ]] || die "La app no usa el usuario de aplicación"
log "La app usa el usuario PostgreSQL $(check_db_user); las migraciones, $POSTGRES_MIGRATOR_USER"

log "== Navegador real detrás de Caddy"
# Direct connection to the local Caddy: no outbound proxy for the browser.
env -u HTTPS_PROXY -u HTTP_PROXY -u https_proxy -u http_proxy -u ALL_PROXY -u all_proxy \
  E2E_DOMAIN=$domain E2E_PORT=443 E2E_BASIC_USER=planta14 E2E_BASIC_PASSWORD="$basic_password" E2E_OUT="$out" node "$here/staging-browser.mjs"

snapshot() { # DIRECTORIO
  local route name
  for route in / /lena /mieres /aller /agenda /edicion /comarca/caudal; do
    name=$(printf '%s' "$route" | tr '/' '_'); name=${name:-_}
    curl_s -o /dev/null "https://$domain$route" # warm-up: the first render after a restart may stream metadata
    curl_s "https://$domain$route" | sed -e 's/<script[^>]*>[^<]*<\/script>//g' | node -e "
      let s='';process.stdin.on('data',c=>s+=c).on('end',()=>{
        const body=(s.match(/<body[^>]*>([\s\S]*?)<\/body>/)||[,''])[1];
        console.log(body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/\/media\/public\/[0-9a-f-]{36}\//g,'/media/public/KEY/').replace(/<template id=\"B:[0-9]+\"><\/template>/g,'').replace(/<(title)>[\s\S]*?<\/title>|<(meta|link)\b[^>]*\/?>/g,'').replace(/<!--.*?-->/g,'').replace(/\s+/g,' ').trim());});" > "$1/$name.html"
  done
  docker exec -i planta14-staging-postgres-1 psql -U planta14 -d planta14 -XAtq < "$here/count-rows.sql" > "$1/filas.txt"
}
snapshot "$out/pages-before"
log "Páginas y recuento de filas guardados: $(wc -l < "$out/pages-before/filas.txt") tablas, $(awk -F'|' '{s+=$2} END {print s}' "$out/pages-before/filas.txt") filas"

log "== Copia de seguridad (cifrada con clave age efímera)"
age-keygen -o "$out/age-key.txt" 2>/dev/null
export BACKUP_DIR=$out/backups BACKUP_ENCRYPTION=age BACKUP_AGE_IDENTITY=$out/age-key.txt BACKUP_DOCKER_NETWORK=planta14-staging_backend
BACKUP_AGE_RECIPIENT=$(age-keygen -y "$out/age-key.txt"); export BACKUP_AGE_RECIPIENT
dump=$("$infra/backup/backup-postgres.sh" --env-file "$envf")
archive=$("$infra/backup/backup-storage.sh" --env-file "$envf")
log "Copias: $(basename "$dump"), $(basename "$archive")"

log "== Borrado completo del entorno (contenedores, volúmenes y datos de S3)"
dc down -v --remove-orphans 2>&1 | tail -n 1 | sed 's/^/    /'
rm -rf -- "${E2E_S3_DIR:?}"/*
[[ -z $(docker volume ls -q --filter name=planta14-staging_postgres_data) ]] || die "El volumen de PostgreSQL sigue existiendo"
[[ -z $(find "$E2E_S3_DIR" -mindepth 1 -print -quit) ]] || die "Quedan datos de S3"

log "== Restauración en un entorno nuevo"
mkdir -p "$E2E_S3_DIR/$S3_BUCKET" "$E2E_S3_DIR/$PUBLIC_MEDIA_BUCKET"
dc up -d --no-build postgres s3 public-media
for _ in $(seq 1 60); do docker exec planta14-staging-postgres-1 pg_isready -h 127.0.0.1 -U planta14 -d planta14 >/dev/null 2>&1 && break; sleep 1; done
"$infra/restore/restore-postgres.sh" --env-file "$envf" "$dump" planta14
"$infra/restore/restore-storage.sh" --env-file "$envf" "$archive" "$S3_BUCKET"
dc up -d --no-build
wait_web
dc run --rm -T migrate npm run cms:media:sync-public 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E 'revisadas|rror' | sed 's/^/    /'
snapshot "$out/pages-after"

log "== Comparación antes / después"
failures=0
# The operation log grows with the resync after restoring (new copies): compared apart from the data tables.
grep -v '^public.public_media_ops|' "$out/pages-before/filas.txt" > "$out/pages-before/filas-datos.txt"; rm "$out/pages-before/filas.txt"
grep -v '^public.public_media_ops|' "$out/pages-after/filas.txt" > "$out/pages-after/filas-datos.txt"
log "Registro de copias públicas tras restaurar: $(grep '^public.public_media_ops|' "$out/pages-after/filas.txt" | cut -d'|' -f2) operaciones (incluye la nueva copia)"
for f in "$out"/pages-before/*; do
  if diff -q "$f" "$out/pages-after/$(basename "$f")" >/dev/null; then log "OK    $(basename "$f") idéntico"; else log "FALLO $(basename "$f") distinto"; diff "$f" "$out/pages-after/$(basename "$f")" | head -5 || true; failures=$((failures + 1)); fi
done
state=$out/browser-state.json
kept=$(node -e "console.log(require('$state').keptTitle)") withdrawn=$(node -e "console.log(require('$state').withdrawnTitle)")
check() { local desc=$1; shift; if "$@"; then log "OK    $desc"; else log "FALLO $desc"; failures=$((failures + 1)); fi; }
absent() { ! grep -q "$1" "$2"; }
public_image_ok() {
  local img; img=$(curl_s "https://$domain/lena" | grep -o "https://$domain/media/public/[0-9a-f-]*/[^\"]*" | head -n1 || true)
  [[ -n $img && $(curl_s -o /dev/null -w '%{http_code}' "$img") == 200 ]]
}
admin_login_ok() {
  [[ $(curl_s -o /dev/null -w '%{http_code}' -H "Origin: https://$domain" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$E2E_ADMIN_EMAIL\",\"password\":\"$E2E_ADMIN_PASSWORD\"}" "https://$domain/api/cms/users/login") == 200 ]]
}
check "la publicación vigente de Lena sigue en /lena" grep -q "$kept" "$out/pages-after/_lena.html"
check "el aviso retirado sigue fuera de la web" absent "$withdrawn" "$out/pages-after/_lena.html"
check "la imagen pública vigente se sirve tras restaurar y sincronizar" public_image_ok
check "el administrador restaurado inicia sesión" admin_login_ok
if (( failures == 0 )); then log "RESULTADO: staging de extremo a extremo SUPERADO"; else log "RESULTADO: $failures comprobaciones FALLIDAS"; exit 1; fi
