"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AI_LABEL, AiBadge, imageSizes } from "@/components/article-image";

// Imágenes dentro del texto de una noticia: bloque «Imagen» (con «Mostrar entera» para carteles) y bloque «Galería»
// (cuadrícula; al pulsar, en grande, con flechas, teclado y deslizando en el móvil). Las imágenes llegan ya resueltas a
// su copia pública (lib/payload-content.ts → resolveBodyBlocks).

export type BodyImage = { url: string; srcSet?: string; alt: string; credit: string; width?: number; height?: number; focus?: string; ai?: boolean };
type Item = { image: BodyImage; caption: string; credit: string };

function Caption({ caption, credit, ai }: { caption: string; credit: string; ai?: boolean }) {
  return <>{caption}{ai ? <> <strong data-ai-caption>{AI_LABEL}.</strong></> : null}{credit ? <> <span className="credit">{ai ? "Autoría" : "Foto"}: {credit}</span></> : null}</>;
}

export function BodyImageFigure({ image, caption, credit, poster }: Item & { poster?: boolean }) {
  const whole = poster || Boolean(image.width && image.height && image.height > image.width);
  return <figure className={`body-figure${whole ? " is-whole" : ""}`} data-body-image>
    <div className="body-figure-frame" style={{ position: "relative" }}>
      <img src={image.url} srcSet={image.srcSet} sizes={image.srcSet ? imageSizes.article : undefined} alt={image.alt} loading="lazy" decoding="async"
        width={image.width ?? 1600} height={image.height ?? 1000} {...(whole ? { "data-image-whole": "" } : {})} />
      {image.ai ? <AiBadge /> : null}
    </div>
    <figcaption><Caption caption={caption} credit={credit} ai={image.ai} /></figcaption>
  </figure>;
}

export function BodyGallery({ images }: { images: Item[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const triggers = useRef<(HTMLButtonElement | null)[]>([]);
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const touch = useRef<number | null>(null);
  const last = useRef<number>(0);
  const count = images.length;
  const go = useCallback((delta: number) => setOpen(current => current === null ? null : (current + delta + count) % count), [count]);
  const close = useCallback(() => setOpen(null), []);
  useEffect(() => {
    if (open === null) return;
    last.current = open;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      else if (event.key === "ArrowRight") go(1);
      else if (event.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [open, go, close]);
  // Al cerrar, el foco vuelve a la miniatura de la imagen que se estaba viendo.
  useEffect(() => { if (open === null) triggers.current[last.current]?.focus({ preventScroll: true }); }, [open]);
  const current = open === null ? null : images[open];
  return <div className="gallery" data-gallery={count}>
    <div className="gallery-grid">
      {images.map((item, i) => <button key={`${item.image.url}-${i}`} type="button" ref={el => { triggers.current[i] = el; }} onClick={() => setOpen(i)}
        aria-label={`Ver en grande la imagen ${i + 1} de ${count}${item.caption ? `: ${item.caption}` : ""}`} data-gallery-item={i}>
        <img src={item.image.url} srcSet={item.image.srcSet} sizes={item.image.srcSet ? imageSizes.gallery : undefined} alt={item.image.alt} loading="lazy" decoding="async"
          width={400} height={300} style={item.image.focus ? { objectPosition: item.image.focus } : undefined} />
        {item.image.ai ? <AiBadge /> : null}
      </button>)}
    </div>
    <p className="gallery-caption">Galería de {count} imágenes. Pulsa una para verla en grande.</p>
    {current ? <div className="lightbox" role="dialog" aria-modal="true" aria-label={`Imagen ${open! + 1} de ${count}`} data-lightbox
      onTouchStart={event => { touch.current = event.touches[0]?.clientX ?? null; }}
      onTouchEnd={event => { const start = touch.current; touch.current = null; const end = event.changedTouches[0]?.clientX; if (start !== null && end !== undefined && Math.abs(end - start) > 40) go(end < start ? 1 : -1); }}>
      <div className="lightbox-top"><span data-lightbox-count>{open! + 1} / {count}</span>
        <button type="button" ref={closeButton} onClick={close} aria-label="Cerrar la galería" data-lightbox-close>×</button></div>
      <div className="lightbox-stage">
        <button type="button" className="lightbox-prev" onClick={() => go(-1)} aria-label="Imagen anterior" data-lightbox-prev>‹</button>
        <img src={current.image.url} srcSet={current.image.srcSet} sizes="100vw" alt={current.image.alt} data-lightbox-image />
        {current.image.ai ? <AiBadge /> : null}
        <button type="button" className="lightbox-next" onClick={() => go(1)} aria-label="Imagen siguiente" data-lightbox-next>›</button>
      </div>
      <p className="lightbox-caption"><Caption caption={current.caption} credit={current.credit} ai={current.image.ai} /></p>
    </div> : null}
  </div>;
}
