import type { Article } from "@/lib/mock-data";

/** Huecos de imagen: el ancho que ocupa la foto en pantalla, para que el navegador elija el tamaño del srcset. */
export const imageSizes = {
  lead: "(min-width: 1212px) 834px, (min-width: 768px) calc(100vw - 340px), calc(100vw - 32px)",
  card: "(min-width: 1024px) 280px, (min-width: 768px) 33vw, calc(100vw - 32px)",
  horizontal: "(min-width: 640px) 180px, calc(100vw - 32px)",
  article: "(min-width: 1024px) 760px, calc(100vw - 32px)",
} as const;

type ArticleImageProps = { article: Pick<Article, "image" | "imageSrcSet" | "imageAlt">; sizes: keyof typeof imageSizes; className?: string; priority?: boolean; width?: number; height?: number };

/** Foto de una noticia con srcset/sizes cuando hay tamaños generados (Payload); en la demo, la imagen tal cual. */
export function ArticleImage({ article, sizes, className, priority = false, width = 800, height = 500 }: ArticleImageProps) {
  return (
    <img src={article.image} srcSet={article.imageSrcSet} sizes={article.imageSrcSet ? imageSizes[sizes] : undefined} alt={article.imageAlt ?? ""}
      loading={priority ? undefined : "lazy"} fetchPriority={priority ? "high" : undefined} decoding="async" width={width} height={height} className={className} />
  );
}
