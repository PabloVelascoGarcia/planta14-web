#!/usr/bin/env bash
# Modo preproducción con HTTP real: infra/Caddyfile.production (certificado interno) delante de una "web"
# sustituta (caddy respond) en la red de Compose, sin construir la aplicación:
#   - con PREPRODUCTION_AUTH=on toda la web pide la contraseña común (401 sin ella o con otra; 200 con ella),
#     incluido /cms y la API, salvo /api/health (monitor) y la comprobación de mantenimiento de deploy.sh;
#   - se quita cambiando la variable y recreando solo Caddy: la web (su contenedor) no se reconstruye ni se
#     reinicia;
#   - tras la salida: pruebas.planta14.com redirige a planta14.com conservando la ruta.
# Uso: infra/test/preproduccion-test.sh   (Docker; puertos 127.0.0.1:18443)
set -Eeuo pipefail
SCRIPT_NAME=preproduccion-test
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
root=$(cd "$here/../.." && pwd)
# shellcheck source=SCRIPTDIR/../lib/common.sh
source "$root/infra/lib/common.sh"
require_cmd docker curl openssl
caddy=caddy:2.10.2-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d
id=$(openssl rand -hex 4) net=p14pp-$id app=p14pp-app-$id proxy=p14pp-caddy-$id port=18443
failures=0
check() { local desc=$1; shift; if "$@"; then log "OK    $desc"; else log "FALLO $desc"; failures=$((failures + 1)); fi; }
cleanup() { docker rm -f -v "$app" "$proxy" >/dev/null 2>&1 || true; docker network rm "$net" >/dev/null 2>&1 || true; }
trap cleanup EXIT
password=$(openssl rand -hex 12)
hash=$(docker run --rm "$caddy" caddy hash-password --plaintext "$password")
docker network create "$net" >/dev/null
docker run -d --name "$app" --network "$net" --network-alias app "$caddy" caddy respond --listen :3000 --body 'web sustituta' >/dev/null
start_caddy() { # DOMINIO y variables -e
  local domain=$1; shift
  docker rm -f -v "$proxy" >/dev/null 2>&1 || true
  docker run -d --name "$proxy" --network "$net" -p "127.0.0.1:$port:443" -e SITE_DOMAIN="$domain" -e ACME_EMAIL=info@planta14.com -e CADDY_TLS_MODE=internal "$@" \
    -v "$root/infra/Caddyfile.production:/etc/caddy/Caddyfile:ro" -v /var/log/caddy "$caddy" >/dev/null
  for _ in $(seq 1 40); do [[ $(code "$domain" /api/health) == 200 ]] && return 0; sleep 0.5; done
  docker logs "$proxy" 2>&1 | tail -5 >&2; return 1
}
code() { # DOMINIO RUTA [curl args...]
  local domain=$1 path=$2; shift 2
  curl -sk --noproxy '*' --max-time 5 --resolve "$domain:$port:127.0.0.1" -o /dev/null -w '%{http_code}' "$@" "https://$domain:$port$path" 2>/dev/null || true
}
d=pruebas.planta14.com
start_caddy "$d" -e CADDY_WWW_REDIRECT=off -e PREPRODUCTION_AUTH=on -e PREPRODUCTION_AUTH_USER=planta14 -e "PREPRODUCTION_AUTH_HASH=$hash"
app_started=$(docker inspect -f '{{.State.StartedAt}}' "$app")
check "con contraseña: portada sin credenciales → 401" test "$(code $d /)" = 401
check "con contraseña: pide autenticación básica (WWW-Authenticate)" bash -c "curl -sk --noproxy '*' --resolve '$d:$port:127.0.0.1' -D - -o /dev/null 'https://$d:$port/' | grep -qi '^www-authenticate: basic'"
check "con contraseña: contraseña incorrecta → 401" test "$(code $d / -u planta14:otra)" = 401
check "con contraseña: contraseña común → 200" test "$(code $d / -u "planta14:$password")" = 200
for path in /cms /cms/login /lena/panel /api/cms/users/login /noticia/cualquiera /sitemap.xml /robots.txt; do
  check "con contraseña: $path sin credenciales → 401" test "$(code $d "$path")" = 401
done
check "con contraseña: /api/health abierto al monitor → 200" test "$(code $d /api/health)" = 200
check "con contraseña: la comprobación de mantenimiento de deploy.sh no pide contraseña" test "$(code $d /api/cms/comprobacion-mantenimiento -X POST)" != 401
check "con contraseña: un POST cualquiera sin credenciales → 401" test "$(code $d /api/cms/articles -X POST)" = 401

start_caddy "$d" -e CADDY_WWW_REDIRECT=off -e PREPRODUCTION_AUTH=off -e "PREPRODUCTION_AUTH_HASH=$hash"
check "sin contraseña (PREPRODUCTION_AUTH=off y Caddy recreado): portada → 200" test "$(code $d /)" = 200
check "sin contraseña: /cms → 200" test "$(code $d /cms)" = 200
check "quitarla no reinicia ni reconstruye la web" test "$(docker inspect -f '{{.State.StartedAt}}' "$app")" = "$app_started"

start_caddy planta14.com -e PREPRODUCTION_AUTH=off -e CADDY_PREVIOUS_DOMAIN_REDIRECT=on -e SITE_PREVIOUS_DOMAIN=$d
check "tras la salida: planta14.com sin contraseña → 200" test "$(code planta14.com /)" = 200
check "tras la salida: pruebas.planta14.com/ruta?x=1 → 301 a https://planta14.com/ruta?x=1" bash -c "[[ \$(curl -sk --noproxy '*' --resolve '$d:$port:127.0.0.1' -o /dev/null -w '%{http_code} %{redirect_url}' 'https://$d:$port/noticia/una?x=1') == '301 https://planta14.com/noticia/una?x=1' ]]"
check "tras la salida: www.planta14.com → 301 a planta14.com" bash -c "[[ \$(curl -sk --noproxy '*' --resolve 'www.planta14.com:$port:127.0.0.1' -o /dev/null -w '%{http_code}' 'https://www.planta14.com:$port/') == 301 ]]"

if (( failures == 0 )); then log "RESULTADO: modo preproducción SUPERADO"; else log "RESULTADO: $failures comprobaciones FALLIDAS"; exit 1; fi
