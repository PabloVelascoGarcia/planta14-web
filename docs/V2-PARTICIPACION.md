# Planta 14 v2: participación (responsables, fiestas, boletín, última hora)

Rama **`desarrollo/planta14-v2-participacion`**, creada desde `desarrollo/planta14-v2-revision-portada` (`9c19b92`). No se han tocado `main` ni el servidor. Sin PR.

> **ESTA RAMA TODAVÍA NO SE INSTALA.**
>
> - **La batería completa de pruebas está PENDIENTE.** Por indicación de Pablo, en esta sesión solo se han pasado las pruebas rápidas de cada bloque (abajo).
> - **Otra sesión continuará en esta misma rama** con más bloques y pasará la batería completa una sola vez, al final de todo. Esa sesión dará el commit a instalar.
> - **Hasta entonces, no hay commit a instalar.** Los pasos para Code local de más abajo son para ese momento.

## Commits (uno por bloque)

| Commit | Bloque |
|---|---|
| `de89639` | 1. Periodista responsable por concejo y «Pendientes de revisar» |
| `d103290` | 2. Fiestas de las Cuencas |
| `b81962d` | 3. Suscripción al boletín (doble confirmación) |
| `e4f92d8` | 4. Barra de «Última hora» |
| `4e1715c` | 5. Google Discover |
| `07e6368` | 6. Fechas del CMS en `dd/MM/yyyy HH:mm` |

El commit posterior añade los apartados 12 y 14 a 17 del manual de operación (`docs/MANUAL-OPERACION.md`) y este documento.

**Migraciones nuevas**, que se aplican solas al desplegar:
- `20261104_195227_responsables`;
- `20261104_200318_fiestas`;
- `20261104_201144_suscriptores`;
- `20261104_202002_ultima_hora`.

**Variables del `.env`:** ninguna nueva. Pero los formularios públicos (fiestas y boletín) y los correos a los responsables **necesitan `SMTP_ENABLED=true`**, con el buzón avisos@planta14.com (`docs/PUESTA-EN-MARCHA-IONOS.md`, apartado 7). Sin él, los formularios avisan de que no están disponibles y no guardan nada, y los pendientes se crean igual, pero sin correo.

## Qué hace cada bloque

**1. Responsables por concejo:**
- **Campo nuevo:** Concejos → «Periodista responsable» (usuario de la redacción). Solo lo cambia la administración y no es público.
- **Lo que llega de fuera:** crea un pendiente asignado al responsable del concejo, que recibe un correo con el enlace. Hoy son las publicaciones de los ayuntamientos y las fiestas enviadas.
- **Cartas:** no hay formulario de cartas en la web, así que no se ha tocado. Cuando exista, usará este mismo camino (`createPendingNotice` en `cms/responsables.ts`).
- **Panel de inicio:** muestra «Pendientes de revisar» a cada periodista con lo suyo; la administración ve todo. La colección «Avisos municipales» pasa a llamarse «Pendientes de revisar».
- **Valores iniciales:** `npm run cms:responsables` crea, si faltan, las cuentas de Andrés y Juanfran Santos (Redacción, contraseña aleatoria que no se muestra; entran con «¿Olvidaste tu contraseña?») y los asigna:
  - Andrés: Aller, Mieres y Morcín;
  - Juanfran: Lena, Riosa y Ribera de Arriba.

  Se puede repetir: no pisa una elección posterior.

**2. Fiestas de las Cuencas:**
- **Colección Fiestas**, con borradores:
  - nombre, pueblo y concejo;
  - días de inicio y fin;
  - programa en texto enriquecido;
  - cartel opcional, con declaración de derechos y copia pública igual que en las noticias;
  - organizador y contacto, que no son públicos;
  - crónica;
  - «se repite cada año».
- **`/fiestas`:**
  - «Este fin de semana» y calendario por meses;
  - filtro por concejo;
  - ningún cartel en los listados.
- **Ficha:** cartel pequeño y enmarcado (200 px; 160 px en móvil), datos `Event` y botones de compartir.
- **Otros sitios:** también en la agenda, en la página del concejo y, en portada, un bloque solo de texto «De fiesta este fin de semana».
  - **Añadido:** si no hay fiestas ese fin de semana, el bloque muestra «Próximas fiestas».
  - **Requisito:** la portada necesita al menos una noticia publicada.
  - **Menú:** enlace «Fiestas».
- **«Envía tu fiesta»:**
  - queda como borrador oculto y se pide confirmar por correo; el enlace abre una página con un botón, de un solo uso y que caduca en 7 días;
  - al confirmar, se crea el pendiente para el responsable del concejo y le llega un correo;
  - campo trampa contra robots y 5 envíos al día como mucho por correo.
