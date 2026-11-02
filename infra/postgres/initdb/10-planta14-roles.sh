#!/bin/sh
# Solo en bases NUEVAS (volumen vacío): la imagen oficial ejecuta /docker-entrypoint-initdb.d una vez.
# Para bases existentes usa infra/postgres/apply-roles.sh (mismo SQL, idempotente).
set -eu
: "${POSTGRES_MIGRATOR_USER:?Define POSTGRES_MIGRATOR_USER}" "${POSTGRES_MIGRATOR_PASSWORD:?Define POSTGRES_MIGRATOR_PASSWORD}"
: "${POSTGRES_APP_USER:?Define POSTGRES_APP_USER}" "${POSTGRES_APP_PASSWORD:?Define POSTGRES_APP_PASSWORD}"
psql -v ON_ERROR_STOP=1 -X --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /planta14/roles.sql
psql -v ON_ERROR_STOP=1 -X --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /planta14/grants.sql
