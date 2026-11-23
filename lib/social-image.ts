import type { Article } from "./mock-data";
import { socialVersion } from "./social-path";
import { BRAND, renderImage, socialCardElement, templateElement, TEMPLATE_STYLES } from "./brand-art";

// Imágenes generadas en el servidor (sin terceros) con caché en memoria: plantillas por sección e imagen para redes.
// Las direcciones llevan la versión de la noticia (?v=…), así que cada versión se puede cachear mucho tiempo.

const cache = new Map<string, Buffer>();
function remember(key: string, value: Buffer, max = 60) {
  cache.set(key, value);
  while (cache.size > max) cache.delete(cache.keys().next().value!);
  return value;
}

export async function templatePng(slug: string) {
  if (!TEMPLATE_STYLES[slug]) return null;
  const key = `plantilla:${slug}`;
  return cache.get(key) ?? remember(key, await renderImage(templateElement(slug), 1600, 1000, "png"));
}

const focus = (value?: string) => {
  const m = value?.match(/^(\d+)% (\d+)%$/);
  return m ? { x: Number(m[1]) / 100, y: Number(m[2]) / 100 } : { x: 0.5, y: 0.5 };
};

/** Foto recortada a 1200×630 alrededor de su punto de interés (o entera en 470×630 si es un cartel), como data URL. */
async function preparePhoto(url: string, mode: "cover" | "poster", point: { x: number; y: number }) {
  const sharp = (await import("sharp")).default;
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Imagen ${response.status}`);
  const input = sharp(Buffer.from(await response.arrayBuffer()), { failOn: "none" }).rotate();
  if (mode === "poster") {
    const out = await input.resize(470, 630, { fit: "contain", background: BRAND.neutral }).jpeg({ quality: 86 }).toBuffer();
    return `data:image/jpeg;base64,${out.toString("base64")}`;
  }
  const { width = 0, height = 0 } = await input.metadata();
  if (!width || !height) throw new Error("Imagen sin medidas");
  const ratio = 1200 / 630;
  const cw = Math.min(width, Math.round(height * ratio)), ch = Math.min(height, Math.round(width / ratio));
  const left = Math.max(0, Math.min(width - cw, Math.round(point.x * width - cw / 2)));
  const top = Math.max(0, Math.min(height - ch, Math.round(point.y * height - ch / 2)));
  const out = await input.extract({ left, top, width: cw, height: ch }).resize(1200, 630).jpeg({ quality: 86 }).toBuffer();
  return `data:image/jpeg;base64,${out.toString("base64")}`;
}

/** Imagen para redes de una noticia (JPEG 1200×630). */
export async function socialImageJpeg(article: Article) {
  const key = `redes:${article.slug}:${socialVersion(article)}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const template = article.imageTemplate ? article.image.match(/\/plantillas\/([a-z0-9-]+)\.png$/)?.[1] ?? "planta14" : null;
  const source = article.customShareImage ? article.shareImage?.url : article.shareImage?.url || (!template ? article.image : undefined);
  let photo: string | null = null;
  const poster = Boolean(article.imagePoster && !article.customShareImage);
  if (source && /^https?:\/\//.test(source)) {
    photo = await preparePhoto(source, poster ? "poster" : "cover", article.customShareImage ? { x: 0.5, y: 0.5 } : focus(article.imageFocus)).catch(() => null);
  }
  const sectionTemplate = template ?? (article.topic ? article.topic.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "planta14");
  const jpeg = await renderImage(socialCardElement({ title: article.title, kicker: article.concejo, photo, poster: poster && Boolean(photo), ai: Boolean(photo) && article.imageAI && !article.customShareImage, template: sectionTemplate }), 1200, 630, "jpeg", 80);
  return remember(key, jpeg);
}
