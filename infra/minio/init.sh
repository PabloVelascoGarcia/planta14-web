#!/bin/sh
# Inicializa MinIO (S3 de pruebas): bucket privado con versionado y una clave limitada a ese bucket.
# Se ejecuta dentro de la imagen minio/mc. Idempotente.
set -eu
: "${MINIO_ROOT_USER:?Define MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD:?Define MINIO_ROOT_PASSWORD}"

mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
mc mb --ignore-existing "local/$S3_BUCKET"
mc anonymous set none "local/$S3_BUCKET"
mc version enable "local/$S3_BUCKET"

policy_file=$(mktemp)
cat > "$policy_file" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {"Effect": "Allow", "Action": ["s3:ListBucket", "s3:GetBucketLocation"], "Resource": ["arn:aws:s3:::$S3_BUCKET"]},
    {"Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], "Resource": ["arn:aws:s3:::$S3_BUCKET/*"]}
  ]
}
JSON
mc admin policy create local planta14-app "$policy_file" >/dev/null 2>&1 || true
if ! mc admin user info local "$S3_ACCESS_KEY_ID" >/dev/null 2>&1; then
  mc admin user add local "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY"
fi
mc admin policy attach local planta14-app --user "$S3_ACCESS_KEY_ID" >/dev/null 2>&1 || true
rm -f "$policy_file"
echo "MinIO listo: bucket $S3_BUCKET privado, versionado y clave de aplicación limitada."
