import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminNewsForm } from "@/components/admin-news-form";
import { getAllArticles, getAuthors } from "@/lib/cms";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Administración",
  description: "Panel de administración de noticias de Planta 14."
};

export default async function AdminPage() {
  const user = await getSession();

  if (!user) {
    redirect("/admin/login");
  }

  const articles = await getAllArticles();
  const authors = await getAuthors();

  return (
    <div className="container-p14 py-8">
      <header className="mb-8 max-w-3xl border-b-2 border-coal-950 pb-5">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-copper">CMS</p>
        <h1 className="mt-2 font-serif text-5xl font-black leading-none text-coal-950">Administración</h1>
        <p className="mt-4 text-lg leading-7 text-coal-800">
          Crea noticias y publícalas automáticamente en portada, comarca, concejo, temática y autor.
        </p>
      </header>
      <AdminNewsForm articles={articles} authors={authors} user={user} />
    </div>
  );
}
