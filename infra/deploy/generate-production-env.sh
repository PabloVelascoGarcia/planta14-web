#!/usr/bin/env bash
# Crea infra/.env.production a partir de infra/.env.production.example con secretos aleatorios (permisos 600).
# Deja vacíos, para rellenarlos a mano, los datos de proveedores (S3, copia externa, correo), la clave pública
# de las copias y la decisión SITE_INDEXABLE.
# Uso: infra/deploy/generate-production-env.sh [--pruebas] CORREO_ACME [SALIDA]
#   --pruebas  instalación de prueba en pruebas.planta14.com: SITE_INDEXABLE=false (fijo), sin redirección
#              de www y copias externas bajo planta14/pruebas. Para pasar luego a planta14.com, ver
#              docs/PUESTA-EN-MARCHA-IONOS.md, apartado 7.
set -Eeuo pipefail
umask 077
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
infra=$(cd "$here/.." && pwd)
pruebas=0
[[ ${1:-} == --pruebas ]] && { pruebas=1; shift; }
[[ $# -ge 1 && $# -le 2 ]] || { echo "Uso: $0 [--pruebas] CORREO_ACME [SALIDA]" >&2; exit 2; }
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
# Valores que sustituyen a los de la plantilla aunque ya tengan uno (instalación de prueba).
declare -A overrides=()
if (( pruebas )); then
  overrides=([SITE_DOMAIN]=pruebas.planta14.com [SITE_INDEXABLE]=false [CADDY_WWW_REDIRECT]=off [OFFSITE_PREFIX]=planta14/pruebas)
fi
while IFS= read -r line || [[ -n $line ]]; do
  key=${line%%=*}
  if [[ $line =~ ^[A-Z_0-9]+= && -n ${overrides[$key]:-} ]]; then printf '%s=%s\n' "$key" "${overrides[$key]}"
  elif [[ $line =~ ^[A-Z_0-9]+=$ && -n ${values[$key]:-} ]]; then printf '%s=%s\n' "$key" "${values[$key]}"; else printf '%s\n' "$line"; fi
done < "$infra/.env.production.example" > "$out"
chmod 600 "$out"
if (( pruebas )); then
  echo "Creado $out para pruebas.planta14.com (SITE_INDEXABLE=false). Rellena la clave de Object Storage (S3_ACCESS_KEY_ID y S3_SECRET_ACCESS_KEY), BACKUP_AGE_RECIPIENT y el correo. Guarda una copia en el gestor de contraseñas." >&2
else
  echo "Creado $out. Rellena la clave de Object Storage (S3_ACCESS_KEY_ID y S3_SECRET_ACCESS_KEY), BACKUP_AGE_RECIPIENT, el correo y SITE_INDEXABLE. Guarda una copia en el gestor de contraseñas." >&2
fi
