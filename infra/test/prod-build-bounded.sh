#!/usr/bin/env bash
# Real production Dockerfile and bounded builder, with a probe of the still-running old web.
set -Eeuo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
cid=$(docker ps -q --filter "label=com.docker.compose.project=${COMPOSE_PROJECT_NAME:?}" --filter label=com.docker.compose.service=app)
probe_file=$(mktemp)
trap 'rm -f -- "$probe_file"' EXIT
bash "$here/../deploy/build-image.sh" "$1" "$2" &
pid=$!
while kill -0 "$pid" 2>/dev/null; do
  if [[ -n $cid ]]; then
    code=$(curl -sk --noproxy '*' --max-time 5 --resolve "$SITE_DOMAIN:443:127.0.0.1" -o /dev/null -w '%{http_code}' "https://$SITE_DOMAIN/api/health" || true)
    [[ $code == 200 ]] || echo "$code" >> "$probe_file"
    [[ $(docker ps -q --filter "id=$cid") == "$cid" ]] || echo stopped >> "$probe_file"
  fi
  sleep 2
done
result=0; wait "$pid" || result=$?
[[ $result == 0 ]] || exit "$result"
[[ ! -s $probe_file ]] || { cat "$probe_file"; echo 'FALLO: web anterior no disponible durante build'; exit 1; }
[[ -z $cid ]] || echo 'PASS: old app stays running and HTTPS health remains 200 throughout bounded build'
