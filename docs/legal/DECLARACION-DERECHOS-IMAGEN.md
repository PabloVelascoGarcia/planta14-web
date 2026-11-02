# Declaración de derechos de imagen de las cuentas municipales

> **Pendiente de revisión por abogado.** El texto corto es el que se guarda hoy con cada imagen (versión `v1`). Si el abogado lo cambia, hay que actualizar también el código (`municipalRightsStatement` en `cms/collections.ts`) y la página `/condiciones-cuentas-municipales`, y subir la versión (`v2`) para distinguir qué declaró cada imagen.

## Texto corto (casilla obligatoria del panel)

Aparece junto a la casilla que el personal municipal debe marcar al subir una imagen. Se guarda con la imagen, junto con la cuenta que lo marcó y la fecha y hora:

> v1 · [Ayuntamiento] declara que tiene los derechos necesarios para publicar esta imagen en Planta 14 y que el autor o crédito indicado es correcto.

La casilla y el campo «Autoría o crédito» son obligatorios: sin ellos la imagen no se sube.

## Texto completo (condiciones de uso y contrato)

Al marcar la declaración, el Ayuntamiento de [NOMBRE DEL AYUNTAMIENTO], a través de la persona usuaria de su cuenta municipal, declara bajo su responsabilidad que:

1. **Titularidad o licencia.** Es autor de la imagen o tiene la autorización o licencia de su autor o titular de derechos para reproducirla y comunicarla públicamente en Planta 14, en su espacio municipal y en las vistas previas que se generen al compartir el enlace en redes sociales y aplicaciones de mensajería, durante el tiempo que el contenido permanezca publicado.
2. **Personas reconocibles.** Las personas que aparecen y pueden ser identificadas han dado su consentimiento a la publicación, o existe otra base legal que la permite. Si hay menores, se cuenta con el consentimiento de quienes ejercen su patria potestad o tutela, o con el del propio menor cuando legalmente proceda.
3. **Crédito.** El autor o crédito indicado es correcto y puede publicarse junto a la imagen.
4. **Contenido lícito.** La imagen no vulnera derechos de terceros (propiedad intelectual, honor, intimidad o propia imagen) ni contiene datos personales innecesarios.
5. **Retirada.** Agencia Social de Servicios Asturiana S.L. (ASSA), editora de Planta 14, puede retirar la imagen y el contenido asociado ante una reclamación fundada o si incumple esta declaración, indicando el motivo al Ayuntamiento.
6. **Responsabilidad.** El Ayuntamiento responde frente a terceros de la veracidad de esta declaración. [ALCANCE DE LA RESPONSABILIDAD E INDEMNIDAD A DEFINIR POR ABOGADO]

## Qué se guarda como prueba

| Campo | Contenido |
|---|---|
| `rightsDeclaration.declared` | Siempre «sí» en las imágenes municipales |
| `rightsDeclaration.statement` | Texto corto con su versión (`v1 · …`) |
| `rightsDeclaration.declaredBy` | Cuenta que marcó la declaración (tomada de la sesión, no se puede falsificar) |
| `rightsDeclaration.declaredAt` | Fecha y hora del servidor |
| `credit` y `rightsHolder` | Autor o crédito indicado y ayuntamiento titular |

La revisión de la migración impide borrar estas declaraciones sin exportarlas antes.
