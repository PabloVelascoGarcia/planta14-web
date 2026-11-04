import type { GlobalConfig } from 'payload';
import { editorialUser } from './access';
import { MAINTENANCE_MESSAGE, maintenanceActive } from './maintenance';
import { APIError } from 'payload';

// «Última hora»: barra bajo la cabecera de la web, con texto, enlace y caducidad. La activa la redacción.
const link = (value: unknown) => !value || /^\/[^\s]*$/.test(String(value)) || /^https:\/\/\S+$/.test(String(value)) || 'Usa una ruta de la web (/noticia/…) o una dirección que empiece por https://';
export const BreakingNews: GlobalConfig = {
  slug: 'breaking-news',
  label: 'Última hora',
  admin: { description: 'Barra roja bajo la cabecera de la web. Se quita sola a la hora de caducidad, o desmarcando «Mostrar».' },
  access: { read: () => true, update: editorialUser },
  hooks: { beforeChange: [({ data }) => {
    if (maintenanceActive()) throw new APIError(MAINTENANCE_MESSAGE, 503, undefined, true);
    if (data.active && !String(data.text ?? '').trim()) throw new APIError('Escribe el texto de la última hora', 400);
    return data;
  }] },
  fields: [
    { name: 'active', label: 'Mostrar la barra de última hora', type: 'checkbox', defaultValue: false },
    { name: 'text', label: 'Texto', type: 'text', maxLength: 140, admin: { description: 'Una frase corta (140 caracteres como mucho).' } },
    { name: 'link', label: 'Enlace (opcional)', type: 'text', validate: link, admin: { description: 'La noticia que lo cuenta: /noticia/… o una dirección https://' } },
    { name: 'expiresAt', label: 'Se quita sola el', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime', displayFormat: 'dd/MM/yyyy HH:mm', timeFormat: 'HH:mm', timeIntervals: 15 }, description: 'Opcional. A esa hora deja de verse aunque siga marcada.' } },
  ],
};

/** La barra vigente, o null (sin CMS, desactivada, sin texto o caducada). */
export function activeBreakingNews(value: { active?: boolean | null; text?: string | null; link?: string | null; expiresAt?: string | null } | null, now = new Date()) {
  if (!value?.active || !value.text?.trim()) return null;
  if (value.expiresAt && new Date(value.expiresAt) <= now) return null;
  return { text: value.text.trim(), link: value.link || null };
}
