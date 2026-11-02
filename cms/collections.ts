import { APIError, type CollectionConfig } from 'payload';
import { adminOnly, editorialUser, ownUserOrAdmin } from './access';
import { publishedMediaIDs, readMedia } from './media-rights';

export const Users: CollectionConfig = {
  slug: 'users',
  auth: { cookies: { secure: process.env.NODE_ENV === 'production', sameSite: 'Lax' }, maxLoginAttempts: 5, lockTime: 10 * 60 * 1000 },
  admin: { useAsTitle: 'email' },
  access: { admin: editorialUser, create: adminOnly, read: ownUserOrAdmin, update: adminOnly, delete: adminOnly },
  hooks: { beforeOperation: [({ operation, req, args }) => {
    if (operation === 'create' && !adminOnly({ req }) && req.context.cmsBootstrap !== true) {
      throw new APIError('Crea el primer administrador mediante cms:bootstrap', 403);
    }
    return args;
  }] },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'role', type: 'select', required: true, defaultValue: 'editor', options: ['admin', 'editor'], access: { create: adminOnly, update: adminOnly } },
  ],
};

export const Media: CollectionConfig = {
  slug: 'media',
  access: { create: editorialUser, read: readMedia, update: editorialUser, delete: editorialUser },
  hooks: {
    beforeChange: [async ({ data, originalDoc, req }) => {
      const next = { ...originalDoc, ...data };
      if (!next.rightsHolder || !next.rightsType) throw new APIError('Indica titular y tipo de derechos de la imagen', 400);
      if (next.rightsScope !== 'publicable' && originalDoc && (await publishedMediaIDs(req)).includes(originalDoc.id)) throw new APIError('Despublica el contenido antes de retirar los derechos', 400);
      return data;
    }],
    beforeDelete: [async ({ id, req }) => {
      if ((await publishedMediaIDs(req)).includes(Number(id))) throw new APIError('Despublica el contenido antes de borrar su imagen', 400);
    }],
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
  ],
};
