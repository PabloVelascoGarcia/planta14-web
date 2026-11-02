#!/usr/bin/env bash
# Ensayo local de producción con Docker (nada real, todo desechable):
#   - copia aislada del repositorio con tres versiones locales: "buena" (esta rama + la de lanzamiento, que
#     aporta /api/health), "mala con migración" (cambia datos y /api/health falla) y "mala sin migración";
#   - infra/compose.production.yaml + infra/Caddyfile.production con certificado interno (CADDY_TLS_MODE=internal)
#     para planta14.test y www.planta14.test en 127.0.0.1:80/443, y S3 externo sustituto (rclone);
#   - despliegue de la buena; comprobaciones públicas (sin contraseña, HTTPS, www, /api/health, cabeceras);
#   - modo mantenimiento: escrituras rechazadas (Caddy y app) y lectura pública funcionando;
#   - mala con migración: vuelve a la anterior, deja el mantenimiento activado y NO restaura; restauración
#     asistida con la clave por la entrada estándar (sin dejarla en disco ni en la lista de procesos);
#   - mala sin migración: vuelta atrás automática; actualización correcta con mantenimiento durante el cambio;
#   - programación de copias (cron) y una copia del almacenamiento lanzada como lo haría cron.
# Uso: infra/test/production-deploy-test.sh     (PRODTEST_KEEP=1 conserva el entorno para revisarlo)
# Requiere: Docker, git, curl, age, openssl, node_modules instalados (npm ci) y la rama de lanzamiento en origin.
set -Eeuo pipefail
SCRIPT_NAME=production-deploy-test
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
root=$(cd "$here/../.." && pwd)
# shellcheck source=SCRIPTDIR/../lib/common.sh
source "$root/infra/lib/common.sh"
require_cmd docker git curl age age-keygen openssl python3
[[ -d $root/node_modules ]] || die "Falta node_modules (npm ci)"
launch_ref=${PRODTEST_LAUNCH_REF:-refs/remotes/origin/desarrollo/planta14-v2-lanzamiento}
git -C "$root" rev-parse --verify --quiet "$launch_ref" >/dev/null || die "No está $launch_ref (git fetch origin desarrollo/planta14-v2-lanzamiento)"
project=planta14-prodtest domain=planta14.test
[[ -z $(docker ps -aq --filter "label=com.docker.compose.project=$project") ]] || die "Ya existen contenedores del proyecto $project; no se adopta un entorno existente"
[[ -z $(docker volume ls -q --filter "label=com.docker.compose.project=$project") ]] || die "Ya existen volúmenes del proyecto $project; no se borran"

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
# Y también los cambios sin commit de la aplicación (fuera de infra/).
while IFS= read -r f; do
  [[ -e $root/$f ]] || continue
  mkdir -p "$(dirname "$f")"; cp -a "$root/$f" "$f"