- **«Duplicar para el año siguiente»:** un botón en la ficha del CMS crea un borrador 52 semanas después (mismo día de la semana), sin cartel ni crónica.
- **`npm run cms:fiestas:importar`:**
  - valida todo el JSON antes de importar;
  - opciones `--solo-comprobar` y `--publicar`;
  - se puede repetir sin duplicar; con `-` lee el archivo de la entrada estándar;
  - formato en `docs/ejemplos/fiestas.json`.

**3. Boletín (solo captar y confirmar):**
- **Dónde está el formulario:** portada, pie (con las opciones plegadas), noticias y fichas de fiestas.
- **Qué elige cada persona:** concejos (ninguno equivale a los seis) y «Qué hacer este finde» / «Avisos de mi concejo».
- **Consentimiento:** claro, con enlace a la privacidad. La política se ha completado con el boletín y las fiestas enviadas, pero aún tiene huecos por rellenar, como el proveedor de correo y los plazos.
- **Doble confirmación:** con botón en la página del enlace. Las preferencias, también al cambiarlas, se aplican solo al confirmar.
- **Baja con un clic:** cada correo lleva un enlace que abre una página con un botón, más las cabeceras `List-Unsubscribe` y `List-Unsubscribe-Post` (RFC 8058).
- **Colección Suscriptores:** solo administración, con exportación CSV de todos o de los confirmados.
- **Envío del boletín:** queda para el siguiente encargo.

**4. Última hora:** global del CMS con mostrar, texto, enlace y caducidad. Pinta una barra roja bajo la cabecera (no en las páginas de concejo), que se quita sola al caducar.

**5. Google Discover:**
- **Robots:** `max-image-preview:large`, solo si `SITE_INDEXABLE=true`.
- **Imagen para redes, Discover y JSON-LD:** la de 1600 px; si no existe, el original; la de 800 px solo si el original es más pequeño.
- **JSON-LD:** `ImageObject` con ancho y alto.

**6. Fechas del CMS:** `admin.dateFormat = 'dd/MM/yyyy HH:mm'` para las listas, los datos del documento y las versiones.

**Arreglo de paso:** al mostrar errores, React vaciaba los formularios de fiestas y de boletín. Ahora conservan lo escrito; solo el archivo del cartel hay que volver a elegirlo.

## Pruebas pasadas (solo rápidas)

| Prueba | Resultado |
|---|---|
| **`npm run test:participacion`** (nueva; base de `compose.ensayo-test.yaml`, S3rver, buzón de correo de pruebas y Chromium) | **12 PASS** sobre el estado final: 2 de responsables, 4 de fiestas, 3 de boletín y 3 de los bloques 4 a 6 |
| `npm run test:block2` | 8 PASS (después de los bloques 2, 3 y 4 a 6) |
| `npm run test:block3` | 17 PASS (después del bloque 1) |
| `npm run test:instalacion` | 16 PASS (después de los bloques 1, 2 y 3) |
| `npm run test:launch` | 6 PASS (después de los bloques 4 a 6; su JSON-LD se ha actualizado al `ImageObject`) |
| `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` | Correctos; lint con 0 errores y 14 avisos, todos de estilo (`<img>` en lugar de `<Image>` y similares) |

**Sin pasar en esta rama** (para la batería completa):
- `production-deploy-test.sh`, que ensaya el despliegue con las cuatro migraciones nuevas;
- `test:ensayo`, `test:formulario` y `test:portada` (esta última comprueba tamaños de texto y desbordes en móvil, y ahora hay formularios nuevos en portada y pie);
- `staging-e2e`, las restauraciones y el resto de pruebas de `infra/`.

**`npm run test:participacion` comprueba:**
1. **`cms:responsables`:**
   - cuentas creadas y asignadas;
   - se puede repetir sin pisar una elección posterior;
   - solo la administración cambia el responsable y no es público;
   - una publicación de Lena crea un pendiente para Juanfran, con correo y enlace.
2. **Panel de inicio:** Juanfran ve 1 pendiente y Andrés 0.
3. **Fiestas:**
   - fin de semana, calendario, filtro y fiestas pasadas ocultas;
   - sin carteles en los listados; cartel de 220 px como mucho en escritorio y 170 px en móvil, servido desde la copia pública;
   - organizador y contacto no salen en la web ni en la API;
   - aparecen en la agenda, en el concejo y en el bloque de portada sin imágenes.
4. **«Envía tu fiesta»:**
   - errores; borrador oculto y sin pendiente antes de confirmar;
   - correo, botón y enlace de un solo uso;
   - pendiente y correo para Juanfran; cartel con la declaración de quien lo envía, público solo al publicar la fiesta;
   - campo trampa.
