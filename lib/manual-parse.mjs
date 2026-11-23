// Lector de los manuales (docs/MANUAL-*.md) para la Ayuda del CMS y del panel: solo el Markdown que usan los manuales
// (títulos, párrafos, listas, tablas, imágenes, código, negrita, cursiva y enlaces). Lo usan el generador de cada
// compilación (scripts/generar-manuales.mjs) y, si faltara su resultado, la propia web al leerlos.
// Lo que va entre <!-- solo-administracion --> y <!-- /solo-administracion --> lo ve solo la administración.

/** @typedef {{ text: string, bold?: boolean, italic?: boolean, code?: boolean, href?: string }} Span */

const slug = text => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

/** Texto con **negrita**, *cursiva*, `código` y [enlaces](…) → trozos. */
export function parseInline(text) {
  /** @type {Span[]} */
  const out = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    const t = m[0];
    if (m[1]) out.push({ text: t.slice(1, -1), code: true });
    else if (m[2]) for (const s of parseInline(t.slice(2, -2))) out.push({ ...s, bold: true });
    else if (m[3]) for (const s of parseInline(t.slice(1, -1))) out.push({ ...s, italic: true });
    else { const [, label, href] = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(t); for (const s of parseInline(label)) out.push({ ...s, href }); }
    last = m.index + t.length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/** Manual → { title, blocks }. Cada bloque lleva `admin` si es solo de administración. */
export function parseManual(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let admin = false, title = '', i = 0, para = [];
  const ids = new Set();
  const uniqueId = text => { let id = slug(text) || 'apartado', n = 2; while (ids.has(id)) id = `${slug(text)}-${n++}`; ids.add(id); return id; };
  const push = block => blocks.push({ ...block, admin });
  const flush = () => {
    if (!para.length) return;
    const text = para.join(' ').trim(); para = [];
    // Un párrafo solo con imágenes → bloques de imagen.
    const images = [...text.matchAll(/!\[([^\]]*)\]\(([^)\s]+)\)/g)];
    if (images.length && !text.replace(/!\[[^\]]*\]\([^)\s]+\)/g, '').trim()) { for (const [, alt, src] of images) push({ type: 'image', alt, src }); return; }
    push({ type: 'paragraph', spans: parseInline(text) });
  };
  while (i < lines.length) {
    const line = lines[i];
    if (/^<!--\s*solo-administracion\s*-->/.test(line.trim())) { flush(); admin = true; i++; continue; }
    if (/^<!--\s*\/solo-administracion\s*-->/.test(line.trim())) { flush(); admin = false; i++; continue; }
    if (/^<!--.*-->$/.test(line.trim())) { i++; continue; }
    if (!line.trim()) { flush(); i++; continue; }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      const text = h[2].trim();
      if (h[1].length === 1 && !title) title = text;
      else push({ type: 'heading', level: h[1].length, text, id: uniqueId(text) });
      i++; continue;
    }
    if (/^```/.test(line)) {
      flush(); const code = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++; push({ type: 'code', text: code.join('\n') }); continue;
    }
    if (/^---+\s*$/.test(line)) { flush(); push({ type: 'rule' }); i++; continue; }
    if (/^\|/.test(line)) {
      flush(); const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        if (!cells.every(c => /^:?-{2,}:?$/.test(c))) rows.push(cells.map(parseInline));
        i++;
      }
      push({ type: 'table', header: rows[0] ?? [], rows: rows.slice(1) }); continue;
    }
    const li = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(line);
    if (li) {
      flush(); const ordered = /\d/.test(li[2]); const items = [];
      while (i < lines.length) {
        const m = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(lines[i]);
        if (m) { items.push(m[3]); i++; continue; }
        // Continuación de un elemento (línea sangrada).
        if (/^\s{2,}\S/.test(lines[i]) && items.length) { items[items.length - 1] += ' ' + lines[i].trim(); i++; continue; }
        break;
      }
      push({ type: 'list', ordered, items: items.map(parseInline) }); continue;
    }
    para.push(line.trim()); i++;
  }
  flush();
  return { title, blocks };
}

/** Texto plano de unos trozos (buscador, PDF). */
export const plain = spans => spans.map(s => s.text).join('');
