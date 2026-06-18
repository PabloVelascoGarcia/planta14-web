import type { Metadata } from "next";
import { AdminNewsForm } from "@/components/admin-news-form";
import { getArticles } from "@/lib/cms";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Administración",
  description: "Panel de administración de noticias de Planta 14."
};

export default async function AdminPage() {
  const articles = await getArticles();

  return (
    <div className="container-p14 py-8">
      <header className="mb-8 max-w-3xl border-b-2 border-coal-950 pb-5">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-copper">CMS</p>
        <h1 className="mt-2 font-serif text-5xl font-black leading-none text-coal-950">Administración</h1>
        <p className="mt-4 text-lg leading-7 text-coal-800">
          Crea noticias y publícalas automáticamente en portada, comarca, concejo, temática y autor.
        </p>
      </header>
      <AdminNewsForm articles={articles} />
    </div>
  );
}
