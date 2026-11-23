import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Manual, ManualBlock, Span } from './manual-parse.mjs';
import { HELVETICA_BOLD_WIDTHS, HELVETICA_WIDTHS } from './pdf-font-widths';
import { IMAGE_DIRS, type ManualKey } from './manuals';

// Manual en PDF (A4) para «Descargar en PDF» de la Ayuda: portada (Planta 14, título y fecha), índice con números de
// página y el manual con sus capturas. Sin dependencias nuevas: fuentes estándar de PDF (Helvetica, Courier) en
// Windows-1252 y las capturas pasadas a JPEG con sharp.

const W = 595, H = 842, M = 56, CW = W - 2 * M, TOP = H - 64, BOTTOM = 64;
const COPPER = '0.643 0.322 0.176', INK = '0.11 0.098 0.09', GREY = '0.42 0.4 0.38';
type Font = 'F1' | 'F2' | 'F3' | 'F4';

const WIN1252: Record<string, number> = { '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97 };
const REPLACE: Record<string, string> = { '→': '->', '←': '<-', '↗': '', '≥': '>=', '≤': '<=', '✓': 'Sí', '×': 'x', '⋮': '...', ' ': ' ', ' ': ' ' };
const byteOf = (ch: string) => WIN1252[ch] ?? (ch.codePointAt(0)! < 256 ? ch.codePointAt(0)! : 0x3f);
const clean = (t: string) => [...t].map(ch => REPLACE[ch] ?? ch).join('');
function encode(text: string) {
  let out = '';
  for (const ch of clean(text)) {
    const b = byteOf(ch), c = String.fromCharCode(b);
    out += c === '(' || c === ')' || c === '\\' ? `\\${c}` : b < 32 || b > 126 ? `\\${b.toString(8).padStart(3, '0')}` : c;
  }
  return out;
}
function width(text: string, font: Font, size: number) {
  if (font === 'F4') return [...clean(text)].length * 600 * size / 1000;
  const table = font === 'F2' ? HELVETICA_BOLD_WIDTHS : HELVETICA_WIDTHS;
  let w = 0;
  for (const ch of clean(text)) w += table[byteOf(ch)] || 556;
  return w * size / 1000;
}

type Img = { name: string; data: Buffer; w: number; h: number };
type Page = { ops: string; images: Img[] };

class Layout {
  pages: Page[] = [];
  page!: Page;
  y = TOP;
  constructor(private footer: string, private firstNumber: number) { this.newPage(); }
  newPage() { this.page = { ops: '', images: [] }; this.pages.push(this.page); this.y = TOP; }
  get number() { return this.firstNumber + this.pages.length - 1; }
  ensure(h: number) { if (this.y - h < BOTTOM) this.newPage(); }
  text(x: number, y: number, t: string, font: Font, size: number, color = INK) { this.page.ops += `${color} rg BT /${font} ${size} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${encode(t)}) Tj ET 0 g\n`; }
  rect(x: number, y: number, w: number, h: number, color: string) { this.page.ops += `${color} rg ${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f 0 g\n`; }
  line(x1: number, y1: number, x2: number, y2: number, color = '0.85 0.83 0.8') { this.page.ops += `${color} RG 0.6 w ${x1.toFixed(1)} ${y1.toFixed(1)} m ${x2.toFixed(1)} ${y2.toFixed(1)} l S 0 G\n`; }
  /** Trozos de texto con estilo → líneas partidas en `maxW`. */
  wrap(spans: Span[], size: number, maxW: number, baseFont: Font = 'F1') {
    const words: { t: string; font: Font }[] = [];
    for (const s of spans) {
      const font: Font = s.code ? 'F4' : s.bold || baseFont === 'F2' ? 'F2' : s.italic ? 'F3' : 'F1';
      const t = s.href && /^https?:/.test(s.href) && s.href !== s.text ? `${s.text} (${s.href})` : s.text;
      for (const part of t.split(/(\s+)/)) if (part) words.push({ t: part, font });
    }
    const lines: { t: string; font: Font }[][] = [[]];
    let lw = 0;
    for (const w of words) {
      const ww = width(w.t, w.font, size);
      if (/^\s+$/.test(w.t)) { if (lw > 0) { lines[lines.length - 1].push({ t: ' ', font: w.font }); lw += width(' ', w.font, size); } continue; }
      if (lw + ww > maxW && lw > 0) { const last = lines[lines.length - 1]; while (last.length && last[last.length - 1].t === ' ') last.pop(); lines.push([]); lw = 0; }
      lines[lines.length - 1].push(w); lw += ww;
    }
    return lines;
  }
  paragraph(spans: Span[], { size = 10.5, x = M, maxW = CW, lead = 1.45, font = 'F1' as Font, color = INK, prefix = '' } = {}) {
    const lines = this.wrap(spans, size, maxW, font);
    lines.forEach((ln, i) => {
      this.ensure(size * lead);
      this.y -= size * lead;
      if (i === 0 && prefix) this.text(x - 14, this.y, prefix, 'F1', size, color);
      let cx = x;
      for (const w of ln) { this.text(cx, this.y, w.t, w.font, size, color); cx += width(w.t, w.font, size); }
    });
  }
}

/** PDF del manual: portada, índice y contenido. `date` es la fecha que sale en la portada. */
export async function manualPdf(key: ManualKey, manual: Manual, date: string): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  const footer = `Planta 14 · ${manual.title}`;
  const sections = manual.blocks.filter((b): b is Extract<ManualBlock, { type: 'heading' }> => b.type === 'heading' && b.level === 2);
  const tocPages = Math.max(1, Math.ceil(sections.length / 28));
  const content = new Layout(footer, 2 + tocPages);
  const pageOf: Record<string, number> = {};
  let imageN = 0;
  for (const b of manual.blocks) {
    if (b.type === 'heading') {
      const size = b.level === 2 ? 17 : b.level === 3 ? 13 : 11.5;
      if (b.level === 2 && content.y < TOP - 10) content.ensure(size * 6);
      else content.ensure(size * 4);
      content.y -= b.level === 2 ? 20 : 12;
      if (b.level === 2) { pageOf[b.id] = content.number; content.rect(M, content.y - 2, 28, 3, COPPER); content.y -= 8; }
      content.paragraph([{ text: b.text }], { size, font: 'F2', lead: 1.25 });
      content.y -= 4;
    } else if (b.type === 'paragraph') { content.paragraph(b.spans); content.y -= 6; }
    else if (b.type === 'list') {
      b.items.forEach((item, i) => { content.paragraph(item, { x: M + 16, maxW: CW - 16, prefix: b.ordered ? `${i + 1}.` : '•' }); content.y -= 2; });
      content.y -= 5;
    } else if (b.type === 'code') {
      const lines = b.text.split('\n');
      const h = lines.length * 12 + 10;
      content.ensure(h); content.rect(M, content.y - h, CW, h, '0.95 0.94 0.92');
      content.y -= 6;
      for (const l of lines) { content.y -= 12; content.text(M + 8, content.y, l, 'F4', 9); }
      content.y -= 12;
    } else if (b.type === 'rule') { content.y -= 6; content.line(M, content.y, M + CW, content.y); content.y -= 6; }
    else if (b.type === 'table') {
      const cols = Math.max(b.header.length, ...b.rows.map(r => r.length)), cw = CW / cols, size = 9;
      const row = (cells: Span[][], bold: boolean) => {
        const wrapped = cells.map(c => content.wrap(c, size, cw - 8, bold ? 'F2' : 'F1'));
        const h = Math.max(...wrapped.map(w => w.length)) * size * 1.35 + 6;
        content.ensure(h);
        if (bold) content.rect(M, content.y - h, CW, h, '0.95 0.94 0.92');
        wrapped.forEach((lines, ci) => lines.forEach((ln, li) => {
          let cx = M + ci * cw + 4;
          for (const w of ln) { content.text(cx, content.y - 3 - (li + 1) * size * 1.35 + 2, w.t, w.font, size); cx += width(w.t, w.font, size); }
        }));
        content.y -= h; content.line(M, content.y, M + CW, content.y);
      };
      content.y -= 4; row(b.header, true); for (const r of b.rows) row(r, false); content.y -= 10;
    } else if (b.type === 'image') {
      const file = path.join(process.cwd(), 'docs/img', IMAGE_DIRS[key], path.basename(b.src));
      const input = await readFile(file).catch(() => null);
      if (!input) continue;
      const jpeg = await sharp(input).flatten({ background: '#ffffff' }).resize({ width: 1100, withoutEnlargement: true }).jpeg({ quality: 72 }).toBuffer();
      const meta = await sharp(jpeg).metadata();
      const scale = Math.min(CW / meta.width!, 300 / meta.height!);
      const w = meta.width! * scale, h = meta.height! * scale;
      content.ensure(h + 26);
      const name = `Im${++imageN}`;
      content.page.images.push({ name, data: jpeg, w: meta.width!, h: meta.height! });
      content.y -= h + 4;
      const x = M + (CW - w) / 2;
      content.page.ops += `q ${w.toFixed(1)} 0 0 ${h.toFixed(1)} ${x.toFixed(1)} ${content.y.toFixed(1)} cm /${name} Do Q\n`;
      content.line(x, content.y, x + w, content.y, '0.8 0.78 0.75'); content.line(x, content.y + h, x + w, content.y + h, '0.8 0.78 0.75');
      content.paragraph([{ text: b.alt }], { size: 8.5, color: GREY, x: M, maxW: CW });
      content.y -= 8;
    }
  }

  // Portada.
  const cover = new Layout(footer, 1);
  cover.rect(0, H - 250, W, 250, INK);
  cover.rect(M, H - 160, 8, 56, COPPER);
  cover.text(M + 22, H - 150, 'Planta 14', 'F2', 44, '1 1 1');
  cover.text(M + 22, H - 178, 'Una voz para las Cuencas', 'F3', 13, '0.85 0.82 0.78');
  cover.y = H - 330;
  cover.paragraph([{ text: manual.title }], { size: 30, font: 'F2', lead: 1.2 });
  cover.y -= 18;
  cover.paragraph([{ text: date }], { size: 13, color: GREY });
  cover.text(M, BOTTOM, 'Planta 14 · info@planta14.com', 'F1', 9, GREY);

  // Índice.
  const toc = new Layout(footer, 2);
  toc.paragraph([{ text: 'Índice' }], { size: 22, font: 'F2' });
  toc.y -= 14;
  for (const s of sections) {
    toc.ensure(20); toc.y -= 18;
    const n = String(pageOf[s.id] ?? '');
    const title = clean(s.text).length > 80 ? `${clean(s.text).slice(0, 78)}…` : s.text;
    toc.text(M, toc.y, title, 'F1', 11);
    toc.text(M + CW - width(n, 'F1', 11), toc.y, n, 'F1', 11);
    toc.line(M, toc.y - 5, M + CW, toc.y - 5, '0.9 0.88 0.85');
  }
  while (toc.pages.length < tocPages) toc.newPage();

  const pages = [...cover.pages, ...toc.pages, ...content.pages];
  pages.forEach((p, i) => { if (i > 0) p.ops += `${GREY} rg BT /F1 8.5 Tf ${M} 36 Td (${encode(footer)}) Tj ET BT /F1 8.5 Tf ${(W - M - width(String(i + 1), 'F1', 8.5)).toFixed(1)} 36 Td (${i + 1}) Tj ET 0 g\n`; });
  return writePdf(manual.title, pages);
}