5. **Duplicar:** con un clic en el CMS, 52 semanas después y en el mismo día de la semana; nadie de fuera de la redacción puede hacerlo.
6. **Importador:** validación de todo o nada, `--solo-comprobar` y `--publicar`; se puede repetir; rechaza opciones desconocidas.
7. **Boletín:**
   - el formulario está en los cuatro sitios;
   - sin consentimiento no guarda nada, y conserva lo escrito tras un error;
   - doble confirmación con botón, de un solo uso;
   - el cambio de preferencias también se confirma;
   - límite de dos minutos entre correos y cabeceras de baja.
8. **Baja:**
   - un GET no da de baja; el botón sí;
   - el POST de un clic también da de baja.
9. **Suscriptores:**
   - nadie fuera de la administración los ve;
   - nadie los crea por la API;
   - exportación CSV de todos o de los confirmados.
10. **Última hora:** validación; se ve en varias páginas, pero no en las de concejo; caduca y se desactiva.
11. **Discover:**
    - `noindex` sin indexar e `index, follow, max-image-preview:large` al indexar;
    - `og:image` y JSON-LD de 1600 px.
12. **Fechas:** las listas del CMS en `dd/MM/aaaa HH:mm` (navegador real).

## Qué debe hacer Code local, cuando la otra sesión dé el commit a instalar

No antes. Este es el orden para los bloques de esta sesión; la otra sesión completará la lista con lo suyo.

**1. Comprobar el correo.** En `infra/.env.production` debe estar `SMTP_ENABLED=true` con la contraseña de avisos@planta14.com (`docs/PUESTA-EN-MARCHA-IONOS.md`, apartado 7). Sin él, los formularios de fiestas y del boletín no funcionan.

**2. Desplegar el commit indicado.** Igual que siempre: `status.sh`, después `git fetch` y `git checkout --detach <commit>`, y después `deploy.sh`. Aplica las migraciones: las cuatro de esta rama y las de la otra sesión.

**3. Cargar los responsables** (una vez; se puede repetir):

```bash
installed=$(cut -c1-12 /srv/planta14/state/current)
```

```bash
APP_IMAGE="planta14-app:$installed" docker compose -f infra/compose.production.yaml --env-file infra/.env.production --profile migrate run --rm -T migrate npm run cms:responsables
```

Debe terminar en «RESPONSABLES CARGADOS» y listar los seis concejos. Si ha creado las cuentas, Andrés y Juanfran entran la primera vez en `/cms` con «¿Olvidaste tu contraseña?».

**4. Precargar fiestas** (opcional, si Pablo da un JSON con el formato de `docs/ejemplos/fiestas.json`). Primero se comprueba y luego se importa:

```bash
APP_IMAGE="planta14-app:$installed" docker compose -f infra/compose.production.yaml --env-file infra/.env.production --profile migrate run --rm -T migrate npm run cms:fiestas:importar -- - --solo-comprobar < fiestas.json
```

```bash
APP_IMAGE="planta14-app:$installed" docker compose -f infra/compose.production.yaml --env-file infra/.env.production --profile migrate run --rm -T migrate npm run cms:fiestas:importar -- - < fiestas.json
```

Las fiestas entran como borrador. Añade `--publicar` para que salgan publicadas.

**5. Comprobar en el navegador:**
- **Fiestas:**
  - `/fiestas`, una ficha y `/fiestas/enviar`;
  - envía una fiesta de prueba con un correo propio, confírmala y comprueba que le llega al responsable del concejo;
  - después bórrala.
- **Boletín:**
  - suscríbete desde la portada, confirma y date de baja desde el correo;
  - en el CMS, como administración, mira Suscriptores y la exportación.
- **Última hora:** actívala con una caducidad cercana y comprueba que aparece y que se quita sola.
- **CMS:**
  - «Pendientes de revisar» en el inicio de cada periodista;
  - fechas en `dd/MM/aaaa HH:mm`;
  - en una fiesta, «Duplicar para el año siguiente».

## Sin comprobar

- **Todo lo que cubre la batería completa** (ver la lista de arriba): queda para el final de la otra sesión.
- **El correo real desde IONOS.** Las pruebas usan un buzón de archivo. No se ha comprobado:
  - la entrega real, ni que no acabe en spam;
  - que los programas de correo muestren su propio «Cancelar suscripción» con las cabeceras `List-Unsubscribe`.
- **La política de privacidad:** se han añadido el boletín y las fiestas enviadas, pero quedan los huecos que ya tenía, como el proveedor de correo y los plazos. Debe revisarla quien lleve la parte legal antes de captar suscriptores reales.
