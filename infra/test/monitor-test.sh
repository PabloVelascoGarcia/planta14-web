#!/usr/bin/env bash
# Pruebas de las alertas: correo desactivado (solo registro), disco por encima del umbral, tarea fallida
# y envío preparado (con un "curl" simulado que captura la orden; no se envía ningún correo real).
set -Eeuo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
infra=$(cd "$here/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT
fail() { echo "FALLO: $*" >&2; exit 1; }
export ALERT_LOG=$work/alerts.log

# 1. Disco: umbral 0 % fuerza la alerta; correo desactivado => solo registro, código 2.
set +e; ALERT_DISK_THRESHOLD=0 ALERT_DISK_PATHS="$work" "$infra/monitor/check-disk.sh" 2>"$work/err"; code=$?; set -e
[[ $code == 2 ]] || fail "check-disk debía salir con 2 (salió $code)"
grep -q 'Disco al' "$ALERT_LOG" || fail 'no se registró la alerta de disco'
grep -q 'correo desactivado' "$work/err" || fail 'debía indicar que el correo está desactivado'
ALERT_DISK_THRESHOLD=100 ALERT_DISK_PATHS="$work" "$infra/monitor/check-disk.sh" 2>/dev/null || fail 'por debajo del umbral no debe alertar'
echo 'PASS: disk above threshold raises an alert (email disabled: logged only); below threshold is quiet'

# 2. Tarea fallida: se propaga su código y se registra la alerta; una tarea correcta no alerta.
: > "$ALERT_LOG"
set +e; "$infra/monitor/run-with-alert.sh" "Copia de prueba" -- bash -c 'exit 7' 2>/dev/null; code=$?; set -e
[[ $code == 7 ]] || fail "run-with-alert debía devolver 7 (devolvió $code)"
grep -q 'FALLO: Copia de prueba' "$ALERT_LOG" || fail 'no se registró la alerta de copia fallida'
: > "$ALERT_LOG"; "$infra/monitor/run-with-alert.sh" "Copia correcta" -- true; [[ ! -s $ALERT_LOG ]] || fail 'una tarea correcta no debe alertar'
echo 'PASS: a failed backup task alerts and keeps its exit code; a successful one does not'

# 3. Correo activado: orden SMTP correcta, credenciales fuera de la línea de órdenes.
mkdir "$work/bin"
cat > "$work/bin/curl" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$@" > "$CURL_ARGS"
[[ -z ${ALERT_SMTP_PASSWORD+x} ]] || exit 99
while [[ $# -gt 0 ]]; do
  if [[ $1 == --config ]]; then
    [[ $(stat -c '%a' "$2") == 600 ]] || exit 98
    cp "$2" "$CURL_CONFIG"
    printf '%s' "$2" > "$CURL_PATH"
  fi
  shift
done
cat > "$CURL_BODY"
exit "${CURL_FAIL:-0}"
STUB
chmod +x "$work/bin/curl"
export CURL_ARGS=$work/args CURL_CONFIG=$work/config CURL_BODY=$work/body
export CURL_PATH=$work/config-path
PATH="$work/bin:$PATH" ALERT_EMAIL_ENABLED=true ALERT_SMTP_URL=smtps://smtp.example.test:465 ALERT_SMTP_USER=usuario ALERT_SMTP_PASSWORD=secreto-de-prueba \
  ALERT_EMAIL_FROM=alertas@planta14.example ALERT_EMAIL_TO='pablo@planta14.example, otra@planta14.example' \
  bash -c "source '$infra/lib/common.sh'; source '$infra/lib/alert.sh'; send_alert 'Prueba' 'Cuerpo de prueba'"
grep -qx 'smtps://smtp.example.test:465' "$CURL_ARGS" || fail 'URL SMTP'
grep -qx 'pablo@planta14.example' "$CURL_ARGS" || fail 'destinatario 1'
grep -qx 'otra@planta14.example' "$CURL_ARGS" || fail 'destinatario 2'
! grep -q 'secreto-de-prueba' "$CURL_ARGS" || fail 'la contraseña aparece en la línea de órdenes'
grep -q 'usuario:secreto-de-prueba' "$CURL_CONFIG" || fail 'credenciales en el archivo de configuración'
grep -q 'Subject: \[Planta 14\] Prueba' "$CURL_BODY" || fail 'asunto'
[[ -z $(find "${TMPDIR:-/tmp}" -maxdepth 1 -newer "$CURL_ARGS" -name 'tmp.*' -user "$(id -u)" -exec grep -l secreto-de-prueba {} + 2>/dev/null) ]] || fail 'el archivo temporal de credenciales no se borró'
echo 'PASS: email alert prepared: SMTP URL, recipients and subject; password never on the command line; temp file removed'

PATH="$work/bin:$PATH" ALERT_EMAIL_ENABLED=true ALERT_SMTP_URL=smtps://smtp.example.test:465 ALERT_SMTP_USER=usuario ALERT_SMTP_PASSWORD='secreto"con\barra' \
  ALERT_EMAIL_FROM=alertas@planta14.example ALERT_EMAIL_TO=pablo@planta14.example \
  bash -c "source '$infra/lib/common.sh'; source '$infra/lib/alert.sh'; send_alert 'Comillas' 'Prueba'"
grep -Fxq 'user = "usuario:secreto\"con\\barra"' "$CURL_CONFIG" || fail 'curl config did not escape the password'
[[ ! -e $(cat "$CURL_PATH") ]] || fail 'credential config remains after success'
set +e
PATH="$work/bin:$PATH" CURL_FAIL=22 ALERT_EMAIL_ENABLED=true ALERT_SMTP_URL=smtps://smtp.example.test:465 ALERT_SMTP_USER=usuario ALERT_SMTP_PASSWORD=secreto-fallo \
  ALERT_EMAIL_FROM=alertas@planta14.example ALERT_EMAIL_TO=pablo@planta14.example \
  bash -c "source '$infra/lib/common.sh'; source '$infra/lib/alert.sh'; send_alert 'Fallo SMTP' 'Prueba'" 2>"$work/fail.err"
code=$?
set -e
[[ $code == 1 ]] || fail 'SMTP failure must return nonzero'
grep -q 'ENTREGA FALLIDA' "$ALERT_LOG" || fail 'SMTP failure not recorded'
[[ ! -e $(cat "$CURL_PATH") ]] || fail 'credential config remains after failure'
! grep -q 'secreto-fallo' "$CURL_ARGS" || fail 'password in curl arguments on failure'
echo 'PASS: quoted passwords escaped, credentials absent from curl environment, mode 600, failed delivery recorded and temp file removed'
