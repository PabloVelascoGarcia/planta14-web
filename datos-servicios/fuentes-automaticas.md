# Fuentes automáticas para los servicios del Caudal

Revisión: **4 de noviembre de 2026**. Ámbito: Mieres, Lena, Aller, Morcín, Riosa y Ribera de Arriba.

Este archivo documenta accesos y condiciones; no instala recolectores. «No localizado» significa que no se ha encontrado un contrato público de API o RSS, no que sea imposible un acuerdo con el titular. La frecuencia de consulta propuesta es una decisión para Planta 14 y se distingue de la actualización declarada por la fuente. Los estados de carretera y nieve deben mostrar la hora del parte, además de la hora de descarga.

## Resumen de integración

| Información | Fuente y formato | Clave | Actualización de origen | Consulta propuesta |
|---|---|---|---|---|
| Puerto de Pajares | DGT NAP, XML DATEX II 3.7 | GET anónimo comprobado | 1 minuto, según catálogo | 1–5 minutos, una descarga compartida |
| Puerto de San Isidro | SEPA/112 Asturias, HTML | No para la página pública | Sin intervalo garantizado localizado | 5–10 minutos si se confirma reutilización |
| Valgrande-Pajares | Parte oficial, HTML | No para consultar | Sin intervalo garantizado localizado | 15 minutos en temporada, si se acuerda reutilización |
| Fuentes de Invierno | Parte oficial, HTML | No para consultar | Sin intervalo garantizado localizado | 15 minutos en temporada, si se acuerda reutilización |
| Predicción municipal | AEMET OpenData, REST/JSON; RSS de avisos de actualización | Sí en la API | Fecha de elaboración incluida en el producto | Notificación RSS o cada hora, con caché |
| Farmacias de guardia | COF Asturias, formulario HTML | Sin clave para consulta pública | Turnos por fecha; sin SLA localizado | **No activar extracción periódica sin aclarar permiso** |
| Subvenciones | SNPSAP/BDNS, REST/JSON | GET público comprobado sin clave | Según incorporación por los órganos; sin SLA localizado | Cada 6 horas; revisión de bases y plazos |
| Empleo BOE | API JSON/XML y RSS | No en los accesos comprobados | Cada edición del boletín | RSS y una comprobación diaria |
| Empleo BOPA | Sumario y disposiciones HTML/PDF | No para consulta pública | Cada publicación y posibles correcciones | Una comprobación diaria |
| Empleo municipal | Web y documentos del ayuntamiento | No en páginas públicas | Cuando publica cada ayuntamiento | Diario; no confundir con RSS de noticias general |

## 1. Puerto de Pajares: DGT

