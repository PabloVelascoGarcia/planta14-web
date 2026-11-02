import type { CollectionConfig, Field } from 'payload';
import { adminOnly, editorialUser, publishedOnly } from './access';
import { validatePublishedImages } from './media-rights';

const text = (name: string, required = false): Field => ({ name, type: 'text', required });
const key: Field = { name: 'legacyID', type: 'text', unique: true, index: true };
const provenance: Field[] = [text('provenance'), text('sourceUrl')];
const published = {
  versions: { drafts: true },
  access: { create: editorialUser, read: publishedOnly, update: editorialUser, delete: editorialUser },
  hooks: { beforeChange: [async ({ data, originalDoc, req }) => {
    await validatePublishedImages({ ...originalDoc, ...data }, req);
    return data;
  }] },
} satisfies Partial<CollectionConfig>;

export const Sections: CollectionConfig = {
  slug: 'sections', admin: { useAsTitle: 'name' },
  access: { read: () => true, create: adminOnly, update: adminOnly, delete: adminOnly },
  fields: [{ name: 'slug', type: 'text', required: true, unique: true }, text('name', true), { name: 'position', type: 'number', defaultValue: 0 }],
};

export const Towns: CollectionConfig = {
  slug: 'towns', admin: { useAsTitle: 'name' },
  access: { read: () => true, create: adminOnly, update: adminOnly, delete: adminOnly },
  fields: [key, { name: 'slug', type: 'text', unique: true, required: true }, text('name', true),
    { name: 'comarca', type: 'select', required: true, options: ['Caudal', 'Nalón'] },
    { name: 'visible', type: 'checkbox', defaultValue: true }, ...provenance],
};

export const Authors: CollectionConfig = {
  slug: 'authors', admin: { useAsTitle: 'name' },
  access: { read: () => true, create: editorialUser, update: editorialUser, delete: editorialUser },
  fields: [text('name', true), { name: 'slug', type: 'text', unique: true, required: true }, text('role'), { name: 'bio', type: 'textarea' },
    { name: 'email', type: 'email', access: { read: editorialUser } }, { name: 'avatar', type: 'relationship', relationTo: 'media' }],
};

export const Articles: CollectionConfig = {
  slug: 'articles', admin: { useAsTitle: 'title' }, ...published,
  fields: [key, { name: 'slug', type: 'text', unique: true, required: true }, text('title', true),
    { name: 'excerpt', type: 'textarea', required: true },
    { name: 'body', type: 'json', required: true, validate: (value: unknown) => Array.isArray(value) && value.every(p => typeof p === 'string') || 'Usa una lista de párrafos de texto' },
    { name: 'image', type: 'relationship', relationTo: 'media' },
    { name: 'author', type: 'relationship', relationTo: 'authors', required: true },
    { name: 'town', type: 'relationship', relationTo: 'towns', required: true },
    { name: 'section', type: 'relationship', relationTo: 'sections', required: true },
    text('date', true), text('publishedAt'), text('scheduledAt'), text('seoTitle'), { name: 'seoDescription', type: 'textarea' },
    { name: 'seoImage', type: 'relationship', relationTo: 'media' },
    { name: 'featured', type: 'checkbox' }, { name: 'main', type: 'checkbox' }, { name: 'opinion', type: 'checkbox' },
    text('sourceName'), text('sourceAuthor'), ...provenance],
};

export const MunicipalSpaces: CollectionConfig = {
  slug: 'municipal-spaces', admin: { useAsTitle: 'name' },
  versions: { drafts: true },
  access: { read: publishedOnly, create: adminOnly, update: adminOnly, delete: adminOnly },
  fields: [key, text('name', true), { name: 'town', type: 'relationship', relationTo: 'towns', required: true, unique: true },
    text('medium', true),
    { name: 'subscription', type: 'group', fields: [
      { name: 'status', type: 'select', required: true, options: ['demo', 'active', 'inactive'] }, text('startsAt'), text('endsAt')] },
    { name: 'contact', type: 'group', fields: [text('place'), text('hours'), { name: 'note', type: 'textarea' }] }, ...provenance],
};

export const MunicipalContent: CollectionConfig = {
  slug: 'municipal-content', admin: { useAsTitle: 'title' }, ...published,
  fields: [key, { name: 'space', type: 'relationship', relationTo: 'municipal-spaces', required: true },
    { name: 'type', type: 'select', required: true, options: ['news', 'notice', 'event', 'grant', 'announcement'] },
    text('title', true), { name: 'excerpt', type: 'textarea', required: true }, { name: 'body', type: 'textarea', required: true },
    { name: 'origin', type: 'select', required: true, defaultValue: 'municipality', options: ['municipality'] },
    text('publishedAt', true), text('expiresAt'), text('eventAt'), text('place'), text('deadline'),
    { name: 'attachments', type: 'array', fields: [text('url', true), text('title', true)] },
    { name: 'image', type: 'relationship', relationTo: 'media' },
    { name: 'demo', type: 'checkbox', defaultValue: true }, ...provenance],
};
