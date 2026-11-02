# Planta 14 v2 final — entrega del 2 de noviembre de 2026

Salida prevista: **4 de diciembre de 2026**. Rama de instalación: **desarrollo/planta14-v2-final**.

Creada desde `origin/desarrollo/planta14-v2` (`e3ed2f2`) e integrada con `origin/desarrollo/planta14-v2-lanzamiento` (`84b2971`). Merge `1e70172`: el único conflicto de `infra/test/staging-e2e.sh` era un comentario; se conservan las protecciones y los cambios funcionales de ambas ramas. Configuración principal en `5c013e5`, más las correcciones y este informe de cierre. No se modifican ni publican otras ramas, main o la demo. Sin PR, despliegue externo, contratación ni secretos en Git.

Guía vigente: [PUESTA-EN-MARCHA-IONOS.md](PUESTA-EN-MARCHA-IONOS.md). El informe [V2-PRODUCCION.md](V2-PRODUCCION.md) se conserva como histórico del kit anterior.

## Qué se ha adaptado y corregido

- VPS contratado: **IONOS Linux M+, 2 vCores, 4 GB RAM, 120 GB NVMe, Ubuntu 24.04**. No es ampliable; las alertas y la guía indican mudanza con copia/restauración.
- `setup-server.sh`: objetivo de al menos 4 GiB de swap, sin desactivar un swap activo para aumentarlo. En un VPS sin swap crea el archivo de 4 GiB. `check-server.sh` comprueba la capacidad. La activación real requiere systemd y queda pendiente en el VPS.
- Constructor BuildKit separado: RAM 1280 MiB, RAM+swap 2560 MiB, máximo dos CPUs. Next usa un trabajador, optimización de memoria y old-space de Node de 768 MiB. El constructor se para al terminar; la web anterior no se para para construir. La imagen de producción sigue sin ejecutar como root.
- Límites de app 1024 MiB (Node old-space 640), PostgreSQL 640, Caddy 128, migrador 768; límites de swap adicionales explícitos. PostgreSQL usa buffers 128 MB, caché estimada 384 MB, 30 conexiones, work_mem 4 MB y mantenimiento 64 MB. Cada rclone se limita a 256 MiB y reduce concurrencia.
- Memoria: muestra cada minuto, alarma si supera 85 % durante 600 segundos, con registro persistente, recuperación, reinicio tras un hueco de muestras y máximo un intento de aviso cada seis horas durante un episodio. Cron queda probado. Correo fallido conserva el aviso en el registro cuando este se puede escribir; no hay cola de reintentos.
- SMTP Payload oficial (`@payloadcms/email-nodemailer` 3.92.1), únicamente `smtp.ionos.es:465` con SSL/TLS y remitente/usuario `avisos@planta14.com`. Recuperación y avisos usan ese adaptador; alertas reutilizan `SMTP_PASSWORD` con curl. Desactivado hasta configurar y probar el buzón, sin conexiones de prueba al proveedor durante build/configuración. Se comprueban entrega/error con transporte sintético.
- Guía Windows/SSH: creación de Ed25519, frase de paso, entrega **solo de la pública**, primera conexión con credenciales iniciales, comprobación en una segunda ventana antes de cerrar root. Despliegue desde el PC por SSH, pero construcción y ejecución en Ubuntu, en `/srv/planta14/app`, fijando un commit.
- Guía S3: tres buckets IONOS, copia en otra región UE, identidades técnicas separadas y pruebas negativas de permisos. No se presenta una segunda clave de administrador como una identidad restringida. No se inventan endpoints, IDs de políticas ni claves.
- La prueba Ubuntu descubrió que un intento sin clave podía alterar sudoers antes de fallar. Ahora las claves se validan **antes** de cambiar paquetes, usuarios, sudoers o SSH. Admite claves Windows CRLF. Se prueban rechazo sin alterar sudoers, ausencia de duplicados y repetición con cero cambios.
- `server-setup-test.sh` inicializa los índices apt si necesita instalar su cliente SSH. Se corrige un aviso de shellcheck. El ensayo de producción se niega también ante volúmenes preexistentes y permite construir de verdad, sin depender de la alternativa precompilada.

## Evidencia de memoria y continuidad

Se utilizó Docker Desktop Linux con límites **efectivos**, no solo variables de heap. Constructor inspeccionado con `memory.max=1342177280`; el cgroup registró un pico aproximado de **1280 MiB**, unos **95 MiB de swap** en la muestra y `oom_kill=0`. La compilación terminó con un trabajador.

La instalación de prueba arrancó app, PostgreSQL y Caddy con estos límites verificados mediante Docker inspect:

| Servicio | RAM máxima real | RAM+swap máxima | Muestra tras arrancar |
| --- | ---: | ---: | ---: |
| App | 1024 MiB | 1536 MiB | 124,7 MiB |
| PostgreSQL | 640 MiB | 768 MiB | 41,18 MiB |
| Caddy | 128 MiB | 192 MiB | 19,17 MiB |

