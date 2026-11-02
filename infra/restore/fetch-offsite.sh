#!/usr/bin/env bash
# Descarga una copia (y su .sha256) desde el destino externo para restaurarla después con
# restore-postgres.sh o restore-storage.sh. No restaura nada por sí mismo.
#
# Uso: infra/restore/fetch-offsite.sh [--env-file F] postgres|storage NOMBRE|--latest DIRECTORIO_DESTINO
# Imprime la ruta local del archivo descargado.
set -Eeuo pipefail
SCRIPT_NAME=fetch-offsite
# shellcheck source=SCRIPTDIR/../lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/../lib/common.sh"
# shellcheck source=SCRIPTDIR/../lib/rclone.sh
source "$(dirname "${BASH_SOURCE[0]}")/../lib/rclone.sh"

if [[ ${1:-} == --env-file ]]; then load_env_file "${2:?Falta la ruta tras --env-file}"; shift 2; fi
[[ $# -eq 3 ]] || die "Uso: $0 [--env-file F] postgres|storage NOMBRE|--latest DIRECTORIO_DESTINO"
kind=$1 name=$2 dest=$3
[[ $kind == postgres || $kind == storage ]] || die "Tipo no válido: $kind"
[[ -d $dest && ! -L $dest ]] || die "El destino debe ser un directorio existente: $dest"
rclone_setup_offsite
network=$(egress_network) || exit 1
remote="$(offsite_path)/$kind" || exit 1

if [[ $name == --latest ]]; then
  name=$(run_rclone_on "$network" "$dest" lsf --files-only "$remote" --exclude '*.sha256' --exclude '*.partial' | grep -E "^planta14-$kind-" | sort | tail -n 1)
  [[ -n $name ]] || die "No hay copias de $kind en $remote"
fi
[[ $name =~ ^planta14-$kind-[A-Za-z0-9._-]+$ && $name != *..* ]] || die "Nombre de copia no válido: $name"
[[ ! -e $dest/$name && ! -e $dest/$name.sha256 ]] || die "Ya existe $dest/$name; no se sobrescribe"
log "Descargando $remote/$name"
run_rclone_on "$network" "$dest" copyto "$remote/$name" "/work/$name"
run_rclone_on "$network" "$dest" copyto "$remote/$name.sha256" "/work/$name.sha256" || die "El destino no tiene $name.sha256"
printf '%s\n' "$dest/$name"
