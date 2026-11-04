import type { CollectionConfig, Field, Option } from 'payload';

// Etiquetas en español del CMS: colecciones, campos, grupos y opciones de las listas. Solo cambian lo que se
// ve en /cms; los nombres internos y los valores guardados no cambian (no hace falta migración).

const collectionLabels: Record<string, [string, string]> = {
  users: ['Usuario', 'Usuarios'],
  media: ['Imagen', 'Imágenes'],
  articles: ['Noticia', 'Noticias'],
  authors: ['Autor', 'Autores'],
  sections: ['Sección', 'Secciones'],
  towns: ['Concejo', 'Concejos'],
  'municipal-spaces': ['Espacio municipal', 'Espacios municipales'],
  'municipal-content': ['Contenido municipal', 'Contenidos municipales'],
  notifications: ['Pendiente de revisar', 'Pendientes de revisar'],
  'audit-log': ['Registro de auditoría', 'Auditoría'],
  'public-media-ops': ['Operación de copia pública', 'Operaciones de copias públicas'],
};

// Por nombre de campo; "colección.campo" o "colección.grupo.campo" tienen prioridad.
const fieldLabels: Record<string, string> = {
  name: 'Nombre', role: 'Rol', municipalSpace: 'Espacio municipal',
  alt: 'Texto alternativo', credit: 'Autoría o crédito', sourceURL: 'Dirección de origen', rightsHolder: 'Titular de los derechos',
  rightsType: 'Tipo de derechos', rightsScope: 'Ámbito', uploadedBySpace: 'Subida por el espacio municipal', publishedUses: 'Usos publicados',
  publicKey: 'Clave de la copia pública', publicBucket: 'Bucket de la copia pública', publicURL: 'Dirección pública',
  rightsDeclaration: 'Declaración de derechos', declared: 'Declarada', statement: 'Texto declarado', declaredBy: 'Declarada por', declaredAt: 'Fecha de la declaración',
  slug: 'Identificador en la dirección (slug)', position: 'Posición', legacyID: 'Identificador de origen', comarca: 'Comarca', visible: 'Visible',
  provenance: 'Procedencia', sourceUrl: 'Dirección de la fuente', bio: 'Biografía', email: 'Correo electrónico', avatar: 'Foto',
  title: 'Título', excerpt: 'Entradilla', body: 'Texto', image: 'Imagen', author: 'Autor', town: 'Concejo', section: 'Sección',
  date: 'Fecha', publishedAt: 'Fecha de publicación', scheduledAt: 'Publicación programada', seoTitle: 'Título para buscadores',
  seoDescription: 'Descripción para buscadores', seoImage: 'Imagen para redes y buscadores', featured: 'Destacada', main: 'Principal de portada',
  opinion: 'Opinión', showInTown: 'Mostrar en la página del concejo', sourceName: 'Fuente', sourceAuthor: 'Autor de la fuente',
  medium: 'Medio', subscription: 'Suscripción', status: 'Estado', startsAt: 'Inicio (AAAA-MM-DD)', endsAt: 'Fin (AAAA-MM-DD)',
  contact: 'Contacto', place: 'Lugar', hours: 'Horario', note: 'Nota', space: 'Espacio municipal', type: 'Tipo', origin: 'Origen',
  expiresAt: 'Vigente hasta (AAAA-MM-DD)', eventAt: 'Fecha y hora del evento', deadline: 'Plazo (AAAA-MM-DD)', attachments: 'Adjuntos', url: 'Dirección',
  demo: 'Contenido de ejemplo', withdrawal: 'Retirada por Planta 14', withdrawn: 'Retirado', reason: 'Motivo', withdrawnAt: 'Retirado el', withdrawnBy: 'Retirado por',
  action: 'Acción', targetCollection: 'Colección', documentID: 'Documento', summary: 'Resumen', user: 'Usuario', userEmail: 'Correo del usuario',
  userRole: 'Rol del usuario', kind: 'Tipo', content: 'Contenido', publishedBy: 'Publicado por', emailStatus: 'Estado del correo', reviewed: 'Revisado',
  mediaId: 'Imagen', bucket: 'Bucket', keyPrefix: 'Prefijo', objects: 'Objetos', purge: 'Purga de la CDN', error: 'Error',
  'authors.role': 'Cargo', 'municipal-content.excerpt': 'Resumen', 'municipal-content.attachments.title': 'Título',
};

