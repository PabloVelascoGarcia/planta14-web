#!/usr/bin/env bash
# Refusal must happen before staging-e2e installs its destructive cleanup trap.
set -Eeuo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=SCRIPTDIR/../lib/common.sh
source "$here/../lib/common.sh"
require_cmd docker openssl age age-keygen curl node diff
[[ -z $(docker ps -aq --filter label=com.docker.compose.project=planta14-staging) ]] || die 'Existing staging: guard test refused'
[[ -z $(docker volume ls -q --filter label=com.docker.compose.project=planta14-staging) ]] || die 'Existing staging volumes: guard test refused'
id=p14-guard-$(openssl rand -hex 6)
work=$(mktemp -d)
cleanup() { docker rm "$id" >/dev/null 2>&1 || true; docker volume rm "$id" >/dev/null 2>&1 || true; rm -rf -- "$work"; }
trap cleanup EXIT
docker create --name "$id" --label com.docker.compose.project=planta14-staging \
  "${CADDY_IMAGE:-caddy:2.10.2-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d}" >/dev/null
if bash "$here/staging-e2e.sh" >"$work/container.log" 2>&1; then die 'Existing container accepted'; fi
grep -q 'Ya existe el proyecto' "$work/container.log"
docker inspect "$id" >/dev/null
docker rm "$id" >/dev/null
docker volume create --label com.docker.compose.project=planta14-staging "$id" >/dev/null
if bash "$here/staging-e2e.sh" >"$work/volume.log" 2>&1; then die 'Existing volume accepted'; fi
grep -q 'Hay volúmenes' "$work/volume.log"
docker volume inspect "$id" >/dev/null
echo 'PASS: existing stopped staging container and volume preserved; destructive test refuses both'
