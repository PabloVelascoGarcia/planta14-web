#!/usr/bin/env bash
# Comprueba que el servidor está preparado como deja infra/server/setup-server.sh. Solo lee; no cambia nada.
# Uso: sudo bash infra/server/check-server.sh [--admin-user planta14]
# Sale con 0 si todo está bien; con 1 si algo falla. OMITIDO = no comprobable aquí (p. ej. sin systemd).
set -Euo pipefail
admin_user=planta14
[[ ${1:-} == --admin-user ]] && admin_user=${2:?}
fails=0
pass() { printf 'OK       %s\n' "$*"; }
fail() { printf 'FALLO    %s\n' "$*"; fails=$((fails + 1)); }
skip() { printf 'OMITIDO  %s\n' "$*"; }
check() { local desc=$1; shift; if "$@" >/dev/null 2>&1; then pass "$desc"; else fail "$desc"; fi; }
has_systemd() { [[ -d /run/systemd/system ]]; }
[[ $(id -u) == 0 ]] || { echo "Ejecuta como root (sudo)"; exit 2; }

# shellcheck disable=SC1091
. /etc/os-release
check "Ubuntu ($PRETTY_NAME)" test "$ID" = ubuntu
check "zona horaria Europe/Madrid" test "$(readlink -f /etc/localtime)" = /usr/share/zoneinfo/Europe/Madrid
check "usuario $admin_user existe" id -u "$admin_user"
check "$admin_user no tiene contraseña utilizable (solo clave)" bash -c "passwd -S '$admin_user' | awk '{print \$2}' | grep -qx L"
admin_home=$(getent passwd "$admin_user" | cut -d: -f6)
check "$admin_user tiene al menos una clave SSH" test -s "$admin_home/.ssh/authorized_keys"
check "permisos de ~/.ssh (700/600)" bash -c "[[ \$(stat -c %a '$admin_home/.ssh') == 700 && \$(stat -c %a '$admin_home/.ssh/authorized_keys') == 600 ]]"
check "$admin_user puede usar sudo" bash -c "sudo -l -U '$admin_user' | grep -q 'NOPASSWD: ALL'"
effective=$(sshd -T 2>/dev/null)
check "SSH: sin contraseñas" grep -qx 'passwordauthentication no' <<< "$effective"
check "SSH: sin teclado interactivo" grep -qx 'kbdinteractiveauthentication no' <<< "$effective"
check "SSH: root no puede entrar" grep -qx 'permitrootlogin no' <<< "$effective"
check "SSH: solo $admin_user" grep -qx "allowusers $admin_user" <<< "$effective"
check "actualizaciones automáticas activadas" grep -q 'Unattended-Upgrade "1"' /etc/apt/apt.conf.d/20auto-upgrades
check "actualizaciones de seguridad incluidas" bash -c "apt-config dump | grep -q 'Unattended-Upgrade::Allowed-Origins::.*security'"
check "Docker instalado" docker --version
check "Docker Compose instalado" docker compose version
check "rotación de registros de Docker" grep -q '"max-size": "10m"' /etc/docker/daemon.json
check "$admin_user en el grupo docker" bash -c "id -nG '$admin_user' | tr ' ' '\n' | grep -qx docker"
check "filtro fail2ban de logins" test -f /etc/fail2ban/filter.d/planta14-login.conf
check "jaulas fail2ban sshd y planta14-login" bash -c "grep -q '^\[sshd\]' /etc/fail2ban/jail.d/planta14.local && grep -q '^\[planta14-login\]' /etc/fail2ban/jail.d/planta14.local"
# El filtro debe reconocer un login fallido real de Caddy y no uno correcto.
sample=$(mktemp)
printf '%s\n' '{"level":"info","ts":1793625000.1,"logger":"http.log.access.log0","msg":"handled request","request":{"remote_ip":"203.0.113.7","remote_port":"51515","client_ip":"203.0.113.7","proto":"HTTP/2.0","method":"POST","host":"planta14.com","uri":"/api/cms/users/login","headers":{}},"bytes_read":60,"user_id":"","duration":0.2,"size":70,"status":401,"resp_headers":{}}' \
  '{"level":"info","ts":1793625001.1,"logger":"http.log.access.log0","msg":"handled request","request":{"remote_ip":"203.0.113.8","remote_port":"51516","client_ip":"203.0.113.8","proto":"HTTP/2.0","method":"POST","host":"planta14.com","uri":"/api/cms/users/login","headers":{}},"bytes_read":60,"user_id":"","duration":0.2,"size":900,"status":200,"resp_headers":{}}' > "$sample"
check "fail2ban reconoce un login fallido (y no uno correcto)" bash -c "fail2ban-regex '$sample' /etc/fail2ban/filter.d/planta14-login.conf | grep -q 'Lines: 2 lines, 0 ignored, 1 matched'"
rm -f "$sample"
for dir in /srv/planta14 /var/backups/planta14 /var/log/planta14/caddy; do check "carpeta $dir" test -d "$dir"; done
check "copias en carpeta privada (700)" test "$(stat -c %a /var/backups/planta14)" = 700
if has_systemd; then
  status=$(ufw status verbose 2>/dev/null)
  check "cortafuegos activo, entrada denegada por defecto" bash -c "grep -q 'Status: active' <<< \"$status\" && grep -q 'deny (incoming)' <<< \"$status\""
  check "cortafuegos: 22 (limitado), 80 y 443" bash -c "grep -qE '^22/tcp +LIMIT' <<< \"$status\" && grep -qE '^80/tcp +ALLOW' <<< \"$status\" && grep -qE '^443 +ALLOW' <<< \"$status\""
  for unit in ssh docker fail2ban unattended-upgrades cron; do check "servicio $unit activo" systemctl is-active --quiet "$unit"; done
  check "fail2ban: jaula sshd activa" fail2ban-client status sshd
  check "fail2ban: jaula planta14-login activa" fail2ban-client status planta14-login
  check "swap >= 4 GiB" test "$(swapon --show --bytes --noheadings --output SIZE | awk '{s+=$1} END {printf "%.0f", s+0}')" -ge 4294967296
else
  skip "cortafuegos, servicios activos, jaulas en marcha y swap (sin systemd)"
fi
if (( fails == 0 )); then echo "RESULTADO: servidor preparado"; else echo "RESULTADO: $fails comprobaciones fallidas"; exit 1; fi