function writePdf(title: string, pages: Page[]) {
  const parts: Buffer[] = [];
  const offsets: number[] = [];
  let size = 0;
  const objects: (string | { head: string; data: Buffer })[] = [];
  const add = (o: string | { head: string; data: Buffer }) => { objects.push(o); return objects.length; };
  const catalog = add(''), pagesObj = add('');
  const fonts = { F1: 'Helvetica', F2: 'Helvetica-Bold', F3: 'Helvetica-Oblique', F4: 'Courier' };
  const fontRefs = Object.entries(fonts).map(([k, base]) => `/${k} ${add(`<< /Type /Font /Subtype /Type1 /BaseFont /${base} /Encoding /WinAnsiEncoding >>`)} 0 R`).join(' ');
  const kids: number[] = [];
  for (const p of pages) {
    const xobjects = p.images.map(img => `/${img.name} ${add({ head: `<< /Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.data.length} >>`, data: img.data })} 0 R`).join(' ');
    const stream = add(`<< /Length ${Buffer.byteLength(p.ops, 'latin1')} >>\nstream\n${p.ops}endstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << ${fontRefs} >>${xobjects ? ` /XObject << ${xobjects} >>` : ''} >> /Contents ${stream} 0 R >>`));
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objects[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map(k => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  const info = add(`<< /Title (${encode(`Planta 14 · ${title}`)}) /Producer (Planta 14) >>`);
  const push = (b: Buffer) => { parts.push(b); size += b.length; };
  push(Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1'));
  objects.forEach((o, i) => {
    offsets.push(size);
    if (typeof o === 'string') push(Buffer.from(`${i + 1} 0 obj\n${o}\nendobj\n`, 'latin1'));
    else { push(Buffer.from(`${i + 1} 0 obj\n${o.head}\nstream\n`, 'latin1')); push(o.data); push(Buffer.from('\nendstream\nendobj\n', 'latin1')); }
  });
  const xref = size;
  push(Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`, 'latin1'));
  return Buffer.concat(parts);
}
