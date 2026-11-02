#!/bin/sh
# Inicializa MinIO (S3 de pruebas). Idempotente y sin ocultar errores:
#   - bucket privado S3_BUCKET con versionado;
#   - bucket público PUBLIC_MEDIA_BUCKET (opcional): lectura anónima de objetos, sin listado;
#   - clave de la aplicación limitada a esos buckets (se actualiza su secreto en cada ejecución).
# Se ejecuta dentro de la imagen de MinIO (incluye mc).
set -eu
: "${MINIO_ROOT_USER:?Define MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD:?Define MINIO_ROOT_PASSWORD}"
: "${S3_BUCKET:?}" "${S3_ACCESS_KEY_ID:?}" "${S3_SECRET_ACCESS_KEY:?}"
PUBLIC_MEDIA_BUCKET=${PUBLIC_MEDIA_BUCKET:-}
[ "$PUBLIC_MEDIA_BUCKET" != "$S3_BUCKET" ] || { echo "PUBLIC_MEDIA_BUCKET debe ser distinto de S3_BUCKET" >&2; exit 1; }

mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
mc mb --ignore-existing "local/$S3_BUCKET"
mc anonymous set none "local/$S3_BUCKET"
mc version enable "local/$S3_BUCKET"

resources="\"arn:aws:s3:::$S3_BUCKET/*\""
buckets="\"arn:aws:s3:::$S3_BUCKET\""
if [ -n "$PUBLIC_MEDIA_BUCKET" ]; then
  mc mb --ignore-existing "local/$PUBLIC_MEDIA_BUCKET"
  # "download": GetObject anónimo; no permite listar ni escribir.
  mc anonymous set download "local/$PUBLIC_MEDIA_BUCKET"
  resources="$resources, \"arn:aws:s3:::$PUBLIC_MEDIA_BUCKET/*\""
  buckets="$buckets, \"arn:aws:s3:::$PUBLIC_MEDIA_BUCKET\""
fi

policy_file=$(mktemp)
trap 'rm -f "$policy_file"' EXIT
cat > "$policy_file" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {"Effect": "Allow", "Action": ["s3:ListBucket", "s3:GetBucketLocation"], "Resource": [$buckets]},
    {"Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], "Resource": [$resources]}
  ]
}
JSON
mc admin policy create local planta14-app "$policy_file"
# Crea el usuario o actualiza su secreto (rotación).
mc admin user add local "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY"
if ! out=$(mc admin policy attach local planta14-app --user "$S3_ACCESS_KEY_ID" 2>&1); then
  case $out in *already*) ;; *) echo "$out" >&2; exit 1 ;; esac
fi
echo "MinIO listo: $S3_BUCKET privado y versionado${PUBLIC_MEDIA_BUCKET:+, $PUBLIC_MEDIA_BUCKET público (solo lectura de objetos)}; clave de la aplicación limitada."
