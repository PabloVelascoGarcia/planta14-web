"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { hasTheme, identityStyle } from "@/lib/municipal-identity";
import { sections, type MunicipalSpace } from "@/lib/demo/municipal";
import type { PanelItem, PanelState } from "@/lib/municipal-panel";
import { MunicipalMasthead } from "./municipal-masthead";
import { MunicipalSuggestions } from "./municipal-suggestions";

type ContentType = PanelItem["type"];
const types = sections.filter(s => s.id !== "contact") as { id: ContentType; label: string }[];
const api = "/api/cms";

async function request(path: string, init: RequestInit) {
  const response = await fetch(`${api}${path}`, { credentials: "same-origin", ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.errors?.[0]?.message || body?.message || `Error ${response.status}`);
  return body;
}
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const empty = { id: null as number | null, type: "notice" as ContentType, title: "", excerpt: "", body: "", expiresAt: "", eventDate: "", eventTime: "18:00", place: "", deadline: "", image: null as number | null };
type Draft = typeof empty;
function fromItem(item: PanelItem): Draft {
  return { id: item.id, type: item.type, title: item.title, excerpt: item.excerpt, body: item.body, expiresAt: item.expiresAt || "",
    eventDate: item.eventAt?.slice(0, 10) || "", eventTime: item.eventAt?.slice(11, 16) || "18:00", place: item.place || "", deadline: item.deadline || "", image: item.image };
}

function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [forgot, setForgot] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    try { await request("/users/login", json("POST", { email, password })); onDone(); }
    catch { setMessage("No se ha podido iniciar sesión. Revisa el correo y la contraseña."); }
  }
  async function sendReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage("");
    try {
      await request("/users/forgot-password", json("POST", { email }));
      // Mismo mensaje exista o no la cuenta: no se revela qué correos tienen cuenta.
      setMessage("Si ese correo tiene una cuenta, en unos minutos recibirás un enlace para elegir una contraseña nueva. Caduca en una hora. Mira también en el correo no deseado.");
    } catch (error) {
      setMessage(error instanceof Error && /actualiz/i.test(error.message) ? error.message : "No se ha podido enviar el correo. Inténtalo de nuevo en unos minutos.");
    } finally { setBusy(false); }
  }
  if (forgot) return <form onSubmit={sendReset} className="municipal-form" data-forgot-password>
    <div className="municipal-step"><span>1</span><h3>¿Has olvidado tu contraseña?</h3></div>
    <p className="municipal-form-help">Escribe el correo de la cuenta de tu ayuntamiento y te enviaremos un enlace para elegir una nueva.</p>
    <label>Correo electrónico<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></label>
    <div className="municipal-publish-actions"><button type="submit" className="municipal-cta" disabled={busy}>{busy ? "Enviando…" : "Enviar el enlace ↗"}</button></div>
    <div role="status" className={message ? "municipal-form-status" : ""}>{message}</div>
    <button type="button" className="municipal-text-link" onClick={() => { setForgot(false); setMessage(""); }}>← Volver a entrar</button>
  </form>;
  return <form onSubmit={submit} className="municipal-form">
    <div className="municipal-step"><span>1</span><h3>Entra con la cuenta de tu ayuntamiento</h3></div>
    <label>Correo electrónico<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></label>
    <label>Contraseña<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
    <div className="municipal-publish-actions"><button type="submit" className="municipal-cta">Entrar ↗</button><small>Las cuentas municipales las crea Planta 14.</small></div>
    <div role="status" className={message ? "municipal-form-status" : ""}>{message}</div>
    <button type="button" className="municipal-text-link" onClick={() => { setForgot(true); setMessage(""); }}>¿Has olvidado tu contraseña?</button>
  </form>;
}

