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
    line=${line%$'\r'}
    [[ $line =~ ^[[:space:]]*(#|$) ]] && continue
    [[ $line =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue
    key=${BASH_REMATCH[1]}
    value=${BASH_REMATCH[2]}
    if [[ $value == \"*\" || $value == \'*\' ]]; then value=${value:1:${#value}-2}; fi
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
      age -r "$BACKUP_AGE_RECIPIENT" -o "$src.age.partial" "$src" || { rm -f -- "$src.age.partial"; die "Ha fallado el cifrado age"; }
      mv -- "$src.age.partial" "$src.age" || die "No se pudo finalizar la copia age"
      rm -f -- "$src"
      printf '%s\n' "$src.age" ;;
    gpg)
      require_cmd gpg
      [[ -n ${BACKUP_GPG_RECIPIENT:-} ]] || die "BACKUP_ENCRYPTION=gpg requiere BACKUP_GPG_RECIPIENT"
      gpg --batch --yes --trust-model always --encrypt --recipient "$BACKUP_GPG_RECIPIENT" --output "$src.gpg.partial" "$src" || { rm -f -- "$src.gpg.partial"; die "Ha fallado el cifrado gpg"; }
      mv -- "$src.gpg.partial" "$src.gpg" || die "No se pudo finalizar la copia gpg"
      rm -f -- "$src"
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

# Verifica ARCHIVO contra ARCHIVO.sha256. Sin suma, se niega salvo ALLOW_MISSING_CHECKSUM=true
# (opción explícita --allow-missing-checksum de los scripts de restauración).
verify_checksum() {
  local f=$1 sum line expected
  sum="$f.sha256"
  if [[ ! -e $sum ]]; then
    [[ ${ALLOW_MISSING_CHECKSUM:-false} == true ]] || die "Falta $sum: no se restaura sin verificar la integridad (usa --allow-missing-checksum solo si sabes de dónde viene la copia)"
    log "AVISO: restauración SIN suma SHA-256 por decisión explícita (--allow-missing-checksum)"
    return 0
  fi
  safe_input_file "$sum"
  # Exactly one line, "<64 hex>  <basename of the file>": the sum cannot point to another file.
  [[ $(wc -l < "$sum") -eq 1 ]] || die "Formato de suma no válido: $sum"
  IFS= read -r line < "$sum"
  expected="  $(basename "$f")"
  [[ $line =~ ^[0-9a-f]{64}(.*)$ && ${BASH_REMATCH[1]} == "$expected" ]] || die "La suma $sum no corresponde a $(basename "$f")"
  (cd "$(dirname "$f")" && sha256sum --quiet -c "$(basename "$sum")") || die "Suma SHA-256 incorrecta: $f"
  log "Suma SHA-256 verificada"
}

# Archivo de entrada para restaurar: debe existir, ser un archivo regular y no un enlace simbólico.
safe_input_file() {
  local f=$1
  [[ -n $f && $f != -* ]] || die "Ruta no válida: $f"
  [[ ! -L $f ]] || die "Se rechaza un enlace simbólico como archivo de copia: $f"
  [[ -f $f && -r $f ]] || die "No existe o no es un archivo regular legible: $f"
}

# Valida un .tar.gz de backup-storage.sh ANTES de extraerlo: solo INFO, MANIFEST.sha256 y objects/...,
# solo archivos y directorios (sin enlaces, dispositivos ni FIFO), sin rutas absolutas ni "..".
validate_storage_archive() {
  local archive=$1 names types name n_names n_types
  names=$(tar -tzf "$archive") || die "Archivo tar no legible: $archive"
  types=$(tar -tvzf "$archive" | cut -c1) || die "Archivo tar no legible: $archive"
  n_names=$(printf '%s\n' "$names" | grep -c '') ; n_types=$(printf '%s\n' "$types" | grep -c '')
  [[ $n_names -eq $n_types ]] || die "Listado del archivo inconsistente"
  while IFS= read -r name; do
    [[ $name == INFO || $name == MANIFEST.sha256 || $name == objects/ || $name == objects/?* ]] || die "Entrada no permitida en la copia: $name"
    [[ $name != /* && ! $name =~ (^|/)\.\.(/|$) && $name != *\\* ]] || die "Ruta peligrosa en la copia: $name"
  done <<< "$names"
  while IFS= read -r name; do
    [[ $name == - || $name == d ]] || die "La copia contiene enlaces o archivos especiales (tipo '$name'); se rechaza"
  done <<< "$types"
}

# Extrae un archivo ya validado sin conservar propietarios ni permisos y comprueba que no quedan enlaces.
extract_storage_archive() {
  local archive=$1 dest=$2
  validate_storage_archive "$archive"
  tar -C "$dest" -xzf "$archive" --no-same-owner --no-same-permissions || die "No se pudo extraer la copia"
  [[ -z $(find "$dest" -type l -print -quit) ]] || die "Se han encontrado enlaces tras extraer; se rechaza la copia"
  [[ -f $dest/MANIFEST.sha256 && -d $dest/objects ]] || die "La copia no tiene MANIFEST.sha256 u objects/"
  # Manifest lines: "<sha256>  ./ruta" relative to objects/, without "..".
  if grep -Evq '^[0-9a-f]{64}  \./[^\\]+$' "$dest/MANIFEST.sha256" || grep -Eq '(^|/)\.\.(/|$)' "$dest/MANIFEST.sha256"; then
    die "MANIFEST.sha256 con formato o rutas no válidas"
  fi
  [[ $(grep -c '' "$dest/MANIFEST.sha256") -eq $(find "$dest/objects" -type f | wc -l) ]] || die "El número de objetos no coincide con el manifiesto"
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
  mapfile -t files < <(find "$dir" -maxdepth 1 -type f -name "$prefix-*" ! -name '*.sha256' ! -name '*.partial' -printf '%f\n' | sort -r)
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

# Contenedor de PostgreSQL por defecto: el del proyecto Compose.
default_pg_container() { printf '%s-postgres-1' "${COMPOSE_PROJECT_NAME:-planta14-staging}"; }

# PG_CONTAINER: vacío = <COMPOSE_PROJECT_NAME>-postgres-1; "none" = herramientas PostgreSQL del host.
resolve_pg_container() {
  if [[ -z ${PG_CONTAINER:-} ]]; then PG_CONTAINER=$(default_pg_container); fi
  if [[ $PG_CONTAINER == none ]]; then PG_CONTAINER=''; fi
  export PG_CONTAINER
}

# Ejecuta pg_dump/pg_restore/psql: dentro de PG_CONTAINER si está definido, si no en el host.
pg_tool() {
  if [[ -n ${PG_CONTAINER:-} ]]; then
    docker exec -i "$PG_CONTAINER" "$@"
  else
    "$@"
  fi
}
