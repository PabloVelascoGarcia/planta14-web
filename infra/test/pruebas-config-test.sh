#!/usr/bin/env bash
# Instalación de prueba en pruebas.planta14.com con la configuración de producción, sin cambiar planta14.com:
#   - generate-production-env.sh --pruebas: dominio, SITE_INDEXABLE=false, sin www, copias bajo planta14/pruebas;
#   - Compose: SITE_URL/CMS_SERVER_URL del dominio de prueba y noindex;
#   - Caddy: pruebas.planta14.com SIN www (no pide un certificado imposible); planta14.com sigue con www → 301;
#   - el despliegue se niega a indexar un dominio que no sea planta14.com y valida CADDY_WWW_REDIRECT.
# Uso: infra/test/pruebas-config-test.sh   (Docker para Compose y Caddy; no arranca servicios)
set -Eeuo pipefail
SCRIPT_NAME=pruebas-config-test
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
root=$(cd "$here/../.." && pwd)
# shellcheck source=SCRIPTDIR/../lib/common.sh
source "$root/infra/lib/common.sh"
require_cmd docker openssl python3
work=$(mktemp -d); trap 'rm -rf -- "$work"' EXIT
failures=0
check() { local desc=$1; shift; if "$@"; then log "OK    $desc"; else log "FALLO $desc"; failures=$((failures + 1)); fi; }
caddy=caddy:2.10.2-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d
value() { sed -n "s/^$1=//p" "$2"; }
fill() { # completa con valores sintéticos lo que Pablo rellena a mano
  sed -i "s/^S3_ACCESS_KEY_ID=$/S3_ACCESS_KEY_ID=sintetica/; s/^S3_SECRET_ACCESS_KEY=$/S3_SECRET_ACCESS_KEY=sintetica/; s/^BACKUP_AGE_RECIPIENT=$/BACKUP_AGE_RECIPIENT=age1sintetica/" "$1"
}
"$root/infra/deploy/generate-production-env.sh" --pruebas info@planta14.com "$work/pruebas.env" 2>/dev/null
"$root/infra/deploy/generate-production-env.sh" info@planta14.com "$work/produccion.env" 2>/dev/null
fill "$work/pruebas.env"; fill "$work/produccion.env"; sed -i 's/^SITE_INDEXABLE=$/SITE_INDEXABLE=true/' "$work/produccion.env"

check "pruebas: dominio pruebas.planta14.com" test "$(value SITE_DOMAIN "$work/pruebas.env")" = pruebas.planta14.com
check "pruebas: SITE_INDEXABLE=false" test "$(value SITE_INDEXABLE "$work/pruebas.env")" = false
check "pruebas: sin redirección de www" test "$(value CADDY_WWW_REDIRECT "$work/pruebas.env")" = off
check "pruebas: copias externas bajo planta14/pruebas" test "$(value OFFSITE_PREFIX "$work/pruebas.env")" = planta14/pruebas
check "pruebas: mismos buckets y endpoints reales" bash -c "[[ \$(sed -n 's/^S3_ENDPOINT=//p' '$work/pruebas.env') == https://s3.eu-central-3.ionoscloud.com && \$(sed -n 's/^OFFSITE_ENDPOINT=//p' '$work/pruebas.env') == https://s3.eu-central-4.ionoscloud.com ]]"
check "producción: planta14.com con www y copias bajo planta14/produccion" bash -c "[[ \$(sed -n 's/^SITE_DOMAIN=//p' '$work/produccion.env') == planta14.com && \$(sed -n 's/^CADDY_WWW_REDIRECT=//p' '$work/produccion.env') == on && \$(sed -n 's/^OFFSITE_PREFIX=//p' '$work/produccion.env') == planta14/produccion ]]"
check "plantilla y generador: secretos con permisos 600" test "$(stat -c %a "$work/pruebas.env")" = 600

compose_json() { APP_IMAGE=planta14-app:x docker compose -f "$root/infra/compose.production.yaml" --env-file "$1" config --format json; }
compose_json "$work/pruebas.env" > "$work/pruebas.json"
compose_json "$work/produccion.env" > "$work/produccion.json"
py() { python3 -c "import json,sys; c=json.load(open(sys.argv[1])); print($2)" "$1"; }
check "Compose pruebas: SITE_URL y CMS_SERVER_URL del dominio de prueba" test "$(py "$work/pruebas.json" "c['services']['app']['environment']['SITE_URL'], c['services']['app']['environment']['CMS_SERVER_URL']")" = "https://pruebas.planta14.com https://pruebas.planta14.com"
check "Compose pruebas: SITE_INDEXABLE=false y contenido real (payload)" test "$(py "$work/pruebas.json" "c['services']['app']['environment']['SITE_INDEXABLE'], c['services']['app']['environment']['CONTENT_SOURCE']")" = "false payload"
check "Compose pruebas: Caddy sin www" test "$(py "$work/pruebas.json" "c['services']['caddy']['environment']['CADDY_WWW_REDIRECT']")" = off
check "Compose producción: Caddy con www (valor por defecto)" test "$(py "$work/produccion.json" "c['services']['caddy']['environment']['CADDY_WWW_REDIRECT']")" = on
sed '/^CADDY_WWW_REDIRECT=/d' "$work/produccion.env" > "$work/antiguo.env"
check "Compose con un .env anterior sin CADDY_WWW_REDIRECT: con www" test "$(compose_json "$work/antiguo.env" | python3 -c "import json,sys; print(json.load(sys.stdin)['services']['caddy']['environment']['CADDY_WWW_REDIRECT'])")" = on

