#!/usr/bin/env bash
# Configuración de rclone por variables de entorno (sin archivo de configuración ni secretos en disco).
# shellcheck shell=bash

# rclone_setup ACCESS_KEY SECRET_KEY: prepara el remoto "p14" a partir de S3_*.
rclone_setup() {
  local key=$1 secret=$2
  [[ -n $key && -n $secret ]] || die "Faltan credenciales S3 para rclone"
  export RCLONE_CONFIG_P14_TYPE=s3
  export RCLONE_CONFIG_P14_PROVIDER=${RCLONE_S3_PROVIDER:-Other}
  export RCLONE_CONFIG_P14_ACCESS_KEY_ID=$key
  export RCLONE_CONFIG_P14_SECRET_ACCESS_KEY=$secret
  export RCLONE_CONFIG_P14_REGION=${S3_REGION:-us-east-1}
  export RCLONE_CONFIG_P14_ENDPOINT=${S3_ENDPOINT:-}
  if [[ ${S3_FORCE_PATH_STYLE:-false} == true ]]; then
    export RCLONE_CONFIG_P14_FORCE_PATH_STYLE=true
  else
    export RCLONE_CONFIG_P14_FORCE_PATH_STYLE=false
  fi
  case ${STORAGE_RCLONE:-docker} in
    docker) require_cmd docker ;;
    host) require_cmd rclone ;;
    *) die "STORAGE_RCLONE no válido: ${STORAGE_RCLONE} (docker|host)" ;;
  esac
}

# run_rclone DIR_LOCAL args...: ejecuta rclone con DIR_LOCAL montado en /work.
# Las credenciales pasan por nombre de variable (-e VAR), no aparecen en la línea de órdenes.
run_rclone() {
  local workdir=$1; shift
  if [[ ${STORAGE_RCLONE:-docker} == host ]]; then
    local -a args=()
    local a
    for a in "$@"; do args+=("${a//\/work/$workdir}"); done
    rclone "${args[@]}"
  else
    local -a envs=() v
    for v in TYPE PROVIDER ACCESS_KEY_ID SECRET_ACCESS_KEY REGION ENDPOINT FORCE_PATH_STYLE; do
      envs+=(-e "RCLONE_CONFIG_P14_$v")
    done
    docker run --rm --network "${BACKUP_DOCKER_NETWORK:-planta14-staging_backend}" \
      --user "$(id -u):$(id -g)" -e HOME=/tmp -e RCLONE_CONFIG=/dev/null "${envs[@]}" -v "$workdir:/work" \
      "${RCLONE_IMAGE:-rclone/rclone:1.71.2}" "$@"
  fi
}
