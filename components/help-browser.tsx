"use client";
import { useMemo, useState } from "react";

// Ayuda (CMS y panel municipal): índice con enlaces, buscador sencillo (sin tildes ni mayúsculas) y el manual con sus
// capturas. El HTML lo genera el servidor a partir del manual del repositorio (lib/manuals.ts), con el texto escapado.
export type HelpSectionView = { id: string; title: string; html: string; text: string; admin: boolean };
const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function HelpBrowser({ title, sections, pdfHref, updated }: { title: string; sections: HelpSectionView[]; pdfHref: string; updated: string }) {
  const [query, setQuery] = useState("");
  const words = norm(query).split(/\s+/).filter(Boolean);
  const visible = useMemo(() => sections.filter(s => words.every(w => norm(s.text).includes(w))), [sections, words.join(" ")]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="help" data-help>
    <style>{CSS}</style>
    <div className="help-head">
      <div><h1>{title}</h1><p className="help-updated">Actualizado el {updated}.</p></div>
      <a className="help-pdf" href={pdfHref} download data-help-pdf>Descargar en PDF</a>
    </div>
    <label className="help-search">Buscar en la ayuda
      <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Por ejemplo: galería, etiqueta, contraseña…" data-help-search /></label>
    {query ? <p className="help-count" role="status" data-help-count>{visible.length ? `${visible.length} ${visible.length === 1 ? "apartado" : "apartados"} con «${query}»` : `Nada con «${query}». Prueba con otra palabra.`}</p> : null}
    <div className="help-layout">
      <nav className="help-toc" aria-label="Índice de la ayuda" data-help-toc>
        <strong>Índice</strong>
        <ol>{visible.map(s => <li key={s.id}><a href={`#${s.id}`}>{s.title}</a>{s.admin ? <span className="help-admin-tag">Administración</span> : null}</li>)}</ol>
      </nav>
      <div className="help-body">
        {visible.map(s => <section key={s.id} id={s.id} className={s.admin ? "help-section is-admin" : "help-section"} data-help-section={s.id} {...(s.admin ? { "data-help-admin": "" } : {})}>
          {s.admin ? <p className="help-admin-note">Solo lo ve la administración.</p> : null}
          {s.id !== "introduccion" ? <h2>{s.title}</h2> : null}
          <div dangerouslySetInnerHTML={{ __html: s.html }} />
          <p className="help-top"><a href="#ayuda-inicio">Volver arriba</a></p>
        </section>)}
      </div>
    </div>
  </div>;
}

const CSS = `
.help { max-width: 1120px; font-size: 16px; line-height: 1.6; color: inherit; scroll-margin-top: 80px; }
.help h1 { margin: 0; font-size: 30px; line-height: 1.15; }
.help-head { display: flex; flex-wrap: wrap; gap: 12px 24px; align-items: flex-end; justify-content: space-between; margin-bottom: 16px; }
.help-updated { margin: 6px 0 0; font-size: 14px; opacity: .7; }
.help-pdf { display: inline-flex; align-items: center; min-height: 44px; padding: 0 18px; border-radius: 4px; background: #a4522d; color: #fff !important; font-weight: 700; text-decoration: none; }
.help-search { display: grid; gap: 6px; max-width: 560px; font-weight: 700; font-size: 14px; }
.help-search input { min-height: 44px; padding: 8px 12px; font: inherit; font-weight: 400; border: 1px solid #b9b2a8; border-radius: 4px; }
.help-count { margin: 10px 0 0; font-size: 14px; }
.help-layout { display: grid; gap: 28px; margin-top: 24px; }
@media (min-width: 1000px) { .help-layout { grid-template-columns: 260px minmax(0, 1fr); } .help-toc { position: sticky; top: 72px; align-self: start; max-height: calc(100vh - 96px); overflow: auto; } }
.help-toc { border: 1px solid #ddd6cc; border-radius: 6px; padding: 14px 16px; font-size: 14px; }
.help-toc ol { margin: 8px 0 0; padding-left: 20px; display: grid; gap: 6px; }
.help-toc a { text-decoration: underline; color: inherit; }
.help-admin-tag { margin-left: 6px; font-size: 11px; padding: 1px 6px; border-radius: 3px; background: #7a2e3a; color: #fff; }
.help-section { padding-bottom: 12px; border-bottom: 1px solid #e6e0d8; margin-bottom: 24px; scroll-margin-top: 80px; }
.help-section.is-admin { border-left: 4px solid #7a2e3a; padding-left: 16px; }
.help-admin-note { font-size: 13px; font-weight: 700; color: #7a2e3a; margin: 0 0 4px; }
.help-section h2 { font-size: 24px; margin: 8px 0 12px; line-height: 1.25; }
.help-section h3 { font-size: 18px; margin: 20px 0 8px; }
.help-section p, .help-section li { max-width: 72ch; }
.help-section ul, .help-section ol { padding-left: 24px; }
.help-section li { margin: 4px 0; }
.help-section figure { margin: 16px 0; }
.help-section figure img { display: block; max-width: 100%; height: auto; border: 1px solid #ddd6cc; border-radius: 4px; }
.help-section figcaption { font-size: 13px; opacity: .75; margin-top: 4px; }
.help-section code { font-size: .92em; padding: 1px 4px; border-radius: 3px; background: rgba(0,0,0,.06); }
.help-section pre { white-space: pre-wrap; padding: 12px; border-radius: 4px; background: rgba(0,0,0,.06); font-size: 14px; }
.help-table { overflow-x: auto; }
.help-section table { border-collapse: collapse; width: 100%; font-size: 15px; }
.help-section th, .help-section td { text-align: left; vertical-align: top; padding: 8px 10px; border-bottom: 1px solid #e6e0d8; }
.help-section th { background: rgba(0,0,0,.04); }
.help-section a { color: inherit; text-decoration: underline; }
.help-top { font-size: 13px; margin-top: 12px; }
`;
