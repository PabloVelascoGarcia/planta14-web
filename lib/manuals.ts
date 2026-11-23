import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseManual, plain, type Manual, type ManualBlock, type Span } from './manual-parse.mjs';

// Manuales de la Ayuda (CMS y panel municipal). Salen de generated/manuales.json, que genera cada compilación desde
// docs/MANUAL-*.md (scripts/generar-manuales.mjs); si faltara, se leen los .md directamente. Las imágenes del manual se
// sirven por /api/ayuda/imagen/… solo con sesión.

export type ManualKey = 'redaccion' | 'ayuntamiento';
const SOURCES: Record<ManualKey, string> = { redaccion: 'docs/MANUAL-REDACCION.md', ayuntamiento: 'docs/MANUAL-AYUNTAMIENTOS.md' };
/** Carpetas de imágenes de cada manual (docs/img/…). */
export const IMAGE_DIRS: Record<ManualKey, string> = { redaccion: 'manual-redaccion', ayuntamiento: 'manual-ayuntamientos' };

let cache: Promise<{ generatedAt: string } & Record<ManualKey, Manual>> | null = null;
async function load() {
  cache ??= readFile(path.join(process.cwd(), 'generated/manuales.json'), 'utf8').then(JSON.parse).catch(async () => ({
    generatedAt: new Date().toISOString(),
    redaccion: parseManual(await readFile(path.join(process.cwd(), SOURCES.redaccion), 'utf8')),
    ayuntamiento: parseManual(await readFile(path.join(process.cwd(), SOURCES.ayuntamiento), 'utf8')),
  }));
  return cache;
}

/** Manual para quien lo ve: sin el apartado de administración si no es administración. */
export async function getManual(key: ManualKey, { admin = false } = {}): Promise<Manual & { generatedAt: string }> {
  const all = await load();
  const manual = all[key];
  return { title: manual.title, generatedAt: all.generatedAt, blocks: manual.blocks.filter(b => admin || !b.admin) };
}

/** Dirección de una imagen del manual (img/manual-x/archivo.png → /api/ayuda/imagen/x/archivo.png). */
export function imageURL(key: ManualKey, src: string) {
  const file = src.split('/').pop() ?? '';
  return `/api/ayuda/imagen/${key}/${encodeURIComponent(file)}`;
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function spansHtml(spans: Span[]) {
  return spans.map(s => {
    let h = esc(s.text);
    if (s.code) h = `<code>${h}</code>`;
    if (s.bold) h = `<strong>${h}</strong>`;
    if (s.italic) h = `<em>${h}</em>`;
    // Solo enlaces a la web o al correo; nada del repositorio.
    if (s.href && /^(https?:\/\/|mailto:|\/(?!\/)|#)/.test(s.href)) h = `<a href="${esc(s.href)}"${/^https?:/.test(s.href) ? ' target="_blank" rel="noopener noreferrer"' : ''}>${h}</a>`;
    return h;
  }).join('');
}
function blockHtml(key: ManualKey, b: ManualBlock) {
  switch (b.type) {
    case 'heading': return `<h${b.level} id="${b.id}">${esc(b.text)}</h${b.level}>`;
    case 'paragraph': return `<p>${spansHtml(b.spans)}</p>`;
    case 'list': return `<${b.ordered ? 'ol' : 'ul'}>${b.items.map(i => `<li>${spansHtml(i)}</li>`).join('')}</${b.ordered ? 'ol' : 'ul'}>`;
    case 'table': return `<div class="help-table"><table><thead><tr>${b.header.map(c => `<th>${spansHtml(c)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(r => `<tr>${r.map(c => `<td>${spansHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    case 'image': return `<figure><img src="${imageURL(key, b.src)}" alt="${esc(b.alt)}" loading="lazy" /><figcaption>${esc(b.alt)}</figcaption></figure>`;
    case 'code': return `<pre>${esc(b.text)}</pre>`;
    case 'rule': return '<hr />';
  }
}

export type HelpSection = { id: string; title: string; html: string; text: string; admin: boolean };
/** Apartados (por título de nivel 2) con su HTML y su texto para el buscador; lo anterior al primero, «Introducción». */
export function helpSections(key: ManualKey, manual: Manual): HelpSection[] {
  const sections: HelpSection[] = [];
  let current: HelpSection = { id: 'introduccion', title: 'Introducción', html: '', text: '', admin: false };
  const push = () => { if (current.html) sections.push(current); };
  for (const b of manual.blocks) {
    if (b.type === 'heading' && b.level === 2) { push(); current = { id: b.id, title: b.text, html: '', text: b.text, admin: b.admin }; continue; }
    current.html += blockHtml(key, b);
    current.text += ' ' + (b.type === 'paragraph' ? plain(b.spans) : b.type === 'list' ? b.items.map(plain).join(' ') : b.type === 'table' ? [...b.header, ...b.rows.flat()].map(plain).join(' ') : b.type === 'heading' ? b.text : b.type === 'image' ? b.alt : b.type === 'code' ? b.text : '');
  }
  push();
  return sections;
}
