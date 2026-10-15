"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { MunicipalMasthead } from "./municipal-masthead";
import { readBrowserContent, storageKey, type MunicipalSpace, type MunicipalContent } from "@/lib/demo/municipal";

export function MunicipalPanel({ space }: { space: MunicipalSpace }) {
  const [type, setType] = useState<"notice" | "event">("notice");
  const [title, setTitle] = useState("La biblioteca amplía su horario esta semana");
  const [body, setBody] = useState("De lunes a viernes, la biblioteca abrirá también por la tarde, de 16:00 a 20:00. Un espacio para estudiar, descubrir nuevas lecturas y compartir el tiempo.");
  const [date, setDate] = useState("2026-11-30");
  const [time, setTime] = useState("18:00");
  const [place, setPlace] = useState("Biblioteca municipal");
  const [message, setMessage] = useState("");
  const [published, setPublished] = useState(false);
  const [preview, setPreview] = useState(false);
  function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !body.trim() || !date || (type === "event" && !place.trim())) return;
    const item: MunicipalContent = {
      id: `browser-${crypto.randomUUID()}`, space: space.id, type, title: title.trim(), body: body.trim(),
      excerpt: body.trim().slice(0,200), origin: "municipality", status: "published",
      publishedAt: new Date().toISOString(), expiresAt: type === "notice" ? date : null,
      eventAt: type === "event" ? `${date}T${time}` : null, place: type === "event" ? place.trim() : null,
      deadline: null, attachments: [], demo: true
    };
    try {
      const previous = readBrowserContent(localStorage.getItem(storageKey(space.id)), space.id);
      localStorage.setItem(storageKey(space.id), JSON.stringify([item, ...previous].slice(0,20)));
      setMessage("¡Listo! Tu publicación ya se puede ver en este navegador."); setPublished(true);
    } catch { setMessage("El navegador no permite guardar la prueba. Puedes seguir viendo la vista previa; no se ha publicado nada."); setPublished(false); }
  }
  function reset() {
    try { localStorage.removeItem(storageKey(space.id)); setMessage("Pruebas borradas. El espacio vuelve a su contenido inicial."); setPublished(false); }
    catch { setMessage("No se han podido borrar las pruebas en este navegador."); }
  }
  return <div className="municipal-shell">
    <MunicipalMasthead space={space} panel />
    <div className="container-p14 municipal-panel-body">
      <div className="municipal-demo-banner"><span className="municipal-example">Demostración</span><p>Prueba libremente. No envía información al ayuntamiento ni publica en internet. Solo se guarda en este navegador.</p><Link href={`/${space.id}`}>Ver el espacio ↗</Link></div>
      <div className="municipal-panel-heading"><div><p className="municipal-kicker">De tu mesa al concejo</p><h2>Una idea. Un minuto.<br />Tu publicación.</h2></div><p>Sin conocimientos técnicos.<br />Escribe, revisa y comparte.</p></div>
      <div className="municipal-panel-grid">
        <form onSubmit={publish} className="municipal-form">
          <div className="municipal-step"><span>1</span><h3>¿Qué quieres contar?</h3></div>
          <fieldset className="municipal-type-picker"><legend className="sr-only">Tipo de publicación</legend><label className={type === "notice" ? "is-selected" : ""}><input type="radio" name="type" value="notice" checked={type === "notice"} onChange={() => { setType("notice"); setPublished(false); }} /><strong>Aviso</strong><small>Información importante</small></label><label className={type === "event" ? "is-selected" : ""}><input type="radio" name="type" value="event" checked={type === "event"} onChange={() => { setType("event"); setPublished(false); }} /><strong>Evento</strong><small>Una cita en la agenda</small></label></fieldset>
          <label>Título<input aria-label="Título" value={title} onChange={e => { setTitle(e.target.value); setPublished(false); }} maxLength={140} required placeholder="Por ejemplo: nuevo horario de la biblioteca" /><small>{title.length}/140 caracteres</small></label>
          <label>¿Qué deben saber los vecinos?<textarea value={body} onChange={e => { setBody(e.target.value); setPublished(false); }} maxLength={2500} rows={5} required placeholder="Cuenta lo esencial con tus palabras…" /></label>
          <div className="municipal-field-row"><label>{type === "notice" ? "Mostrar el aviso hasta" : "Fecha del evento"}<input type="date" value={date} required onChange={e => { setDate(e.target.value); setPublished(false); }} /></label>{type === "event" ? <label>Hora<input type="time" value={time} required onChange={e => { setTime(e.target.value); setPublished(false); }} /></label> : null}</div>
          {type === "event" ? <label>Lugar<input value={place} maxLength={160} required onChange={e => { setPlace(e.target.value); setPublished(false); }} /></label> : <p className="municipal-field-help">El aviso dejará de mostrarse cuando termine este plazo.</p>}
          <button type="button" className="municipal-preview-toggle" aria-expanded={preview} onClick={() => setPreview(!preview)}>{preview ? "Ocultar vista previa ↑" : "2 · Ver cómo queda ↓"}</button>
          <div className="municipal-publish-actions"><button type="submit" className="municipal-cta" disabled={published}>{published ? "Publicado en este navegador ✓" : "Publicar demostración ↗"}</button><small>Sin cuenta y sin envío al servidor.</small></div>
          <div role="status" className={message ? "municipal-form-status" : ""}>{message}{published ? <Link href={`/${space.id}`}> Ver mi publicación en el espacio ↗</Link> : null}</div>
          <button type="button" className="municipal-reset" onClick={reset}>Borrar mis publicaciones de prueba</button>
        </form>
        <aside className={`municipal-live-preview ${preview ? "show-preview" : ""}`}><div className="municipal-step"><span>2</span><h3>Así lo verán los vecinos</h3></div><div className="municipal-preview-window"><div className="municipal-preview-bar"><span /><span /><span /><small>planta14.com/{space.id}</small></div><div className="municipal-preview-paper"><p className="municipal-kicker">{type === "notice" ? "Avisos del concejo" : "Agenda del concejo"}</p><p className="municipal-card-meta">{space.name}</p><h3>{title || "El título de tu publicación"}</h3><p className="municipal-preview-text">{body || "Aquí aparecerá lo que quieras contar."}</p>{date ? <p className="municipal-preview-date">{type === "notice" ? "Visible hasta" : "Te esperamos el"} {new Intl.DateTimeFormat("es-ES", {day:"numeric",month:"long",year:"numeric"}).format(new Date(date + "T12:00:00"))}{type === "event" ? ` · ${time} h` : ""}</p> : null}{type === "event" ? <p>{place}</p> : null}<span className="municipal-example">Contenido de ejemplo</span></div></div><p className="municipal-preview-caption">Tu información, con el diseño de Planta 14.<br />Adaptada al móvil desde el primer momento.</p><div className="municipal-panel-tip"><span aria-hidden="true">✦</span><p><strong>El ayuntamiento solo se ocupa de contar.</strong><br />El diseño, el alojamiento y el mantenimiento van por nuestra cuenta.</p></div></aside>
      </div>
    </div>
  </div>;
}
