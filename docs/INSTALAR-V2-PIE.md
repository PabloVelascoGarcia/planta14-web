# Instalar el pie nuevo, los lemas editables y /principios

Rama **`desarrollo/planta14-v2-pie`**, creada desde `desarrollo/planta14-v2-correcciones` (`0d13512`). **Commit a instalar: `c708a4e`** (`c708a4ebd0af47728ab2c975c69ddefe4529e4a0`). El commit siguiente solo añade documentación: este documento y el apartado 23 del manual. No se han tocado `main`, `mejora/presentacion-la-voz` ni el servidor. Sin PR.

Incluye todo lo de `desarrollo/planta14-v2-correcciones`. **Si en pruebas todavía no está instalado `1e0985a`**, sigue antes `docs/INSTALAR-V2-CORRECCIONES.md` (variables, importaciones de servicios y fiestas) o despliega directamente este commit y haz después sus pasos 4 a 8.

> **Batería completa: pasada una vez sobre `9d94fd6`.** Todo correcto salvo `test:portada`, por enlaces del pie de menos de 44 px de ancho en el móvil. Está corregido en `c708a4e` y repetí las dos pruebas afectadas (`test:portada` y la del pie), ambas correctas.

## Qué cambia

| Punto | Cambio |
|---|---|
| 1. Lemas | Ajuste global **«Lemas»**, que solo ve y edita la administración. Tiene los tres lemas actuales como valores iniciales y permite elegir cuál va bajo la cabecera, cuál en la frase lateral y cuál en el pie. **Puntuación unificada: los tres sin punto final** («Donde otros no llegan.» pasa a «Donde otros no llegan»). |
| 2. Pie | Cuatro columnas: **Planta 14** y el lema elegido · **Concejos** (los seis, a sus páginas) · **Participa** (Envía tu carta, Envía tu fiesta y WhatsApp si hay enlace) y **Proyecto** (Principios editoriales, Publicidad, Agenda, Útil y Contacto) · **Boletín** (el formulario completo). Se mantienen el estilo, el fondo negro, la tipografía y la franja inferior. Se quitan la columna «Redacción» y «El Caudal, Asturias.». Dos columnas en tableta y todo apilado en móvil, con zonas táctiles de 44 px. Títulos de columna: contraste de **11,7:1**; antes, unos 5,9:1. |
| 2b. WhatsApp | Ajuste global **«Pie de página»** (solo administración) con el enlace de WhatsApp. Sin enlace, no sale. Solo admite enlaces de WhatsApp. |
| 3. Principios | **`/principios`**, enlazada en el pie y en el sitemap, editable desde el ajuste global **«Principios editoriales»** (solo administración). Tiene entradilla y principios con título y texto, y el aviso «Texto provisional pendiente de revisión.», que se quita desde el CMS. Texto inicial breve y provisional: independencia, separación entre información, opinión y publicidad, contenido institucional identificado, rectificaciones, cartas con identificación y protección de fuentes. No cita a ninguna persona. |

**Migración nueva:** `20261105_092717_pie`, con las tablas de los tres ajustes globales. Se aplica sola al desplegar. Hasta que la administración los guarde, la web usa los valores iniciales. Sin variables nuevas en el `.env`.

## Pasos en pruebas.planta14.com

Desde el PC de Pablo, con el agente SSH cargado.

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

Debe decir `/api/health: ok`, sin mantenimiento ni restauración pendiente. **Anota la versión actual**: es a la que se vuelve si algo falla.

**2. Fijar el commit y desplegar:**

```bash
git fetch origin desarrollo/planta14-v2-pie
```

```bash
git checkout --detach c708a4ebd0af47728ab2c975c69ddefe4529e4a0
```

```bash
git log -1 --format='%h %s'
```

```bash
bash infra/deploy/deploy.sh --env-file infra/.env.production c708a4ebd0af47728ab2c975c69ddefe4529e4a0
```

```bash
echo "código: $?"
```

Debe terminar en «Desplegada», con código 0, y aplicar la migración `20261105_092717_pie`. Si venías de `684c787`, aplicará también la de correcciones:
- **código 1:** ha vuelto sola a la versión anterior;
- **código 2:** restauración asistida (`docs/MANUAL-OPERACION.md`, apartado 9).

**3. Comprobar:**

```bash
curl -s https://pruebas.planta14.com/api/health
```

Debe dar `"status":"ok"`.

`/principios` y el pie se comprueban en el navegador (apartado siguiente), porque la web de pruebas pide la contraseña de preproducción.

**4. Si algo falla: volver a la versión anterior.** Si `deploy.sh` terminó con código 1 o 2, sigue lo que dice. Si el despliegue fue bien pero algo no funciona después, vuelve a desplegar la versión anotada en el paso 1. Por ejemplo, la de correcciones:

```bash
git checkout --detach 1e0985a3062e244a8c2aeb7e3323917c5d697163
```

