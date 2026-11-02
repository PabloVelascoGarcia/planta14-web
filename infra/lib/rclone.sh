#!/usr/bin/env bash
# rclone configurado por variables de entorno (sin archivo de configuración ni secretos en disco).
# Remotos: "p14" (almacenamiento de la aplicación) y "p14off" (destino de copias fuera del servidor).
# shellcheck shell=bash

# rclone_remote NOMBRE CLAVE SECRETO ENDPOINT REGIÓN PATH_STYLE
rclone_remote() {
  local name=${1^^} key=$2 secret=$3 endpoint=$4 region=$5 path_style=$6
  [[ -n $key && -n $secret ]] || die "Faltan credenciales S3 para el remoto ${1}"
  export "RCLONE_CONFIG_${name}_TYPE=s3" "RCLONE_CONFIG_${name}_PROVIDER=${RCLONE_S3_PROVIDER:-Other}"
  export "RCLONE_CONFIG_${name}_ACCESS_KEY_ID=$key" "RCLONE_CONFIG_${name}_SECRET_ACCESS_KEY=$secret"
  export "RCLONE_CONFIG_${name}_REGION=${region:-us-east-1}" "RCLONE_CONFIG_${name}_ENDPOINT=$endpoint"
  if [[ $path_style == true ]]; then export "RCLONE_CONFIG_${name}_FORCE_PATH_STYLE=true"; else export "RCLONE_CONFIG_${name}_FORCE_PATH_STYLE=false"; fi
  case ${STORAGE_RCLONE:-docker} in
    docker) require_cmd docker ;;
    host) require_cmd rclone ;;
    *) die "STORAGE_RCLONE no válido: ${STORAGE_RCLONE} (docker|host)" ;;
  esac
}

# rclone_setup CLAVE SECRETO: remoto "p14" a partir de S3_*.
rclone_setup() { rclone_remote p14 "$1" "$2" "${S3_ENDPOINT:-}" "${S3_REGION:-}" "${S3_FORCE_PATH_STYLE:-false}"; }

# Remoto "p14off" a partir de OFFSITE_*: destino S3 fuera del servidor. Sin OFFSITE_ACCESS_KEY_ID se usa la
# clave de la aplicación (S3_*): es el caso del Object Storage sencillo de IONOS, con una sola clave del
# propietario. Entonces lo que protege las copias es el bloqueo de objetos (compliance) del bucket de destino.
rclone_setup_offsite() {
  : "${OFFSITE_BUCKET:?Define OFFSITE_BUCKET}"
  local key=${OFFSITE_ACCESS_KEY_ID:-} secret=${OFFSITE_SECRET_ACCESS_KEY:-}
  if [[ -z $key && -z $secret ]]; then
    key=${S3_ACCESS_KEY_ID:-} secret=${S3_SECRET_ACCESS_KEY:-}
    log "Copia externa con la clave de la aplicación (S3_ACCESS_KEY_ID): la protege el bloqueo de objetos del bucket"
  fi
  rclone_remote p14off "$key" "$secret" "${OFFSITE_ENDPOINT:-}" "${OFFSITE_REGION:-}" "${OFFSITE_FORCE_PATH_STYLE:-false}"
}
offsite_path() {
  local prefix=${OFFSITE_PREFIX:-planta14/${COMPOSE_PROJECT_NAME:-planta14-staging}}
  [[ $prefix =~ ^[A-Za-z0-9._/-]*$ && ! $prefix =~ (^|/)\.\.(/|$) ]] || die "OFFSITE_PREFIX no válido"
  printf 'p14off:%s/%s' "$OFFSITE_BUCKET" "${prefix#/}"
}

# Red de salida para trabajos de copia: un puente propio sin otros servicios. Llega a Internet
# (S3 externo), pero no a la red interna "backend" ni a PostgreSQL. Se crea si no existe.
egress_network() {
  local name=${BACKUP_EGRESS_NETWORK:-planta14-backup-egress} internal members pg
  [[ ${STORAGE_RCLONE:-docker} == docker ]] || { printf '%s' "$name"; return; }
  if ! docker network inspect "$name" >/dev/null 2>&1; then
    docker network create --driver bridge --label org.planta14.purpose=backup-egress "$name" >/dev/null || die "No se pudo crear la red $name"
  fi
  internal=$(docker network inspect -f '{{.Internal}}' "$name")
  [[ $internal == false ]] || die "La red $name es interna: no tiene salida a Internet"
  members=$(docker network inspect -f '{{range .Containers}}{{.Name}} {{end}}' "$name")
  pg=${PG_CONTAINER:-$(default_pg_container)}
  [[ " $members " != *" $pg "* ]] || die "PostgreSQL ($pg) está conectado a la red de salida $name; se rechaza"
  printf '%s' "$name"
}

# Red para leer el almacenamiento de la aplicación: la interna si es MinIO del propio Compose,
# la de salida si es un S3 externo. BACKUP_DOCKER_NETWORK la fija explícitamente.
storage_network() {
  if [[ -n ${BACKUP_DOCKER_NETWORK:-} ]]; then printf '%s' "$BACKUP_DOCKER_NETWORK"
  elif [[ ${S3_ENDPOINT:-} =~ ^https?://minio(:[0-9]+)?(/|$) ]]; then printf '%s_backend' "${COMPOSE_PROJECT_NAME:-planta14-staging}"
  else egress_network; fi
}

# run_rclone_on RED DIR_LOCAL[:ro] args...: ejecuta rclone con DIR_LOCAL montado en /work.
# Las credenciales pasan por nombre de variable (-e VAR), no aparecen en la línea de órdenes.
run_rclone_on() {
  local network=$1 mount=$2; shift 2
  local workdir=${mount%:ro} mode=rw
  [[ $mount == *:ro ]] && mode=ro
  if [[ ${STORAGE_RCLONE:-docker} == host ]]; then
    local -a args=()
    local a
    for a in "$@"; do args+=("${a//\/work/$workdir}"); done
    rclone "${args[@]}"
  else
    local -a envs=()
    local v
    while IFS= read -r v; do envs+=(-e "$v"); done < <(compgen -e | grep -E '^RCLONE_CONFIG_P14(OFF)?_')
    # SOLO ENSAYOS (infra/test/offsite-immutable-test.sh): PLANTA14_RCLONE_DUMP=headers registra cada petición
    # HTTP. No usar en producción: el modo detallado de rclone escribe también la clave secreta en el registro.
    [[ -n ${PLANTA14_RCLONE_DUMP:-} ]] && envs+=(-e "RCLONE_DUMP=$PLANTA14_RCLONE_DUMP")
    docker run --rm --network "$network" --memory "${RCLONE_MEM_LIMIT:-256m}" --memory-swap "${RCLONE_MEMSWAP_LIMIT:-384m}" \
      -e RCLONE_TRANSFERS=2 -e RCLONE_CHECKERS=4 -e RCLONE_S3_UPLOAD_CONCURRENCY=2 \
      --user "$(id -u):$(id -g)" -e HOME=/tmp -e RCLONE_CONFIG=/dev/null "${envs[@]}" -v "$workdir:/work:$mode" \
      "${RCLONE_IMAGE:-rclone/rclone:1.71.2@sha256:3103526c506266a9ecdf064efe99bf3677d92ef6407af124d8c56b4f49cbaa51}" "$@"
  fi
}
run_rclone() {
  local workdir=$1 network; shift
  network=$(storage_network) || exit 1
  run_rclone_on "$network" "$workdir" "$@"
}
