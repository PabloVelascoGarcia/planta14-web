import { APIError, type CollectionConfig } from 'payload';
import { adminOnly, editorialUser, municipalSpaceOf, ownUserOrAdmin, relationID } from './access';
import { auditAfterChange, auditAfterDelete } from './activity';
import { readMedia } from './media-rights';
import { countPublishedUses, publicURL, syncPublicMedia } from './public-media';

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
    beforeOperation: [({ operation, args, req }) => {
      // Never let a municipal upload choose a storage namespace (e.g. a public prefix).
      const data = (args as { data?: { prefix?: unknown } }).data;
      if (operation === 'create' && municipalSpaceOf(req) !== null && data?.prefix) throw new APIError('El destino de almacenamiento lo fija el servidor', 403);
      return args;
    }],
    beforeChange: [async ({ data, originalDoc, req }) => {
      const space = municipalSpaceOf(req);
      if (space !== null) {
        // A municipality uploads images under its own rights.
        const owner = await req.payload.findByID({ collection: 'municipal-spaces', id: space, depth: 0, overrideAccess: true, req });
        // The municipality is the rights holder of what it uploads: always institutional and publishable.
        Object.assign(data, { uploadedBySpace: space, rightsHolder: owner.name, rightsType: 'institucional', rightsScope: 'publicable' });
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
    { name: 'alt', type: 'text', required: true },
    { name: 'credit', type: 'text', required: true },
    { name: 'sourceURL', type: 'text' },
    // Nullable for existing phase-1 records; creation hook requires explicit provenance.
    { name: 'rightsHolder', label: 'Titular de los derechos', type: 'text' },
    { name: 'rightsType', label: 'Tipo de derechos', type: 'select', options: ['propia', 'licencia', 'autorización', 'institucional'] },
    { name: 'rightsScope', label: 'Ámbito', type: 'select', required: true, defaultValue: 'demo', options: ['demo', 'publicable'] },
    { name: 'uploadedBySpace', label: 'Subida por el espacio municipal', type: 'relationship', relationTo: 'municipal-spaces', index: true, admin: { readOnly: true } },
    // Maintained by hooks of articles and municipal content: number of published documents using the image.
    { name: 'publishedUses', type: 'number', defaultValue: 0, index: true, admin: { readOnly: true }, access: { create: () => false, update: () => false } },
    // Random object prefix of the current public copy (null when the image is not public).
    { name: 'publicKey', type: 'text', admin: { readOnly: true }, access: { create: () => false, update: () => false } },
    { name: 'publicURL', type: 'text', virtual: true, admin: { readOnly: true }, access: { create: () => false, update: () => false },
      hooks: { afterRead: [({ siblingData }) => publicURL(siblingData)] } },
  ],
};
