# Instalar la actualización de seguridad de Next.js (16.4.3 → 16.4.5)

Para Claude Code en el PC de Pablo (Code local), con el agente SSH cargado.

Rama **`desarrollo/planta14-v2-next-seguridad`**, creada desde `desarrollo/planta14-v2-redaccion` (`022d525`, que es
`a79e302` más su documento de instalación). No se han tocado `main`, `mejora/presentacion-la-voz` ni el servidor. Sin PR.

**Commit a instalar: `HASH-CORTO`** (`HASH-NUEVO`). Se instala sobre **`a79e302`** (la entrega de la redacción).
**Sin migraciones. Caddy no cambia.** El commit siguiente solo completa este documento.

## Qué vulnerabilidad es

No es una sola: son **7 avisos** publicados el 3 de noviembre de 2026 para Next.js hasta 16.4.4, todos de gravedad
**moderada** (CVSS 4.0 entre 6,0 y 6,9), todos corregidos en **16.4.5**.

| Aviso | CVE | Qué afecta | ¿Nos afecta? |
|---|---|---|---|
| GHSA-mfr8-8qww-v76h | CVE-2026-119790 | Funciones `'use cache'` llamadas a través de `unstable_cache()` | No: no usamos `'use cache'` ni `unstable_cache` |
| GHSA-vc7v-qv4w-wrv8 | CVE-2026-119351 | Cache Components con `'use cache'` anidados | No: no está activado |
| GHSA-rhh4-g77r-r9qj | CVE-2026-119349 | `'use cache'` con argumentos binarios | No |
| GHSA-vvgp-ww4w-46vf | CVE-2026-119350 | `cacheComponents: true` con `next start` | No: no está activado |
| GHSA-f3mh-rxg3-f5g2 | CVE-2026-119346 | Rutas con runtime **Edge** que ponen cookies: las HttpOnly quedan legibles | No: no hay rutas Edge (el proxy y las rutas de la API, incluido el panel municipal, van en Node) |
| GHSA-pc58-hwjq-p385 | CVE-2026-119348 | Rutas que devuelven tal cual una respuesta pedida a otro servidor, detrás de un proxy HTTP/1.1 con *pipelining* | Prácticamente no: el puente del panel devuelve la respuesta de Payload del propio proceso, y Caddy no hace *pipelining* |
| GHSA-7qx7-33qx-rqx2 | CVE-2026-119347 | Optimizador de imágenes `/_next/image` (solo autoalojado): acepta un SVG aunque estén prohibidos | Sí, en teoría, con riesgo bajo: la web no usa `next/image`, pero la dirección está activa por defecto. Solo optimiza imágenes de nuestro dominio (no hay orígenes remotos permitidos) y el impacto es de disponibilidad |

No afectan a las acciones del servidor, al CMS, a las cuentas ni a las imágenes de Payload (van por S3, no por
`/_next/image`).

## Qué cambia

- `next` 16.4.3 → **16.4.5**, con el actualizador de seguridad de Next (`next upgrade --agent=security`). Solo cambian
  los 10 paquetes de Next en `package-lock.json` (`next`, `@next/env` y los binarios de SWC).
- **Payload, React y el resto, sin cambios** (no hacía falta). `eslint-config-next` se queda en 16.4.3: solo afecta al
  lint y no es imprescindible.
- Misma versión mayor: sin codemods ni cambios de código.
- El aviso que paraba la compilación en el entorno de Claude («Your version of Next.js is affected by a known security
  vulnerability») ya no aparece: la compilación termina a la primera.

## Memoria de la compilación

MEMORIA

## Pasos en pruebas.planta14.com (jueves por la noche)

**1. Entrar y ver el estado:**

```bash
ssh planta14@87.106.30.18
```

```bash
cd /srv/planta14/app
```

```bash
bash infra/deploy/status.sh --env-file infra/.env.production
```

Debe decir `/api/health: ok`, sin mantenimiento ni restauración pendiente, y la versión `a79e302`.

**2. Fijar el commit y desplegar:**

```bash
git fetch origin desarrollo/planta14-v2-next-seguridad
```

```bash
git checkout --detach HASH-NUEVO
```

```bash
git log -1 --format='%h %s'
```

Debe mostrar `HASH-CORTO` y el asunto del commit.

```bash
bash infra/deploy/deploy.sh --env-file infra/.env.production HASH-NUEVO
```

```bash
echo "código: $?"
```

Debe terminar en «Desplegada», con código 0, y decir «Sin migraciones nuevas». La imagen se compila en el servidor con
`npm ci` (descarga Next.js 16.4.5).

**3. Memoria:** durante la compilación del paso 2, en otra terminal:

```bash
free -m
```

Anota el máximo de la línea «Swap» y compáralo con el del martes.

**4. Estado otra vez:**

```bash
bash infra/deploy/status.sh --env-file infra/.env.production
```

Debe decir `/api/health: ok` y la versión `HASH-CORTO`.

**5. Si algo falla:** si `deploy.sh` terminó con código 1 o 2, sigue lo que dice. Si fue bien pero algo no funciona,
vuelve a `a79e302` (sin migraciones que deshacer):

```bash
git checkout --detach a79e3023d1adc628d63b92a7e08ec5b0cbe13052
```

```bash
bash infra/deploy/deploy.sh --env-file infra/.env.production a79e3023d1adc628d63b92a7e08ec5b0cbe13052
```

No hace falta `aplicar-caddy.sh`.

## Comprobaciones después del despliegue

En el ordenador y en el móvil:

1. **Versión de Next.js en la imagen:**

   ```bash
   docker compose -p planta14 -f infra/compose.production.yaml --env-file infra/.env.production exec -T app node -e "console.log(require('next/package.json').version)"
   ```

   Debe decir `16.4.5`. (Si el nombre del proyecto de Compose no es `planta14`, `status.sh` lo muestra.)
2. **Portada, una noticia, una página de sección y `/etiqueta/…`:** se ven bien; la imagen para redes de una noticia
   (`/noticia/…/redes.jpg`) se abre.
3. **CMS:** entra con una cuenta de la redacción, abre una noticia, guarda un borrador y abre la vista previa.
4. **Panel municipal:** entra con una cuenta de ayuntamiento, guarda un borrador y ciérralo; «Cerrar sesión» funciona.
5. **`/_next/image` sin SVG:** en una ventana normal, abre
   `https://pruebas.planta14.com/_next/image?url=%2Fimages%2Fplaceholder.svg&w=64&q=75`: debe responder con un error
   (400), no con la imagen.

## Resultados de la batería completa

RESULTADOS-BATERIA

## Dudas resueltas por prudencia

1. **Versión:** el actualizador de Next proponía 16.4.6; he instalado **16.4.5**, la versión corregida más cercana,
   como pediste (16.4.5 y 16.4.6 no tienen avisos abiertos).
2. **Del actualizador, no he hecho:** añadir `experimental.agentUpgrade` a `next.config.mjs` (no es necesario para que
   funcione), ejecutar su comando de telemetría (descarga y ejecuta una versión *canary* de Next) ni abrir un PR. La
   búsqueda de PR abiertos equivalentes que pide no está disponible en este entorno; en las ramas no había trabajo
   equivalente.
3. **`eslint-config-next`** sigue en 16.4.3: solo afecta al lint y no es imprescindible.
