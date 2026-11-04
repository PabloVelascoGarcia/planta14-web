// PDF sencillo (A4, texto en Helvetica) sin dependencias: suficiente para los informes mensuales de visitas.
// Texto en WinAnsi (Windows-1252), que cubre tildes, eñes, «», € y similares.

export type PdfLine = { text: string; size?: number; bold?: boolean; gap?: number; bar?: number };

const WIN1252: Record<string, number> = { '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97 };
function encode(text: string) {
  let out = '';
  for (const char of text) {
    const code = char.codePointAt(0)!;
    const byte = WIN1252[char] ?? (code < 256 ? code : 0x3f);
    const c = String.fromCharCode(byte);
    out += c === '(' || c === ')' || c === '\\' ? `\\${c}` : byte < 32 || byte > 126 ? `\\${byte.toString(8).padStart(3, '0')}` : c;
  }
  return out;
}

/** Páginas A4 con las líneas dadas; `bar` (0–1) dibuja una barra proporcional junto a la línea. */
export function simplePdf(title: string, lines: PdfLine[]): Buffer {
  const pages: string[] = [];
  let ops = '', y = 800;
  const flush = () => { pages.push(ops); ops = ''; y = 800; };
  for (const line of lines) {
    const size = line.size ?? 10;
    y -= (line.gap ?? 0) + size * 1.45;
    if (y < 50) { flush(); y -= size * 1.45; }
    if (line.bar !== undefined) ops += `0.64 0.32 0.18 rg 330 ${y.toFixed(1)} ${(Math.max(0, Math.min(1, line.bar)) * 215).toFixed(1)} ${(size * 0.8).toFixed(1)} re f 0 g\n`;
    ops += `BT /${line.bold ? 'F2' : 'F1'} ${size} Tf 50 ${y.toFixed(1)} Td (${encode(line.text)}) Tj ET\n`;
  }
  flush();
  const objects: string[] = [];
  const add = (body: string) => { objects.push(body); return objects.length; };
  const catalog = add('');
  const pagesObj = add('');
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const bold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const kids: number[] = [];
  for (const content of pages) {
    const stream = add(`<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}endstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R /F2 ${bold} 0 R >> >> /Contents ${stream} 0 R >>`));
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objects[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map(k => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  const info = add(`<< /Title (${encode(title)}) /Producer (Planta 14) >>`);
  let pdf = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => { offsets.push(Buffer.byteLength(pdf, 'latin1')); pdf += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}
