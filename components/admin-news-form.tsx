"use client";

import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Article } from "@/lib/mock-data";
import { authors, territories, topics } from "@/lib/mock-data";

type AdminNewsFormProps = {
  articles: Article[];
};

type SaveState = "idle" | "saving" | "saved" | "error";

export function AdminNewsForm({ articles }: AdminNewsFormProps) {
  const router = useRouter();
  const [comarca, setComarca] = useState<keyof typeof territories>("Caudal");
  const [state, setState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");

  const concejos = useMemo(() => territories[comarca], [comarca]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const payload = {
      title: String(formData.get("title") ?? ""),
      excerpt: String(formData.get("excerpt") ?? ""),
      body: String(formData.get("body") ?? ""),
      image: String(formData.get("image") ?? ""),
      date: String(formData.get("date") ?? ""),
      author: String(formData.get("author") ?? ""),
      comarca,
      concejo: String(formData.get("concejo") ?? ""),
      topic: String(formData.get("topic") ?? ""),
      featured: formData.get("featured") === "on",
      main: formData.get("main") === "on"
    };

    const response = await fetch("/api/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      setState("error");
      setMessage(result.errors?.join(" ") ?? "No se pudo guardar la noticia.");
      return;
    }

    event.currentTarget.reset();
    setComarca("Caudal");
    setState("saved");
    setMessage("Noticia publicada. Ya aparece en portada y secciones.");
    router.refresh();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <form onSubmit={handleSubmit} className="grid gap-5 border-t-4 border-coal-950 bg-white/70 p-5">
        <Field label="Título">
          <input name="title" required className="admin-input" />
        </Field>

        <Field label="Entradilla">
          <textarea name="excerpt" required rows={3} className="admin-input resize-y" />
        </Field>

        <Field label="Cuerpo">
          <textarea
            name="body"
            required
            rows={10}
            placeholder="Separa los párrafos con una línea en blanco."
            className="admin-input resize-y"
          />
        </Field>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Imagen destacada">
            <input name="image" required type="url" placeholder="https://..." className="admin-input" />
          </Field>
          <Field label="Fecha de publicación">
            <input name="date" required type="date" className="admin-input" />
          </Field>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <Field label="Comarca">
            <select
              name="comarca"
              value={comarca}
              onChange={(event) => setComarca(event.target.value as keyof typeof territories)}
              className="admin-input"
            >
              {Object.keys(territories).map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </Field>
          <Field label="Concejo">
            <select name="concejo" className="admin-input">
              {concejos.map((concejo) => (
                <option key={concejo}>{concejo}</option>
              ))}
            </select>
          </Field>
          <Field label="Temática">
            <select name="topic" className="admin-input">
              {topics.map((topic) => (
                <option key={topic}>{topic}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Autor">
          <input name="author" required list="authors" className="admin-input" />
          <datalist id="authors">
            {authors.map((author) => (
              <option key={author.slug} value={author.name} />
            ))}
          </datalist>
        </Field>

        <div className="flex flex-wrap gap-5 border-y border-coal-900/15 py-4 text-sm font-bold">
          <label className="flex items-center gap-2">
            <input name="featured" type="checkbox" className="size-4 accent-copper" />
            Destacada
          </label>
          <label className="flex items-center gap-2">
            <input name="main" type="checkbox" className="size-4 accent-copper" />
            Noticia principal
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button
            disabled={state === "saving"}
            className="min-h-11 bg-coal-950 px-5 text-sm font-black uppercase tracking-[0.14em] text-white hover:bg-copper disabled:opacity-60"
          >
            {state === "saving" ? "Guardando" : "Publicar"}
          </button>
          {message ? (
            <p className={`text-sm font-bold ${state === "error" ? "text-red-700" : "text-moss"}`}>{message}</p>
          ) : null}
        </div>
      </form>

      <aside>
        <h2 className="border-b-2 border-coal-950 pb-2 font-serif text-2xl font-black">Noticias publicadas</h2>
        <div className="mt-2 divide-y divide-coal-900/15">
          {articles.slice(0, 10).map((article) => (
            <article key={article.slug} className="py-4">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-copper">
                {article.comarca} / {article.concejo}
              </p>
              <h3 className="mt-1 font-serif text-xl font-black leading-tight">{article.title}</h3>
              <p className="mt-1 text-sm text-coal-800">{article.date} · {article.topic}</p>
            </article>
          ))}
        </div>
      </aside>
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
