"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { MunicipalIdentity } from "@/lib/municipal-identity";
import { MunicipalMasthead } from "./municipal-masthead";
import { ArticleImage } from "./article-image";
import { sections, readBrowserContent, storageKey, type MunicipalSpace, type MunicipalContent } from "@/lib/demo/municipal";
import type { Article } from "@/lib/mock-data";
import { fiestaDates, type Fiesta } from "@/lib/fiestas-dates";
import { formatDate } from "@/lib/utils";
import { hasTheme, identityStyle } from "@/lib/municipal-identity";

// Content published by a municipal account (not demo, no external reference) is labelled as such.
// With real content (CONTENT_SOURCE=payload) the demo flag is ignored: there are no example items.
function originLabel(item: MunicipalContent, demo: boolean) { return item.sourceUrl ? "Referencia" : demo && item.demo ? "Ejemplo" : "Publicado por el ayuntamiento"; }
function ContentCard({ item, space, compact = false, demo, photo = true }: { item: MunicipalContent; space: MunicipalSpace; compact?: boolean; demo: boolean; photo?: boolean }) {
  const kind = sections.find(s => s.id === item.type)?.label;
  return <article className={`municipal-content-card ${compact ? "is-compact" : ""}`}>
    <div className="municipal-card-meta"><span>{space.name}</span><span>{kind} · {originLabel(item, demo)}</span></div>
    <details><summary><h3>{item.title}</h3><span aria-hidden="true">↗</span></summary>
      <p className="municipal-detail-text">{item.body}</p>
      {item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="municipal-read-link">Consultar la referencia oficial ↗</a> : null}
      {item.attachments.map(file => <a key={file.url} href={file.url} className="editorial-link">{file.title} · PDF ↗</a>)}
    </details>
    {/* La lista de ayudas de «Noticias del concejo» va sin foto (photo=false); la foto sale en su sección. */}
    {item.image && photo ? <figure className="municipal-content-image"><img src={item.image.url} srcSet={item.image.srcSet} sizes={item.image.srcSet ? "(min-width: 1024px) 700px, calc(100vw - 32px)" : undefined} alt={item.image.alt} loading="lazy" decoding="async" /><figcaption>{item.image.credit}</figcaption></figure> : null}
    <p>{item.excerpt}</p>
    <div className="municipal-card-dates">
      {item.type === "event" && item.eventAt ? <><time dateTime={item.eventAt}>{formatDate(item.eventAt.slice(0,10))} · {item.eventAt.slice(11,16)} h</time><span>{item.place}</span></> : null}
      {item.deadline ? <time dateTime={item.deadline}>Solicitudes hasta el {formatDate(item.deadline)}</time> : null}
      {item.expiresAt ? <time dateTime={item.expiresAt}>Vigente hasta el {formatDate(item.expiresAt)}</time> : null}
      {item.type === "news" || item.type === "announcement" ? <time dateTime={item.publishedAt}>{formatDate(item.publishedAt.slice(0,10))}</time> : null}
    </div>
  </article>;
}
// Créditos del escudo y de la foto: solo las piezas que existan (identidad editable en el CMS).
function assetCredits(identity?: MunicipalIdentity) {
  if (!identity) return null;
  const parts = [
    identity.crestCredit ? (identity.crestSource ? <a key="crest" href={identity.crestSource} target="_blank" rel="noopener noreferrer">Escudo: {identity.crestCredit}</a> : <span key="crest">Escudo: {identity.crestCredit}</span>) : null,
    identity.crestLicenseUrl ? <a key="crest-license" href={identity.crestLicenseUrl} target="_blank" rel="noopener noreferrer">Licencia del escudo</a> : null,
    identity.imageLicenseUrl ? <a key="image-license" href={identity.imageLicenseUrl} target="_blank" rel="noopener noreferrer">Licencia de la fotografía</a> : null,
  ].filter(Boolean);
  if (!parts.length) return null;
  return <p className="aller-asset-credit">{parts.flatMap((part, i) => i ? [" · ", part] : [part])}. Fotografía de cabecera adaptada en tamaño y encuadre; colores de presentación inspirados en el paisaje.</p>;
}
export function MunicipalPage({ space, active, contents, articles, fiestas = [], demo = false, util = null }: { space: MunicipalSpace; active: boolean; contents: MunicipalContent[]; articles: Article[]; fiestas?: Fiesta[]; demo?: boolean; util?: ReactNode }) {
  const identity = space.identity;
  const [section, setSection] = useState<string>("news");
  const [browserItems, setBrowserItems] = useState<MunicipalContent[]>([]);
  // Demo only: items published in this browser (localStorage) and a fixed date until hydration. With real content
  // the server already filters expired items (app/(frontend)/[municipality]/page.tsx).
  const [today, setToday] = useState("2026-10-15");
  useEffect(() => {
    if (!demo) return;
    const sync = () => { try { setBrowserItems(readBrowserContent(localStorage.getItem(storageKey(space.id)), space.id)); } catch { setBrowserItems([]); } };
    const frame = requestAnimationFrame(() => { sync(); setToday(new Date().toLocaleDateString("en-CA")); });
    window.addEventListener("storage", sync); window.addEventListener("pageshow", sync);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("storage", sync); window.removeEventListener("pageshow", sync); };
  }, [space.id, demo]);
  const all = active ? [...(demo ? browserItems : []), ...contents].filter(c => c.status === "published" && (!demo || !c.expiresAt || c.expiresAt >= today)) : [];
  const notices = all.filter(c => c.type === "notice");
  const events = all.filter(c => c.type === "event").sort((a,b) => (a.eventAt ?? "").localeCompare(b.eventAt ?? ""));
  return <div className={`municipal-shell ${hasTheme(identity) ? "aller-theme" : ""}`} style={identityStyle(identity)}>
    <MunicipalMasthead space={space} />
    {identity?.image && active ? <figure className="aller-hero"><img src={identity.image} alt={identity.imageAlt ?? ""} width={1800} height={715} fetchPriority="high" /><div className="aller-hero-shade" /><div className="container-p14 aller-hero-copy"><p className="municipal-kicker">Un concejo. Mil formas de vivirlo.</p>{identity.title ? <h2>{identity.title}</h2> : null}{identity.subtitle ? <p>{identity.subtitle}</p> : null}<a href="#vida-municipal">Descubre tu espacio municipal <span aria-hidden="true">↓</span></a></div>{identity.imageCredit ? <figcaption>{identity.imageSource ? <a href={identity.imageSource} target="_blank" rel="noopener noreferrer">{identity.imageCredit}</a> : identity.imageCredit}</figcaption> : null}</figure> : null}
    {active ? <nav className="municipal-section-nav" aria-label="Secciones municipales"><div className="container-p14">{sections.map(s => <button key={s.id} onClick={() => setSection(s.id)} aria-current={section === s.id ? "page" : undefined}>{s.label}</button>)}</div></nav> : null}
    <div id="vida-municipal" className="container-p14 municipal-page-body">
      <div className="municipal-introline"><p><span className="municipal-status-dot" />{active ? "Tu espacio de información municipal" : "El concejo en Planta 14"}</p>{demo ? <span className="municipal-example">Contenido de ejemplo</span> : null}{util ? <a href="#util" className="municipal-util-link">Útil: el tiempo, ayudas, empleo… ↓</a> : null}</div>
      {active && notices.length ? <button className="municipal-notice-strip" onClick={() => setSection("notice")}><span className="municipal-notice-icon" aria-hidden="true">!</span><span><small>AVISO DESTACADO</small><strong>{notices[0].title}</strong></span><span aria-hidden="true">Ver aviso ↗</span></button> : null}
      <div className={`municipal-columns${!active && !fiestas.length ? " is-single" : ""}`} data-municipal-active={active ? "true" : "false"}>
        <div className="municipal-main-column">
          <div className="municipal-section-heading"><div><p className="municipal-kicker">{section === "news" ? "La vida del concejo" : "Información municipal"}</p><h2>{section === "news" ? "Noticias del concejo" : sections.find(s => s.id === section)?.label}</h2></div><span aria-hidden="true">{section === "news" ? "01" : "↗"}</span></div>
          {section === "contact" && active ? <div className="municipal-contact"><h3>Estamos cerca</h3><p>{space.contact.place}</p><p>{space.contact.hours}</p><p className="municipal-detail-text">{space.contact.note}</p>{identity?.official || identity?.tourism ? <p>{identity.official ? <a href={identity.official} target="_blank" rel="noopener noreferrer" className="municipal-read-link">Web municipal de {identity.name} ↗</a> : null}{identity.official && identity.tourism ? <br /> : null}{identity.tourism ? <a href={identity.tourism} target="_blank" rel="noopener noreferrer" className="municipal-read-link">Información turística de {identity.name} ↗</a> : null}</p> : null}<p>Este espacio complementa la comunicación municipal. No es la web institucional ni la sede electrónica y no tramita solicitudes.</p></div> : null}
          {all.filter(c => c.type === section).map(item => <ContentCard key={item.id} item={item} space={space} demo={demo} />)}
          {section === "news" ? <>
            {articles.length > 0 ? <div className="municipal-editorial-label"><span /> La mirada de Planta 14 <span /></div> : null}
            {articles.map(article => <article key={article.slug} className="municipal-editorial-card"><Link href={`/noticia/${article.slug}`} className="municipal-editorial-image"><ArticleImage article={article} sizes="horizontal" width={320} height={220} /></Link><div><p className="municipal-card-meta editorial-origin">Redacción Planta 14</p><h3><Link href={`/noticia/${article.slug}`}>{article.title}</Link></h3><p>{article.excerpt}</p><Link href={`/noticia/${article.slug}`} className="municipal-read-link">Leer la historia ↗</Link></div></article>)}
            {active && identity?.stories.length ? <section className="aller-discover" aria-label={`Descubre ${identity.name}`}><p className="municipal-kicker">{identity.name}, todo el año</p><div>{identity.stories.map(story => <a key={story.id} href={story.href} target={story.href.startsWith("https:") ? "_blank" : undefined} rel={story.href.startsWith("https:") ? "noopener noreferrer" : undefined}><span className="aller-story-number">{story.number}</span><small>{story.label}</small><h3>{story.title}</h3><p>{story.text}</p><span className="municipal-read-link">Descubrir ↗</span></a>)}</div></section> : null}
            {!active && !articles.length ? <p className="municipal-contact" data-municipal-empty>Todavía no hay noticias de {space.name} en Planta 14.</p> : null}
            {active ? <section className="municipal-grant-preview"><p className="municipal-kicker">Ayudas y subvenciones</p>{all.filter(c => c.type === "grant").map(item => <ContentCard key={item.id} item={item} space={space} demo={demo} compact photo={false} />)}<button className="municipal-text-button" onClick={() => setSection("grant")}>Ver todas las ayudas ↗</button></section> : null}
          </> : null}
        </div>
        {active || fiestas.length ? <aside className="municipal-sidebar">
          {fiestas.length ? <section className="municipal-fiestas" data-municipal-fiestas><div className="municipal-sidebar-heading"><h2>Fiestas esta semana</h2><Link href={`/fiestas?concejo=${space.territory}`} aria-label="Ver todas las fiestas del concejo">↗</Link></div>
            <ul>{fiestas.map(f => <li key={f.slug}><Link href={`/fiestas/${f.slug}`}><strong>{f.name}</strong><small>{f.village} · {fiestaDates(f)}</small></Link></li>)}</ul></section> : null}
          {active ? <><section><div className="municipal-sidebar-heading"><h2>Agenda</h2><button onClick={() => setSection("event")} aria-label="Ver toda la agenda">↗</button></div>{events.slice(0,3).map(event => <button className="municipal-event" key={event.id} onClick={() => setSection("event")}><time dateTime={event.eventAt ?? undefined}><strong>{event.eventAt?.slice(8,10)}</strong><span>{new Intl.DateTimeFormat("es-ES",{month:"short"}).format(new Date(event.eventAt ?? event.publishedAt)).replace(".","")}</span></time><span><strong>{event.title}</strong><small>{event.place}</small><small>{event.eventAt?.slice(11,16)} h · {originLabel(event, demo)}</small></span></button>)}</section>
          <section className="municipal-notices"><h2>Avisos</h2>{notices.map(item => <ContentCard key={item.id} item={item} space={space} demo={demo} compact />)}</section>
          {demo ? <section className="municipal-panel-invite"><p className="municipal-kicker">Así de sencillo</p><h2>Tu ayuntamiento<br />tiene la palabra.</h2><p>Escribe un aviso, comprueba cómo queda y publícalo. Sin complicaciones.</p><Link href={`/${space.id}/panel`} className="municipal-cta">Probar el panel <span>↗</span></Link><small>Demostración · Sin registro</small></section> : null}</> : null}
        </aside> : null}
      </div>
      {util ? <section id="util" className="municipal-util" aria-labelledby="util-title" data-municipal-util><div className="municipal-section-heading"><div><p className="municipal-kicker">Servicio</p><h2 id="util-title">Útil</h2></div><Link href="/util" aria-label="Útil en todas las Cuencas">↗</Link></div>{util}</section> : null}
      <div className="municipal-bottom-note"><span>{active ? "Información municipal y periodismo local, en un mismo lugar." : `${space.name} en Planta 14.`}</span><Link href="/">Volver al periódico ↗</Link></div>
      {assetCredits(identity)}
    </div>
  </div>;
}
