#!/usr/bin/env bash
# Preparación del servidor de producción de Planta 14 (Ubuntu LTS). Se puede repetir sin efectos: cada paso
# comprueba el estado y solo cambia lo necesario; al final dice cuántos cambios ha hecho.
#
# Uso (como root, en el servidor recién creado):
#   bash infra/server/setup-server.sh --admin-user planta14 --ssh-key /root/clave_pablo.pub
# Después: bash infra/server/check-server.sh --admin-user planta14
#
# Hace: usuario administrador sin root (sudo y docker), SSH solo con clave y sin root, cortafuegos (22, 80, 443),
# actualizaciones de seguridad automáticas, fail2ban (SSH y logins de /cms), Docker oficial con rotación de
# registros, zona horaria Europe/Madrid, carpetas de despliegue, copias y registros, y swap si no hay.
# PLANTA14_SETUP_NO_SERVICES=1 omite arrancar servicios (solo para ensayos en contenedores sin systemd).
set -Eeuo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
files=$here/files
admin_user=planta14 ssh_key='' timezone=Europe/Madrid swap_size=4G
while [[ $# -gt 0 ]]; do
  case $1 in
    --admin-user) admin_user=${2:?}; shift 2 ;;
    --ssh-key) ssh_key=${2:?}; shift 2 ;;
    --timezone) timezone=${2:?}; shift 2 ;;
    --swap) swap_size=${2:?}; shift 2 ;;
    -h|--help) sed -n '2,13p' "$0"; exit 0 ;;
    *) echo "Opción no reconocida: $1" >&2; exit 2 ;;
  esac
done
changes=0
log() { printf '%s %s\n' "$(date '+%H:%M:%S')" "$*"; }
changed() { changes=$((changes + 1)); log "CAMBIO  $*"; }
ok() { log "YA      $*"; }
die() { log "ERROR   $*" >&2; exit 1; }
services() { [[ ${PLANTA14_SETUP_NO_SERVICES:-0} != 1 ]] && [[ -d /run/systemd/system ]]; }
# install_file ORIGEN DESTINO MODO: copia solo si cambia.
install_file() {
  if [[ -f $2 ]] && cmp -s "$1" "$2"; then ok "$2"; return 1; fi
  install -D -m "$3" "$1" "$2"; changed "$2"; return 0
}

[[ $(id -u) == 0 ]] || die "Ejecuta como root (sudo bash $0 ...)"
# shellcheck disable=SC1091
. /etc/os-release
[[ ${ID:-} == ubuntu ]] || die "Pensado para Ubuntu LTS (detectado: ${ID:-desconocido})"
[[ $admin_user =~ ^[a-z][a-z0-9_-]{1,30}$ ]] || die "Nombre de usuario no válido: $admin_user"
# Reject missing/invalid keys BEFORE changing users, sudoers or SSH. Accept Windows CRLF public keys.
if [[ -n $ssh_key ]]; then
  [[ -s $ssh_key ]] || die "No existe una clave pública no vacía en $ssh_key"
  valid_keys=0
  while IFS= read -r line || [[ -n $line ]]; do
    line=${line%$'\r'}
    [[ -z $line ]] && continue
    [[ $line =~ ^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp[0-9]+|sk-ssh-ed25519@openssh.com)\ [A-Za-z0-9+/=]+ ]] || die 'Formato de clave pública SSH no válido'
    valid_keys=$((valid_keys + 1))
  done < "$ssh_key"
  (( valid_keys > 0 )) || die 'No hay ninguna clave pública SSH'
else
  existing_home=$(getent passwd "$admin_user" | cut -d: -f6 || true)
  [[ -n $existing_home && -s $existing_home/.ssh/authorized_keys ]] || die 'Pasa --ssh-key antes de preparar un usuario nuevo'
fi
[[ $timezone =~ ^[A-Za-z_]+/[A-Za-z_]+$ && -e /usr/share/zoneinfo/$timezone || ! -d /usr/share/zoneinfo ]] || die "Zona horaria no válida: $timezone"
log "Ubuntu $VERSION_ID · usuario $admin_user · zona $timezone"
export DEBIAN_FRONTEND=noninteractive