const optionLabels: Record<string, string> = {
  admin: 'Administración', editor: 'Redacción', municipal: 'Ayuntamiento',
  'rightsScope.demo': 'Solo demostración', publicable: 'Publicable',
  propia: 'Propia', licencia: 'Con licencia (p. ej. Creative Commons)', 'autorización': 'Cedida con autorización', institucional: 'Institucional',
  'status.demo': 'Demostración', active: 'Activo', inactive: 'Inactivo',
  news: 'Noticia', notice: 'Aviso', event: 'Agenda', grant: 'Ayuda o subvención', announcement: 'Tablón de anuncios', municipality: 'Ayuntamiento',
  'emailStatus.disabled': 'Desactivado', sent: 'Enviado', 'emailStatus.failed': 'Fallido', 'municipal-publication': 'Publicación municipal', 'festival-submission': 'Fiesta enviada',
  'action.create': 'Creación', 'action.update': 'Edición', publish: 'Publicación', unpublish: 'Despublicación', withdraw: 'Retirada',
  reinstate: 'Restitución', 'action.delete': 'Borrado',
  'public-media-ops.kind.create': 'Crear copia', 'public-media-ops.kind.delete': 'Borrar copia', pending: 'Pendiente', applied: 'Aplicada',
  'public-media-ops.status.failed': 'Fallida', cleaned: 'Limpiada', none: 'Ninguna', 'purge.disabled': 'Desactivada', 'purge.sent': 'Enviada', 'purge.failed': 'Fallida',
};

function label(map: Record<string, string>, keys: string[]) {
  for (const key of keys) if (map[key]) return map[key];
  return undefined;
}

function localizeFields(slug: string, fields: Field[], parent = ''): Field[] {
  return fields.map(field => {
    // Contenedores sin nombre (pestañas, bloques plegables, filas): sus campos cuelgan del mismo nivel.
    if (field.type === 'tabs') return { ...field, tabs: field.tabs.map(tab => ({ ...tab, fields: localizeFields(slug, tab.fields, 'name' in tab && tab.name ? (parent ? `${parent}.${tab.name}` : tab.name) : parent) })) } as Field;
    if ((field.type === 'collapsible' || field.type === 'row') && 'fields' in field) return { ...field, fields: localizeFields(slug, field.fields, parent) } as Field;
    if (!('name' in field) || !field.name) return field;
    const path = parent ? `${parent}.${field.name}` : field.name;
    const next = { ...field } as Field & { label?: unknown; options?: unknown; fields?: Field[] };
    if (next.label === undefined) {
      const found = label(fieldLabels, [`${slug}.${path}`, `${slug}.${field.name}`, field.name]);
      if (found) next.label = found;
    }
    if (field.type === 'select') {
      next.options = field.options.map((option: Option) => {
        if (typeof option !== 'string') return option;
        const found = label(optionLabels, [`${slug}.${field.name}.${option}`, `${field.name}.${option}`, option]);
        return found ? { label: found, value: option } : option;
      });
    }
    if ((field.type === 'group' || field.type === 'array') && 'fields' in field) next.fields = localizeFields(slug, field.fields, path);
    return next as Field;
  });
}

export function withSpanishLabels(collection: CollectionConfig): CollectionConfig {
  const names = collectionLabels[collection.slug];
  return {
    ...collection,
    labels: collection.labels ?? (names ? { singular: names[0], plural: names[1] } : undefined),
    fields: localizeFields(collection.slug, collection.fields),
  };
}
