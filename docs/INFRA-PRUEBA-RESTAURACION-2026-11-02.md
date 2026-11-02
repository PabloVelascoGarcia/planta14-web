# Prueba de restauración: 2 de noviembre de 2026

Ejecutada en el entorno del agente (Linux, Docker 29.9.2, imagen `postgres:17.6-alpine`, `rclone/rclone:1.71.2`, age) sobre la rama `desarrollo/planta14-v2-infra`. Todo con contenedores desechables y **datos sintéticos** (`infra/test/fixture.sql`); no se ha usado ningún recurso real. Las claves y contraseñas se generaron al vuelo y se borraron al terminar.

Orden:

```bash
infra/test/restore-test.sh
```

Qué se ha comprobado:

1. PostgreSQL 17.6 de origen con las dos migraciones reales de Payload (`cms/migrations`) y datos sintéticos: 12 tablas, 20.251 filas.
2. `backup-postgres.sh` con cifrado age: nombre con fecha, `.sha256`, el archivo cifrado no es legible sin la clave, y la retención borra las copias de más de 14 días conservando las recientes.
3. PostgreSQL **nuevo y vacío**; `restore-postgres.sh --create` con verificación de la suma y descifrado.
4. `count(*)` por tabla en origen y en destino: **idéntico en las 12 tablas**.
5. La restauración se niega sobre una base con datos.
6. Almacenamiento: S3 de pruebas con `rclone serve s3`, 45 objetos; copia cifrada, restauración en un bucket vacío, mismo número de objetos y contenido idéntico (`rclone check`); se niega a restaurar sobre un bucket con objetos.

No cubre: MinIO real (ver [INFRA-STAGING.md](INFRA-STAGING.md)), cifrado con gpg ni una copia de datos reales.

## Salida completa

