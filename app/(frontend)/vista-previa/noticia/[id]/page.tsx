import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { contentSource } from "@/lib/content-source";
import { ArticleLivePreview } from "@/components/article-live-preview";

// Vista previa de una noticia (también borradores) con el diseño público. Solo para la redacción y la
// administración con sesión en el CMS; nunca se indexa ni se guarda en caché.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vista previa", robots: { index: false, follow: false } };

export default async function ArticlePreview({ params }: { params: Promise<{ id: string }> }) {
  if (contentSource() !== "payload") notFound();
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const { contentClient } = await import("@/lib/payload-content");
  const payload = await contentClient();
  const { user } = await payload.auth({ headers: await headers() });
  if (!user || user.collection !== "users" || !["admin", "editor"].includes(String(user.role))) notFound();
  const doc = await payload.findByID({ collection: "articles", id: Number(id), draft: true, depth: 2, user, overrideAccess: false }).catch(() => null);
  if (!doc) notFound();
  return <article className="container-p14 py-8"><ArticleLivePreview initialData={doc as unknown as Record<string, unknown>} serverURL={process.env.CMS_SERVER_URL || ""} /></article>;
}
