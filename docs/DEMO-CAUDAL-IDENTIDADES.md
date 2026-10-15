# Identidades municipales del Caudal

Personalizaciones de presentación, sin CMS ni infraestructura nueva. Se mantiene Aller como acceso destacado en la portada y están disponibles los seis espacios.

## Primer bloque: Lena y Mieres

- Lena: Santa Cristina de Lena, Valgrande-Pajares y pueblos/caminos. Paleta azul pizarra inspirada en la montaña.
- Mieres: río Caudal, Bustiello y valle de Turón. Paleta cobre oscuro inspirada en el patrimonio industrial.

`lib/demo/data/municipal-identities.json` guarda imágenes, escudos, créditos, licencias, colores, enlaces y destacados. `lib/demo/identities.ts` adapta esos datos al componente común, conservando la identidad de Aller existente. Las páginas y los paneles comparten el mismo diseño; no son webs institucionales ni sedes electrónicas.

Fuentes de Lena: https://www.aytolena.es/santa-cristina , https://www.valgrande-pajares.com/turismo/ y Turismo Asturias, ficha de Lena. Fuentes de Mieres: https://www.mieres.es/turismo/nuestros-pueblos/bustiello/ y https://www.mieres.es/turismo/nuestros-pueblos/turon/ . Los textos son resúmenes propios de recursos estables, no anuncios de nuevas actividades ni declaraciones atribuidas.

Las noticias de referencia se identifican como tales y enlazan a su fuente. Avisos, eventos, ayudas y panel son ejemplos, sin convocatorias ni incidencias reales. No se inventan horarios de visita ni plazos oficiales. Las fechas de las fichas territoriales indican la preparación de la demo, no una noticia nueva sobre obras o inversiones.

## Recursos libres

Cada cabecera y escudo conserva autoría, página de Commons y enlace a su licencia en el archivo de datos y en el espacio público. Las imágenes son de archivo: no muestran necesariamente condiciones actuales. Los originales se convierten a WebP y su encuadre se adapta con CSS; estas adaptaciones conservan la licencia de cada recurso. No se atribuye a los ayuntamientos respaldo de la demo.

- Lena: escudo de Manuelfb55, CC BY-SA 4.0; Santa Cristina de Lena de Jose Luis Martinez Alvarez, CC BY-SA 2.0, archivo de 2005.
- Mieres: escudo de SanchoPanzaXXI, CC BY-SA 4.0; río Caudal de José Antonio Gil Martínez, CC BY 2.0, archivo de 2007.

## Segundo bloque: Morcín, Riosa y Ribera de Arriba

- Morcín: Monsacro, patrimonio de la lechería en La Foz y pueblos del concejo. Paleta oliva. Escudo de SanchoPanzaXXI (CC BY-SA 4.0) y paisaje del Monsacro de Elfo del bosque (CC BY-SA 4.0).
- Riosa: Angliru, Aramo y Texeo. Paleta verde de montaña. Escudo de Alvaroggallardo (CC BY-SA 4.0) y paisaje del Aramo de Ezequielcabo (CC BY-SA 3.0 España, archivo de 2014).
- Ribera de Arriba: Bueño, Centro de Interpretación del Hórreo y confluencia de los ríos. Paleta azul verdoso. Escudo de SanchoPanzaXXI (CC BY-SA 4.0) y hórreo de Palombar de Pachug (CC BY-SA 3.0).

Fuentes primarias de Morcín: https://www.morcin.es/ruta-perimetral-del-monsacro y https://www.morcin.es/historia . Riosa: https://www.ayuntamientoriosa.com/mapa-web y ficha municipal de Turismo Asturias. Ribera de Arriba: ficha municipal de Turismo Asturias y Centro de Interpretación del Hórreo; portal institucional https://www.ayto-riberadearriba.es/portada . Los enlaces específicos y las páginas de Commons se conservan en los datos.

Se mantiene el límite visible del Caudal; los cinco concejos del Nalón permanecen ocultos. Los seis espacios comparten las mejoras del panel sin introducir persistencia de servidor.

Comprobaciones: compilación/TypeScript, ESLint sin errores, revisión visual y `tests/municipal-identities.mjs` en 1440 y 390 píxeles. La prueba comprueba cabeceras, imágenes, navegación, secciones, noindex y publicación/borrado de un aviso local para cada concejo. No sustituye una prueba en todos los teléfonos físicos.
