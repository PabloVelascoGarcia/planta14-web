"use client";

import { useMemo, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Article, Author } from "@/lib/mock-data";
import { territories, topics } from "@/lib/mock-data";
import type { CmsUser } from "@/lib/auth-types";

type AdminNewsFormProps = {
  articles: Article[];
  authors: Author[];
  user: CmsUser;
};

type SaveState = "idle" | "saving" | "saved" | "error";
type PanelMode = "article" | "authors";

const emptyArticle = {
  id: "",
  title: "",
  excerpt: "",
  body: "",
  image: "",
  date: new Date().toISOString().slice(0, 10),
  author: "",
  authorSlug: "",
  comarca: "Caudal",
  concejo: "Mieres",
  topic: "Sociedad",
  status: "draft",
  scheduledAt: "",
  seoTitle: "",
  seoDescription: "",
  seoImage: "",
  featured: false,
  main: false
};

export function AdminNewsForm({ articles, authors, user }: AdminNewsFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<PanelMode>("article");
  const [draft, setDraft] = useState({ ...emptyArticle });
  const [authorDraft, setAuthorDraft] = useState({ name: "", role: "", bio: "", email: "", avatar: "" });
  const [editingAuthorSlug, setEditingAuthorSlug] = useState("");
  const [state, setState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");

  const concejos = useMemo(() => territories[draft.comarca as keyof typeof territories], [draft.comarca]);
  const selectedArticle = Boolean(draft.id);
  const canManageAuthors = user.role === "admin";
  const canPublish = user.role === "admin";

  function updateField(name: string, value: string | boolean) {
    setDraft((current) => {
      const next = { ...current, [name]: value };
      if (name === "comarca") {
        next.concejo = territories[value as keyof typeof territories][0];
      }
      if (name === "authorSlug") {
        const author = authors.find((item) => item.slug === value);
        next.author = author?.name ?? "";
      }
      return next;
    });
  }

  function editArticle(article: Article) {
    setMode("article");
    setDraft({
      id: article.id ?? article.slug,
      title: article.title,
      excerpt: article.excerpt,
      body: article.body.join("\n\n"),
      image: article.image,
      date: article.date,
      author: article.author,
      authorSlug: article.authorSlug ?? "",
      comarca: article.comarca,
      concejo: article.concejo,
      topic: article.topic,
      status: article.status ?? "published",
      scheduledAt: article.scheduledAt ?? "",
      seoTitle: article.seoTitle ?? article.title,
      seoDescription: article.seoDescription ?? article.excerpt,
      seoImage: article.seoImage ?? article.image,
      featured: Boolean(article.featured),
      main: Boolean(article.main)
    });
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleArticleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setMessage("");

    const endpoint = selectedArticle ? `/api/articles/${draft.id}` : "/api/articles";
    const payload = canPublish ? draft : { ...draft, status: "draft", scheduledAt: "" };
    const response = await fetch(endpoint, {
      method: selectedArticle ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (!response.ok) {
      setState("error");
      setMessage(result.errors?.join(" ") ?? result.error ?? "No se pudo guardar la noticia.");
      return;
    }

    setState("saved");
    setMessage(selectedArticle ? "Noticia actualizada." : "Noticia creada.");
    setDraft({ ...emptyArticle });
    router.refresh();
  }

  async function changeStatus(article: Article, status: Article["status"]) {
    await fetch(`/api/articles/${article.id ?? article.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    router.refresh();
  }

  async function deleteSelectedArticle(article: Article) {
    if (!confirm(`¿Borrar "${article.title}"?`)) {
      return;
    }

    const response = await fetch(`/api/articles/${article.id ?? article.slug}`, { method: "DELETE" });
    if (!response.ok) {
      setState("error");
      setMessage("Solo un administrador puede borrar noticias.");
      return;
    }
    router.refresh();
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>, target: "image" | "seoImage" | "avatar") {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/uploads", { method: "POST", body: formData });
    const result = await response.json();

    if (!response.ok) {
      setState("error");
      setMessage(result.error ?? "No se pudo subir la imagen.");
      return;
    }

    if (target === "avatar") {
      setAuthorDraft((current) => ({ ...current, avatar: result.url }));
      return;
    }

    updateField(target, result.url);
  }

  async function saveAuthor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setMessage("");

    const response = await fetch(editingAuthorSlug ? `/api/authors/${editingAuthorSlug}` : "/api/authors", {
      method: editingAuthorSlug ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(authorDraft)
    });
    const result = await response.json();

    if (!response.ok) {
      setState("error");
      setMessage(result.error ?? "No se pudo guardar el autor.");
      return;
    }

    setState("saved");
    setMessage(editingAuthorSlug ? "Autor actualizado." : "Autor creado.");
    setAuthorDraft({ name: "", role: "", bio: "", email: "", avatar: "" });
    setEditingAuthorSlug("");
    router.refresh();
  }

  function editAuthor(author: Author) {
    setEditingAuthorSlug(author.slug);
    setAuthorDraft({
      name: author.name,
      role: author.role,
      bio: author.bio,
      email: author.email ?? "",
      avatar: author.avatar ?? ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteExistingAuthor(slug: string) {
    if (!confirm("¿Borrar este autor?")) {
      return;
    }

    await fetch(`/api/authors/${slug}`, { method: "DELETE" });
    router.refresh();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-coal-900/15 py-3">
        <div className="text-sm text-coal-800">
          Sesión: <strong>{user.name}</strong> · {user.role === "admin" ? "Administrador" : "Redactor"}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setMode("article")} className={`admin-tab ${mode === "article" ? "admin-tab-active" : ""}`}>
            Noticias
          </button>
          <button onClick={() => setMode("authors")} className={`admin-tab ${mode === "authors" ? "admin-tab-active" : ""}`}>
            Autores
          </button>
          <button onClick={logout} className="admin-tab">Salir</button>
        </div>
      </div>

      {mode === "article" ? (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
          <form onSubmit={handleArticleSubmit} className="grid gap-5 border-t-4 border-coal-950 bg-white/70 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-serif text-3xl font-black">{selectedArticle ? "Editar noticia" : "Nueva noticia"}</h2>
              {selectedArticle ? (
                <button type="button" onClick={() => setDraft({ ...emptyArticle })} className="text-sm font-black text-copper">
                  Nueva
                </button>
              ) : null}
            </div>

            <Field label="Título">
              <input value={draft.title} onChange={(event) => updateField("title", event.target.value)} required className="admin-input" />
            </Field>

            <Field label="Entradilla">
              <textarea value={draft.excerpt} onChange={(event) => updateField("excerpt", event.target.value)} required rows={3} className="admin-input resize-y" />
            </Field>

            <Field label="Cuerpo">
              <textarea value={draft.body} onChange={(event) => updateField("body", event.target.value)} required rows={10} className="admin-input resize-y" />
            </Field>

            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Imagen destacada">
                <input value={draft.image} onChange={(event) => updateField("image", event.target.value)} required placeholder="https://... o /uploads/imagen.jpg" className="admin-input" />
                <input type="file" accept="image/*" onChange={(event) => uploadImage(event, "image")} className="text-sm" />
              </Field>
              <Field label="Fecha de publicación">
                <input value={draft.date} onChange={(event) => updateField("date", event.target.value)} required type="date" className="admin-input" />
              </Field>
            </div>

            <div className="grid gap-5 md:grid-cols-4">
              <Field label="Estado">
                <select disabled={!canPublish} value={draft.status} onChange={(event) => updateField("status", event.target.value)} className="admin-input">
                  <option value="draft">Borrador</option>
                  <option value="published">Publicado</option>
                  <option value="scheduled">Programado</option>
                  <option value="unpublished">Despublicado</option>
                </select>
              </Field>
              <Field label="Programar">
                <input disabled={!canPublish} value={draft.scheduledAt} onChange={(event) => updateField("scheduledAt", event.target.value)} type="datetime-local" className="admin-input" />
              </Field>
              <Field label="Comarca">
                <select value={draft.comarca} onChange={(event) => updateField("comarca", event.target.value)} className="admin-input">
                  {Object.keys(territories).map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>
              <Field label="Concejo">
                <select value={draft.concejo} onChange={(event) => updateField("concejo", event.target.value)} className="admin-input">
                  {concejos.map((concejo) => <option key={concejo}>{concejo}</option>)}
                </select>
              </Field>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Temática">
                <select value={draft.topic} onChange={(event) => updateField("topic", event.target.value)} className="admin-input">
                  {topics.map((topic) => <option key={topic}>{topic}</option>)}
                </select>
              </Field>
              <Field label="Autor">
                <select value={draft.authorSlug} onChange={(event) => updateField("authorSlug", event.target.value)} className="admin-input">
                  <option value="">Seleccionar autor</option>
                  {authors.map((author) => <option key={author.slug} value={author.slug}>{author.name}</option>)}
                </select>
              </Field>
            </div>

            <section className="grid gap-4 border-y border-coal-900/15 py-4">
              <h3 className="font-serif text-2xl font-black">SEO</h3>
              <Field label="Título SEO">
                <input value={draft.seoTitle} onChange={(event) => updateField("seoTitle", event.target.value)} className="admin-input" />
              </Field>
              <Field label="Descripción SEO">
                <textarea value={draft.seoDescription} onChange={(event) => updateField("seoDescription", event.target.value)} rows={3} className="admin-input resize-y" />
              </Field>
              <Field label="Imagen SEO">
                <input value={draft.seoImage} onChange={(event) => updateField("seoImage", event.target.value)} className="admin-input" />
                <input type="file" accept="image/*" onChange={(event) => uploadImage(event, "seoImage")} className="text-sm" />
              </Field>
            </section>

            <div className="flex flex-wrap gap-5 border-b border-coal-900/15 pb-4 text-sm font-bold">
              <label className="flex items-center gap-2">
                <input checked={draft.featured} onChange={(event) => updateField("featured", event.target.checked)} type="checkbox" className="size-4 accent-copper" />
                Destacada
              </label>
              <label className="flex items-center gap-2">
                <input checked={draft.main} onChange={(event) => updateField("main", event.target.checked)} type="checkbox" className="size-4 accent-copper" />
                Noticia principal
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <button disabled={state === "saving"} className="min-h-11 bg-coal-950 px-5 text-sm font-black uppercase tracking-[0.14em] text-white hover:bg-copper disabled:opacity-60">
                {state === "saving" ? "Guardando" : selectedArticle ? "Guardar cambios" : "Crear noticia"}
              </button>
              {message ? <p className={`text-sm font-bold ${state === "error" ? "text-red-700" : "text-moss"}`}>{message}</p> : null}
            </div>
          </form>

          <aside>
            <h2 className="border-b-2 border-coal-950 pb-2 font-serif text-2xl font-black">Mesa editorial</h2>
            <div className="mt-2 divide-y divide-coal-900/15">
              {articles.map((article) => (
                <article key={article.id ?? article.slug} className="py-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-copper">
                    {article.status ?? "published"} / {article.comarca} / {article.concejo}
                  </p>
                  <h3 className="mt-1 font-serif text-xl font-black leading-tight">{article.title}</h3>
                  <p className="mt-1 text-sm text-coal-800">{article.date} · {article.topic}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.12em]">
                    <button onClick={() => editArticle(article)} className="text-copper">Editar</button>
                    {canPublish ? <button onClick={() => changeStatus(article, "published")} className="text-moss">Publicar</button> : null}
                    {canPublish ? <button onClick={() => changeStatus(article, "unpublished")} className="text-steel">Despublicar</button> : null}
                    {user.role === "admin" ? <button onClick={() => deleteSelectedArticle(article)} className="text-red-700">Borrar</button> : null}
                  </div>
                </article>
              ))}
            </div>
          </aside>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
          <form onSubmit={saveAuthor} className="grid gap-5 border-t-4 border-coal-950 bg-white/70 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-serif text-3xl font-black">{editingAuthorSlug ? "Editar autor" : "Nuevo autor"}</h2>
              {editingAuthorSlug ? (
                <button type="button" onClick={() => { setEditingAuthorSlug(""); setAuthorDraft({ name: "", role: "", bio: "", email: "", avatar: "" }); }} className="text-sm font-black text-copper">
                  Nuevo
                </button>
              ) : null}
            </div>
            {!canManageAuthors ? <p className="text-sm font-bold text-red-700">Solo un administrador puede crear o borrar autores.</p> : null}
            <Field label="Nombre">
              <input disabled={!canManageAuthors} value={authorDraft.name} onChange={(event) => setAuthorDraft((current) => ({ ...current, name: event.target.value }))} className="admin-input" />
            </Field>
            <Field label="Cargo">
              <input disabled={!canManageAuthors} value={authorDraft.role} onChange={(event) => setAuthorDraft((current) => ({ ...current, role: event.target.value }))} className="admin-input" />
            </Field>
            <Field label="Bio">
              <textarea disabled={!canManageAuthors} value={authorDraft.bio} onChange={(event) => setAuthorDraft((current) => ({ ...current, bio: event.target.value }))} rows={4} className="admin-input resize-y" />
            </Field>
            <Field label="Email">
              <input disabled={!canManageAuthors} value={authorDraft.email} onChange={(event) => setAuthorDraft((current) => ({ ...current, email: event.target.value }))} className="admin-input" />
            </Field>
            <Field label="Foto">
              <input disabled={!canManageAuthors} value={authorDraft.avatar} onChange={(event) => setAuthorDraft((current) => ({ ...current, avatar: event.target.value }))} className="admin-input" />
              <input disabled={!canManageAuthors} type="file" accept="image/*" onChange={(event) => uploadImage(event, "avatar")} className="text-sm" />
            </Field>
            <button disabled={!canManageAuthors || state === "saving"} className="min-h-11 bg-coal-950 px-5 text-sm font-black uppercase tracking-[0.14em] text-white hover:bg-copper disabled:opacity-60">
              {editingAuthorSlug ? "Guardar autor" : "Crear autor"}
            </button>
          </form>

          <aside>
            <h2 className="border-b-2 border-coal-950 pb-2 font-serif text-2xl font-black">Autores</h2>
            <div className="mt-2 divide-y divide-coal-900/15">
              {authors.map((author) => (
                <article key={author.slug} className="py-4">
                  <h3 className="font-serif text-xl font-black">{author.name}</h3>
                  <p className="mt-1 text-sm font-bold text-coal-800">{author.role}</p>
                  <p className="mt-2 text-sm leading-6 text-coal-800">{author.bio}</p>
                  {canManageAuthors ? (
                    <div className="mt-2 flex gap-3 text-xs font-black uppercase tracking-[0.12em]">
                      <button onClick={() => editAuthor(author)} className="text-copper">Editar</button>
                      <button onClick={() => deleteExistingAuthor(author.slug)} className="text-red-700">Borrar</button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-black text-coal-950">
      {label}
      {children}
    </label>
  );
}