También se consultaron los cinco ajustes de PostgreSQL con SHOW. Son muestras, no máximos de una carga de redacción real.

Los límites de web + PostgreSQL + Caddy + constructor suman **3072 MiB**; queda aproximadamente 0,7–1 GiB de la RAM del plan para Ubuntu/Docker, según la memoria utilizable del VPS. Las migraciones ocurren después del build. No construir a la vez que copias grandes ni reinicios programados.

El ensayo `PRODTEST_REAL_BUILD=1` construyó las versiones buena y dos malas mediante el Dockerfile real y el constructor limitado. En las actualizaciones, el wrapper observó que el contenedor anterior seguía en marcha y `/api/health` por HTTPS permanecía en 200 **durante la construcción**. Se probaron después las dos vueltas atrás, con restauración SQL solo cuando correspondía. El cambio final de contenedor puede interrumpir el servicio unos segundos.

**Alcance:** no es una VM completa limitada globalmente a 4 GB ni una prueba de carga en el IONOS real. La revisión automática rechazó una prueba privilegiada que escribía cgroups del host; no se eludió ese rechazo. Se usaron límites Docker por contenedor y medición conjunta, sin cambiar la memoria del equipo. La capacidad del sistema operativo, swap activa, carga simultánea y latencia del VPS deben verificarse allí antes de abrir. [Opciones oficiales del constructor Docker](https://docs.docker.com/build/builders/drivers/docker-container).

## Pruebas ejecutadas

Todas con datos sintéticos. Node 26.7.0 en Windows; imágenes y ejecutor Linux con Node 22.23.4. Chrome local y Chromium de Playwright 1.64.1; analítica y correo simulados, sin envío real.

| Comando | Resultado |
| --- | --- |
| `npm test` | exit 0; incluye SMTP IONOS, propagación de error y pruebas anteriores |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0; 16 avisos de imágenes, cero errores |
| `npm run build` | exit 0 |
| `CMS_BLOCK2_TEST=true npm run test:block2` | exit 0 |
| `CMS_BLOCK3_TEST=true npm run test:block3` | exit 0, incluida concurrencia, S3 parcial y reversiones protegidas |
| `CMS_LAUNCH_TEST=true npm run test:launch` | exit 0; dos pestañas, Atrás, caché, metadatos, salud y contenido retirado/borrador |
| `infra/deploy/build-image.sh ... planta14-final:local` | Dockerfile real construido con límites de memoria, sin secretos ni CMS en build |
| shellcheck de **todo** infra (incluidos server/deploy/monitor/test) | exit 0 |
| `infra/test/common-test.sh` | exit 0 |
| `infra/test/monitor-test.sh` | exit 0 |
| `infra/test/memory-test.sh` | exit 0; umbral sostenido, aviso único, recuperación y hueco de muestras |
| `infra/test/staging-config-test.mjs` | 4 PASS; se repitió tras un timeout de la primera ejecución bajo carga, sin cambiar aserciones |
| Caddy production, `caddy validate`, modos acme/internal | ambos exit 0; no se solicitan certificados reales |
| `infra/test/staging-guard-test.sh` | exit 0; no borra un staging existente |
| `infra/test/postgres-roles-test.sh` | exit 0, base nueva y existente |
| `infra/test/server-setup-test.sh` | exit 0 en **Ubuntu 24.04 desechable**, repetición 0 cambios, CRLF y sudoers; servicios/swap omitidos por no tener systemd |
| `PRODTEST_REAL_BUILD=1 infra/test/production-deploy-test.sh` | SUPERADO: Compose, HTTPS, construcción real, continuidad durante build, ambas vueltas atrás, restauración, cron y alertas |
| `infra/test/staging-e2e.sh` | SUPERADO: navegador, copia cifrada, borrado/restauración, siete páginas y filas iguales |
| `infra/test/restore-test.sh` | **exit 1: 31 comprobaciones correctas y una fallida**, detallada abajo; SQL/S3, cifrado, sumas y recuperación desde copia externa correctos |

La prueba de roles necesitó que un adaptador exclusivo del ejecutor apuntara a host.docker.internal para los puertos dinámicos de Docker Desktop. No cambia permisos ni aserciones. Los ejecutores, logs, claves age de prueba y estados temporales se mantienen fuera de Git.

## Importante, pendiente de decisión y sin rediseñar

1. **Barrera PostgreSQL no certificada en Docker Desktop.** Se reprodujo que la red de salida alcanza PostgreSQL y **acepta credenciales válidas pese a pg_hba samenet**. El diagnóstico lo muestra y la prueba sigue fallando; no se ha convertido en aviso ni quitado la aserción. No se modificó pg_hba ni el aislamiento para ocultarlo. Antes de abrir, ejecutar esa prueba en Ubuntu nativo del VPS y revisar las reglas efectivas; si falla, bloquear la puesta en servicio hasta resolverlo.
2. **Rollback cifrado y escrituras.** El kit pretende restaurar automáticamente, pero la privada age debe seguir fuera del VPS. Hay que decidir un acceso temporal/autorizado para descifrar durante mantenimiento o una restauración asistida. Además, las escrituras posteriores al snapshot pueden perderse al volver atrás; falta definir ventana sin escrituras o migraciones compatibles. No se ha implementado un modo de mantenimiento ni cambiado el contrato de migraciones. Restaurar SQL no revierte automáticamente efectos externos en S3.
3. **Producción con carga real.** Prueba de humo y límites no certifican concurrencia de usuarios, fotos grandes simultáneas, saturación del pool ni una VM completa de 4 GB. Confirmar CPU, swap, disco y carga en el VPS. En particular, el registro autónomo de imágenes comparte pool con las transacciones: sigue pendiente el ensayo de saturación y la reserva de conexiones de las revisiones anteriores.
4. **S3, purga y retención reales.** Probar políticas de los tres buckets, separación de identidades, multipart y versionado/bloqueo. No activar acceso público a originales. Resolver purgas CDN fallidas, URL histórica y limpieza con escrituras activas de las revisiones de integración. Las claves del mismo usuario heredan permisos: no basta con generar tres nombres distintos de clave. No se ha fijado una retención legal por cuenta de Pablo.
5. **Textos legales y contenidos.** Continúan pendientes revisión jurídica, roles responsable/encargado de cuentas/auditoría, transferencias, subencargados, plazos y [REGISTRO MERCANTIL]. No importar noticias ni fotos de La Voz de Asturias o Agenda Pública a producción. No activar indexación de una demo.
6. **Correo y tareas.** Comprobar el buzón y sus límites IONOS, recepción real de recuperación, avisos y alertas, SPF/DKIM/DMARC. No hay cola SMTP ni segundo canal automático si también falla el registro. Revisar que las copias no se solapen y el reinicio nocturno automático del kit no interrumpa trabajos largos. No se cambiaron por decisión unilateral esas políticas.

## Pasos finales hasta el 4 de diciembre

1. **Antes del 20 de noviembre — Pablo y apoyo técnico/jurídico:** confirmar buzón avisos@, tres buckets/identidades, retención, textos, registro mercantil y el procedimiento de mantenimiento/rollback. Guardar secretos en el gestor, nunca en conversaciones o Git.
2. **Antes del 27 de noviembre — desde Windows por SSH:** preparar el Ubuntu real con la pública de Pablo; probar segunda sesión antes de cerrar root; repetir setup y check-server; comprobar swap >=4 GiB, cortafuegos IONOS/Ubuntu, servicios, fail2ban y backups. Ejecutar el ensayo de aislamiento nativo y resolver cualquier fallo.
3. **27–30 de noviembre:** instalar un commit validado de esta rama con SITE_INDEXABLE=false. Verificar RAM durante build y navegación en el VPS; no construir durante copias. Crear administrador y cuentas reales, sin importación de demo. Cargar contenido municipal/editorial con derechos comprobados.
4. **30 de noviembre–2 de diciembre:** comprobar HTTPS real y www/DNS sin tocar MX/TXT del correo; probar recuperación, aviso municipal y alerta de memoria. Hacer copia SQL + originales, subirla cifrada a la otra región y restaurar en vacío. Comparar datos, imágenes, permisos, retiradas y motivos.
5. **3 de diciembre:** repaso con Pablo de la lista de bloqueos, logs y restauración. Conservar versión anterior y un procedimiento de recuperación probado. Aprobar el commit concreto y la apertura; no hacerlo si continúa algún bloqueo de seguridad/recuperación/legal.
6. **4 de diciembre:** con esa aprobación, SITE_INDEXABLE=true, comprobar portada/municipios/noticias/cookies/sitemaps y configurar monitor externo. GA4 solo con propiedad y textos revisados; no es necesario para abrir.
7. **Primera semana:** revisar memoria, disco de 120 GB, correo y copia diaria. Si RAM >85 % sostenida 10 minutos, investigar y preparar mudanza a otro servidor con copia/restauración; este M+ no se amplía. No contratar automáticamente ni limpiar volúmenes. La demo Netlify y las ramas históricas se gestionan aparte.

No comprobado: SSH del PC de Pablo al VPS, servicios/systemd/swap/cortafuegos y aislamiento nativos reales, DNS/ACME externos, SMTP entregado, S3/IAM/retención IONOS reales, carga sostenida del VPS y revisión jurídica profesional. No se han usado credenciales ni recursos de producción.

## Cierre por puntos del encargo

- **Punto 1 — kit de producción revisado:** cerrado como revisión de código y ensayos locales. Se conservan aparte las decisiones de aislamiento, escrituras/rollback, custodia age y efectos S3. No equivale a aprobar la apertura ni a una instalación en IONOS.

- **Punto 2** — adaptación a 4 GB: cerrado en código y pruebas locales. Construcción limitada a 1280 MiB, arranque y continuidad de la web comprobados; alerta >85 % durante 10 minutos probada. Swap objetivo 4 GiB; activación y carga del VPS real pendientes, sin certificar una VM global de 4 GB.
