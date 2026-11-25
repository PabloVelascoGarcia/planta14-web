import type { Article, Comarca } from "./mock-data";
import { lexicalToParagraphs, toLexical } from "./rich-text";

// Convierte el borrador que envía el CMS (vista previa en vivo) en una noticia para ArticleView. Solo usa los datos
// recibidos: se ejecuta en el navegador. Las imágenes aún no publicadas se ven por su dirección autenticada del CMS.
type Related = Record<string, unknown> | number | string | null | undefined;
const rel = (value: Related) => (value && typeof value === "object" ? value as Record<string, unknown> : null);
const str = (value: unknown) => (typeof value === "string" ? value : "");

export function previewArticle(doc: Record<string, unknown>): Article {
  const author = rel(doc.author as Related), town = rel(doc.town as Related), section = rel(doc.section as Related), image = rel(doc.image as Related);
  const sizes = image?.sizes as Record<string, { url?: string | null } | undefined> | undefined;
  const imageURL = image ? str(image.publicURL) || str(sizes?.hero?.url) || str(image.url) || "/images/placeholder.svg" : "/images/placeholder.svg";
  const body = lexicalToParagraphs(doc.body);
  const bodyRich = toLexical(previewBlocks(doc.body));
  const names = (value: unknown) => (Array.isArray(value) ? value : []).map(v => str(rel(v as Related)?.name)).filter(Boolean);
  const concejos = names(doc.otherTowns), topics = names(doc.secondarySections);
  const tags = (Array.isArray(doc.tags) ? doc.tags : []).map(t => rel(t as Related)).filter(Boolean).map(t => ({ name: str(t!.name), slug: str(t!.slug) })).filter(t => t.name && t.slug);
  const focus = image && (Number(image.focalX ?? 50) !== 50 || Number(image.focalY ?? 50) !== 50) ? `${Math.round(Number(image.focalX))}% ${Math.round(Number(image.focalY))}%` : undefined;
  return {
    id: String(doc.id ?? ""), slug: str(doc.slug), title: str(doc.title) || "Sin título", excerpt: str(doc.excerpt), body,
    image: imageURL, imageAlt: str(image?.alt), imageCredit: str(image?.credit), ...(imageURL && str(doc.imageCaption).trim() ? { imageCaption: str(doc.imageCaption).trim() } : {}),
    date: str(doc.date) || str(doc.publishedAt).slice(0, 10), author: str(author?.name) || "Autor sin elegir", authorSlug: str(author?.slug),
    comarca: (str(town?.comarca) || "Caudal") as Comarca, concejo: str(town?.name) || "Concejo sin elegir", topic: str(section?.name) || "Sección sin elegir",
    status: "draft", publishedAt: str(doc.publishedAt) || str(doc.date), ...(bodyRich ? { bodyRich } : {}),
    ...(concejos.length ? { concejos: [str(town?.name), ...concejos] } : {}), ...(topics.length ? { topics: [str(section?.name), ...topics] } : {}), ...(tags.length ? { tags } : {}),
    ...(doc.imagePoster ? { imagePoster: true } : {}), ...(focus ? { imageFocus: focus } : {}), ...(image?.imageKind === "ia" ? { imageAI: true } : {}),
    ...(image && Number(image.width) && Number(image.height) ? { imageWidth: Number(image.width), imageHeight: Number(image.height) } : {}),
  };
}

/** Bloques «Imagen» y «Galería» del borrador con la imagen que llega del CMS (dirección autenticada si aún no es pública). */
function previewBlocks(value: unknown): unknown {
  const toImage = (v: unknown) => {
    const m = rel(v as Related);
    if (!m) return null;
    const url = str(m.publicURL) || str((m.sizes as Record<string, { url?: string }> | undefined)?.hero?.url) || str(m.url);
    return url ? { url, alt: str(m.alt), credit: str(m.credit), width: Number(m.width) || undefined, height: Number(m.height) || undefined, ai: m.imageKind === "ia" } : null;
  };
  const walk = (node: Record<string, unknown>): Record<string, unknown> => {
    const f = node.fields as Record<string, unknown> | undefined;
    if (node.type === "block" && f) {
      if (f.blockType === "imagen") { const image = toImage(f.image); return { ...node, fields: { ...f, image, credit: str(f.credit) || image?.credit || "" } }; }
      if (f.blockType === "galeria") return { ...node, fields: { ...f, images: (Array.isArray(f.images) ? f.images : []).map((item: Record<string, unknown>) => { const image = toImage(item.image); return { ...item, image, credit: str(item.credit) || image?.credit || "" }; }) } };
    }
    return Array.isArray(node.children) ? { ...node, children: (node.children as Record<string, unknown>[]).map(walk) } : node;
  };
  const root = rel((value as { root?: Related } | null)?.root);
  return root ? { ...(value as object), root: walk(root) } : value;
}