```text
2026-11-02T09:53:50Z [restore-test] == PostgreSQL de origen (postgres:17.6-alpine)
postgres (PostgreSQL) 17.6
2026-11-02T09:53:52Z [restore-test] Aplicando migraciones de Payload (cms/migrations) en la base de origen
    [09:53:55] INFO: Migrating: 20261102_085958_fase1
    [09:53:55] INFO: Migrated:  20261102_085958_fase1 (97ms)
    [09:53:55] INFO: Migrating: 20261102_090101_storage
    [09:53:55] INFO: Migrated:  20261102_090101_storage (3ms)
    [09:53:55] INFO: Done.
2026-11-02T09:53:55Z [restore-test] Cargando datos sintéticos (infra/test/fixture.sql)
2026-11-02T09:53:56Z [restore-test] Tablas en origen: 12; filas: 20251
2026-11-02T09:53:56Z [restore-test] == Copia de seguridad (cifrada con clave age efímera)
2026-11-02T09:53:56Z [backup-postgres] Volcando la base planta14 (usuario planta14)
2026-11-02T09:53:57Z [backup-postgres] Copia creada: /home/user/planta14-web/infra/test/out/495c3a1b/backups/postgres/planta14-postgres-planta14-20261102T095356Z.dump.age (780K)
2026-11-02T09:53:57Z [backup-postgres] Retención: borro planta14-postgres-planta14-20261013T095356Z.dump.age
2026-11-02T09:53:57Z [backup-postgres] Retención: borro planta14-postgres-planta14-20261003T095356Z.dump.age
2026-11-02T09:53:57Z [backup-postgres] Retención: borro planta14-postgres-planta14-20260923T095356Z.dump.age
    planta14-postgres-planta14-20261028T095356Z.dump.age (0 bytes)
    planta14-postgres-planta14-20261030T095356Z.dump.age (0 bytes)
    planta14-postgres-planta14-20261102T095356Z.dump.age (797639 bytes)
    planta14-postgres-planta14-20261102T095356Z.dump.age.sha256 (119 bytes)
2026-11-02T09:53:57Z [restore-test] OK    nombre con fecha y cifrado
2026-11-02T09:53:57Z [restore-test] OK    el volcado cifrado no es legible sin la clave
2026-11-02T09:53:57Z [restore-test] OK    retención: quedan 3 copias (nueva + 3 y 5 días)
2026-11-02T09:53:57Z [restore-test] == PostgreSQL NUEVO y vacío; restauración
2026-11-02T09:53:59Z [restore-postgres] Suma SHA-256 verificada
2026-11-02T09:54:00Z [restore-postgres] Creando la base planta14_restaurada
2026-11-02T09:54:00Z [restore-postgres] Restaurando en planta14_restaurada
2026-11-02T09:54:01Z [restore-postgres] Restauración completada en planta14_restaurada
2026-11-02T09:54:01Z [restore-test] Comparación de filas por tabla (origen | restaurada):
    public.media                                          120 |      120
    public.payload_kv                                       7 |        7
    public.payload_locked_documents_rels                    0 |        0
    public.payload_locked_documents                         0 |        0
    public.payload_migrations                               2 |        2
    public.payload_preferences_rels                        30 |       30
    public.payload_preferences                             30 |       30
    public.users_sessions                                  25 |       25
    public.users                                           25 |       25
    restore_test.concejos                                  12 |       12
    restore_test.noticias                               20000 |    20000
    restore_test.vacia                                      0 |        0
2026-11-02T09:54:01Z [restore-test] OK    mismo número de filas en todas las tablas
2026-11-02T09:54:01Z [restore-test] OK    hay tablas y filas que comparar
2026-11-02T09:54:01Z [restore-test] OK    se niega a restaurar sobre una base con datos
    2026-11-02T09:54:01Z [restore-postgres] ERROR: La base planta14_restaurada no está vacía (22 relaciones). No se restaura encima de datos.
2026-11-02T09:54:01Z [restore-test] == Almacenamiento: servidor S3 de pruebas (rclone serve s3, rclone/rclone:1.71.2)
2026-11-02T09:54:05Z [restore-test] Objetos en el bucket de origen: 45
2026-11-02T09:54:05Z [backup-storage] Descargando objetos del bucket planta14-prueba
2026-11-02T09:54:05Z [backup-storage] Objetos descargados: 45
2026-11-02T09:54:06Z [backup-storage] Copia creada: /home/user/planta14-web/infra/test/out/495c3a1b/backups/storage/planta14-storage-planta14-prueba-20261102T095405Z.tar.gz.age (176K)
2026-11-02T09:54:06Z [restore-test] OK    copia de almacenamiento con fecha y cifrada
2026-11-02T09:54:06Z [restore-storage] Suma SHA-256 verificada
2026-11-02T09:54:07Z [restore-storage] Subiendo 45 objetos a planta14-prueba-restaurado
2026/11/02 09:54:07 NOTICE: S3 bucket planta14-prueba-restaurado: 0 differences found
2026/11/02 09:54:07 NOTICE: S3 bucket planta14-prueba-restaurado: 45 matching files
2026-11-02T09:54:08Z [restore-storage] Restauración del almacenamiento completada: 45 objetos verificados en planta14-prueba-restaurado
2026-11-02T09:54:08Z [restore-test] Objetos: origen 45 | restaurado 45
2026-11-02T09:54:08Z [restore-test] OK    mismo número de objetos
2026/11/02 09:54:08 NOTICE: S3 bucket planta14-prueba-restaurado: 0 differences found
2026/11/02 09:54:08 NOTICE: S3 bucket planta14-prueba-restaurado: 45 matching files
2026-11-02T09:54:08Z [restore-test] OK    contenido idéntico (rclone check origen/restaurado)
2026-11-02T09:54:09Z [restore-test] OK    se niega a restaurar sobre un bucket con objetos
2026-11-02T09:54:09Z [restore-test] RESULTADO: prueba de restauración SUPERADA
```

Código de salida: 0.
