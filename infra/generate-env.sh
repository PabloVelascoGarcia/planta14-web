#!/usr/bin/env bash
# Genera un archivo de entorno de staging a partir de .env.staging.example con secretos aleatorios.
# Uso: infra/generate-env.sh DOMINIO CADDY_TLS [SALIDA]
#   DOMINIO    p. ej. staging.example.org (o localhost para pruebas locales)
#   CADDY_TLS  email para Let's Encrypt, o "internal"
#   SALIDA     por defecto infra/.env.staging (ignorado por Git). No sobrescribe un archivo existente.
set -Eeuo pipefail
umask 077
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
[[ $# -ge 2 && $# -le 3 ]] || { echo "Uso: $0 DOMINIO CADDY_TLS [SALIDA]" >&2; exit 2; }
domain=$1 tls=$2 out=${3:-$here/.env.staging}
[[ -e $out ]] && { echo "Ya existe $out; no se sobrescribe." >&2; exit 1; }
command -v openssl >/dev/null || { echo "Falta openssl" >&2; exit 1; }
[[ -n ${CADDY_BASIC_AUTH_HASH:-} ]] || { echo 'Define CADDY_BASIC_AUTH_HASH con el resultado de caddy hash-password antes de generar el entorno.' >&2; exit 1; }
[[ $CADDY_BASIC_AUTH_HASH =~ ^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$ ]] || { echo 'CADDY_BASIC_AUTH_HASH debe ser un hash bcrypt válido.' >&2; exit 1; }
[[ $domain =~ ^[A-Za-z0-9][A-Za-z0-9.:-]*$ ]] || { echo 'Dominio no válido.' >&2; exit 1; }
[[ $tls == internal || $tls =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$ ]] || { echo 'CADDY_TLS debe ser internal o un email.' >&2; exit 1; }
rand() { openssl rand -hex "$1"; }

declare -A values=(
  [STAGING_DOMAIN]=$domain
  [CADDY_TLS]=$tls
  [CADDY_BASIC_AUTH_HASH]=$CADDY_BASIC_AUTH_HASH
  [PAYLOAD_SECRET]=$(rand 32)
  [POSTGRES_PASSWORD]=$(rand 24)
  [S3_ACCESS_KEY_ID]=planta14app$(rand 4)
  [S3_SECRET_ACCESS_KEY]=$(rand 24)
  [MINIO_ROOT_USER]=planta14root$(rand 4)
  [MINIO_ROOT_PASSWORD]=$(rand 24)
)
while IFS= read -r line || [[ -n $line ]]; do
  key=${line%%=*}
  if [[ $line =~ ^[A-Z_0-9]+=$ && -n ${values[$key]:-} ]]; then
    if [[ $key == CADDY_BASIC_AUTH_HASH ]]; then
      printf "%s='%s'\n" "$key" "${values[$key]}"
    else
      printf '%s=%s\n' "$key" "${values[$key]}"
    fi
  else
    printf '%s\n' "$line"
  fi
done < "$here/.env.staging.example" > "$out"
echo "Creado $out (permisos 600). Guárdalo en un gestor de secretos; no lo subas a Git." >&2