# 1. Paquetes base
packages=(ca-certificates curl gnupg git ufw fail2ban unattended-upgrades apt-listchanges age cron logrotate openssh-server tzdata sudo iptables python3-systemd)
missing=()
for p in "${packages[@]}"; do dpkg-query -W -f='${Status}' "$p" 2>/dev/null | grep -q 'install ok installed' || missing+=("$p"); done
if (( ${#missing[@]} )); then apt-get update -qq; apt-get install -y -qq --no-install-recommends "${missing[@]}" >/dev/null; changed "paquetes: ${missing[*]}"; else ok "paquetes base"; fi

# 2. Zona horaria
if [[ $(cat /etc/timezone 2>/dev/null) != "$timezone" || $(readlink -f /etc/localtime) != "/usr/share/zoneinfo/$timezone" ]]; then
  if services && command -v timedatectl >/dev/null; then timedatectl set-timezone "$timezone"; fi
  ln -sf "/usr/share/zoneinfo/$timezone" /etc/localtime; echo "$timezone" > /etc/timezone
  changed "zona horaria $timezone"
else ok "zona horaria $timezone"; fi

# 3. Usuario administrador (sin contraseña: entra con clave; sudo sin contraseña para operar)
if ! id -u "$admin_user" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$admin_user"; passwd -l "$admin_user" >/dev/null; changed "usuario $admin_user"
else ok "usuario $admin_user"; fi
sudoers=$(mktemp); printf '%s ALL=(ALL) NOPASSWD:ALL\n' "$admin_user" > "$sudoers"
visudo -cf "$sudoers" >/dev/null || die "sudoers no válido"
install_file "$sudoers" "/etc/sudoers.d/90-planta14" 0440 || true; rm -f "$sudoers"
admin_home=$(getent passwd "$admin_user" | cut -d: -f6)
install -d -m 700 -o "$admin_user" -g "$admin_user" "$admin_home/.ssh"
keys=$admin_home/.ssh/authorized_keys
touch "$keys"; chown "$admin_user:$admin_user" "$keys"; chmod 600 "$keys"
if [[ -n $ssh_key ]]; then
  [[ -f $ssh_key ]] || die "No existe la clave pública $ssh_key"
  while IFS= read -r line; do
    line=${line%$'\r'}
    [[ $line =~ ^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp[0-9]+|sk-ssh-ed25519@openssh.com)\ [A-Za-z0-9+/=]+ ]] || die "La clave $ssh_key no parece una clave pública SSH"
    if grep -qxF "$line" "$keys"; then ok "clave SSH ya autorizada"; else echo "$line" >> "$keys"; changed "clave SSH autorizada para $admin_user"; fi
  done < <(grep -v '^\s*$' "$ssh_key")
fi
[[ -s $keys ]] || die "El usuario $admin_user no tiene ninguna clave SSH: pasa --ssh-key. No se desactivan las contraseñas sin una clave."

# 4. SSH: solo clave, sin root (se valida antes de recargar para no perder el acceso)
sshd_conf=$(mktemp); sed "s/__ADMIN_USER__/$admin_user/" "$files/sshd-00-planta14.conf" > "$sshd_conf"
if install_file "$sshd_conf" /etc/ssh/sshd_config.d/00-planta14.conf 0644; then
  mkdir -p /run/sshd; ssh-keygen -A >/dev/null
  sshd -t || { rm -f /etc/ssh/sshd_config.d/00-planta14.conf; die "Configuración SSH no válida; se deja como estaba"; }
  if services; then systemctl reload ssh 2>/dev/null || systemctl reload sshd; fi
fi
rm -f "$sshd_conf"

# 5. Actualizaciones de seguridad automáticas
install_file "$files/apt-20auto-upgrades" /etc/apt/apt.conf.d/20auto-upgrades 0644 || true
install_file "$files/apt-52planta14-unattended-upgrades" /etc/apt/apt.conf.d/52planta14-unattended-upgrades 0644 || true
if services; then systemctl enable --now unattended-upgrades >/dev/null 2>&1 || true; fi

# 6. Docker (repositorio oficial)
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${UBUNTU_CODENAME:-$VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
  changed "Docker $(docker --version | cut -d, -f1)"
else ok "Docker $(docker --version | cut -d, -f1)"; fi
if install_file "$files/docker-daemon.json" /etc/docker/daemon.json 0644 && services; then systemctl restart docker; fi
if id -nG "$admin_user" | tr ' ' '\n' | grep -qx docker; then ok "$admin_user en el grupo docker"; else usermod -aG docker "$admin_user"; changed "$admin_user en el grupo docker"; fi
if services; then systemctl enable --now docker >/dev/null 2>&1 || true; fi

# 7. Carpetas
for spec in "/srv/planta14 755 $admin_user" "/var/backups/planta14 700 $admin_user" "/var/log/planta14 755 $admin_user" "/var/log/planta14/caddy 755 root"; do
  read -r dir mode owner <<< "$spec"
  if [[ -d $dir && $(stat -c '%a %U' "$dir") == "$mode $owner" ]]; then ok "$dir"; else install -d -m "$mode" -o "$owner" "$dir"; changed "$dir ($mode, $owner)"; fi
done
[[ -e /var/log/planta14/caddy/access.log ]] || { touch /var/log/planta14/caddy/access.log; changed "registro de accesos de Caddy"; }

# 8. fail2ban (SSH y logins de /cms y paneles municipales)
install_file "$files/fail2ban-filter-planta14-login.conf" /etc/fail2ban/filter.d/planta14-login.conf 0644 && f2b=1 || f2b=0
if install_file "$files/fail2ban-jail-planta14.local" /etc/fail2ban/jail.d/planta14.local 0644; then f2b=1; fi
if services; then
  systemctl enable fail2ban >/dev/null 2>&1 || true
  if (( f2b )) || ! systemctl is-active --quiet fail2ban; then systemctl restart fail2ban; fi
fi

# 9. Cortafuegos: solo 22, 80 y 443 (los puertos publicados por Docker solo son 80/443, de Caddy)
if services; then
  rules=$(ufw status verbose 2>/dev/null || true)
  if grep -q 'Status: active' <<< "$rules" && grep -q 'deny (incoming)' <<< "$rules" \
     && grep -qE '^22/tcp +LIMIT' <<< "$rules" && grep -qE '^80/tcp +ALLOW' <<< "$rules" && grep -qE '^443 +ALLOW|^443/tcp +ALLOW' <<< "$rules"; then
    ok "cortafuegos (22, 80, 443)"
  else
    ufw default deny incoming >/dev/null; ufw default allow outgoing >/dev/null
    ufw limit 22/tcp >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443 >/dev/null
    ufw --force enable >/dev/null
    changed "cortafuegos: entrada denegada salvo 22 (limitado), 80 y 443"
  fi
else log "OMITIDO cortafuegos (sin systemd: ensayo en contenedor)"; fi

# 10. VPS M+: ensure at least 4 GiB swap without turning off an active swap file.
if [[ -n $swap_size && $swap_size != 0 ]] && services; then
  target=$(numfmt --from=iec "$swap_size")
  available=$(swapon --show --bytes --noheadings --output SIZE | awk '{s+=$1} END {printf "%.0f", s+0}')
  if (( available >= target )); then ok "swap >= $swap_size"
  else
    swapfile=/swapfile-planta14
    [[ ! -e $swapfile && ! -L $swapfile ]] || die "$swapfile ya existe sin completar el swap requerido; revisa antes de modificarlo"
    fallocate -l "$((target - available))" "$swapfile" && chmod 600 "$swapfile" && mkswap "$swapfile" >/dev/null && swapon "$swapfile"
    grep -q "^$swapfile " /etc/fstab || echo "$swapfile none swap sw 0 0" >> /etc/fstab
    changed "swap de $swap_size"
  fi
fi

log "Terminado: $changes cambios. Comprueba con: bash infra/server/check-server.sh --admin-user $admin_user"
log "IMPORTANTE: antes de cerrar esta sesión, abre otra con 'ssh $admin_user@<IP>' y comprueba que entras."
