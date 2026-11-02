#!/usr/bin/env bash
# Ensayo de infra/server en una máquina Ubuntu DESECHABLE (modifica el sistema: paquetes, usuario, SSH, fail2ban).
# Ejecuta setup-server.sh dos veces (la segunda no debe cambiar nada) y después check-server.sh.
# Sin systemd (p. ej. un contenedor) se omiten cortafuegos y servicios; en un servidor real se comprueban.
# Uso: PLANTA14_SERVER_TEST_ON_THIS_MACHINE=si sudo -E infra/test/server-setup-test.sh [MUESTRA_CADDY.log]
set -Eeuo pipefail
[[ ${PLANTA14_SERVER_TEST_ON_THIS_MACHINE:-} == si ]] || { echo "Este ensayo modifica esta máquina. Confirma con PLANTA14_SERVER_TEST_ON_THIS_MACHINE=si" >&2; exit 2; }
[[ $(id -u) == 0 ]] || { echo "Ejecuta como root" >&2; exit 2; }
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
server=$(cd "$here/../server" && pwd)
work=$(mktemp -d); trap 'rm -rf -- "$work"' EXIT
user=planta14ensayo
ssh-keygen -q -t ed25519 -N '' -C ensayo -f "$work/clave" 2>/dev/null || { apt-get install -y -qq openssh-client >/dev/null; ssh-keygen -q -t ed25519 -N '' -C ensayo -f "$work/clave"; }
failures=0
step() { local desc=$1; shift; if "$@"; then echo "OK    $desc"; else echo "FALLO $desc"; failures=$((failures + 1)); fi; }

echo "== Primera ejecución"
bash "$server/setup-server.sh" --admin-user "$user" --ssh-key "$work/clave.pub" | tee "$work/run1.log" | grep -E 'CAMBIO|OMITIDO|Terminado|ERROR'
step "primera ejecución hace cambios" bash -c "grep -q 'Terminado: [1-9][0-9]* cambios' '$work/run1.log'"
echo "== Segunda ejecución (debe ser idempotente)"
bash "$server/setup-server.sh" --admin-user "$user" --ssh-key "$work/clave.pub" > "$work/run2.log"
grep -E 'CAMBIO|Terminado' "$work/run2.log"
step "segunda ejecución: 0 cambios" grep -q 'Terminado: 0 cambios' "$work/run2.log"
step "la clave no se duplica" test "$(grep -c ensayo "/home/$user/.ssh/authorized_keys")" = 1
echo "== Sin clave SSH, no se desactivan las contraseñas"
step "se niega a crear un usuario sin clave" bash -c "! bash '$server/setup-server.sh' --admin-user planta14sinclave >/dev/null 2>&1"
userdel -r planta14sinclave >/dev/null 2>&1 || true
echo "== Comprobación"
bash "$server/check-server.sh" --admin-user "$user" | tee "$work/check.log"
step "check-server sin fallos" grep -q 'RESULTADO: servidor preparado' "$work/check.log"
if [[ -n ${1:-} && -s $1 ]]; then
  echo "== fail2ban con logins reales de Caddy de producción ($1)"
  fail2ban-regex "$1" /etc/fail2ban/filter.d/planta14-login.conf > "$work/regex.log" || true
  grep -E '^Lines:|Failregex:' "$work/regex.log"
  failed=$(grep -c '"status":401' "$1")
  step "el filtro detecta los $failed logins fallidos reales" grep -qE "^Failregex: $failed total" "$work/regex.log"
fi
if (( failures == 0 )); then echo "RESULTADO: preparación del servidor SUPERADA"; else echo "RESULTADO: $failures FALLIDAS"; exit 1; fi
