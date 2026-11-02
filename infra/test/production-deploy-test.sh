#!/usr/bin/env bash
# Ensayo local de producción con Docker (nada real, todo desechable):
#   - copia aislada del repositorio con tres versiones locales: "buena" (esta rama + la de lanzamiento, que
#     aporta /api/health), "mala con migración" (cambia datos y /api/health falla) y "mala sin migración";
#   - infra/compose.production.yaml + infra/Caddyfile.production con certificado interno (CADDY_TLS_MODE=internal)
#     para planta14.test y www.planta14.test en 127.0.0.1:80/443, y S3 externo sustituto (rclone);
#   - despliegue de la buena; comprobaciones públicas (sin contraseña, HTTPS, www, /api/health, cabeceras);
#   - despliegue de las malas: vuelta atrás automática, con restauración solo si la migración cambió datos;
#   - programación de copias (cron) y una copia del almacenamiento lanzada como lo haría cron.
# Uso: infra/test/production-deploy-test.sh     (PRODTEST_KEEP=1 conserva el entorno para revisarlo)
# Requiere: Docker, git, curl, age, openssl, node_modules instalados (npm ci) y la rama de lanzamiento en origin.
set -Eeuo pipefail
SCRIPT_NAME=production-deploy-test
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
root=$(cd "$here/../.." && pwd)
# shellcheck source=SCRIPTDIR/../lib/common.sh
source "$root/infra/lib/common.sh"
require_cmd docker git curl age age-keygen openssl
[[ -d $root/node_modules ]] || die "Falta node_modules (npm ci)"
launch_ref=${PRODTEST_LAUNCH_REF:-refs/remotes/origin/desarrollo/planta14-v2-lanzamiento}
git -C "$root" rev-parse --verify --quiet "$launch_ref" >/dev/null || die "No está $launch_ref (git fetch origin desarrollo/planta14-v2-lanzamiento)"
project=planta14-prodtest domain=planta14.test
[[ -z $(docker ps -aq --filter "label=com.docker.compose.project=$project") ]] || die "Ya existen contenedores del proyecto $project; no se adopta un entorno existente"

id=$(openssl rand -hex 4)
ws=$here/out/prod-$id
mkdir -p "$ws"
failures=0
check() { local desc=$1; shift; if "$@"; then log "OK    $desc"; else log "FALLO $desc"; failures=$((failures + 1)); fi; }
built_tags=()
cleanup() {
  if [[ ${PRODTEST_KEEP:-0} == 1 ]]; then log "Entorno conservado en $ws"; return; fi
  (cd "$ws/repo" 2>/dev/null && DEPLOY_STATE_DIR=$ws/state docker compose -p "$project" -f infra/compose.production.yaml -f infra/test/compose.production-test.yaml \
    --env-file "$ws/production.env" down -v --remove-orphans >/dev/null 2>&1) || true
  local tag; for tag in "${built_tags[@]}"; do docker image rm "$tag" >/dev/null 2>&1 || true; done
  docker network rm planta14-backup-egress-prodtest >/dev/null 2>&1 || true
  rm -rf -- "$ws"
}
trap cleanup EXIT

log "== Copia aislada del repositorio y versiones de ensayo"
git clone --quiet --no-local "$root" "$ws/repo"
cd "$ws/repo"
git config user.email prueba@planta14.example; git config user.name "Ensayo de despliegue"
git fetch --quiet "$root" "$launch_ref:refs/heads/lanzamiento"
git checkout --quiet -b ensayo
git merge --quiet --no-edit lanzamiento
# Las herramientas de despliegue de esta copia son las de la rama en curso (incluidos cambios sin commit).
for path in infra/deploy infra/server infra/compose.production.yaml infra/Caddyfile.production infra/.env.production.example infra/postgres infra/test infra/restore infra/lib/common.sh infra/lib/rclone.sh; do
  rm -rf "$path"
  (cd "$root" && tar -cf - --exclude=infra/test/out "$path") | tar -xf -