```bash
bash infra/deploy/deploy.sh --env-file infra/.env.production 1e0985a3062e244a8c2aeb7e3323917c5d697163
```

La migración nueva solo **crea** tablas de ajustes globales, que la versión anterior no usa, así que no hace falta deshacerla. Esa versión vuelve a mostrar el pie anterior.

## Qué mirar en el navegador

- **Pie, en la portada y en cualquier página:**
  - cuatro columnas en el ordenador: Planta 14 con «Orgullo de historia. Mirada al futuro»; Concejos; Participa y Proyecto; Boletín;
  - sin «Redacción» ni «El Caudal, Asturias.»;
  - el formulario del boletín completo: correo, «Elegir concejos y contenidos», consentimiento y «Política de privacidad».
- **En el móvil:** todo apilado y cómodo de pulsar. **En una tableta en vertical:** dos columnas.
- **Cabecera:**
  - «Una voz para las Cuencas» bajo «Planta 14»;
  - en el ordenador, a la izquierda, «Donde otros no llegan», ahora sin punto.
- **CMS → Globales → Lemas:** como administración, cambia qué lema va en cada sitio, guarda y recarga la portada. Después déjalo como estaba.
- **CMS → Globales → Pie de página:** pega el enlace del canal de WhatsApp (si lo hay): aparece «WhatsApp» en Participa.
- **`/principios`:** el aviso «Texto provisional pendiente de revisión.» y los seis principios. Cuando esté revisado, desmarca el aviso en CMS → Globales → Principios editoriales.
- **Con una cuenta de redacción:** los tres ajustes no se pueden guardar.

## Resultados de la batería completa

**Batería completa sobre `9d94fd6`:**

| Prueba | Resultado |
|---|---|
| `production-deploy-test.sh` | **SUPERADO**: construye la imagen y aplica la migración del pie |
| `npm test`, `typecheck`, `lint`, `build` | Correctos; lint con 0 errores y 16 avisos de estilo |
| `test:block2` / `block3` / `launch` / `instalacion` / `ensayo` / `formulario` | 8 / 17 / 6 / 16 / 8 / 3 PASS |
| `test:participacion` | **33 PASS**, con los dos nuevos del pie: lemas, WhatsApp, principios y permisos; maquetación a 1440, 820 y 390 px, zonas táctiles y contraste (11,7:1) |
| `test:portada` | **Falló**: en el móvil, en `/mieres`, los enlaces «Lena», «Aller», «Riosa» y «Útil» del pie medían 44 px de alto pero menos de 44 de ancho |
| shellcheck, Caddy, `common-test`, `staging-config-test`, `monitor-test`, `memory-test`, `staging-guard-test` | Correctos |
| `restore-test.sh` (tres variantes), `offsite-immutable-test`, `pruebas-config-test`, `preproduccion-test`, `postgres-roles-test`, `staging-e2e.sh` | SUPERADAS, sin volúmenes nuevos ni restos |

**Arreglo y repetición (`c708a4e`):** los enlaces del pie tienen ahora también un ancho mínimo de 44 px, y la prueba del pie comprueba alto y ancho. Repetidas: `test:portada`, 9 PASS, y los bloques de fiestas, boletín y pie de `test:participacion`, correctos.

## Dudas resueltas por prudencia

1. **Puntuación de los lemas:** los tres **sin punto final**, porque son lemas y no frases. Se mantiene el punto interior de «Orgullo de historia. Mirada al futuro», que separa sus dos partes.
2. **Dónde va el enlace de WhatsApp:** en un ajuste global aparte, «Pie de página», no dentro de «Lemas», para que «Lemas» sea solo eso. Los dos son solo de la administración. Solo se admiten enlaces de WhatsApp, para que nadie ponga ahí otra web por error.
3. **Lemas fuera de la web principal:** la cabecera de las páginas de concejo, el correo de recuperación de contraseña, la imagen para redes (`og:image`) y la revista de la demo mantienen «Una voz para las Cuencas» fijo. El encargo pedía cabecera, frase lateral y pie, y esos textos forman parte de la marca o de una imagen ya generada.
4. **Enlace a la política de privacidad del boletín:** dentro de la frase del consentimiento medía 25 px de alto en el móvil. Para cumplir los 44 px pedidos, pasa a su propia línea, justo debajo del consentimiento, en todos los formularios del boletín (portada, pie, noticias y fiestas). El texto del consentimiento sigue citando la política de privacidad.
5. **Contraste:** los títulos de columna ya cumplían AA (unos 5,9:1). Los subo a 11,7:1 (`text-paper/80`), igual que el lema y la franja inferior, para que se lean mejor sobre el negro.
6. **Principios:** cada principio se guarda como título y texto (párrafos separados por una línea en blanco), no en texto enriquecido. Es más sencillo de editar y no se puede romper la maquetación de la página.
7. **«Demo municipal»:** solo con la demo (`CONTENT_SOURCE=demo`), como antes; sale bajo Proyecto. Con contenido real no aparece.
