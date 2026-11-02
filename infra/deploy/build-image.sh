#!/usr/bin/env bash
# Bounded BuildKit, separate from the running web. Context and image tag are mandatory.
set -Eeuo pipefail
[[ $# == 2 ]] || { echo 'Uso: build-image.sh CONTEXTO ETIQUETA' >&2; exit 2; }
builder=planta14-build
memory=${BUILD_MEMORY_BYTES:-1342177280} swap=${BUILD_MEMORY_SWAP_BYTES:-2684354560}
exec 7>"${TMPDIR:-/tmp}/planta14-build.lock"
flock -n 7 || { echo 'Ya hay una construcción en curso' >&2; exit 1; }
# Recreate to guarantee the limits are applied, including after configuration changes.
docker buildx rm --keep-state "$builder" >/dev/null 2>&1 || true
extra=()
[[ -n ${BUILD_CGROUP_PARENT:-} ]] && extra+=(--driver-opt "cgroup-parent=$BUILD_CGROUP_PARENT")
docker buildx create --name "$builder" --driver docker-container \
  --driver-opt "memory=$memory,memory-swap=$swap,cpu-period=100000,cpu-quota=200000" "${extra[@]}" >/dev/null
trap 'docker buildx stop "$builder" >/dev/null 2>&1 || true' EXIT
docker buildx build --builder "$builder" --load --progress plain \
  -f "$1/infra/app.Dockerfile" -t "$2" "$1"