done
git add -A; git commit --quiet -m "ensayo: versión buena" || true
good=$(git rev-parse HEAD)
git checkout --quiet -b mala-migracion
cat > cms/migrations/20991231_000000_ensayo_fallo.ts <<'TS'
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'
// Migración de ENSAYO: cambia datos para comprobar que la vuelta atrás los restaura.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`UPDATE municipal_content SET title = 'DATOS CAMBIADOS POR LA MIGRACION'; CREATE TABLE ensayo_migracion (id int);`)
}
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE ensayo_migracion;`)
}
TS
python3 - <<'PY'
p='cms/migrations/index.ts'; s=open(p).read()
s=s.replace("\nexport const migrations = [", "import * as ensayo from './20991231_000000_ensayo_fallo';\n\nexport const migrations = [",1)
s=s.rstrip().rstrip('];').rstrip().rstrip(',') + ",\n  { up: ensayo.up, down: ensayo.down, name: '20991231_000000_ensayo_fallo' },\n];\n"
open(p,'w').write(s)
PY
break_health() { sed -i 's#export async function GET() {#export async function GET() {\n  if (process.env.NODE_ENV) return Response.json({ status: "error" }, { status: 503 }); // ENSAYO: versión rota#' app/api/health/route.ts; }
break_health
git add -A; git commit --quiet -m "ensayo: versión mala con migración"
bad_migration=$(git rev-parse HEAD)
git checkout --quiet -b mala-sin-migracion "$good"
break_health
git add -A; git commit --quiet -m "ensayo: versión mala sin migración"
bad_plain=$(git rev-parse HEAD)
git checkout --quiet ensayo
log "Versiones: buena ${good:0:12}, mala con migración ${bad_migration:0:12}, mala sin migración ${bad_plain:0:12}"

log "== Entorno de producción de ensayo"
"$ws/repo/infra/deploy/generate-production-env.sh" ensayo@planta14.example "$ws/production.env"
age-keygen -o "$ws/age-key.txt" 2>/dev/null
mkdir -p "$ws/s3/planta14-privado" "$ws/s3/planta14-publico" "$ws/caddy-logs" "$ws/backups" "$ws/state"
s3key=ensayo$(openssl rand -hex 4) s3secret=$(openssl rand -hex 16)
python3 - "$ws/production.env" <<PY
import re, sys
p = sys.argv[1]; s = open(p).read()
values = {
  'COMPOSE_PROJECT_NAME': '$project', 'SITE_DOMAIN': '$domain', 'CADDY_TLS_MODE': 'internal', 'HTTP_BIND': '127.0.0.1', 'HTTPS_BIND': '127.0.0.1',
  'CADDY_LOG_DIR': '$ws/caddy-logs', 'SITE_INDEXABLE': 'false',
  'S3_BUCKET': 'planta14-privado', 'S3_REGION': 'us-east-1', 'S3_ENDPOINT': 'http://s3:8080', 'S3_FORCE_PATH_STYLE': 'true',
  'S3_ACCESS_KEY_ID': '$s3key', 'S3_SECRET_ACCESS_KEY': '$s3secret',
  'PUBLIC_MEDIA_BUCKET': 'planta14-publico', 'PUBLIC_MEDIA_BASE_URL': 'https://media.$domain',
  'BACKUP_DIR': '$ws/backups', 'BACKUP_AGE_RECIPIENT': '$(age-keygen -y "$ws/age-key.txt")',
  'BACKUP_DOCKER_NETWORK': '${project}_edge', 'BACKUP_EGRESS_NETWORK': 'planta14-backup-egress-prodtest',
  'ALERT_LOG': '$ws/alerts.log', 'ALERT_DISK_PATHS': '$ws', 'DEPLOY_HEALTH_TIMEOUT': '120',
}
for k, v in values.items():
    s, n = re.subn(rf'^{k}=.*$', f'{k}={v}', s, flags=re.M)
    assert n == 1, k
open(p, 'w').write(s)
PY
chmod 600 "$ws/production.env"
export DEPLOY_STATE_DIR=$ws/state DEPLOY_NO_FETCH=1 DEPLOY_COMPOSE_EXTRA=infra/test/compose.production-test.yaml PRODTEST_S3_DIR=$ws/s3
export DEPLOY_BUILD_COMMAND=$ws/repo/infra/test/prod-build-prebuilt.sh PREBUILT_NODE_MODULES=$root/node_modules BACKUP_AGE_IDENTITY=$ws/age-key.txt
dc() { APP_IMAGE=planta14-app:${good:0:12} docker compose -p "$project" -f infra/compose.production.yaml -f infra/test/compose.production-test.yaml --env-file "$ws/production.env" "$@"; }
check "docker compose config de producción (con S3 sustituto)" dc config --quiet
built_tags+=("planta14-app:${good:0:12}" "planta14-app:${bad_migration:0:12}" "planta14-app:${bad_plain:0:12}")
c() { curl --silent --show-error --noproxy '*' --insecure --resolve "$domain:443:127.0.0.1" --resolve "www.$domain:443:127.0.0.1" --resolve "$domain:80:127.0.0.1" --resolve "www.$domain:80:127.0.0.1" "$@"; }
deploy() { local code=0; infra/deploy/deploy.sh --env-file "$ws/production.env" "$1" > "$ws/deploy-$2.log" 2>&1 || code=$?; sed 's/^/    /' "$ws/deploy-$2.log" | grep -E 'Versión|Copia previa|Migraciones|Sin migraciones|FALLO|Volviendo|restaura|no hace falta|funciona|Desplegada|health|Base restaurada' || true; return "$code"; }

log "== 1. Despliegue de la versión buena (primera instalación)"
code=0; deploy "$good" buena || code=$?
check "despliegue correcto (código 0)" test "$code" = 0
check "estado: versión actual = buena" test "$(cat "$ws/state/current")" = "$good"
status_of() { c -o /dev/null -w '%{http_code}' "$@"; }
check "web pública sin contraseña (200)" test "$(status_of "https://$domain/")" = 200
check "HTTP redirige a HTTPS" bash -c "[[ \$(curl -s --noproxy '*' --resolve '$domain:80:127.0.0.1' -o /dev/null -w '%{http_code} %{redirect_url}' 'http://$domain/aviso') == 308\ https://$domain/aviso ]]"
check "www redirige a $domain (permanente, conserva la ruta)" bash -c "[[ \$(curl -sk --noproxy '*' --resolve 'www.$domain:443:127.0.0.1' -o /dev/null -w '%{http_code} %{redirect_url}' 'https://www.$domain/lena?x=1') == 301\ https://$domain/lena?x=1 ]]"
health=$(c "https://$domain/api/health")
check "/api/health abierto al monitor externo: 200 ok" grep -q '"status":"ok"' <<< "$health"
check "/api/health sin caché" bash -c "c() { curl -sk --noproxy '*' --resolve '$domain:443:127.0.0.1' \"\$@\"; }; c -D - -o /dev/null https://$domain/api/health | grep -qi '^cache-control: no-store'"
headers=$(c -D - -o /dev/null "https://$domain/")
check "HSTS y nosniff" bash -c "grep -qi '^strict-transport-security: max-age=31536000' <<< \"$headers\" && grep -qi '^x-content-type-options: nosniff' <<< \"$headers\""
check "sin cabecera Server" bash -c "! grep -qi '^server:' <<< \"$headers\""
check "SITE_INDEXABLE=false: noindex" grep -qi '^x-robots-tag: noindex' <<< "$headers"
check "/cms accesible (login de Payload)" test "$(status_of "https://$domain/cms/login")" = 200
check "PostgreSQL sin puertos publicados" test -z "$(docker port "$project-postgres-1")"

log "== Datos de ensayo"
admin_password=$(openssl rand -hex 16)
CMS_BOOTSTRAP_EMAIL=admin@planta14.example CMS_BOOTSTRAP_PASSWORD=$admin_password dc --profile migrate run --rm -T -e CMS_BOOTSTRAP_EMAIL -e CMS_BOOTSTRAP_PASSWORD migrate npm run cms:bootstrap >/dev/null 2>&1
dc --profile migrate run --rm -T -e NODE_ENV=development -e IMPORT_MUNICIPAL_DEMO=true migrate npm run cms:import:municipal >/dev/null 2>&1
counts() { docker exec -i "$project-postgres-1" psql -U planta14 -d planta14 -XAtq < "$root/infra/test/count-rows.sql" | grep -v '^public.public_media_ops|'; }
titles() { docker exec "$project-postgres-1" psql -U planta14 -d planta14 -XAtc "SELECT md5(string_agg(title, '|' ORDER BY id)) FROM municipal_content"; }
counts > "$ws/filas-antes.txt"; titles_before=$(titles)
check "datos de ensayo cargados" test "$(grep -c '' "$ws/filas-antes.txt")" -gt 10
for _ in 1 2 3; do c -o /dev/null -X POST -H 'Content-Type: application/json' -H "Origin: https://$domain" -d '{"email":"admin@planta14.example","password":"incorrecta"}' "https://$domain/api/cms/users/login"; done
sleep 1
check "registro de accesos con los logins fallidos (para fail2ban)" test "$(grep -c '"uri":"/api/cms/users/login".*"status":401' "$ws/caddy-logs/access.log")" -ge 3
grep '"uri":"/api/cms/users/login"' "$ws/caddy-logs/access.log" > "$here/out/caddy-login-sample-$id.log" || true

log "== 2. Versión que falla CON migración que cambia datos: vuelta atrás con restauración"
code=0; deploy "$bad_migration" mala-migracion || code=$?
check "código 1 (falló y volvió a la anterior)" test "$code" = 1
check "la versión actual sigue siendo la buena" test "$(cat "$ws/state/current")" = "$good"
check "se hizo copia antes de migrar" grep -q 'Copia previa:' "$ws/deploy-mala-migracion.log"
check "la migración llegó a aplicarse (y se detectó)" grep -q 'Migraciones aplicadas: 20991231_000000_ensayo_fallo' "$ws/deploy-mala-migracion.log"
check "se restauró la copia previa" grep -q 'Base restaurada desde' "$ws/deploy-mala-migracion.log"
check "/api/health ok con la versión anterior" grep -q '"status":"ok"' <<< "$(c "https://$domain/api/health")"
check "contenedor app con la imagen buena" test "$(docker inspect -f '{{.Config.Image}}' "$project-app-1")" = "planta14-app:${good:0:12}"
check "datos restaurados (títulos originales)" test "$(titles)" = "$titles_before"
check "sin la tabla ni la migración de la versión mala" test "$(docker exec "$project-postgres-1" psql -U planta14 -d planta14 -XAtc "SELECT to_regclass('public.ensayo_migracion') IS NULL AND NOT EXISTS (SELECT 1 FROM payload_migrations WHERE name LIKE '2099%')")" = t
counts > "$ws/filas-despues.txt"
check "mismo número de filas en todas las tablas que antes" diff -u "$ws/filas-antes.txt" "$ws/filas-despues.txt"
check "la base con los cambios se conserva para analizarla" test "$(docker exec "$project-postgres-1" psql -U planta14 -d postgres -XAtc "SELECT count(*) FROM pg_database WHERE datname LIKE 'planta14_fallida_%'")" = 1
check "objetos restaurados con el usuario de migraciones" test "$(docker exec "$project-postgres-1" psql -U planta14 -d planta14 -XAtc "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tableowner <> 'planta14_migrator'")" = 0
check "la app sigue con el usuario de aplicación y puede leer" grep -q '"database":"ok"' <<< "$(c "https://$domain/api/health")"

log "== 3. Versión que falla SIN migración: vuelta atrás sin restaurar"
code=0; deploy "$bad_plain" mala-sin-migracion || code=$?
check "código 1 (falló y volvió a la anterior)" test "$code" = 1
check "no hizo falta restaurar" grep -q 'no hace falta restaurar' "$ws/deploy-mala-sin-migracion.log"
check "no se creó otra base fallida" test "$(docker exec "$project-postgres-1" psql -U planta14 -d postgres -XAtc "SELECT count(*) FROM pg_database WHERE datname LIKE 'planta14_fallida_%'")" = 1
check "/api/health ok con la versión anterior" grep -q '"status":"ok"' <<< "$(c "https://$domain/api/health")"
check "historial con las dos vueltas atrás" test "$(grep -c 'vuelta-atras' "$ws/state/historial.log")" = 2
code=0; deploy "$good" repetida || code=$?
check "redesplegar la versión actual no hace nada" bash -c "[[ $code == 0 ]] && grep -q 'ya está desplegada' '$ws/deploy-repetida.log'"
sed 's/^SITE_INDEXABLE=.*/SITE_INDEXABLE=/' "$ws/production.env" > "$ws/sin-decision.env"; chmod 600 "$ws/sin-decision.env"
check "sin SITE_INDEXABLE el despliegue se niega" bash -c "! infra/deploy/deploy.sh --env-file '$ws/sin-decision.env' '$good' > '$ws/sin-decision.log' 2>&1 && grep -q 'decisión explícita' '$ws/sin-decision.log'"
check "sin SITE_INDEXABLE Compose se niega" bash -c "! APP_IMAGE=x docker compose -f infra/compose.production.yaml --env-file '$ws/sin-decision.env' config --quiet 2>/dev/null"
infra/deploy/status.sh --env-file "$ws/production.env" > "$ws/status.txt" 2>&1 || true
check "status.sh muestra versión y salud" bash -c "grep -q 'Versión actual:   $good' '$ws/status.txt' && grep -q '/api/health: ok' '$ws/status.txt'"

log "== 4. Programación de copias y alertas"
mkdir -p "$ws/cron" "$ws/logrotate"
SCHEDULE_CRON_DIR=$ws/cron SCHEDULE_LOGROTATE_DIR=$ws/logrotate infra/deploy/schedule.sh --env-file "$ws/production.env" --user "$(id -un)" >/dev/null
check "cron: 3 copias (PostgreSQL, almacenamiento, externa) y vigilancia de disco" test "$(grep -cE '^[0-9]+ [0-9*]+ \* \* \* ' "$ws/cron/planta14")" = 4
check "cron: todas las copias pasan por las alertas" test "$(grep -c 'run-with-alert.sh' "$ws/cron/planta14")" = 3
job=$(grep 'Copia del almacenamiento' "$ws/cron/planta14" | sed -E 's/^[0-9]+ [0-9]+ \* \* \* [^ ]+ //; s/ >> .*$//')
check "la copia del almacenamiento programada funciona tal cual" bash -c "$job"
check "copia del almacenamiento cifrada creada" test -n "$(find "$ws/backups/storage" -name '*.tar.gz.age')"
failing=$(grep 'Copia de PostgreSQL' "$ws/cron/planta14" | sed -E 's/^[0-9]+ [0-9]+ \* \* \* [^ ]+ //; s/ >> .*$//; s/backup-postgres\.sh/backup-postgres-no-existe.sh/')
check "una copia que falla genera alerta (correo desactivado: registro)" bash -c "! ( $failing ) >/dev/null 2>&1 && grep -q 'FALLO: Copia de PostgreSQL' '$ws/alerts.log'"

if (( failures == 0 )); then log "RESULTADO: ensayo de producción SUPERADO"; else log "RESULTADO: $failures comprobaciones FALLIDAS"; exit 1; fi
