export type Comarca = "Caudal" | "Nalón";

export type Article = {
  id?: string;
  title: string;
  excerpt: string;
  body: string[];
  image: string;
  date: string;
  author: string;
  authorSlug?: string;
  comarca: Comarca;
  concejo: string;
  topic: string;
  slug: string;
  status?: "draft" | "published" | "scheduled" | "unpublished";
  publishedAt?: string;
  scheduledAt?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoImage?: string;
  featured?: boolean;
  main?: boolean;
  opinion?: boolean;
};

export type Author = {
  name: string;
  slug: string;
  role: string;
  bio: string;
  email?: string;
  avatar?: string;
};

export type AgendaEvent = {
  title: string;
  date: string;
  place: string;
  concejo: string;
  description: string;
};

export const territories = {
  Caudal: ["Mieres", "Lena", "Aller", "Morcín", "Riosa", "Ribera de Arriba"],
  Nalón: ["Langreo", "San Martín del Rey Aurelio", "Laviana", "Caso", "Sobrescobio"]
} satisfies Record<Comarca, string[]>;

export const topics = [
  "Sucesos",
  "Economía",
  "Empresas",
  "Política",
  "Sociedad",
  "Deportes",
  "Cultura",
  "Patrimonio",
  "Opinión",
  "Agenda"
];

export const authors: Author[] = [
  {
    name: "Clara Valdés",
    slug: "clara-valdes",
    role: "Redactora de Caudal",
    bio: "Sigue la actualidad municipal, social y cultural del valle del Caudal."
  },
  {
    name: "Marcos Llaneza",
    slug: "marcos-llaneza",
    role: "Redactor de Nalón",
    bio: "Especializado en política local, patrimonio industrial y vida asociativa."
  },
  {
    name: "Aitana Robles",
    slug: "aitana-robles",
    role: "Opinión",
    bio: "Firma análisis sobre territorio, servicios públicos y memoria minera."
  }
];

