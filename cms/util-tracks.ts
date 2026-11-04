import { inflateRawSync } from 'node:zlib';

// Recorridos de las rutas de «Útil»: se descargan al importar (GPX directo, ZIP oficial con GPX o PLT) y se guardan
// simplificados para dibujarlos en el mapa. Un PLT (OziExplorer) solo se convierte si declara WGS 84 y todos sus puntos
// caen en Asturias o su entorno; si no, la ruta queda solo con el enlace de descarga oficial, sin recorrido dibujado.

export type Track = [number, number][][]; // segmentos de [latitud, longitud]
const inArea = ([lat, lon]: [number, number]) => lat > 42.5 && lat < 43.8 && lon > -7.2 && lon < -4.5;

/** Archivos de un ZIP (almacenados o deflate), sin dependencias. */
export function unzip(data: Buffer): { name: string; data: Buffer }[] {
  let end = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65_558); i--) if (data.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error('ZIP no válido');
  const count = data.readUInt16LE(end + 10);
  let p = data.readUInt32LE(end + 16);
  const files: { name: string; data: Buffer }[] = [];
  for (let n = 0; n < count; n++) {
    if (data.readUInt32LE(p) !== 0x02014b50) throw new Error('ZIP no válido');
    const method = data.readUInt16LE(p + 10), size = data.readUInt32LE(p + 20);
    const nameLength = data.readUInt16LE(p + 28), extra = data.readUInt16LE(p + 30), comment = data.readUInt16LE(p + 32), local = data.readUInt32LE(p + 42);
    const name = data.subarray(p + 46, p + 46 + nameLength).toString('utf8');
    p += 46 + nameLength + extra + comment;
    if (name.endsWith('/')) continue;
    const start = local + 30 + data.readUInt16LE(local + 26) + data.readUInt16LE(local + 28);
    const raw = data.subarray(start, start + size);
    if (method !== 0 && method !== 8) throw new Error(`ZIP: método de compresión ${method} no admitido`);
    files.push({ name, data: method === 8 ? inflateRawSync(raw) : Buffer.from(raw) });
  }
  return files;
}

export function parseGpx(xml: string): Track {
  const segments: Track = [];
  const blocks = xml.match(/<trkseg\b[\s\S]*?<\/trkseg>/g) ?? xml.match(/<rte\b[\s\S]*?<\/rte>/g) ?? [];
  for (const block of blocks) {
    const points = [...block.matchAll(/<(?:trkpt|rtept)\b([^>]*)/g)].map(m => {
      const lat = Number(m[1].match(/\blat="([-\d.]+)"/)?.[1]), lon = Number(m[1].match(/\blon="([-\d.]+)"/)?.[1]);
      return [lat, lon] as [number, number];
    }).filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon));
    if (points.length > 1) segments.push(points);
  }
  return segments;
}

/** OziExplorer Track Point File: solo con datum WGS 84 (grados decimales). Devuelve null si no es fiable. */
export function parsePlt(text: string): Track | null {
  const lines = text.split(/\r?\n/);
  if (!/^OziExplorer Track Point File/i.test(lines[0] ?? '') || !/^WGS ?84\s*$/i.test((lines[1] ?? '').trim())) return null;
  const segments: Track = [];
  let current: [number, number][] = [];
  for (const line of lines.slice(6)) {
    if (!line.trim()) continue;
    const [lat, lon, flag] = line.split(',').map(v => v.trim());
    const point: [number, number] = [Number(lat), Number(lon)];
    if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) return null;
    if (flag === '1' && current.length) { segments.push(current); current = []; }
    current.push(point);
  }
  if (current.length) segments.push(current);
  return segments.filter(s => s.length > 1);
}

