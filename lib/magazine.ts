export type MagazinePhoto = { image: string; imageAlt: string; credit: string; source: string };
export type MagazineStory = {
  slug: string; category: string; title: string; subtitle: string; image: string;
  imageAlt: string; credit: string; source: string; notice: string;
  introduction: string; chapters: { title: string; text: string }[];
  cover?: MagazinePhoto; gallery?: MagazinePhoto[];
};
const agendaPublica = "https://agendapublica.es/noticia/20032/adrian-barbon-entrevista-asturias";
const agendaPublicaImg = (file: string) => `https://agendapublica.sobrevia.net/gestiobeta/arxius/agendapublica/imatges/202507/1200_${file}.jpg`;
export const magazineStories: MagazineStory[] = [
  {
    slug: "adrian-barbon", category: "Protagonistas", title: "Adrián Barbón", subtitle: "Las Cuencas que vienen",
    image: "https://img.lavdg.com/sc/jK-_VBhBipFAfEfkSLQAspkelho=/1280x/2023/05/24/00121684950454427549120/Foto/abok.jpg",
    imageAlt: "Adrián Barbón en una fotografía de archivo publicada por La Voz de Asturias",
    credit: "Fotografía de archivo publicada por La Voz de Asturias · 2023",
    source: "https://www.lavozdeasturias.es/noticia/asturias/2023/05/24/etv-bruto-barbon/00031684950491104138982.htm",
    cover: {
      image: agendaPublicaImg("1752835714009_B44O1605"),
      imageAlt: "Adrián Barbón, sentado, durante una entrevista con Agenda Pública en julio de 2025",
      credit: "Fotografía: Marcos Vega / Agenda Pública · Entrevista de julio de 2025 · Imagen de referencia",
      source: agendaPublica
    },
    gallery: [
      {
        image: agendaPublicaImg("1752835682071_B44O1401"),
        imageAlt: "Adrián Barbón conversa sentado en un sillón durante una entrevista con Agenda Pública",
        credit: "Fotografía: Marcos Vega / Agenda Pública · Julio de 2025 · Referencia del tono de conversación previsto",
        source: agendaPublica
      }
    ],
    notice: "Propuesta de entrevista · Demostración. La conversación no se ha realizado ni está confirmada.",
    introduction: "Una conversación por preparar sobre el lugar de las Cuencas en la Asturias del futuro. Empleo, vivienda y oportunidades para quienes quieren quedarse: estos son los asuntos que proponemos llevar a la mesa, con preguntas concretas y espacio para escuchar.",
    chapters: [
      { title: "Quedarse, volver, empezar", text: "¿Qué tendría que cambiar para que una persona joven pudiera construir su vida en las Cuencas? Proponemos abordar empleo, vivienda, servicios y los obstáculos cotidianos que condicionan esa decisión." },
      { title: "De los anuncios a los resultados", text: "¿Qué compromisos pueden medirse y en qué plazos? El guion pondría el foco en proyectos, ejecución y rendición de cuentas, dando espacio a las preguntas de quienes viven en el territorio." },
      { title: "Historia y futuro, en la misma conversación", text: "¿Cómo aprovechar la experiencia industrial sin quedar anclados en la nostalgia? Una oportunidad para hablar de conocimiento, actividad económica y nuevas generaciones." }
    ]
  },
  {
    slug: "volver-a-la-tierra", category: "Reportajes", title: "Volver a la tierra", subtitle: "¿Qué puede crecer en las Cuencas?",
    image: "https://greentrekker.pt/site/assets/files/161680/img_e1263.jpg", imageAlt: "Paisaje de Redes, imagen de contexto territorial; no muestra una explotación entrevistada",
    credit: "Paisaje de Redes · Fuente: Green Trekker · Imagen de contexto", source: "https://greentrekker.pt/agenda/cordilheira-de-ancares-e-las-medulas-3/",
    notice: "Propuesta de reportaje · Demostración. Protagonistas y explotación agrícola pendientes de selección.",
    introduction: "El siguiente reportaje podría empezar junto a una parcela y una pregunta: ¿qué hace falta para vivir de lo que se cultiva aquí? Queremos acompañar una iniciativa agrícola real de las Cuencas, desde el trabajo en la tierra hasta la llegada del producto al mercado.",
    chapters: [
      { title: "Una jornada sobre el terreno", text: "El trabajo previsto seguiría a sus protagonistas durante una jornada: las tareas, las herramientas y las decisiones pequeñas que no suelen aparecer en una noticia. El cultivo concreto se elegirá después de localizar y contrastar un caso real." },
      { title: "Las cuentas detrás del paisaje", text: "Acceso a la tierra, inversión, agua, distribución y clientes. El reportaje buscaría explicar qué permite sostener la actividad, sin convertir una experiencia particular en una promesa de rentabilidad." },
      { title: "De la finca a la mesa", text: "Fotografías del proceso y conversaciones con productores y compradores completarían una historia sobre trabajo, arraigo y posibilidades. No hay testimonios ni resultados atribuidos en esta muestra." }
    ]
  },
  {
    slug: "la-fiesta-antes-de-la-fiesta", category: "Reportajes", title: "La fiesta antes de la fiesta", subtitle: "Las manos detrás del Descenso del Nalón",
    image: "https://img.lavdg.com/sc/_b89YebWmAhyh6OuzZaeLrphVVs%3D/480x/2026/08/11/00121786441391383301670/Foto/3.jpg",
    imageAlt: "Imagen de archivo del Descenso Folklórico del Nalón publicada por La Voz de Asturias",
    credit: "Archivo de La Voz de Asturias · Autor no indicado en la pieza de referencia",
    source: "https://www.lavozdeasturias.es/noticia/asturias/2026/08/18/regodon-2026-presenta-cartel-decena-artistas-cuatro-dias-fiesta-pola-laviana/00031787054225738913659.htm",
    notice: "Propuesta de reportaje · Demostración. Trabajo de campo y entrevistas pendientes.",
    introduction: "Antes de que una fiesta ocupe la calle, alguien tiene que imaginarla, prepararla y sostenerla. Proponemos mirar el Descenso del Nalón desde ese otro lado: el de las personas que convierten los preparativos en una forma de encontrarse.",
    chapters: [
      { title: "Cuando todavía no hay público", text: "La propuesta es acompañar los preparativos, observar el trabajo colectivo y documentar cómo se transforma una idea en una celebración. Las escenas se recogerán durante el trabajo de campo; aquí no se presentan como hechos observados." },
      { title: "Lo que pasa de unos a otros", text: "Entrevistar a participantes de distintas generaciones permitiría preguntar qué se conserva, qué cambia y por qué merece la pena seguir implicándose. Sin respuestas prefabricadas: las voces serán las de sus protagonistas." },
      { title: "Un álbum de lo que no se ve", text: "Una serie fotográfica de detalles, materiales, manos y encuentros completaría el relato. La foto de archivo ilustra el tema, pero no pertenece a una producción propia de Planta 14." }
    ]
  }
];

export const season = {
  title: "Primera temporada",
  standfirst: "Una conversación cada semana. Empezamos por quienes gobiernan cada concejo de las Cuencas y seguimos por quienes lo mueven.",
  phases: [
    { label: "Temporada 1", title: "Los alcaldes y alcaldesas", text: "Una entrevista semanal con la persona al frente de cada uno de los once concejos de Caudal y Nalón. Mismas preguntas de fondo para todos, sin excepciones y con espacio para la oposición." },
    { label: "Temporada 2", title: "Quienes mueven el territorio", text: "Sindicatos, empresariado, cultura, deporte y personas que emprenden o recuperan oficios." },
    { label: "Cada semana", title: "Reportajes", text: "Un negocio que abre, una empresa que crece, una iniciativa que funciona. Historias contadas sobre el terreno." }
  ],
  note: "Calendario propuesto. Ninguna entrevista está concertada todavía."
};
