"use client";
import { useEffect, useState } from "react";
import { ready, subscribe, unsubscribe } from "@payloadcms/live-preview";
import { ArticleView } from "./article-view";
import { previewArticle } from "@/lib/article-preview";

/** Vista previa en vivo de una noticia (pestaña «Vista previa» del CMS): se actualiza mientras se escribe. */
export function ArticleLivePreview({ initialData, serverURL }: { initialData: Record<string, unknown>; serverURL: string }) {
  const [data, setData] = useState(initialData);
  useEffect(() => {
    const handler = subscribe({ apiRoute: "/api/cms", callback: setData, depth: 2, initialData, serverURL });
    ready({ serverURL });
    return () => unsubscribe(handler);
  }, [initialData, serverURL]);
  return <>
    <p className="mb-6 border border-dashed border-copper/60 bg-white/60 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-copper" data-preview="on">Vista previa del CMS · No es pública hasta que se publique</p>
    <ArticleView article={previewArticle(data)} related={[]} />
  </>;
}
