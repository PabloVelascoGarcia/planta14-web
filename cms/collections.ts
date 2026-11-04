import { APIError, type CollectionConfig } from 'payload';
import { adminOnly, editorialUser, municipalSpaceOf, ownUserOrAdmin, relationID } from './access';
import { auditAfterChange, auditAfterDelete } from './activity';
import { readMedia } from './media-rights';
import { countPublishedUses, publicURL, syncPublicMedia } from './public-media';
import { withPublicMediaLock } from './public-media-lock';
import { loteField } from './lote';

/** Text stored with each municipal upload (versioned so the evidence says what was declared). */
export const municipalRightsStatement = (municipality: string) =>
  `v1 · ${municipality} declara que tiene los derechos necesarios para publicar esta imagen en Planta 14 y que el autor o crédito indicado es correcto.`;

export const Users: CollectionConfig = {
  slug: 'users',
  auth: { cookies: { secure: process.env.NODE_ENV === 'production', sameSite: 'Lax' }, maxLoginAttempts: 5, lockTime: 10 * 60 * 1000 },
  admin: { useAsTitle: 'email' },
  // Municipal accounts use /[municipality]/panel, never the /cms administration.
  access: { admin: editorialUser, create: adminOnly, read: ownUserOrAdmin, update: adminOnly, delete: adminOnly },
  hooks: {
    beforeOperation: [({ operation, req, args }) => {
      if (operation === 'create' && !adminOnly({ req }) && req.context.cmsBootstrap !== true) {
        throw new APIError('Crea el primer administrador mediante cms:bootstrap', 403);
      }
      return args;
    }],
    beforeChange: [({ data, originalDoc }) => {
      const next = { ...originalDoc, ...data };
      const space = relationID(next.municipalSpace);
      if (next.role === 'municipal' && space === null) throw new APIError('Una cuenta municipal debe estar vinculada a un espacio municipal', 400);
      if (next.role !== 'municipal' && space !== null) throw new APIError('Solo las cuentas municipales se vinculan a un espacio municipal', 400);
      return data;
    }],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'role', type: 'select', required: true, defaultValue: 'editor', options: ['admin', 'editor', 'municipal'], access: { create: adminOnly, update: adminOnly } },
    // Firma que se pone por defecto en sus noticias.
    { name: 'author', label: 'Firma (autor vinculado)', type: 'relationship', relationTo: 'authors',
      admin: { condition: (data) => data?.role !== 'municipal', description: 'Autor que se pondrá por defecto en las noticias de esta cuenta.' },
      access: { create: adminOnly, update: adminOnly } },
    { name: 'municipalSpace', label: 'Espacio municipal', type: 'relationship', relationTo: 'municipal-spaces', index: true,
      admin: { condition: (data) => data?.role === 'municipal', description: 'Obligatorio para cuentas municipales; prohibido para las demás.' },
      access: { create: adminOnly, update: adminOnly } },
  ],
};

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    create: ({ req }) => editorialUser({ req }) || municipalSpaceOf(req) !== null,
    read: readMedia,
    update: ({ req }) => editorialUser({ req }) || (municipalSpaceOf(req) !== null ? { uploadedBySpace: { equals: municipalSpaceOf(req) } } : false),
    delete: ({ req }) => editorialUser({ req }) || (municipalSpaceOf(req) !== null ? { uploadedBySpace: { equals: municipalSpaceOf(req) } } : false),
  },
  hooks: {
    beforeOperation: [async ({ operation, args, req }) => {
      const id = (args as { id?: number | string }).id;
      if ((operation === 'update' || operation === 'delete') && id != null) {
        await withPublicMediaLock(req.payload, Number(id), req, async () => undefined);
      }
      // Never let a municipal upload choose a storage namespace (e.g. a public prefix).
      const data = (args as { data?: { prefix?: unknown } }).data;
      if (operation === 'create' && municipalSpaceOf(req) !== null && data?.prefix) throw new APIError('El destino de almacenamiento lo fija el servidor', 403);
      return args;
    }],
    beforeChange: [async ({ data, originalDoc, operation, req }) => {
      if (operation === 'update') await withPublicMediaLock(req.payload, originalDoc.id, req, async () => undefined);
      const space = municipalSpaceOf(req);
      const declaration = data.rightsDeclaration as { declared?: unknown } | undefined;
      // The declaration is only ever written here, from the session: never accepted as client data.
      delete data.rightsDeclaration;
      if (space !== null) {
        // A municipality uploads images under its own rights.
        const owner = await req.payload.findByID({ collection: 'municipal-spaces', id: space, depth: 0, overrideAccess: true, req });
        // The municipality is the rights holder of what it uploads: always institutional and publishable.
        Object.assign(data, { uploadedBySpace: space, rightsHolder: owner.name, rightsType: 'institucional', rightsScope: 'publicable' });
        const credit = typeof data.credit === 'string' ? data.credit.trim() : originalDoc?.credit;
        if (!credit) throw new APIError('Indica el autor o crédito de la imagen', 400);
        if (typeof data.credit === 'string') data.credit = credit;
        // New file (upload or replacement): explicit rights declaration by the municipal account.
        if (operation === 'create' || req.file) {
          if (declaration?.declared !== true) throw new APIError('Marca la declaración de derechos sobre la imagen para poder subirla', 400);
          data.rightsDeclaration = { declared: true, statement: municipalRightsStatement(owner.name), declaredBy: req.user!.id, declaredAt: new Date().toISOString() };
        }
      }
      // Declaración de la administración al subir desde el servidor (p. ej. la carga de ensayo citando la fuente de
      // Commons). Solo llega por el contexto de la API local, nunca como dato del cliente.
      const adminDeclaration = req.context.adminRightsDeclaration as { statement?: string } | undefined;
      // Redacción (también desde «Crear nuevo» en una noticia): la casilla de declaración hace la foto publicable.
      const confirmed = data.rightsConfirm === true;
      delete data.rightsConfirm;
      if (space === null && !adminDeclaration?.statement && editorialUser({ req }) && (operation === 'create' || req.file)) {
        if (confirmed) {
          const who = req.user as { id: number; name?: string; email?: string };
          data.rightsScope = 'publicable';
          data.rightsDeclaration = { declared: true, declaredBy: who.id, declaredAt: new Date().toISOString(),
            statement: `v1 · ${who.name || who.email} (Planta 14) declara que Planta 14 tiene derecho a publicar esta imagen (propia, cedida o con una licencia que lo permite) y que la autoría indicada es correcta.` };
        } else if ((data.rightsScope ?? originalDoc?.rightsScope ?? 'demo') === 'publicable') {
          throw new APIError('Para que la foto se pueda publicar, marca la declaración de derechos', 400);
        }
      }
      // Cartel enviado con «Envía tu fiesta»: declaración de quien lo envía. Solo llega por el contexto de la API local
      // (acción del servidor del formulario), nunca como dato del cliente.
      const submissionDeclaration = req.context.submissionRightsDeclaration as { statement?: string } | undefined;
      if (space === null && !req.user && submissionDeclaration?.statement && operation === 'create') {
        data.rightsScope = 'publicable';
        data.rightsDeclaration = { declared: true, statement: submissionDeclaration.statement, declaredBy: null, declaredAt: new Date().toISOString() };
      }
      if (space === null && adminDeclaration?.statement && (operation === 'create' || req.file)) {
        if (req.user?.collection !== 'users' || req.user.role !== 'admin') throw new APIError('Solo la administración puede declarar los derechos de esta imagen', 403);
        data.rightsDeclaration = { declared: true, statement: adminDeclaration.statement, declaredBy: req.user.id, declaredAt: new Date().toISOString() };
      }
      const next = { ...originalDoc, ...data };
      if (!next.rightsHolder || !next.rightsType) throw new APIError('Indica titular y tipo de derechos de la imagen', 400);
      if (next.rightsScope !== 'publicable' && (originalDoc?.publishedUses ?? 0) > 0) throw new APIError('Despublica el contenido antes de retirar los derechos', 400);
      return data;
    }],
    afterChange: [async ({ doc, previousDoc, operation, req }) => {
      const fileChanged = operation === 'update' && previousDoc?.filename && (Boolean(req.file) || previousDoc.filename !== doc.filename);
      if (operation === 'update') await syncPublicMedia(req.payload, doc.id, req, fileChanged ? { refresh: true, previous: previousDoc } : {});
      return doc;
    }, auditAfterChange],
    beforeDelete: [async ({ id, req }) => {
      if (await countPublishedUses(req.payload, Number(id), req) > 0) throw new APIError('Despublica el contenido antes de borrar su imagen', 400);
      // Remove a known residual copy before deleting the only record that can identify it.
      await syncPublicMedia(req.payload, Number(id), req);
    }],
    afterDelete: [auditAfterDelete],
  },
  upload: { disableLocalStorage: true, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'], imageSizes: [{ name: 'card', width: 800 }, { name: 'hero', width: 1600 }] },
  fields: [
    { name: 'alt', type: 'text', required: true, admin: { description: 'Qué se ve en la foto, para quien no puede verla (lectores de pantalla y buscadores).' } },
    { name: 'credit', type: 'text', required: true, admin: { description: 'Autor o autora de la foto, tal como debe aparecer: «Foto: …».' } },
    { name: 'sourceURL', type: 'text', admin: { description: 'Opcional: enlace a la foto original si viene de otra web (por ejemplo, su ficha en Wikimedia Commons).' } },
    // Nullable for existing phase-1 records; creation hook requires explicit provenance.
    { name: 'rightsHolder', label: 'Titular de los derechos', type: 'text', admin: { description: 'Obligatorio. Quién tiene los derechos: Planta 14, la persona que hizo la foto, una agencia, un ayuntamiento…' } },
    { name: 'rightsType', label: 'Tipo de derechos', type: 'select', options: ['propia', 'licencia', 'autorización', 'institucional'],
      admin: { description: 'Obligatorio. Propia: hecha por Planta 14. Con licencia: p. ej. Creative Commons. Cedida: con permiso de su autor. Institucional: de una administración.' } },
    { name: 'rightsScope', label: 'Ámbito', type: 'select', required: true, defaultValue: 'demo', options: ['demo', 'publicable'],
      admin: { condition: (data, _s, { user }) => Boolean(data?.id) || user?.role === 'admin', description: 'Se pone en «Publicable» al marcar la declaración de derechos. «Solo demostración» no se puede publicar.' } },
    // Declaración de la redacción al subir una foto (no se guarda como tal: queda en «Declaración de derechos»).
    { name: 'rightsConfirm', label: 'Declaro que Planta 14 tiene derecho a publicar esta imagen (propia, cedida o con una licencia que lo permite) y que la autoría indicada es correcta', type: 'checkbox', virtual: true,
      admin: { readOnly: false, condition: (data) => !data?.id, description: 'Obligatorio para poder publicar la foto. Queda registrado quién y cuándo lo declara.' } },
    { name: 'uploadedBySpace', label: 'Subida por el espacio municipal', type: 'relationship', relationTo: 'municipal-spaces', index: true, admin: { readOnly: true, condition: data => Boolean(data?.uploadedBySpace) } },
    // Maintained by hooks of articles and municipal content: number of published documents using the image.
    { name: 'publishedUses', type: 'number', defaultValue: 0, index: true, admin: { readOnly: true, condition: data => Boolean(data?.id) }, access: { create: () => false, update: () => false } },
    // Random object prefix of the current public copy (null when the image is not public).
    { name: 'publicKey', type: 'text', admin: { readOnly: true, condition: data => Boolean(data?.id) }, access: { create: () => false, update: () => false } },
    // Bucket that holds the current public copy (to clean the old one after changing PUBLIC_MEDIA_BUCKET).
    { name: 'publicBucket', type: 'text', admin: { readOnly: true, condition: data => Boolean(data?.id) }, access: { create: () => false, update: () => false } },
    // Rights declaration made by a municipal account when uploading (who, when, what was declared).
    { name: 'rightsDeclaration', label: 'Declaración de derechos', type: 'group', admin: { readOnly: true, condition: data => Boolean(data?.id) }, fields: [
      { name: 'declared', type: 'checkbox', defaultValue: false },
      { name: 'statement', type: 'textarea' },
      { name: 'declaredBy', type: 'relationship', relationTo: 'users' },
      { name: 'declaredAt', type: 'date' },
    ] },
    loteField,
    { name: 'publicURL', type: 'text', virtual: true, admin: { readOnly: true, condition: data => Boolean(data?.id) }, access: { create: () => false, update: () => false },
      hooks: { afterRead: [({ siblingData }) => publicURL(siblingData)] } },
  ],
};

/** Durable log of public-copy operations, written outside request transactions (see cms/public-media.ts). */
export const PublicMediaOps: CollectionConfig = {
  slug: 'public-media-ops',
  labels: { singular: 'Operación de copia pública', plural: 'Operaciones de copias públicas' },
  admin: { group: 'Sistema', defaultColumns: ['createdAt', 'kind', 'status', 'bucket', 'keyPrefix', 'purge'] },
  access: { read: editorialUser, create: () => false, update: () => false, delete: () => false },
  fields: [
    { name: 'kind', type: 'select', required: true, options: ['create', 'delete'] },
    { name: 'mediaId', type: 'number', required: true, index: true },
    { name: 'bucket', type: 'text', required: true },
    { name: 'keyPrefix', type: 'text', required: true, index: true },
    { name: 'objects', type: 'json', required: true },
    { name: 'status', type: 'select', required: true, index: true, defaultValue: 'pending', options: ['pending', 'applied', 'failed', 'cleaned'] },
    { name: 'purge', type: 'select', options: ['none', 'disabled', 'sent', 'failed'] },
    { name: 'error', type: 'text' },
  ],
};
