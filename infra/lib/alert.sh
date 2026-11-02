#!/usr/bin/env bash
# Envío de alertas por correo (SMTP con curl). Preparado y DESACTIVADO hasta que haya proveedor de correo.
#   ALERT_EMAIL_ENABLED=true   activa el envío (por defecto false: solo se anota en ALERT_LOG)
#   ALERT_SMTP_URL             p. ej. smtps://smtp.proveedor.example:465
#   ALERT_SMTP_USER / ALERT_SMTP_PASSWORD   credenciales del proveedor (en el .env, nunca en Git)
#   ALERT_EMAIL_FROM / ALERT_EMAIL_TO       remitente y destinatario (varios, separados por comas)
#   ALERT_LOG                  archivo donde siempre se anota la alerta (por defecto $BACKUP_DIR/alerts.log)
# shellcheck shell=bash

send_alert() { # ASUNTO CUERPO
  local subject="[Planta 14] $1" body=$2 host log
  host=$(hostname 2>/dev/null || echo servidor)
  log=${ALERT_LOG:-${BACKUP_DIR:-/var/log}/alerts.log}
  mkdir -p "$(dirname "$log")" 2>/dev/null || true
  printf '%s %s | %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$subject" "${body//$'\n'/ }" >> "$log" 2>/dev/null || true
  if [[ ${ALERT_EMAIL_ENABLED:-false} != true ]]; then
    printf 'ALERTA (correo desactivado): %s\n' "$subject" >&2
    return 0
  fi
  local missing=() var
  for var in ALERT_SMTP_URL ALERT_EMAIL_FROM ALERT_EMAIL_TO; do [[ -n ${!var:-} ]] || missing+=("$var"); done
  if (( ${#missing[@]} )); then printf 'ALERTA sin enviar: faltan %s\n' "${missing[*]}" >&2; return 1; fi
  local -a rcpt=() args=()
  local to
  IFS=',' read -ra rcpt <<< "$ALERT_EMAIL_TO"
  for to in "${rcpt[@]}"; do args+=(--mail-rcpt "${to// /}"); done
  # Credentials through a private temporary config file, never on the command line (visible in ps).
  local cfg; cfg=$(umask 077; mktemp)
  [[ -n ${ALERT_SMTP_USER:-} ]] && printf 'user = "%s:%s"\n' "$ALERT_SMTP_USER" "${ALERT_SMTP_PASSWORD:-}" > "$cfg"
  args+=(--config "$cfg")
  printf 'From: %s\r\nTo: %s\r\nSubject: %s\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n%s\r\n\r\nServidor: %s\r\n' \
    "$ALERT_EMAIL_FROM" "$ALERT_EMAIL_TO" "$subject" "$body" "$host" |
    curl --silent --show-error --ssl-reqd --max-time 30 --url "$ALERT_SMTP_URL" --mail-from "$ALERT_EMAIL_FROM" "${args[@]}" --upload-file - \
    || { rm -f -- "$cfg"; printf 'ALERTA: no se pudo enviar el correo\n' >&2; return 1; }
  rm -f -- "$cfg"
}