export const articles: Article[] = [
  {
    title: "Las cuencas pactan una mesa común para defender el tren de cercanías",
    excerpt:
      "Alcaldías de Caudal y Nalón coordinan alegaciones y reclaman plazos verificables para recuperar frecuencias y fiabilidad.",
    body: [
      "Los concejos de las dos cuencas mineras han acordado constituir una mesa de seguimiento del servicio ferroviario para fijar una posición común ante las administraciones competentes.",
      "El objetivo es que las reivindicaciones no se fragmenten por municipio y que las mejoras anunciadas cuenten con calendario, indicadores públicos y participación vecinal.",
      "La primera reunión técnica abordará frecuencias, accesibilidad de estaciones, conexiones con líneas de autobús y necesidades específicas de estudiantes y personas mayores."
    ],
    image:
      "https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=1400&q=80",
    date: "2026-06-18",
    author: "Clara Valdés",
    comarca: "Caudal",
    concejo: "Mieres",
    topic: "Política",
    slug: "cuencas-mesa-comun-tren-cercanias",
    main: true,
    featured: true
  },
  {
    title: "Langreo abre el debate sobre nuevos usos para los antiguos talleres",
    excerpt:
      "El Ayuntamiento reunirá a asociaciones, empresas y expertos en patrimonio industrial antes de redactar el plan director.",
    body: [
      "Langreo iniciará este mes un proceso de consulta para definir el futuro de varios espacios industriales sin actividad.",
      "La propuesta municipal combina equipamientos culturales, viveros empresariales y zonas de formación técnica vinculadas a la transición energética.",
      "Los colectivos vecinales piden que la recuperación mantenga la lectura histórica de los edificios y no se limite a una operación inmobiliaria."
    ],
    image:
      "https://images.unsplash.com/photo-1513828583688-c52646db42da?auto=format&fit=crop&w=1400&q=80",
    date: "2026-06-17",
    author: "Marcos Llaneza",
    comarca: "Nalón",
    concejo: "Langreo",
    topic: "Patrimonio",
    slug: "langreo-debate-usos-antiguos-talleres",
    featured: true
  },
  {
    title: "Lena refuerza las rutas escolares de montaña para el próximo curso",
    excerpt:
      "La medida busca reducir esperas y mejorar la conexión diaria de los pueblos altos con Campomanes y La Pola.",
    body: [
      "El concejo de Lena revisará los horarios de transporte escolar tras varias peticiones de familias de núcleos de montaña.",
      "La reorganización se diseñará junto a los centros educativos y tendrá en cuenta actividades extraescolares, meteorología y tiempos de espera.",
      "El consistorio trasladará la propuesta al Principado para que pueda entrar en vigor al inicio del próximo curso."
    ],
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80",
    date: "2026-06-16",
    author: "Clara Valdés",
    comarca: "Caudal",
    concejo: "Lena",
    topic: "Sociedad",
    slug: "lena-refuerza-rutas-escolares-montana",
    featured: true
  },
  {
    title: "San Martín impulsa un censo de locales vacíos para atraer comercio",
    excerpt:
      "La iniciativa cruzará disponibilidad, estado de los inmuebles y ayudas públicas para facilitar nuevas aperturas.",
    body: [
      "San Martín del Rey Aurelio elaborará un mapa de locales sin actividad en los principales ejes urbanos del concejo.",
      "El censo permitirá poner en contacto a propietarios y emprendedores, además de orientar las convocatorias de ayudas a la actividad económica.",
      "Las asociaciones comerciales valoran la medida, aunque reclaman simplificación administrativa y acompañamiento durante los primeros meses."
    ],
    image:
      "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1400&q=80",
    date: "2026-06-15",
    author: "Marcos Llaneza",
    comarca: "Nalón",
    concejo: "San Martín del Rey Aurelio",
    topic: "Economía",
    slug: "san-martin-censo-locales-vacios-comercio"
  },
  {
    title: "Aller recupera la carrera de montaña con salida en Cabañaquinta",
    excerpt:
      "La prueba regresa con recorridos para categorías base y un circuito largo por pistas y senderos tradicionales.",
    body: [
      "La carrera de montaña de Aller volverá al calendario deportivo local con una edición orientada tanto a corredores federados como a participantes populares.",
      "La organización ha preparado recorridos diferenciados para favorecer la participación de menores y familias.",
      "El dispositivo contará con voluntariado de clubes locales y puntos de avituallamiento en varias zonas del trazado."
    ],
    image:
      "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1400&q=80",
    date: "2026-06-14",
    author: "Clara Valdés",
    comarca: "Caudal",
    concejo: "Aller",
    topic: "Deportes",
    slug: "aller-recupera-carrera-montana-cabanaquinta"
  },
  {
    title: "Laviana prepara una semana cultural dedicada a la memoria oral",
    excerpt:
      "Centros sociales y bibliotecas recogerán testimonios vecinales sobre oficios, fiestas y vida cotidiana.",
    body: [
      "Laviana celebrará una semana cultural dedicada a la memoria oral con grabaciones abiertas, charlas y actividades intergeneracionales.",
      "El material recopilado se incorporará a un archivo municipal consultable por investigadores, centros educativos y asociaciones.",
      "La programación incluirá música tradicional, fotografía histórica y una mesa sobre el papel de las mujeres en las redes comunitarias."
    ],
    image:
      "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1400&q=80",
    date: "2026-06-13",
    author: "Marcos Llaneza",
    comarca: "Nalón",
    concejo: "Laviana",
    topic: "Cultura",
    slug: "laviana-semana-cultural-memoria-oral"
  },
  {
    title: "No hay futuro local sin servicios cotidianos",
    excerpt:
      "La cohesión territorial se mide en trenes, centros de salud, escuelas abiertas y trámites que no obliguen a marcharse.",
    body: [
      "Hablar de futuro en las cuencas exige bajar de los grandes titulares a la vida diaria. Un territorio no se sostiene solo con proyectos estratégicos si falla lo básico.",
      "La población necesita servicios públicos previsibles, comercio cercano, vivienda disponible y comunicaciones que permitan vivir aquí sin pedir disculpas por la distancia.",
      "La política local acierta cuando deja de competir por fotos aisladas y entiende que Caudal y Nalón comparten problemas, pero también una escala suficiente para negociar."
    ],
    image:
      "https://images.unsplash.com/photo-1449157291145-7efd050a4d0e?auto=format&fit=crop&w=1400&q=80",
    date: "2026-06-12",
    author: "Aitana Robles",
    comarca: "Nalón",
    concejo: "Caso",
    topic: "Opinión",
    slug: "futuro-local-servicios-cotidianos",
    opinion: true
  },
  {
    title: "Riosa actualizará el alumbrado en varios núcleos rurales",
    excerpt:
      "La actuación prioriza eficiencia energética, seguridad peatonal y puntos con luminarias obsoletas.",
    body: [
      "Riosa renovará parte del alumbrado público en varios núcleos rurales durante el segundo semestre del año.",
      "El plan incluye sustitución de luminarias, revisión de cuadros eléctricos y criterios de reducción del consumo.",
      "El Ayuntamiento asegura que la intervención se hará por fases para minimizar molestias y atender primero las zonas con más incidencias."
    ],
    image:
      "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1400&q=80",
    date: "2026-06-11",
    author: "Clara Valdés",
    comarca: "Caudal",
    concejo: "Riosa",
    topic: "Empresas",
    slug: "riosa-actualizara-alumbrado-nucleos-rurales"
  }
];

export const agenda: AgendaEvent[] = [
  {
    title: "Encuentro comarcal de bandas de música",
    date: "2026-06-22",
    place: "Auditorio Teodoro Cuesta",
    concejo: "Mieres",
    description: "Concierto conjunto con agrupaciones de Caudal y Nalón."
  },
  {
    title: "Visita guiada al patrimonio industrial",
    date: "2026-06-24",
    place: "Sama",
    concejo: "Langreo",
    description: "Recorrido urbano por espacios fabriles y memoria obrera."
  },
  {
    title: "Mercado de productores locales",
    date: "2026-06-28",
    place: "Plaza del Ayuntamiento",
    concejo: "Laviana",
    description: "Alimentación, artesanía y actividades para público familiar."
  }
];