done < <(git -C "$root" ls-files -mo --exclude-standard | grep -v '^infra/')
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
# Clave privada de las copias SOLO en memoria (como la custodia Pablo): el servidor tiene la pública.
age_key=$(age-keygen 2>/dev/null | sed -n '/^AGE-SECRET-KEY-1/p')
age_recipient=$(printf '%s\n' "$age_key" | age-keygen -y)
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
  'BACKUP_DIR': '$ws/backups', 'BACKUP_AGE_RECIPIENT': '$age_recipient', 'MAINTENANCE_DIR': '$ws/mantenimiento',
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
export PREBUILT_NODE_MODULES=$root/node_modules
unset BACKUP_AGE_IDENTITY
if [[ ${PRODTEST_REAL_BUILD:-0} == 1 ]]; then export DEPLOY_BUILD_COMMAND=$ws/repo/infra/test/prod-build-bounded.sh
else export DEPLOY_BUILD_COMMAND=$ws/repo/infra/test/prod-build-prebuilt.sh; fi
dc() { APP_IMAGE=planta14-app:${good:0:12} docker compose -p "$project" -f infra/compose.production.yaml -f infra/test/compose.production-test.yaml --env-file "$ws/production.env" "$@"; }
check "docker compose config de producción (con S3 sustituto)" dc config --quiet
built_tags+=("planta14-app:${good:0:12}" "planta14-app:${bad_migration:0:12}" "planta14-app:${bad_plain:0:12}")
c() { curl --silent --show-error --noproxy '*' --insecure --resolve "$domain:443:127.0.0.1" --resolve "www.$domain:443:127.0.0.1" --resolve "$domain:80:127.0.0.1" --resolve "www.$domain:80:127.0.0.1" "$@"; }
deploy() { local code=0; infra/deploy/deploy.sh --env-file "$ws/production.env" "$1" > "$ws/deploy-$2.log" 2>&1 || code=$?; sed 's/^/    /' "$ws/deploy-$2.log" | grep -E 'Versión|Copia previa|Migraciones|Sin migraciones|FALLO|Volviendo|restaura|no hace falta|funciona|Desplegada|health|Base restaurada|mantenimiento|restauración' || true; return "$code"; }

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
counts > "$ws/filas-antes.txt"
check "datos de ensayo cargados" test "$(grep -c '' "$ws/filas-antes.txt")" -gt 10
for _ in 1 2 3; do c -o /dev/null -X POST -H 'Content-Type: application/json' -H "Origin: https://$domain" -d '{"email":"admin@planta14.example","password":"incorrecta"}' "https://$domain/api/cms/users/login"; done
sleep 1
check "registro de accesos con los logins fallidos (para fail2ban)" test "$(grep -c '"uri":"/api/cms/users/login".*"status":401' "$ws/caddy-logs/access.log")" -ge 3
grep '"uri":"/api/cms/users/login"' "$ws/caddy-logs/access.log" > "$here/out/caddy-login-sample-$id.log" || true