- Catálogo vigente: [Incidencias DGT DATEX2 v3.7](https://nap.dgt.es/es/dataset/incidencias-dgt-datex2-v3-7).
- Recurso: [XML SituationPublication](https://nap.dgt.es/datex2/v3/dgt/SituationPublication/datex2_v37.xml). Comprobado HTTP 200, XML válido y acceso sin credenciales.
- Consultar el conjunto completo y seleccionar el tramo de la **N-630 del puerto de Pajares**, en ambas vertientes. Validar carretera, localización, sentido, vigencia y restricciones por vehículo con el perfil XSD del catálogo.
- No confundirlo con la AP-66/Huerna ni considerar «abierto» un puerto por no aparecer una incidencia.
- El catálogo declara actualización cada minuto y licencia **Creative Commons Attribution**, sin versión concreta identificada en la ficha. Citar DGT, preservar fechas y revisar los [términos enlazados por el catálogo](https://www.dgt.es/contenido/aviso-legal/); esta página legal agotó el tiempo de respuesta durante la revisión.
- La [antigua URL de Infocar](https://infocar.dgt.es/datex2/dgt/SituationPublication/all/) anuncia la retirada del servicio. No usarla como acceso de producción.

## 2. Puerto de San Isidro: Principado / SEPA

La referencia es [Estado de las carreteras y circulación](https://www.112asturias.es/estado-carreteras), enlazada desde el portal oficial del SEPA. La carretera asturiana del puerto es la **AS-112**, según la [documentación oficial de vialidad invernal](https://actualidad.asturias.es/documents/533407/0/2024_11_01%2BNP%2BPlan%2Bvialidad%2Binvernal.pdf/a3cf46dd-f64b-9c5f-5945-cfc43306e0e2?t=1730397942308).

La página contiene tablas y filtros por concejo y carretera; también incorpora acceso al mapa DGT. El HTML se obtuvo sin clave. **No se ha localizado una API o RSS público documentado para este parte.** Un lector de HTML sería una integración frágil, sin contrato de estabilidad.

Seleccionar Aller/AS-112 y revisar también los cortes de carretera, no solo la tabla de puertos. Una tabla sin filas no acredita apertura. El campo de inicio de incidencia no es necesariamente la última verificación del estado.

Frecuencia de origen y licencia específica del parte: **dudosas/no verificadas**. Revisar el [aviso legal del SEPA](https://www.112asturias.es/aviso-legal) y consultar al titular antes de republicar automáticamente. Hasta aclararlo, enlazar el parte oficial.

## 3. Estaciones de esquí

Su carácter oficial se contrasta en [Estaciones de esquí del Principado](https://www.asturias.es/temas/educacion-deporte/instalaciones-centros-tecnificacion-deportiva/estaciones-esqui).

### Valgrande-Pajares — Lena

- [Parte de nieve y webcams](https://www.valgrande-pajares.com/parte-de-nieve-meteo/); [portada oficial](https://www.valgrande-pajares.com/).
- HTML: estado, accesos, pistas, remontes, nieve y fecha/hora del parte. Consulta pública sin clave. **API/RSS específico de estado no localizado**; un canal de noticias no sustituye el parte.
- No se ha localizado una frecuencia de publicación garantizada. Fuera de temporada pueden conservarse partes anteriores.
- El [aviso legal](https://www.valgrande-pajares.com/aviso-legal/) reserva derechos sobre el sitio: no se ha verificado una licencia abierta para redistribuir el parte, imágenes o webcams. Confirmar acuerdo o permiso para una integración estable.

### Fuentes de Invierno — Aller

- [Parte oficial](https://www.fuentesdeinvierno.com/es/parte-meteorologico.html).
- HTML público con accesos por vertiente, pistas y remontes; no se ha localizado API/RSS documentado. Comprobado acceso sin clave.
- Frecuencia garantizada no localizada. El contenido puede corresponder al cierre de una temporada; una descarga reciente no lo vuelve actual.
- Su [aviso legal](https://www.fuentesdeinvierno.com/52/aviso-legal.html) no cede de forma general los derechos de explotación de la web. **Permiso de reutilización automática del parte no confirmado.**
- Los accesos indicados por la estación no sustituyen el estado oficial de la carretera. No extraer imágenes de las webcams para publicarlas sin revisar sus derechos.

## 4. AEMET: predicción por municipio

[Documentación oficial de OpenData](https://opendata.aemet.es/dist/) y [obtención de clave](https://opendata.aemet.es/centrodedescargas/inicio).

| Concejo | Identificador municipal |
|---|---|
| Mieres | 33037 |
| Lena | 33033 |
| Aller | 33002 |
| Morcín | 33038 |
| Riosa | 33058 |
| Ribera de Arriba | 33057 |

Identificadores contrastados con la [relación oficial de municipios de AEMET](https://www.aemet.es/documentos/es/eltiempo/prediccion/avisos/plan_meteoalerta/detalle_municipios_zonas_meteorologicas.pdf).

Accesos REST documentados:

- `https://opendata.aemet.es/opendata/api/prediccion/especifica/municipio/diaria/{municipio}`
- `https://opendata.aemet.es/opendata/api/prediccion/especifica/municipio/horaria/{municipio}`

Enviar la clave mediante el mecanismo descrito en OpenData. La respuesta de control facilita las URL de datos y metadatos; descargar el contenido desde ellas y conservar elaboración y periodo previsto. No persistir como permanente una URL temporal de descarga. Los [RSS/Atom oficiales](https://opendata.aemet.es/centrodedescargas/rssatom) notifican actualizaciones; no equivalen al JSON completo.

Las [novedades de octubre de 2026](https://opendata.aemet.es/centrodedescargas/novedades) anuncian caducidad de claves antiguas y validez de tres meses para las nuevas. Prever renovación; no guardar claves en estos archivos. No se solicitó una clave ni se probó una descarga autenticada.

La [nota legal de AEMET](https://www.aemet.es/es/nota_legal) permite reutilización comercial y no comercial con atribución, fecha y metadatos, integridad del contenido técnico y sin sugerir patrocinio. Distingue reproducción y productos de valor añadido: usar la fórmula de atribución que corresponda. No se ha verificado un SLA específico para los seis municipios; seguir la elaboración del producto.

## 5. Farmacias de guardia: Colegio Oficial de Farmacéuticos de Asturias

- [Buscador oficial](https://www.farmasturias.org/GESCOF/cms/Guardias/FarmaciaBuscar.asp?IdMenu=111).
- HTML con formulario POST. En la inspección aparecen los campos de fecha, municipio y localidad; la consulta pública no exige clave de API. **No se ha localizado API/RSS público documentado.**
- Los turnos tienen fecha y pueden cambiar; no se ha localizado un compromiso de actualización ni una licencia de datos abiertos.
- **¿El Colegio permite reutilizar sus datos? No se ha podido confirmar una autorización pública expresa para extraerlos y republicarlos automáticamente.** La accesibilidad del formulario no acredita ese permiso. El [enlace de aviso legal del Colegio](https://www.farmasturias.org/gescof/cms/contenidos/contenido.asp?id=1619&IdMenu=421) ofrece información de privacidad/cookies, sin una autorización de reutilización del directorio que se haya podido verificar.
- Confirmar por escrito con el Colegio el uso editorial/comercial, método de acceso, atribución, caché, frecuencia y correcciones. No se ha contactado con él.
- Mientras tanto, publicar el enlace oficial. «Sin datos para un concejo» no debe convertirse en «no hay farmacia de guardia» ni asignarse una guardia cercana sin confirmación.

## 6. Subvenciones abiertas: BDNS / SNPSAP

Fuentes: [API oficial](https://www.infosubvenciones.es/bdnstrans/doc/swagger), [especificación OpenAPI](https://www.infosubvenciones.es/bdnstrans/estaticos/doc/snpsap-api.json) y [catálogo institucional](https://datos.gob.es/es/catalogo/e05250001-base-de-datos-nacional-de-subvenciones).

Comprobado HTTP 200 y JSON sin clave en:
`https://www.infosubvenciones.es/bdnstrans/api/convocatorias/ultimas?vpd=GE&page=0&pageSize=1`.

La especificación documenta búsqueda, detalle y documentos: `/convocatorias/busqueda`, `/convocatorias?numConv=...` y `/convocatorias/documentos?idDocumento=...`, bajo `/bdnstrans/api`. Usar paginación y los identificadores oficiales de órganos y regiones; resolverlos con el catálogo, no inventarlos. Cubrir ayudas municipales, autonómicas y estatales aplicables.

La fecha de recepción no es el fin de solicitud. Para clasificar «abierta», revisar plazo, bases, extracto y modificaciones; dejar «plazo pendiente de comprobar» cuando solo exista una expresión relativa o contradictoria. Desduplicar por código BDNS y revisar correcciones.

Acceso público no equivale a permiso ilimitado de carga: las condiciones permiten limitar abusos. Consultar el [aviso legal del SNPSAP](https://www.infosubvenciones.es/bdnstrans/GE/es/avisolegal). Su contenido requiere la aplicación web y no resultó legible en el extractor: **la licencia concreta queda pendiente de verificación**, aunque la documentación oficial presenta el servicio para reutilización. No extraer beneficiarios personales para este uso de convocatorias.

## 7. Empleo público: BOE

[API de datos abiertos](https://www.boe.es/datosabiertos/api/api.php):

`https://www.boe.es/datosabiertos/api/boe/sumario/{AAAAMMDD}`

Comprobado HTTP 200 y JSON del sumario de 20261103, sin clave, solicitando `Accept: application/json`. Filtrar la sección II.B y seguir los enlaces al documento. El [RSS oficial de oposiciones y concursos de la sección II.B](https://www.boe.es/rss/boe.php?s=2B) devolvió HTTP 200 y XML válido; también figura en el [directorio RSS del BOE](https://www.boe.es/rss/).

Buscar los seis concejos, variantes de topónimo y órganos convocantes. No limitar la selección a municipios: incluir convocatorias generales aplicables. Una oferta de empleo público no equivale a una convocatoria abierta. Revisar bases, publicación que abre el plazo y rectificaciones.

Las [condiciones de reutilización del BOE](https://www.boe.es/informacion/aviso_legal/index.php#reutilizacion) autorizan usos comerciales/no comerciales con sus obligaciones de atribución, enlace, fecha, identificación de transformaciones y ausencia de apariencia oficial. Hay exclusiones para diseño, marcas y materiales de terceros. No se aplica aquí la licencia de la Biblioteca Jurídica Digital.

## 8. Empleo público: BOPA

Puntos oficiales: [sumario](https://miprincipado.asturias.es/bopa-sumario) y [disposiciones](https://miprincipado.asturias.es/bopa/disposiciones).

Formato localizado: HTML y documentos oficiales enlazados. Consulta pública sin clave. **API de sumarios o RSS específico de empleo no verificados**: no se debe inventar un endpoint a partir de los parámetros internos de Liferay.

Recorrer los sumarios publicados, identificar anuncios por concejo y órgano, guardar referencia BOPA y enlazar la disposición. Mantener correcciones y distinguir bases, convocatorias, listas y nombramientos. Actualización: cuando se publica una edición; no se ha verificado un SLA adicional.

**Reutilización: pendiente de verificar la condición específica del portal vigente.** Priorizar extracción de metadatos y resúmenes propios enlazados a la disposición; no presentar la copia de Planta 14 como texto auténtico. El acceso público no acredita una licencia abierta de todo el portal.

## 9. Empleo en los seis ayuntamientos

| Concejo | Dirección oficial localizada | Formato y situación |
|---|---|---|
| Mieres | [Anuncios de empleo](https://www.mieres.es/anuncios-de-empleo) | Web/documentos |
| Lena | [Empleo y formación](https://www.aytolena.es/empleo-y-formacion) | Web/documentos |
| Aller | [Empleo](https://www.aller.es/empleo) y [noticias de empleo](https://www.aller.es/noticias11) | Web/documentos; contiene anuncios de convocatorias |
| Morcín | [Empleo](https://www.morcin.es/empleo) | Web/documentos |
| Riosa | [Selección de personal](https://www.ayuntamientoriosa.com/seleccion-de-personal-y-provision-de-puestos) y [ofertas municipales](https://www.ayuntamientoriosa.com/agencia-de-desarrollo-local) | Web/documentos |
| Ribera de Arriba | [Empleo público](https://www.ayto-riberadearriba.es/empleo-publico) | Web/documentos |

En estos accesos no se ha verificado una API o RSS estable y específico de selección de personal. El RSS genérico de un portal, si lo ofrece, no garantiza cubrir los anexos del tablón o de la sede electrónica.

Revisar diariamente listados y documentos enlazados, conservando URL, fecha y huella del documento para detectar sustituciones. Contrastar con sede/tablón y publicación oficial que determine los plazos. No usar el perfil de contratación administrativa como sustituto del empleo público. Para documentos escaneados puede hacer falta OCR, con revisión de fechas.

No se ha verificado una licencia homogénea para los seis portales. **Condiciones de extracción y republicación automatizada pendientes por ayuntamiento**; solicitar canal o autorización al titular si no publica condiciones suficientes. No se han enviado solicitudes ni implantado robots.

## Comprobaciones y pendientes de integración

Comprobados con descarga anónima y análisis de formato: XML DATEX II, RSS II.B del BOE, JSON del sumario BOE y JSON de últimas convocatorias BDNS. Inspeccionados: HTML del SEPA, ambas estaciones y formulario de guardias. Leída la documentación de AEMET, sin credenciales disponibles.

No se han probado recolectores permanentes ni se han comprobado todos los avisos de cada concejo. Falta resolver permisos de guardias, partes de estaciones y portales sin licencia clara; estabilizar accesos BOPA/municipales y realizar la prueba autenticada AEMET.

Al presentar datos dinámicos, conservar estado desconocido, error y antigüedad. Una respuesta vacía, bloqueada o caducada no puede transformarse automáticamente en apertura de una carretera, ausencia de guardias o inexistencia de convocatorias.

