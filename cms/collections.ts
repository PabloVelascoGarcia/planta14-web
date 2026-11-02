import { APIError, type CollectionConfig } from 'payload';
import { adminOnly, ownUserOrAdmin } from './access';

export const Users: CollectionConfig = {
  slug: 'users',
  auth: { maxLoginAttempts: 5, lockTime: 10 * 60 * 1000 },
  admin: { useAsTitle: 'email' },
  access: { admin: adminOnly, create: adminOnly, read: ownUserOrAdmin, update: adminOnly, delete: adminOnly },
  hooks: { beforeOperation: [({ operation, req, args }) => {
    if (operation === 'create' && !adminOnly({ req }) && req.context.cmsBootstrap !== true) {
      throw new APIError('Crea el primer administrador mediante cms:bootstrap', 403);
    }
    return args;
  }] },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'role', type: 'select', required: true, defaultValue: 'admin', options: ['admin'], access: { create: adminOnly, update: adminOnly } },
  ],
};

export const Media: CollectionConfig = {
  slug: 'media',
  access: { create: adminOnly, read: adminOnly, update: adminOnly, delete: adminOnly },
  upload: { disableLocalStorage: true, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'], imageSizes: [{ name: 'card', width: 800 }, { name: 'hero', width: 1600 }] },
  fields: [
    { name: 'alt', type: 'text', required: true },
    { name: 'credit', type: 'text', required: true },
    { name: 'sourceURL', type: 'text' },
  ],
};
