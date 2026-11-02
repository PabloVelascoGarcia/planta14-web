#!/usr/bin/env bash
# Funciones comunes de copia y restauración. Se carga con "source"; no se ejecuta sola.
# shellcheck shell=bash

umask 077

log() { printf '%s [%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${SCRIPT_NAME:-planta14}" "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }
require_cmd() { local c; for c in "$@"; do command -v "$c" >/dev/null 2>&1 || die "Falta la orden: $c"; done; }

# Carga un archivo de entorno (KEY=VALUE) sin ejecutar código arbitrario. Las variables
# ya presentes en el entorno tienen prioridad.
load_env_file() {
  local file=$1 line key value
  [[ -f $file ]] || die "No existe el archivo de entorno: $file"
  while IFS= read -r line || [[ -n $line ]]; do
    [[ $line =~ ^[[:space:]]*(#|$) ]] && continue
    [[ $line =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue
    key=${BASH_REMATCH[1]}
    value=${BASH_REMATCH[2]}
    value=${value%\"}; value=${value#\"}
    if [[ -z ${!key+x} ]]; then export "$key=$value"; fi
  done < "$file"
}

timestamp() { date -u +%Y%m%dT%H%M%SZ; }

# Bloqueo para que no se solapen dos ejecuciones del mismo tipo.
acquire_lock() {
  local name=$1 dir=${BACKUP_DIR:?}
  mkdir -p "$dir"
  exec 9>"$dir/.$name.lock"
  if command -v flock >/dev/null 2>&1; then flock -n 9 || die "Ya hay otra ejecución de $name en curso"; fi
}

# Cifra $1 según BACKUP_ENCRYPTION y escribe el resultado en stdout del nombre final.
# Uso: encrypt_file origen -> imprime la ruta del archivo final (origen o origen.age/.gpg).
encrypt_file() {
  local src=$1
  case ${BACKUP_ENCRYPTION:-none} in
    none) printf '%s\n' "$src" ;;
    age)
      require_cmd age
      [[ -n ${BACKUP_AGE_RECIPIENT:-} ]] || die "BACKUP_ENCRYPTION=age requiere BACKUP_AGE_RECIPIENT"
      age -r "$BACKUP_AGE_RECIPIENT" -o "$src.age" "$src" && rm -f "$src"
      printf '%s\n' "$src.age" ;;
    gpg)
      require_cmd gpg
      [[ -n ${BACKUP_GPG_RECIPIENT:-} ]] || die "BACKUP_ENCRYPTION=gpg requiere BACKUP_GPG_RECIPIENT"
      gpg --batch --yes --trust-model always --encrypt --recipient "$BACKUP_GPG_RECIPIENT" --output "$src.gpg" "$src" && rm -f "$src"
      printf '%s\n' "$src.gpg" ;;
    *) die "BACKUP_ENCRYPTION no válido: ${BACKUP_ENCRYPTION} (none|age|gpg)" ;;
  esac
}

# Descifra $1 en $2 si está cifrado; si no, lo copia.
decrypt_file() {
  local src=$1 dst=$2
  case $src in
    *.age)
      require_cmd age
      [[ -n ${BACKUP_AGE_IDENTITY:-} ]] || die "Copia cifrada con age: define BACKUP_AGE_IDENTITY (ruta a la clave privada)"
      age -d -i "$BACKUP_AGE_IDENTITY" -o "$dst" "$src" ;;
    *.gpg)
      require_cmd gpg
      gpg --batch --yes --decrypt --output "$dst" "$src" ;;
    *) cp -- "$src" "$dst" ;;
  esac
}

write_checksum() { (cd "$(dirname "$1")" && sha256sum "$(basename "$1")" > "$(basename "$1").sha256"); }

verify_checksum() {
  local f=$1
  if [[ -f $f.sha256 ]]; then
    (cd "$(dirname "$f")" && sha256sum --quiet -c "$(basename "$f").sha256") || die "Suma SHA-256 incorrecta: $f"
    log "Suma SHA-256 verificada"
  else
    log "AVISO: no hay $f.sha256; no se puede verificar la integridad"
  fi
}

# Retención: borra copias con fecha (en el nombre) anterior a BACKUP_RETENTION_DAYS,
# conservando siempre las BACKUP_KEEP_MIN más recientes.
# Uso: prune_backups directorio prefijo
prune_backups() {
  local dir=$1 prefix=$2 days=${BACKUP_RETENTION_DAYS:-14} keep=${BACKUP_KEEP_MIN:-3}
  [[ $days =~ ^[0-9]+$ ]] || die "BACKUP_RETENTION_DAYS debe ser un entero"
  [[ $keep =~ ^[0-9]+$ ]] || die "BACKUP_KEEP_MIN debe ser un entero"
  local cutoff; cutoff=$(date -u -d "-$days days" +%Y%m%dT%H%M%SZ)
  local -a files=()
  mapfile -t files < <(find "$dir" -maxdepth 1 -type f -name "$prefix-*" ! -name '*.sha256' -printf '%f\n' | sort -r)
  local i=0 f stamp
  for f in "${files[@]}"; do
    i=$((i + 1))
    (( i <= keep )) && continue
    stamp=${f#"$prefix"-}; stamp=${stamp:0:16}
    [[ $stamp =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || continue
    if [[ $stamp < $cutoff ]]; then
      log "Retención: borro $f"
      rm -f -- "$dir/$f" "$dir/$f.sha256"
    fi
  done
}

# Ejecuta pg_dump/pg_restore/psql: dentro de PG_CONTAINER si está definido, si no en el host.
pg_tool() {
  if [[ -n ${PG_CONTAINER:-} ]]; then
    docker exec -i "$PG_CONTAINER" "$@"
  else
    "$@"
  fi
}
