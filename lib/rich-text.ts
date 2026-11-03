// Texto enriquecido de las noticias (Lexical de Payload): solo párrafos, negrita, cursiva, enlaces, ladillos (h2/h3),
// citas y listas. Funciones puras, válidas en el servidor y en el navegador (vista previa en vivo).

export type LexicalNode = { type: string; children?: LexicalNode[]; text?: string; format?: number | string; tag?: string;
  listType?: string; fields?: { url?: string; newTab?: boolean; linkType?: string }; url?: string; [key: string]: unknown };
export type LexicalState = { root: LexicalNode & { type: 'root' } };

const text = (value: string) => ({ type: 'text', text: value, format: 0, detail: 0, mode: 'normal', style: '', version: 1 });
const block = (type: string, children: LexicalNode[], extra: Record<string, unknown> = {}) =>
  ({ type, children, direction: 'ltr', format: '', indent: 0, version: 1, ...(type === 'paragraph' ? { textFormat: 0, textStyle: '' } : {}), ...extra });

export function isLexical(value: unknown): value is LexicalState {
  return Boolean(value && typeof value === 'object' && (value as LexicalState).root && Array.isArray((value as LexicalState).root.children));
}

/** Lista de párrafos (formato anterior y cargador del ensayo) → Lexical, sin pérdida: un párrafo por elemento. */
export function paragraphsToLexical(paragraphs: string[]): LexicalState {
  const clean = paragraphs.map(p => p.trim()).filter(Boolean);
  return { root: { ...block('root', clean.map(p => block('paragraph', [text(p)]))), type: 'root' } as LexicalState['root'] };
}

/** Acepta Lexical, una lista de párrafos o un texto con párrafos separados por líneas en blanco. */
export function toLexical(value: unknown): LexicalState | null {
  if (isLexical(value)) return value;
  if (Array.isArray(value)) return paragraphsToLexical(value.filter((p): p is string => typeof p === 'string'));
  if (typeof value === 'string') return paragraphsToLexical(value.split(/\n\s*\n/));
  return null;
}

function plain(node: LexicalNode): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'linebreak') return '\n';
  if (node.type === 'tab') return '\t';
  return (node.children ?? []).map(plain).join('');
}
/** Texto plano por bloques (párrafo, ladillo, cita o elemento de lista): buscador, tiempo de lectura, datos. */
export function lexicalToParagraphs(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((p): p is string => typeof p === 'string' && p.trim() !== '');
  if (!isLexical(value)) return [];
  const out: string[] = [];
  const walk = (node: LexicalNode) => {
    if (node.type === 'list') { for (const item of node.children ?? []) walk(item); return; }
    if (['paragraph', 'heading', 'quote', 'listitem'].includes(node.type)) {
      const t = plain(node).trim(); if (t) out.push(t);
      for (const child of node.children ?? []) if (child.type === 'list') walk(child);
      return;
    }
    for (const child of node.children ?? []) walk(child);
  };
  walk(value.root);
  return out;
}

/** Solo enlaces http(s), mailto y rutas de la propia web. */
export function safeHref(url: unknown) {
  return typeof url === 'string' && /^(https?:\/\/|mailto:|\/(?!\/))/i.test(url.trim()) ? url.trim() : null;
}
/** ¿Solo párrafos de texto sin formato? (la web los pinta exactamente como antes) */
export function isPlainParagraphs(value: unknown) {
  return isLexical(value) && value.root.children!.every(n => n.type === 'paragraph' && (n.children ?? []).every(c => c.type === 'text' && !Number(c.format)));
}
