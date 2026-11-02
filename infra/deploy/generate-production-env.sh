#!/usr/bin/env bash
# Crea infra/.env.production a partir de infra/.env.production.example con secretos aleatorios (permisos 600).
# Deja vacíos, para rellenarlos a mano, los datos de proveedores (S3, copia externa, correo), la clave pública
# de las copias y la decisión SITE_INDEXABLE.
# Uso: infra/deploy/generate-production-env.sh CORREO_ACME [SALIDA]
set -Eeuo pipefail
umask 077
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
infra=$(cd "$here/.." && pwd)
[[ $# -ge 1 && $# -le 2 ]] || { echo "Uso: $0 CORREO_ACME [SALIDA]" >&2; exit 2; }
email=$1 out=${2:-$infra/.env.production}
[[ $email =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || { echo "Correo no válido" >&2; exit 2; }
[[ -e $out ]] && { echo "Ya existe $out; no se sobrescribe." >&2; exit 1; }
rand() { openssl rand -hex "$1"; }
declare -A values=(
  [ACME_EMAIL]=$email
  [PAYLOAD_SECRET]=$(rand 32)
  [POSTGRES_PASSWORD]=$(rand 24)
  [POSTGRES_MIGRATOR_PASSWORD]=$(rand 24)
  [POSTGRES_APP_PASSWORD]=$(rand 24)
)
while IFS= read -r line || [[ -n $line ]]; do
  key=${line%%=*}
  if [[ $line =~ ^[A-Z_0-9]+=$ && -n ${values[$key]:-} ]]; then printf '%s=%s\n' "$key" "${values[$key]}"; else printf '%s\n' "$line"; fi
done < "$infra/.env.production.example" > "$out"
chmod 600 "$out"
echo "Creado $out. Rellena S3_*, PUBLIC_MEDIA_*, OFFSITE_*, BACKUP_AGE_RECIPIENT, correo y SITE_INDEXABLE. Guarda una copia en el gestor de contraseñas." >&2
