"use client";
import { useState } from "react";

// Compartir sin scripts de terceros ni cookies: enlaces directos a cada red y «Copiar enlace» con el portapapeles.
export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const u = encodeURIComponent(url), t = encodeURIComponent(title);
  const links = [
    // utm_source: WhatsApp no envía la página de origen; así las estadísticas propias saben de dónde llegó la visita.
    { name: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}?utm_source=whatsapp`)}` },
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { name: "X", href: `https://x.com/intent/post?text=${t}&url=${u}` },
    { name: "Telegram", href: `https://t.me/share/url?url=${u}&text=${t}` },
  ];
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); }
    catch {
      // Navegadores sin portapapeles asíncrono (o sin permiso): selección temporal.
      const input = document.createElement("textarea"); input.value = url; document.body.appendChild(input); input.select();
      try { document.execCommand("copy"); } finally { input.remove(); }
    }
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  };
  return (
    <nav aria-label="Compartir esta noticia" className="share-buttons" data-share>
      <span className="share-label">Compartir</span>
      {links.map(link => <a key={link.name} href={link.href} target="_blank" rel="noopener noreferrer nofollow" data-share-network={link.name}>{link.name}</a>)}
      <button type="button" onClick={copy} data-share-copy>{copied ? "Enlace copiado" : "Copiar enlace"}</button>
      <span className="sr-only" role="status">{copied ? "Enlace copiado al portapapeles" : ""}</span>
    </nav>
  );
}
