export type Span = { text: string; bold?: boolean; italic?: boolean; code?: boolean; href?: string };
export type ManualBlock = ({ type: 'heading'; level: number; text: string; id: string } | { type: 'paragraph'; spans: Span[] } | { type: 'list'; ordered: boolean; items: Span[][] }
  | { type: 'table'; header: Span[][]; rows: Span[][][] } | { type: 'image'; alt: string; src: string } | { type: 'code'; text: string } | { type: 'rule' }) & { admin: boolean };
export type Manual = { title: string; blocks: ManualBlock[] };
export function parseInline(text: string): Span[];
export function parseManual(markdown: string): Manual;
export function plain(spans: Span[]): string;