export function MunicipalCmsPanel({ space, state, maintenance = null }: { space: MunicipalSpace; state: PanelState; maintenance?: string | null }) {
  const identity = space.identity;
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(empty);
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [credit, setCredit] = useState("");
  const [declared, setDeclared] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Draft>) => setDraft(current => ({ ...current, ...patch }));
  // Modo mantenimiento: solo lectura (el servidor rechaza igualmente cualquier escritura).
  const locked = busy || Boolean(maintenance);

  async function logout() {
    await fetch(`${api}/users/logout`, { method: "POST", credentials: "same-origin" }).catch(() => undefined);
    router.refresh();
  }
  async function save(publish: boolean) {
    if (!draft.title.trim() || !draft.excerpt.trim() || !draft.body.trim()) { setMessage("Completa título, resumen y texto."); return; }
    if (draft.type === "event" && (!draft.eventDate || !draft.place.trim())) { setMessage("Indica la fecha y el lugar del evento."); return; }
    setBusy(true); setMessage("");
    try {
      let image = draft.image;
      if (file) {
        if (!alt.trim() || !credit.trim()) throw new Error("Describe la imagen e indica su autoría.");
        if (!declared) throw new Error("Marca la declaración de derechos sobre la imagen.");
        const form = new FormData();
        form.append("file", file);
        form.append("_payload", JSON.stringify({ alt: alt.trim(), credit: credit.trim(), rightsScope: "publicable", rightsDeclaration: { declared: true } }));
        image = (await request("/media", { method: "POST", body: form })).doc.id;
      }
      const data = {
        type: draft.type, title: draft.title.trim(), excerpt: draft.excerpt.trim(), body: draft.body.trim(), image,
        expiresAt: draft.type === "notice" ? draft.expiresAt || null : null,
        eventAt: draft.type === "event" ? `${draft.eventDate}T${draft.eventTime || "00:00"}` : null,
        place: draft.type === "event" ? draft.place.trim() : null,
        deadline: draft.type === "grant" ? draft.deadline || null : null,
        _status: publish ? "published" : "draft",
      };
      const query = publish ? "" : "?draft=true";
      if (draft.id) await request(`/municipal-content/${draft.id}${query}`, json("PATCH", data));
      else await request(`/municipal-content${query}`, json("POST", data));
      setMessage(publish ? "Publicado. Ya se puede ver en tu espacio." : "Borrador guardado. Solo lo ve tu ayuntamiento.");
      setDraft(empty); setFile(null); setAlt(""); setCredit(""); setDeclared(false);
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se ha podido guardar."); }
    finally { setBusy(false); }
  }
  async function setStatus(item: PanelItem, status: "published" | "draft") {
    setBusy(true); setMessage("");
    try {
      await request(`/municipal-content/${item.id}`, json("PATCH", { _status: status }));
      setMessage(status === "published" ? "Publicado." : "Retirado de la web. Queda como borrador.");
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se ha podido cambiar el estado."); }
    finally { setBusy(false); }
  }

  return <div className={`municipal-shell ${hasTheme(identity) ? "aller-theme" : ""}`} style={identityStyle(identity)}>
    <MunicipalMasthead space={space} panel live />
    <div className="container-p14 municipal-panel-body">
      {maintenance ? <div className="municipal-demo-banner" role="status" data-maintenance="on"><span className="municipal-example">Mantenimiento</span><p>{maintenance}</p></div> : null}
      {state.kind === "login" ? <>
        <div className="municipal-panel-heading"><div><p className="municipal-kicker">De tu mesa al concejo</p><h2>Publica en tu<br />espacio municipal.</h2></div><p>Lo que publiques aparece al momento<br />en {space.name}.</p></div>
        <div className="municipal-panel-grid"><Login onDone={() => router.refresh()} /></div>
      </> : null}
      {state.kind === "forbidden" ? <div className="municipal-demo-banner"><span className="municipal-example">Sin acceso</span><p>{state.reason} ({state.email})</p><button type="button" className="municipal-reset" onClick={logout}>Cerrar sesión</button></div> : null}
      {state.kind === "editor" ? <>
        <div className="municipal-demo-banner"><span className="municipal-example">Contenido municipal</span><p>Conectado como {state.email}. Lo que publiques aparece al momento en tu espacio, marcado como contenido del ayuntamiento. Planta 14 puede retirarlo indicando el motivo.</p><button type="button" className="municipal-reset" onClick={logout}>Cerrar sesión</button></div>
        <div className="municipal-panel-heading"><div><p className="municipal-kicker">De tu mesa al concejo</p><h2>{draft.id ? "Edita tu publicación." : "Una idea. Un minuto."}<br />Tu publicación.</h2></div><p><Link href={`/${space.id}`}>Ver el espacio ↗</Link></p></div>
        <div className="municipal-panel-grid">
          <form onSubmit={e => { e.preventDefault(); void save(true); }} className="municipal-form" aria-label="Publicación municipal">
            <div className="municipal-step"><span>1</span><h3>¿Qué quieres contar?</h3></div>
            <label>Tipo<select value={draft.type} onChange={e => set({ type: e.target.value as ContentType })}>{types.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
            <label>Título<input value={draft.title} onChange={e => set({ title: e.target.value })} maxLength={140} required /><small>{draft.title.length}/140 caracteres</small></label>
            <label>Resumen<textarea value={draft.excerpt} onChange={e => set({ excerpt: e.target.value })} maxLength={300} rows={2} required /></label>
            <label>¿Qué deben saber los vecinos?<textarea value={draft.body} onChange={e => set({ body: e.target.value })} maxLength={5000} rows={6} required /></label>
            {draft.type === "notice" ? <label>Mostrar el aviso hasta<input type="date" value={draft.expiresAt} onChange={e => set({ expiresAt: e.target.value })} /></label> : null}
            {draft.type === "event" ? <><div className="municipal-field-row"><label>Fecha del evento<input type="date" value={draft.eventDate} required onChange={e => set({ eventDate: e.target.value })} /></label><label>Hora<input type="time" value={draft.eventTime} onChange={e => set({ eventTime: e.target.value })} /></label></div>
              <label>Lugar<input value={draft.place} maxLength={160} required onChange={e => set({ place: e.target.value })} /></label></> : null}
            {draft.type === "grant" ? <label>Plazo de solicitud<input type="date" value={draft.deadline} onChange={e => set({ deadline: e.target.value })} /></label> : null}
            <div className="municipal-step"><span>2</span><h3>Imagen (opcional)</h3></div>
            <label>Archivo JPEG, PNG o WebP, hasta 10 MB<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] || null)} /></label>
            {file ? <><label>Descripción de la imagen<input value={alt} onChange={e => setAlt(e.target.value)} required /></label><label>Autoría o crédito<input value={credit} onChange={e => setCredit(e.target.value)} required /></label>
              <label className="municipal-declaration"><input type="checkbox" checked={declared} onChange={e => setDeclared(e.target.checked)} required /> {space.name} declara que tiene los derechos necesarios para publicar esta imagen en Planta 14 y que el autor o crédito indicado es correcto.</label>
              <p className="municipal-field-help">Los derechos quedan a nombre de {space.name}. <Link href="/condiciones-cuentas-municipales#declaracion-imagen" target="_blank">Qué implica esta declaración ↗</Link></p></> : draft.image ? <p className="municipal-field-help">Se mantiene la imagen actual.</p> : null}
            <div className="municipal-publish-actions"><button type="submit" className="municipal-cta" disabled={locked}>Publicar ahora ↗</button><small>Aparece al momento en tu espacio.</small></div>
            <button type="button" className="municipal-reset" disabled={locked} onClick={() => void save(false)}>Guardar como borrador</button>
            {draft.id ? <button type="button" className="municipal-reset" onClick={() => setDraft(empty)}>Cancelar la edición</button> : null}
            <div role="status" className={message ? "municipal-form-status" : ""}>{message}</div>
          </form>
          <aside className="municipal-live-preview show-preview" aria-label="Tus publicaciones">
            <div className="municipal-step"><span>3</span><h3>Tus publicaciones</h3></div>
            {state.items.length === 0 ? <p className="municipal-field-help">Todavía no hay publicaciones.</p> : null}
            {state.items.map(item => <article key={item.id} className="municipal-content-card is-compact" data-status={item.withdrawn ? "withdrawn" : item.live}>
              <div className="municipal-card-meta"><span>{types.find(t => t.id === item.type)?.label}</span><span>{item.withdrawn ? "Retirado por Planta 14" : item.live === "published" ? (item.hasDraft ? "Publicado · cambios sin publicar" : "Publicado") : "Borrador"}</span></div>
              <h3>{item.title}</h3>
              {item.withdrawn ? <p className="municipal-form-status">Motivo de la retirada: {item.withdrawalReason}</p> : <p>{item.excerpt}</p>}
              <div className="municipal-card-dates">
                <button type="button" className="municipal-text-button" onClick={() => { setDraft(fromItem(item)); setMessage(""); }}>Editar</button>
                {!item.withdrawn && (item.live !== "published" || item.hasDraft) ? <button type="button" className="municipal-text-button" disabled={locked} onClick={() => void setStatus(item, "published")}>{item.hasDraft ? "Publicar cambios" : "Publicar"}</button> : null}
                {!item.withdrawn && item.live === "published" ? <button type="button" className="municipal-text-button" disabled={locked} onClick={() => void setStatus(item, "draft")}>Despublicar</button> : null}
              </div>
            </article>)}
          </aside>
        </div>
        <div className="municipal-panel-extra">
          <MunicipalSuggestions disabled={Boolean(maintenance)} />
        </div>
      </> : null}
    </div>
  </div>;
}