/** Douglas-Peucker por segmento, hasta como mucho `max` puntos en total; coordenadas con 5 decimales (~1 m). */
export function simplify(track: Track, max = 600): Track {
  const dp = (points: [number, number][], tolerance: number): [number, number][] => {
    if (points.length < 3) return points;
    const [a, b] = [points[0], points[points.length - 1]];
    let index = 0, distance = 0;
    for (let i = 1; i < points.length - 1; i++) {
      const [y, x] = points[i];
      const dx = b[1] - a[1], dy = b[0] - a[0];
      const d = dx || dy ? Math.abs(dy * x - dx * y + b[1] * a[0] - b[0] * a[1]) / Math.hypot(dx, dy) : Math.hypot(x - a[1], y - a[0]);
      if (d > distance) { distance = d; index = i; }
    }
    return distance > tolerance ? [...dp(points.slice(0, index + 1), tolerance).slice(0, -1), ...dp(points.slice(index), tolerance)] : [a, b];
  };
  let tolerance = 0.00004, result = track;
  for (let i = 0; i < 12; i++) {
    result = track.map(s => dp(s, tolerance));
    if (result.reduce((n, s) => n + s.length, 0) <= max) break;
    tolerance *= 1.6;
  }
  return result.map(s => s.map(([lat, lon]) => [Math.round(lat * 1e5) / 1e5, Math.round(lon * 1e5) / 1e5] as [number, number]));
}

const USER_AGENT = 'Planta14Util/1.0 (https://planta14.com; importación de rutas y patrimonio con atribución)';
/** Descarga con tiempo máximo y tamaño máximo; sigue redirecciones (p. ej. Google Drive → drive.usercontent.google.com). */
export async function download(url: string, maxBytes = 20 * 1024 * 1024) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(45_000), redirect: 'follow' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length > maxBytes) throw new Error('archivo demasiado grande');
  return { data, type: response.headers.get('content-type') || '' };
}

/**
 * Recorrido a partir de una descarga oficial: GPX, ZIP (todos sus GPX salvo variantes ciclistas; si no hay GPX, sus PLT)
 * o PLT. Devuelve también una descripción de lo que se ha hecho, para el informe.
 */
export function trackFrom(data: Buffer): { track: Track | null; note: string } {
  const head = data.subarray(0, 400).toString('latin1');
  let track: Track = [], note = '';
  if (data.readUInt32LE(0) === 0x04034b50) {
    const files = unzip(data);
    const gpx = files.filter(f => /\.gpx$/i.test(f.name));
    const walking = gpx.filter(f => !/ciclista|bici|btt|mtb/i.test(f.name));
    if (gpx.length) {
      track = walking.flatMap(f => parseGpx(f.data.toString('utf8')));
      note = `ZIP: ${walking.length} GPX${gpx.length > walking.length ? ` (descartadas ${gpx.length - walking.length} variantes ciclistas)` : ''}`;
    } else {
      const plts = files.filter(f => /\.plt$/i.test(f.name)).map(f => parsePlt(f.data.toString('latin1')));
      if (!plts.length || plts.some(p => !p)) return { track: null, note: 'ZIP sin GPX y con PLT no convertibles de forma fiable' };
      track = plts.flatMap(p => p!);
      note = `ZIP: ${plts.length} PLT (WGS 84) convertidos`;
    }
  } else if (/<gpx\b/i.test(head) || /<gpx\b/i.test(data.toString('utf8'))) {
    track = parseGpx(data.toString('utf8')); note = 'GPX';
  } else if (/^OziExplorer Track Point File/i.test(head)) {
    const plt = parsePlt(data.toString('latin1'));
    if (!plt) return { track: null, note: 'PLT sin datum WGS 84: no se convierte' };
    track = plt; note = 'PLT (WGS 84) convertido';
  } else return { track: null, note: 'no es GPX, ZIP ni PLT' };
  if (!track.length) return { track: null, note: `${note}: sin puntos` };
  if (!track.every(s => s.every(inArea))) return { track: null, note: `${note}: hay puntos fuera de Asturias; no se dibuja` };
  return { track: simplify(track), note };
}