log "== 1b. Modo mantenimiento: escrituras rechazadas, lectura pública funcionando"
token=$(c -X POST -H 'Content-Type: application/json' -H "Origin: https://$domain" -d "{\"email\":\"admin@planta14.example\",\"password\":\"$admin_password\"}" "https://$domain/api/cms/users/login" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
check "inicio de sesión de administración para el ensayo" test -n "$token"
content_id=$(docker exec "$project-postgres-1" psql -U planta14 -d planta14 -XAtc "SELECT min(id) FROM municipal_content")
current_title=$(docker exec "$project-postgres-1" psql -U planta14 -d planta14 -XAtc "SELECT title FROM municipal_content WHERE id = $content_id")
auth=(-H "Authorization: JWT $token" -H "Origin: https://$domain")
write_status() { # MÉTODO RUTA [DATOS]
  c -o "$ws/escritura.json" -w '%{http_code}' -X "$1" "${auth[@]}" -H 'Content-Type: application/json' ${3:+-d "$3"} "https://$domain/api/cms$2"
}
patch_same_title() { write_status PATCH "/municipal-content/$content_id" "$(python3 -c 'import json,sys; print(json.dumps({"title": sys.argv[1]}))' "$current_title")"; }
maint() { infra/deploy/mantenimiento.sh --env-file "$ws/production.env" "$@"; }
counts > "$ws/filas-pre-mantenimiento.txt"
maint activar "ensayo" > "$ws/mantenimiento-activar.log" 2>&1
check "mantenimiento.sh activar: comprobado que Caddy rechaza escrituras" grep -q 'las escrituras se rechazan' "$ws/mantenimiento-activar.log"
check "mantenimiento: web pública 200" test "$(status_of "https://$domain/")" = 200
check "mantenimiento: página de concejo 200" test "$(status_of "https://$domain/lena")" = 200
check "mantenimiento: /api/health ok" grep -q '"status":"ok"' <<< "$(c "https://$domain/api/health")"
check "mantenimiento: lectura de la API de Payload con sesión (200)" test "$(c -o /dev/null -w '%{http_code}' "${auth[@]}" "https://$domain/api/cms/municipal-content?limit=1")" = 200
check "mantenimiento: lectura por POST con X-Payload-HTTP-Method-Override: GET (200)" test "$(c -o /dev/null -w '%{http_code}' -X POST "${auth[@]}" -H 'X-Payload-HTTP-Method-Override: GET' -H 'Content-Type: application/x-www-form-urlencoded' -d 'limit=1' "https://$domain/api/cms/municipal-content")" = 200
check "mantenimiento: crear (POST) rechazado con 503" test "$(write_status POST /municipal-content '{"title":"no"}')" = 503
check "mantenimiento: mensaje claro para el usuario" grep -q 'Planta 14 se está actualizando' "$ws/escritura.json"
check "mantenimiento: editar (PATCH) rechazado con 503" test "$(patch_same_title)" = 503
check "mantenimiento: borrar (DELETE) rechazado con 503" test "$(write_status DELETE "/municipal-content/$content_id")" = 503
check "mantenimiento: subir imagen rechazado con 503" test "$(c -o /dev/null -w '%{http_code}' -X POST "${auth[@]}" -F 'file=@/dev/null;filename=x.png' "https://$domain/api/cms/media")" = 503
check "mantenimiento: recuperar contraseña rechazado con 503" test "$(write_status POST /users/forgot-password '{"email":"admin@planta14.example"}')" = 503
app_write=$(docker exec -e T="$token" -e ID="$content_id" "$project-app-1" node -e '
fetch(`http://127.0.0.1:3000/api/cms/municipal-content/${process.env.ID}`, { method: "PATCH", headers: { Authorization: `JWT ${process.env.T}`, "Content-Type": "application/json" }, body: JSON.stringify({ title: "ESCRITURA DIRECTA" }) })
  .then(async r => console.log(r.status, await r.text())).catch(e => console.log("error", e.message))' 2>&1)
check "mantenimiento: la app también rechaza la escritura sin pasar por Caddy (503)" grep -q '^503 .*Planta 14 se está actualizando' <<< "$app_write"
check "mantenimiento: aviso visible en /cms" bash -c "curl -sk --noproxy '*' --resolve '$domain:443:127.0.0.1' -H 'Cookie: payload-token=$token' 'https://$domain/cms' | grep -q 'data-maintenance=\"on\"'"
check "mantenimiento: aviso visible en el panel municipal" bash -c "curl -sk --noproxy '*' --resolve '$domain:443:127.0.0.1' 'https://$domain/lena/panel' | grep -q 'Planta 14 se está actualizando'"
counts > "$ws/filas-mantenimiento.txt"
check "mantenimiento: ningún dato cambió" diff -u "$ws/filas-pre-mantenimiento.txt" "$ws/filas-mantenimiento.txt"
infra/deploy/status.sh --env-file "$ws/production.env" > "$ws/status-mantenimiento.txt" 2>&1 || true
check "status.sh indica el mantenimiento" grep -q 'Modo mantenimiento: ACTIVADO' "$ws/status-mantenimiento.txt"
maint desactivar > /dev/null 2>&1
check "mantenimiento desactivado: se vuelve a escribir (PATCH 200)" test "$(patch_same_title)" = 200
check "sin mantenimiento: ni aviso en el panel" bash -c "! curl -sk --noproxy '*' --resolve '$domain:443:127.0.0.1' 'https://$domain/lena/panel' | grep -q 'Planta 14 se está actualizando'"

log "== 2. Versión que falla CON migración que cambia datos: vuelve a la anterior en mantenimiento, sin restaurar"
counts > "$ws/filas-antes.txt"; titles_before=$(titles)
code=0; deploy "$bad_migration" mala-migracion || code=$?
check "código 2 (requiere la restauración asistida)" test "$code" = 2
check "la versión actual sigue siendo la buena" test "$(cat "$ws/state/current")" = "$good"
check "mantenimiento activado antes de la copia previa" bash -c "[[ \$(grep -n 'Modo mantenimiento ACTIVADO' '$ws/deploy-mala-migracion.log' | head -1 | cut -d: -f1) -lt \$(grep -n 'Copia previa:' '$ws/deploy-mala-migracion.log' | cut -d: -f1) ]]"
check "se hizo copia antes de migrar" grep -q 'Copia previa:' "$ws/deploy-mala-migracion.log"
check "la migración llegó a aplicarse (y se detectó)" grep -q 'Migraciones aplicadas: 20991231_000000_ensayo_fallo' "$ws/deploy-mala-migracion.log"
check "NO restauró automáticamente" bash -c "! grep -q 'Base restaurada' '$ws/deploy-mala-migracion.log' && grep -q 'NO se restaura automáticamente' '$ws/deploy-mala-migracion.log'"
check "los datos siguen como los dejó la migración (sin restaurar)" test "$(titles)" != "$titles_before"
check "no se creó ninguna base nueva" test "$(docker exec "$project-postgres-1" psql -U planta14 -d postgres -XAtc "SELECT count(*) FROM pg_database WHERE datname LIKE 'planta14_%'")" = 0
check "contenedor app con la imagen anterior (buena)" test "$(docker inspect -f '{{.Config.Image}}' "$project-app-1")" = "planta14-app:${good:0:12}"
check "modo mantenimiento sigue activado" test -f "$ws/mantenimiento/activo"
check "restauración pendiente anotada" grep -q "^copia=$ws/backups/" "$ws/state/restauracion-pendiente"
check "instrucciones en lenguaje llano con la orden para Windows" bash -c "grep -q 'QUÉ HACER AHORA' '$ws/deploy-mala-migracion.log' && grep -q 'ssh -t .*infra/deploy/restaurar.sh' '$ws/deploy-mala-migracion.log' && grep -q 'botón derecho' '$ws/deploy-mala-migracion.log'"
check "alerta enviada con las instrucciones" bash -c "grep -q 'restauración asistida pendiente' '$ws/alerts.log' && grep -q 'restaurar.sh' '$ws/alerts.log'"
check "versión anterior en mantenimiento: web pública 200" test "$(status_of "https://$domain/")" = 200
check "versión anterior en mantenimiento: /api/health ok" grep -q '"status":"ok"' <<< "$(c "https://$domain/api/health")"
check "versión anterior en mantenimiento: escritura rechazada (503)" test "$(patch_same_title)" = 503
infra/deploy/status.sh --env-file "$ws/production.env" > "$ws/status-pendiente.txt" 2>&1 || true
check "status.sh avisa de la restauración pendiente" grep -q 'restauración asistida pendiente' "$ws/status-pendiente.txt"
code=0; deploy "$bad_plain" con-pendiente || code=$?
check "con la restauración pendiente no se despliega otra versión (código 3)" bash -c "[[ $code == 3 ]] && grep -q 'restauración asistida pendiente' '$ws/deploy-con-pendiente.log'"
check "con la restauración pendiente no se puede quitar el mantenimiento" bash -c "! infra/deploy/mantenimiento.sh --env-file '$ws/production.env' desactivar >/dev/null 2>&1 && test -f '$ws/mantenimiento/activo'"

log "== 2b. Restauración asistida con la clave privada por la entrada estándar"
restore() { infra/deploy/restaurar.sh --env-file "$ws/production.env" "${@:2}" > "$ws/restaurar-$1.log" 2>&1; }
code=0; printf '%s\n' "$age_key" | restore simulacro --solo-comprobar || code=$?
check "simulacro (--solo-comprobar): la clave descifra la última copia sin cambiar nada" bash -c "[[ $code == 0 ]] && grep -q 'SIMULACRO CORRECTO' '$ws/restaurar-simulacro.log' && test -f '$ws/state/restauracion-pendiente' && test -f '$ws/mantenimiento/activo'"
code=0; printf 'esto no es una clave\n' | restore basura || code=$?
check "texto que no es una clave: se niega sin cambiar nada (código 3)" bash -c "[[ $code == 3 ]] && grep -q 'no parece una clave age' '$ws/restaurar-basura.log'"
other_key=$(age-keygen 2>/dev/null | sed -n '/^AGE-SECRET-KEY-1/p')
code=0; printf '%s\n' "$other_key" | restore otra-clave || code=$?
check "clave que no es la de las copias: se niega sin cambiar nada (código 3)" bash -c "[[ $code == 3 ]] && grep -q 'no corresponde a la clave pública' '$ws/restaurar-otra-clave.log'"
check "tras las claves incorrectas: sin restaurar y en mantenimiento" bash -c "[[ \$(docker exec '$project-postgres-1' psql -U planta14 -d planta14 -XAtc \"SELECT md5(string_agg(title, '|' ORDER BY id)) FROM municipal_content\") != '$titles_before' ]] && test -f '$ws/mantenimiento/activo' && test -f '$ws/state/restauracion-pendiente'"
touch "$ws/antes-de-restaurar"; sleep 1
rm -f "$ws/restauracion.fin"
( while [[ ! -f $ws/restauracion.fin ]]; do ps -eo args= >> "$ws/procesos-durante-restauracion.txt" 2>/dev/null || true; sleep 0.2; done ) &
sampler=$!
# Como desde PowerShell: la clave llega por la entrada estándar con final de línea de Windows.
code=0; printf '%s\r\n' "$age_key" | restore buena || code=$?
touch "$ws/restauracion.fin"; wait "$sampler" || true
sed 's/^/    /' "$ws/restaurar-buena.log" | grep -E 'Clave|Restaur|mantenimiento|health|COMPLETADA|ERROR' || true
check "restauración asistida correcta (código 0)" test "$code" = 0
check "mensaje RESTAURACIÓN COMPLETADA" grep -q 'RESTAURACIÓN COMPLETADA' "$ws/restaurar-buena.log"
check "datos restaurados (títulos originales)" test "$(titles)" = "$titles_before"
check "sin la tabla ni la migración de la versión mala" test "$(docker exec "$project-postgres-1" psql -U planta14 -d planta14 -XAtc "SELECT to_regclass('public.ensayo_migracion') IS NULL AND NOT EXISTS (SELECT 1 FROM payload_migrations WHERE name LIKE '2099%')")" = t
counts > "$ws/filas-despues.txt"
check "mismo número de filas en todas las tablas que antes" diff -u "$ws/filas-antes.txt" "$ws/filas-despues.txt"
check "la base con los cambios se conserva para analizarla" test "$(docker exec "$project-postgres-1" psql -U planta14 -d postgres -XAtc "SELECT count(*) FROM pg_database WHERE datname LIKE 'planta14_fallida_%'")" = 1
check "objetos restaurados con el usuario de migraciones" test "$(docker exec "$project-postgres-1" psql -U planta14 -d planta14 -XAtc "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tableowner <> 'planta14_migrator'")" = 0
check "mantenimiento desactivado tras comprobar la salud" bash -c "! test -f '$ws/mantenimiento/activo' && grep -q 'restauración asistida correcta y /api/health correcto' '$ws/state/historial.log'"
check "restauración pendiente cerrada" test ! -f "$ws/state/restauracion-pendiente"
check "/api/health ok y la app lee con su usuario" grep -q '"database":"ok"' <<< "$(c "https://$domain/api/health")"
check "se vuelve a escribir (PATCH 200)" test "$(patch_same_title)" = 200
has_key() { grep -qF -f <(printf '%s\n' "$age_key") "$@" 2>/dev/null; }
check "la clave no aparece en la lista de procesos durante la restauración ($(grep -c '' "$ws/procesos-durante-restauracion.txt") líneas de ps)" bash -c "test -s '$ws/procesos-durante-restauracion.txt' && ! grep -qF -f <(printf '%s\n' '$age_key') '$ws/procesos-durante-restauracion.txt'"
mapfile -t new_files < <(find "$ws" /tmp "${TMPDIR:-/tmp}" "$HOME" -xdev -maxdepth 6 -type f -newer "$ws/antes-de-restaurar" -size -200M 2>/dev/null | sort -u)
leaked=(); for f in "${new_files[@]}"; do has_key "$f" && leaked+=("$f"); done
check "la clave no queda en ningún archivo nuevo o modificado (${#new_files[@]} revisados: ensayo, /tmp, \$HOME)" test "${#leaked[@]}" = 0
(( ${#leaked[@]} == 0 )) || printf '    con la clave: %s\n' "${leaked[@]}"
check "la clave no queda en el contenedor de PostgreSQL" bash -c "! printf '%s\n' '$age_key' | docker exec -i '$project-postgres-1' sh -c 'grep -rlF -f /dev/stdin /tmp /var/lib/postgresql/data' 2>/dev/null | grep -q ."
check "la clave no queda en el historial de órdenes" bash -c "! grep -qsF -f <(printf '%s\n' '$age_key') \"\$HOME/.bash_history\""
check "sin rastro de la copia descifrada" test -z "$(find /tmp "${TMPDIR:-/tmp}" -maxdepth 2 -newer "$ws/antes-de-restaurar" -name 'restore.dump' 2>/dev/null)"

log "== 3. Versión que falla SIN migración: vuelta atrás automática"
code=0; deploy "$bad_plain" mala-sin-migracion || code=$?
check "código 1 (falló y volvió a la anterior sola)" test "$code" = 1
check "no hizo falta restaurar" grep -q 'no hace falta restaurar' "$ws/deploy-mala-sin-migracion.log"
check "no se creó otra base fallida" test "$(docker exec "$project-postgres-1" psql -U planta14 -d postgres -XAtc "SELECT count(*) FROM pg_database WHERE datname LIKE 'planta14_fallida_%'")" = 1
check "/api/health ok con la versión anterior" grep -q '"status":"ok"' <<< "$(c "https://$domain/api/health")"
check "mantenimiento activado durante el intento y desactivado al volver" bash -c "grep -q 'Modo mantenimiento ACTIVADO' '$ws/deploy-mala-sin-migracion.log' && grep -q 'Modo mantenimiento DESACTIVADO (vuelta atrás automática correcta)' '$ws/deploy-mala-sin-migracion.log' && ! test -f '$ws/mantenimiento/activo'"
check "se vuelve a escribir tras la vuelta atrás automática (PATCH 200)" test "$(patch_same_title)" = 200
check "historial: una vuelta atrás sin restaurar y una automática" bash -c "[[ \$(grep -c 'vuelta-atras-sin-restaurar' '$ws/state/historial.log') == 1 && \$(grep -c 'vuelta-atras .*(sin cambios en la base)' '$ws/state/historial.log') == 1 ]]"

log "== 3b. Actualización correcta: mantenimiento solo durante el cambio"
rm -f "$ws/despliegue.fin" "$ws/escrituras-durante.txt"
( while [[ ! -f $ws/despliegue.fin ]]; do
    c -o /dev/null -w '%{http_code}\n' -X POST -H 'Content-Type: application/json' -d '{}' "https://$domain/api/cms/comprobacion-ensayo" >> "$ws/escrituras-durante.txt" 2>/dev/null || true
    sleep 0.5
  done ) &
writer=$!
code=0; DEPLOY_FORCE=1 deploy "$good" forzada || code=$?
touch "$ws/despliegue.fin"; wait "$writer" || true
check "actualización correcta (código 0)" test "$code" = 0
check "durante la actualización las escrituras se rechazaron (503)" grep -q '^503$' "$ws/escrituras-durante.txt"
check "orden: mantenimiento, copia previa, health ok, fin del mantenimiento" bash -c "l() { grep -n \"\$1\" '$ws/deploy-forzada.log' | head -1 | cut -d: -f1; }; [[ \$(l 'Modo mantenimiento ACTIVADO') -lt \$(l 'Copia previa:') && \$(l 'Copia previa:') -lt \$(l '/api/health: ok') && \$(l '/api/health: ok') -lt \$(l 'Modo mantenimiento DESACTIVADO') ]]"
check "tras la actualización el mantenimiento queda desactivado" test ! -f "$ws/mantenimiento/activo"
check "tras la actualización: PATCH 200" test "$(patch_same_title)" = 200
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
check "cron: 3 copias y vigilancia de disco" test "$(grep -cE '^[0-9]+ [0-9*]+ \* \* \* ' "$ws/cron/planta14")" = 4
check "cron: memoria cada minuto" grep -q '^\* \* \* \* \* .*check-memory.sh' "$ws/cron/planta14"
check "cron: todas las copias pasan por las alertas" test "$(grep -c 'run-with-alert.sh' "$ws/cron/planta14")" = 3
job=$(grep 'Copia del almacenamiento' "$ws/cron/planta14" | sed -E 's/^[0-9]+ [0-9]+ \* \* \* [^ ]+ //; s/ >> .*$//')
check "la copia del almacenamiento programada funciona tal cual" bash -c "$job"
check "copia del almacenamiento cifrada creada" test -n "$(find "$ws/backups/storage" -name '*.tar.gz.age')"
failing=$(grep 'Copia de PostgreSQL' "$ws/cron/planta14" | sed -E 's/^[0-9]+ [0-9]+ \* \* \* [^ ]+ //; s/ >> .*$//; s/backup-postgres\.sh/backup-postgres-no-existe.sh/')
check "una copia que falla genera alerta (correo desactivado: registro)" bash -c "! ( $failing ) >/dev/null 2>&1 && grep -q 'FALLO: Copia de PostgreSQL' '$ws/alerts.log'"

if (( failures == 0 )); then log "RESULTADO: ensayo de producción SUPERADO"; else log "RESULTADO: $failures comprobaciones FALLIDAS"; exit 1; fi
