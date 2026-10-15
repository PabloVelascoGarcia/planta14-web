"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { MunicipalMasthead } from "./municipal-masthead";
import { sections, readBrowserContent, storageKey, type MunicipalSpace, type MunicipalContent } from "@/lib/demo/municipal";
import type { Article } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";
import { allerIdentity } from "@/lib/demo/aller";

function ContentCard({ item, space, compact = false }: { item: MunicipalContent; space: MunicipalSpace; compact?: boolean }) {
  const kind = sections.find(s => s.id === item.type)?.label;
  return <article className={`municipal-content-card ${compact ? "is-compact" : ""}`}>
    <div className="municipal-card-meta"><span>{space.name}</span><span>{kind} · {item.sourceUrl ? "Referencia" : "Ejemplo"}</span></div>
    <details><summary><h3>{item.title}</h3><span aria-hidden="true">↗</span></summary>
      <p className="municipal-detail-text">{item.body}</p>
      {item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="municipal-read-link">Consultar la referencia oficial ↗</a> : null}
      {item.attachments.map(file => <a key={file.url} href={file.url} className="editorial-link">{file.title} · PDF ↗</a>)}
    </details>
    <p>{item.excerpt}</p>
    <div className="municipal-card-dates">
      {item.type === "event" && item.eventAt ? <><time dateTime={item.eventAt}>{formatDate(item.eventAt.slice(0,10))} · {item.eventAt.slice(11,16)} h</time><span>{item.place}</span></> : null}
      {item.deadline ? <time dateTime={item.deadline}>Solicitudes hasta el {formatDate(item.deadline)}</time> : null}
      {item.expiresAt ? <time dateTime={item.expiresAt}>Vigente hasta el {formatDate(item.expiresAt)}</time> : null}
      {item.type === "news" || item.type === "announcement" ? <time dateTime={item.publishedAt}>{formatDate(item.publishedAt.slice(0,10))}</time> : null}
    </div>
  </article>;
}
export function MunicipalPage({ space, active, contents, articles }: { space: MunicipalSpace; active: boolean; contents: MunicipalContent[]; articles: Article[] }) {
  const [section, setSection] = useState<string>("news");
  const [browserItems, setBrowserItems] = useState<MunicipalContent[]>([]);
  const [today, setToday] = useState("2026-10-15");
  useEffect(() => {
    const sync = () => { try { setBrowserItems(readBrowserContent(localStorage.getItem(storageKey(space.id)), space.id)); } catch { setBrowserItems([]); } };
    const frame = requestAnimationFrame(() => { sync(); setToday(new Date().toLocaleDateString("en-CA")); });
    window.addEventListener("storage", sync); window.addEventListener("pageshow", sync);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("storage", sync); window.removeEventListener("pageshow", sync); };
  }, [space.id]);
  const all = active ? [...browserItems, ...contents].filter(c => c.status === "published" && (!c.expiresAt || c.expiresAt >= today)) : [];
  const notices = all.filter(c => c.type === "notice");
  const events = all.filter(c => c.type === "event").sort((a,b) => (a.eventAt ?? "").localeCompare(b.eventAt ?? ""));
  return <div className={`municipal-shell ${space.id === "aller" ? "aller-theme" : ""}`}>
    <MunicipalMasthead space={space} />
    {space.id === "aller" && active ? <figure className="aller-hero"><img src={allerIdentity.image} alt={allerIdentity.imageAlt} width={1800} height={715} fetchPriority="high" /><div className="aller-hero-shade" /><div className="container-p14 aller-hero-copy"><p className="municipal-kicker">Un concejo. Mil formas de vivirlo.</p><h2>{allerIdentity.title}</h2><p>{allerIdentity.subtitle}</p><a href="#vida-municipal">Descubre tu espacio municipal <span aria-hidden="true">↓</span></a></div><figcaption><a href={allerIdentity.imageSource} target="_blank" rel="noopener noreferrer">{allerIdentity.imageCredit}</a></figcaption></figure> : null}
    {active ? <nav className="municipal-section-nav" aria-label="Secciones municipales"><div className="container-p14">{sections.map(s => <button key={s.id} onClick={() => setSection(s.id)} aria-current={section === s.id ? "page" : undefined}>{s.label}</button>)}</div></nav> : null}
    <div id="vida-municipal" className="container-p14 municipal-page-body">
      <div className="municipal-introline"><p><span className="municipal-status-dot" />{active ? "Tu espacio de información municipal" : "El concejo en Planta 14"}</p><span className="municipal-example">Contenido de ejemplo</span></div>
      {active && notices.length ? <button className="municipal-notice-strip" onClick={() => setSection("notice")}><span className="municipal-notice-icon" aria-hidden="true">!</span><span><small>AVISO DESTACADO</small><strong>{notices[0].title}</strong></span><span aria-hidden="true">Ver aviso ↗</span></button> : null}
      <div className="municipal-columns">
        <div className="municipal-main-column">
          <div className="municipal-section-heading"><div><p className="municipal-kicker">{section === "news" ? "La vida del concejo" : "Información municipal"}</p><h2>{section === "news" ? "Noticias del concejo" : sections.find(s => s.id === section)?.label}</h2></div><span aria-hidden="true">{section === "news" ? "01" : "↗"}</span></div>
          {section === "contact" && active ? <div className="municipal-contact"><h3>Estamos cerca</h3><p>{space.contact.place}</p><p>{space.contact.hours}</p><p className="municipal-detail-text">{space.contact.note}</p>{space.id === "aller" ? <p><a href="https://www.aller.es/" target="_blank" rel="noopener noreferrer" className="municipal-read-link">Web del Ayuntamiento de Aller ↗</a><br /><a href="https://visitaaller.es/" target="_blank" rel="noopener noreferrer" className="municipal-read-link">Información turística de Aller ↗</a></p> : null}<p>Este espacio complementa la comunicación municipal. No es la web institucional ni la sede electrónica y no tramita solicitudes.</p></div> : null}
          {all.filter(c => c.type === section).map(item => <ContentCard key={item.id} item={item} space={space} />)}
          {section === "news" ? <>
            {space.id === "aller" ? <section className="aller-discover" aria-label="Descubre Aller"><p className="municipal-kicker">Aller, todo el año</p><div>{allerIdentity.stories.map(story => <a key={story.id} href={story.href} target={story.href.startsWith("https:") ? "_blank" : undefined} rel={story.href.startsWith("https:") ? "noopener noreferrer" : undefined}><span className="aller-story-number">{story.number}</span><small>{story.label}</small><h3>{story.title}</h3><p>{story.text}</p><span className="municipal-read-link">Descubrir ↗</span></a>)}</div></section> : null}
            {articles.length > 0 ? <div className="municipal-editorial-label"><span /> La mirada de Planta 14 <span /></div> : null}
            {articles.map(article => <article key={article.slug} className="municipal-editorial-card"><Link href={`/noticia/${article.slug}`} className="municipal-editorial-image"><img src={article.image} alt={article.imageAlt ?? ""} width={320} height={220} /></Link><div><p className="municipal-card-meta editorial-origin">Redacción Planta 14</p><h3><Link href={`/noticia/${article.slug}`}>{article.title}</Link></h3><p>{article.excerpt}</p><Link href={`/noticia/${article.slug}`} className="municipal-read-link">Leer la historia ↗</Link></div></article>)}
            {!active && !articles.length ? <p className="municipal-contact">El espacio municipal todavía no está activo. <Link href="/comarca/caudal">Explora las historias del Caudal ↗</Link></p> : null}
            {active ? <section className="municipal-grant-preview"><p className="municipal-kicker">Ayudas y subvenciones</p>{all.filter(c => c.type === "grant").map(item => <ContentCard key={item.id} item={item} space={space} compact />)}<button className="municipal-text-button" onClick={() => setSection("grant")}>Ver todas las ayudas ↗</button></section> : null}
          </> : null}
        </div>
        <aside className="municipal-sidebar">
          {active ? <><section><div className="municipal-sidebar-heading"><h2>Agenda</h2><button onClick={() => setSection("event")} aria-label="Ver toda la agenda">↗</button></div>{events.slice(0,3).map(event => <button className="municipal-event" key={event.id} onClick={() => setSection("event")}><time dateTime={event.eventAt ?? undefined}><strong>{event.eventAt?.slice(8,10)}</strong><span>{new Intl.DateTimeFormat("es-ES",{month:"short"}).format(new Date(event.eventAt ?? event.publishedAt)).replace(".","")}</span></time><span><strong>{event.title}</strong><small>{event.place}</small><small>{event.eventAt?.slice(11,16)} h · {event.sourceUrl ? "Referencia" : "Ejemplo"}</small></span></button>)}</section>
          <section className="municipal-notices"><h2>Avisos</h2>{notices.map(item => <ContentCard key={item.id} item={item} space={space} compact />)}</section>
          <section className="municipal-panel-invite"><p className="municipal-kicker">Así de sencillo</p><h2>Tu ayuntamiento<br />tiene la palabra.</h2><p>Escribe un aviso, comprueba cómo queda y publícalo. Sin complicaciones.</p><Link href={`/${space.id}/panel`} className="municipal-cta">Probar el panel <span>↗</span></Link><small>Demostración · Sin registro</small></section></> : <Link href="/comarca/caudal" className="municipal-cta">Historias del Caudal ↗</Link>}
        </aside>
      </div>
      <div className="municipal-bottom-note"><span>Información municipal y periodismo local, en un mismo lugar.</span><Link href="/">Volver al periódico ↗</Link></div>
      {space.id === "aller" ? <p className="aller-asset-credit"><a href={allerIdentity.crestSource} target="_blank" rel="noopener noreferrer">Escudo: {allerIdentity.crestCredit}</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">Licencia</a>. Fotografía de cabecera adaptada en tamaño y encuadre; colores de presentación inspirados en el paisaje.</p> : null}
    </div>
  </div>;
}
