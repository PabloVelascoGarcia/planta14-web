import type { CSSProperties } from "react";
import type { Article } from "@/lib/mock-data";

/** Huecos de imagen: el ancho que ocupa la foto en pantalla, para que el navegador elija el tamaño del srcset. */
export const imageSizes = {
  lead: "(min-width: 1212px) 834px, (min-width: 768px) calc(100vw - 340px), calc(100vw - 32px)",
  card: "(min-width: 1024px) 280px, (min-width: 768px) 33vw, calc(100vw - 32px)",
  horizontal: "(min-width: 640px) 180px, calc(100vw - 32px)",
  article: "(min-width: 1024px) 760px, calc(100vw - 32px)",
  gallery: "(min-width: 1024px) 250px, (min-width: 640px) 33vw, 50vw",
} as const;

export const AI_LABEL = "Ilustración generada con IA";

type ImageFields = Pick<Article, "image" | "imageSrcSet" | "imageAlt" | "imagePoster" | "imageFocus" | "imageAI">;
type ArticleImageProps = { article: ImageFields; sizes: keyof typeof imageSizes; className?: string; priority?: boolean; width?: number; height?: number; whole?: boolean; fill?: boolean };

/**
 * Foto de una noticia con srcset/sizes cuando hay tamaños generados (Payload); en la demo, la imagen tal cual.
 * - Recortes (tarjetas, portada): respetan el punto de interés de la imagen (`object-position`).
 * - Carteles («Mostrar entera») o `whole`: la imagen completa dentro de su hueco, sobre fondo neutro, sin recortar.
 * - «Ilustración generada con IA»: lleva siempre el rótulo encima de la imagen (no se puede quitar). Su envoltorio mide
 *   lo que la imagen; `fill` solo dentro de un hueco de alto fijo (tarjeta horizontal), para cubrirlo entero.
 */
export function ArticleImage({ article, sizes, className, priority = false, width = 800, height = 500, whole = false, fill = false }: ArticleImageProps) {
  const contain = whole || article.imagePoster;
  const style: CSSProperties = contain ? { objectFit: "contain", background: "#e9e4dc" } : article.imageFocus ? { objectPosition: article.imageFocus } : {};
  const img = <img src={article.image} srcSet={article.imageSrcSet} sizes={article.imageSrcSet ? imageSizes[sizes] : undefined} alt={article.imageAlt ?? ""}
    loading={priority ? undefined : "lazy"} fetchPriority={priority ? "high" : undefined} decoding="async" width={width} height={height} className={className} style={style}
    {...(contain ? { "data-image-whole": "" } : {})} />;
  return article.imageAI ? <span className={`ai-image${fill ? " is-fill" : ""}`} data-ai-image>{img}<AiBadge /></span> : img;
}

/** Rótulo fijo de las ilustraciones generadas con IA (encima de la imagen). */
export function AiBadge() {
  return <span className="ai-badge" data-ai-label>{AI_LABEL}</span>;
}