hosts() { # DOMINIO WWW: hosts de la configuración de Caddy y destino de la redirección de www
  docker run --rm -e SITE_DOMAIN="$1" -e ACME_EMAIL=info@planta14.com -e CADDY_TLS_MODE=acme -e CADDY_WWW_REDIRECT="$2" \
    -v "$root/infra/Caddyfile.production:/etc/caddy/Caddyfile:ro" "$caddy" caddy adapt --config /etc/caddy/Caddyfile 2>/dev/null \
    | python3 -c "
import json,sys
c=json.load(sys.stdin); out=[]
def walk(o):
    if isinstance(o,dict):
        if 'host' in o and isinstance(o['host'],list): out.extend(o['host'])
        if o.get('handler')=='static_response' and 'Location' in (o.get('headers') or {}): out.append('->'+o['headers']['Location'][0]+' '+str(o.get('status_code')))
        for v in o.values(): walk(v)
    elif isinstance(o,list):
        for v in o: walk(v)
walk(c); print(' '.join(sorted(set(out))))"
}
check "Caddy pruebas: solo pruebas.planta14.com (sin www)" test "$(hosts pruebas.planta14.com off)" = "pruebas.planta14.com"
check "Caddy producción: planta14.com y www → https://planta14.com (301)" test "$(hosts planta14.com on)" = "->https://planta14.com{http.request.uri} 301 planta14.com www.planta14.com"
for mode in acme internal; do
  check "Caddy pruebas válido ($mode)" bash -c "docker run --rm -e SITE_DOMAIN=pruebas.planta14.com -e ACME_EMAIL=info@planta14.com -e CADDY_TLS_MODE=$mode -e CADDY_WWW_REDIRECT=off -v '$root/infra/Caddyfile.production:/etc/caddy/Caddyfile:ro' $caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile 2>&1 | grep -q 'Valid configuration'"
done

init() { # deploy_init con un .env: ACEPTADO o el motivo del rechazo
  DEPLOY_STATE_DIR=$work/state MAINTENANCE_DIR=$work/mantenimiento BACKUP_DIR=$work/backups bash -c "
    source '$root/infra/lib/common.sh'; infra='$root/infra'; source '$root/infra/deploy/lib.sh'; deploy_init '$1' && echo ACEPTADO" 2>&1 | tail -n 1
}
check "despliegue: acepta pruebas.planta14.com con SITE_INDEXABLE=false" test "$(init "$work/pruebas.env")" = ACEPTADO
check "despliegue: acepta planta14.com con SITE_INDEXABLE=true" test "$(init "$work/produccion.env")" = ACEPTADO
sed 's/^SITE_INDEXABLE=.*/SITE_INDEXABLE=true/' "$work/pruebas.env" > "$work/pruebas-indexable.env"; chmod 600 "$work/pruebas-indexable.env"
check "despliegue: se niega a indexar pruebas.planta14.com" bash -c "[[ \"\$(DEPLOY_STATE_DIR='$work/state' MAINTENANCE_DIR='$work/mantenimiento' BACKUP_DIR='$work/backups' bash -c \"source '$root/infra/lib/common.sh'; infra='$root/infra'; source '$root/infra/deploy/lib.sh'; deploy_init '$work/pruebas-indexable.env' && echo ACEPTADO\" 2>&1)\" == *'solo para planta14.com'* ]]"
sed 's/^CADDY_WWW_REDIRECT=.*/CADDY_WWW_REDIRECT=si/' "$work/pruebas.env" > "$work/www-mal.env"; chmod 600 "$work/www-mal.env"
check "despliegue: CADDY_WWW_REDIRECT solo on u off" bash -c "[[ \"\$(DEPLOY_STATE_DIR='$work/state' MAINTENANCE_DIR='$work/mantenimiento' BACKUP_DIR='$work/backups' bash -c \"source '$root/infra/lib/common.sh'; infra='$root/infra'; source '$root/infra/deploy/lib.sh'; deploy_init '$work/www-mal.env' && echo ACEPTADO\" 2>&1)\" == *'on\" u \"off'* ]]"

if (( failures == 0 )); then log "RESULTADO: configuración de pruebas.planta14.com SUPERADA"; else log "RESULTADO: $failures comprobaciones FALLIDAS"; exit 1; fi
