# Base de presentación aprobada — 22 de septiembre de 2026

La portada `/` es la base elegida por Pablo. Conservar fondo cálido, cabecera Planta 14 negra, jerarquía periodística y tratamiento de enlaces existente.

Textos: «Una voz para las Cuencas» bajo la cabecera; «Donde otros no llegan» en la nota lateral; «La vida aquí» sustituye «Historias que nos mueven». El bloque cultural se llama «Para salir» y el menú mantiene «Agenda». El pie expresa «Orgullosos de nuestra historia. Con la mirada en el futuro».

Se retira el selector de comparación de la cabecera para presentar limpiamente la base. `/edicion` queda conservada como ensayo descartado; no es la nueva dirección solicitada.

La nueva foto de Fuentes de Invierno se verificó a 1280 × 720 píxeles (anterior: 768 × 432). Foto de archivo de 2019, publicada también en https://www.lavozdeasturias.es/noticia/asturias/2024/01/09/fuentes-invierno-abre-nueve-pistas-miercoles/00031704800896847459219.htm. No representa el estado actual de las pistas ni obras ejecutadas. Crédito visible en portada y artículo.

Alternativa elegida: «Entre la niebla», implementada en `/niebla`, completamente independiente, con identidad de montaña, niebla y carbón, sin iconografía minera literal. Direcciones propuestas: «Entre la niebla» (inmersiva y cinematográfica), «Estratos» (revista gráfica y experimental), «Cuaderno de las Cuencas» (revista fotográfica cálida). Pablo eligió «Entre la niebla». La base `/` se conserva. La alternativa usa paisaje real de Redes (2048 × 1152 px, fuente Green Trekker), tratamiento monocromo con CSS y movimiento ambiental desactivado si el usuario prefiere movimiento reducido. Los artículos enlazan a los interiores existentes.

## Actualización: magazine editorial para la presentación

El magazine `/niebla` deja de consumir noticias del diario y usa `lib/magazine.ts`: propuesta de entrevista a Adrián Barbón, reportaje agrícola «Volver a la tierra» y reportaje «La fiesta antes de la fiesta». Interiores propios en `/niebla/[slug]`, con fotografías reales acreditadas, preguntas/enfoques previstos y avisos visibles de propuesta no realizada. No hay declaraciones inventadas ni vídeo simulado. La portada diaria conserva su diseño y añade un bloque discreto de acceso al concepto semanal.

Lema definitivo: «Orgullo de historia. Mirada al futuro», en pie general, apertura y pie de magazine. La marca de magazine usa la misma familia, peso y espaciado tipográfico de la cabecera aprobada; no se ha inventado un logotipo gráfico nuevo. `components/magazine-footer.tsx` comparte el pie entre portada e interiores. Este registro sustituye el apartado de tareas pendientes del dossier de traspaso previo para estos cambios.
