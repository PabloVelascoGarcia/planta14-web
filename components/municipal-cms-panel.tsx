"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { hasTheme, identityStyle } from "@/lib/municipal-identity";
import { sections, type MunicipalSpace } from "@/lib/demo/municipal";
import type { PanelItem, PanelState } from "@/lib/municipal-panel";
import { MunicipalMasthead } from "./municipal-masthead";
import { MunicipalSuggestions } from "./municipal-suggestions";
import { StatsReportView } from "./stats-report-view";
import { MunicipalServicesEditor } from "./municipal-services-editor";
import { MunicipalUtilVisibility } from "./municipal-util-visibility";

type ContentType = PanelItem["type"];
const types = sections.filter(s => s.id !== "contact") as { id: ContentType; label: string }[];
// Puente del panel a la API de Payload con la sesión del panel (app/api/panel/api).
const api = "/api/panel/api";

async function request(path: string, init: RequestInit) {
  const response = await fetch(`${api}${path}`, { credentials: "same-origin", ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.errors?.[0]?.message || body?.message || `Error ${response.status}`);
  return body;
}
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const empty = { id: null as number | null, type: "news" as ContentType, title: "", excerpt: "", body: "", expiresAt: "", eventDate: "", eventTime: "18:00", place: "", deadline: "", image: null as number | null };
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
    try {
      // Sesión del panel: cookie propia, compartida por todas las pestañas, 14 días renovados con el uso.
      const response = await fetch("/api/panel/entrar", { ...json("POST", { email, password }), credentials: "same-origin" });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error || "No se ha podido iniciar sesión. Revisa el correo y la contraseña.");
      onDone();
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se ha podido iniciar sesión. Revisa el correo y la contraseña."); }
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
    <div className="municipal-step is-single"><h3>¿Has olvidado tu contraseña?</h3></div>
    <p className="municipal-form-help">Escribe el correo de la cuenta de tu ayuntamiento y te enviaremos un enlace para elegir una nueva.</p>
    <label>Correo electrónico<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></label>
    <div className="municipal-publish-actions"><button type="submit" className="municipal-cta" disabled={busy}>{busy ? "Enviando…" : "Enviar el enlace ↗"}</button></div>
    <div role="status" className={message ? "municipal-form-status" : ""}>{message}</div>
    <button type="button" className="municipal-text-link" onClick={() => { setForgot(false); setMessage(""); }}>← Volver a entrar</button>
  </form>;
  return <form onSubmit={submit} className="municipal-form">
    <div className="municipal-step is-single"><h3>Entra con la cuenta de tu ayuntamiento</h3></div>
    <label>Correo electrónico<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></label>
    <label>Contraseña<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
    <div className="municipal-publish-actions"><button type="submit" className="municipal-cta">Entrar ↗</button><small>Las cuentas municipales las crea Planta 14.</small></div>
    <div role="status" className={message ? "municipal-form-status" : ""}>{message}</div>
    <button type="button" className="municipal-text-link" onClick={() => { setForgot(true); setMessage(""); }}>¿Has olvidado tu contraseña?</button>
  </form>;
}

/** «Mis publicaciones»: una línea por publicación (tipo, título, estado y fecha) con acciones pequeñas a la derecha. */
function PublicationsList({ items, locked, message, typeFilter, statusFilter, page, setTypeFilter, setStatusFilter, setPage, onEdit, onStatus }: {
  items: PanelItem[]; locked: boolean; message: string; typeFilter: string; statusFilter: string; page: number;
  setTypeFilter: (v: string) => void; setStatusFilter: (v: string) => void; setPage: (p: number) => void;
  onEdit: (item: PanelItem) => void; onStatus: (item: PanelItem, status: "published" | "draft") => void;
}) {
  const filtered = items.filter(i => (!typeFilter || i.type === typeFilter) && (!statusFilter || statusOf(i) === statusFilter || (statusFilter === "publicado" && statusOf(i) === "cambios")));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  return <section className="municipal-form municipal-publications" aria-label="Mis publicaciones" data-panel-section="publicaciones">
    <div className="municipal-step"><span>☰</span><h3>Mis publicaciones</h3></div>
    <div className="municipal-list-tools">
      <label>Tipo<select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} data-publications-type><option value="">Todos</option>{types.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
      <label>Estado<select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} data-publications-status><option value="">Todos</option><option value="publicado">Publicado</option><option value="borrador">Borrador</option><option value="retirado">Retirado</option></select></label>
    </div>
    {!items.length ? <p className="municipal-field-help">Todavía no hay publicaciones.</p> : !filtered.length ? <p className="municipal-field-help">Ninguna publicación con estos filtros.</p> : null}
    <ul className="municipal-compact-list">{shown.map(item => <li key={item.id} data-publication={item.id} data-status={statusOf(item)}>
      <div className="municipal-row">
        <span className="municipal-row-main"><small className="municipal-row-type">{types.find(t => t.id === item.type)?.label}</small> <strong>{item.title}</strong> <small>{STATUS_LABEL[statusOf(item)]} · {shortDay(item.updatedAt)}</small>
          {item.withdrawn ? <small className="municipal-form-status"> Motivo: {item.withdrawalReason}</small> : null}</span>
        <span className="municipal-row-actions">
          <button type="button" className="municipal-text-link" onClick={() => onEdit(item)}>Editar</button>
          {!item.withdrawn && (item.live !== "published" || item.hasDraft) ? <button type="button" className="municipal-text-link" disabled={locked} onClick={() => onStatus(item, "published")}>{item.hasDraft ? "Publicar cambios" : "Publicar"}</button> : null}
          {!item.withdrawn && item.live === "published" ? <button type="button" className="municipal-text-link" disabled={locked} onClick={() => onStatus(item, "draft")}>Despublicar</button> : null}
        </span>
      </div></li>)}</ul>
    {pages > 1 ? <nav className="municipal-pager" aria-label="Páginas" data-publications-pager>
      <button type="button" className="municipal-text-link" disabled={current <= 1} onClick={() => setPage(current - 1)}>← Anteriores</button>
      <span>Página {current} de {pages}</span>
      <button type="button" className="municipal-text-link" disabled={current >= pages} onClick={() => setPage(current + 1)}>Siguientes →</button>
    </nav> : null}
    <div role="status" className={message ? "municipal-form-status" : ""}>{message}</div>
  </section>;
}

/** Pestañas del panel, cada una con su enlace (?pestana=…). «Publicar» es la de por defecto. */
export const PANEL_TABS = [
  { id: "publicar", label: "Publicar" }, { id: "publicaciones", label: "Mis publicaciones" }, { id: "util", label: "Útil" },
  { id: "directorio", label: "Directorio" }, { id: "sugerencias", label: "Sugerencias" }, { id: "visitas", label: "Visitas" },
] as const;
export type PanelTab = typeof PANEL_TABS[number]["id"];
const PAGE_SIZE = 10;
const shortDay = (iso: string) => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "";
const statusOf = (item: PanelItem) => item.withdrawn ? "retirado" : item.live === "published" ? (item.hasDraft ? "cambios" : "publicado") : "borrador";
const STATUS_LABEL: Record<string, string> = { publicado: "Publicado", cambios: "Publicado · cambios sin publicar", borrador: "Borrador", retirado: "Retirado por Planta 14" };

export function MunicipalCmsPanel({ space, state, maintenance = null, initialTab = "publicar" }: { space: MunicipalSpace; state: PanelState; maintenance?: string | null; initialTab?: string }) {
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
  const [tab, setTabState] = useState<PanelTab>(PANEL_TABS.some(t => t.id === initialTab) ? initialTab as PanelTab : "publicar");
  // Renovación con el uso: al abrir el panel con sesión, la cookie del panel se alarga a 14 días si tiene más de uno.
  const signedIn = state.kind === "editor";
  // Si la sesión ya no vale (cerrada en otra pestaña, contraseña cambiada, espacio desactivado), vuelve a la entrada.
  useEffect(() => {
    if (!signedIn) return;
    void fetch("/api/panel/sesion", { method: "POST", credentials: "same-origin" })
      .then(async response => { await response.text(); if (response.status === 401) router.refresh(); }).catch(() => undefined);
  }, [signedIn, router]);
  // Cada pestaña tiene su enlace: se cambia sin recargar y la dirección queda en la barra (?pestana=…).
  const setTab = (next: PanelTab) => { setTabState(next); window.history.replaceState(null, "", next === "publicar" ? window.location.pathname : `?pestana=${next}`); };
  useEffect(() => { const onPop = () => { const t = new URLSearchParams(window.location.search).get("pestana"); setTabState(PANEL_TABS.some(x => x.id === t) ? t as PanelTab : "publicar"); }; window.addEventListener("popstate", onPop); return () => window.removeEventListener("popstate", onPop); }, []);
  // Mis publicaciones: filtros por tipo y estado, 10 por página.
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  // Modo mantenimiento: solo lectura (el servidor rechaza igualmente cualquier escritura).
  const locked = busy || Boolean(maintenance);

  async function logout() {
    await fetch("/api/panel/salir", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
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
        expiresAt: draft.type === "notice" || draft.type === "grant" ? draft.expiresAt || null : null,
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
        <div className="municipal-panel-heading"><div><p className="municipal-kicker">De tu mesa al concejo</p><h2>Publica en tu<br />espacio municipal.</h2></div><p>Lo que publiques aparece al momento<br />en el espacio del {space.name}.</p></div>
        {state.cmsEmail ? <p className="municipal-form-help" data-panel-cms-note>Has entrado en el CMS como {state.cmsEmail}. Gestiona los contenidos desde /cms. Para el panel, entra con la cuenta del ayuntamiento: las dos sesiones no se mezclan.</p> : null}
        <div className="municipal-panel-grid"><Login onDone={() => router.refresh()} /></div>
        <p className="municipal-panel-terms"><Link href="/condiciones-cuentas-municipales" target="_blank" data-panel-terms>Condiciones de uso del espacio municipal</Link></p>
      </> : null}
      {state.kind === "forbidden" ? <div className="municipal-demo-banner"><span className="municipal-example">Sin acceso</span><p>{state.reason} ({state.email})</p><button type="button" className="municipal-reset" onClick={logout}>Cerrar sesión</button></div> : null}
      {state.kind === "editor" ? <>
        <div className="municipal-demo-banner"><span className="municipal-example">Contenido municipal</span><p>Conectado como {state.email}. Lo que publiques aparece al momento en tu espacio, marcado como contenido del ayuntamiento. Planta 14 puede retirarlo indicando el motivo.</p><button type="button" className="municipal-reset" onClick={logout}>Cerrar sesión</button></div>
        <nav className="municipal-panel-tabs" aria-label="Secciones del panel" data-panel-tabs>
          {PANEL_TABS.map(t => <a key={t.id} href={t.id === "publicar" ? `/${space.id}/panel` : `/${space.id}/panel?pestana=${t.id}`} aria-current={tab === t.id ? "page" : undefined} data-panel-tab={t.id}
            onClick={e => { e.preventDefault(); setTab(t.id); }}>{t.label}{t.id === "publicaciones" && state.kind === "editor" ? <small> {state.items.length}</small> : null}</a>)}
        </nav>
        {tab === "publicar" ? <section data-panel-section="publicar">
          <div className="municipal-panel-heading"><div><p className="municipal-kicker">De tu mesa al concejo</p><h2>{draft.id ? "Edita tu publicación." : "Una idea. Un minuto."}<br />Tu publicación.</h2></div><p><Link href={`/${space.id}`}>Ver el espacio ↗</Link></p></div>
          <div className="municipal-panel-grid is-single">
          <form onSubmit={e => { e.preventDefault(); void save(true); }} className="municipal-form" aria-label="Publicación municipal">
            <div className="municipal-step"><span>1</span><h3>¿Qué quieres contar?</h3></div>
            <label>Tipo<select value={draft.type} onChange={e => set({ type: e.target.value as ContentType })}>{types.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
            <label>Título<input value={draft.title} onChange={e => set({ title: e.target.value })} maxLength={140} required /><small>{draft.title.length}/140 caracteres</small></label>
            <label>Resumen<textarea value={draft.excerpt} onChange={e => set({ excerpt: e.target.value })} maxLength={300} rows={2} required /><small data-excerpt-count>{draft.excerpt.length}/300 caracteres</small></label>
            <label>¿Qué deben saber los vecinos?<textarea value={draft.body} onChange={e => set({ body: e.target.value })} maxLength={5000} rows={6} required /></label>
            {draft.type === "event" ? <><div className="municipal-field-row"><label>Fecha del evento<input type="date" value={draft.eventDate} required onChange={e => set({ eventDate: e.target.value })} /></label><label>Hora<input type="time" value={draft.eventTime} onChange={e => set({ eventTime: e.target.value })} /></label></div>
              <label>Lugar<input value={draft.place} maxLength={160} required onChange={e => set({ place: e.target.value })} /></label></> : null}
            {draft.type === "grant" ? <label>Plazo de solicitud<input type="date" value={draft.deadline} onChange={e => set({ deadline: e.target.value })} /></label> : null}
            {/* Solo en avisos y ayudas: después de esa fecha deja de verse en la web. */}
            {draft.type === "notice" || draft.type === "grant" ? <label data-expires-field>{draft.type === "notice" ? "Mostrar el aviso hasta" : "Mostrar la ayuda hasta"}<input type="date" value={draft.expiresAt} onChange={e => set({ expiresAt: e.target.value })} /><small>Después de ese día deja de verse en la web. Vacío: se ve hasta que lo despubliques.</small></label> : null}
            <div className="municipal-step is-separated"><span>2</span><h3>Imagen (opcional)</h3></div>
            <label>Archivo JPEG, PNG o WebP, hasta 10 MB<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] || null)} /></label>
            {file ? <><label>Descripción de la imagen<input value={alt} onChange={e => setAlt(e.target.value)} required /></label><label>Autoría o crédito<input value={credit} onChange={e => setCredit(e.target.value)} required /></label>
              <label className="municipal-declaration"><input type="checkbox" checked={declared} onChange={e => setDeclared(e.target.checked)} required /> {space.name} declara que tiene los derechos necesarios para publicar esta imagen en Planta 14 y que el autor o crédito indicado es correcto.</label>
              <p className="municipal-field-help">Los derechos quedan a nombre de {space.name}. <Link href="/condiciones-cuentas-municipales#declaracion-imagen" target="_blank">Qué implica esta declaración ↗</Link></p></> : draft.image ? <p className="municipal-field-help">Se mantiene la imagen actual.</p> : null}
            <div className="municipal-publish-actions"><div className="municipal-publish-buttons"><button type="submit" className="municipal-cta" disabled={locked}>Publicar ahora</button>
              <button type="button" className="municipal-cta is-secondary" disabled={locked} onClick={() => void save(false)} data-save-draft>Guardar como borrador</button></div>
              <small data-publish-note>«Publicar ahora»: aparece al momento en tu espacio. «Guardar como borrador»: solo lo ve tu ayuntamiento.</small></div>
            {draft.id ? <button type="button" className="municipal-reset" onClick={() => setDraft(empty)}>Cancelar la edición</button> : null}
            <div role="status" className={message ? "municipal-form-status" : ""}>{message}</div>
          </form>
          </div>
        </section> : null}
        {tab === "publicaciones" ? <PublicationsList items={state.items} locked={locked} message={message}
          typeFilter={typeFilter} statusFilter={statusFilter} page={page} setTypeFilter={v => { setTypeFilter(v); setPage(1); }} setStatusFilter={v => { setStatusFilter(v); setPage(1); }} setPage={setPage}
          onEdit={item => { setDraft(fromItem(item)); setMessage(""); setTab("publicar"); }} onStatus={(item, status) => void setStatus(item, status)} /> : null}
        {tab === "util" ? <div data-panel-section="util"><MunicipalUtilVisibility hidden={state.utilHidden} territory={space.territory} disabled={Boolean(maintenance)} /></div> : null}
        {tab === "directorio" ? <div data-panel-section="directorio"><MunicipalServicesEditor services={state.services} disabled={Boolean(maintenance)} /></div> : null}
        {tab === "sugerencias" ? <div data-panel-section="sugerencias"><MunicipalSuggestions disabled={Boolean(maintenance)} /></div> : null}
        {tab === "visitas" ? (state.stats ? <section className="municipal-form municipal-stats" aria-label="Visitas de tu concejo" data-municipal-stats data-panel-section="visitas">
          <div className="municipal-step"><span>↗</span><h3>Visitas de {space.name.replace("Ayuntamiento de ", "")} este mes</h3></div>
          <StatsReportView report={state.stats} exportBase={`/api/estadisticas?mes=${state.statsMonth}`} compact />
        </section> : <p className="municipal-field-help" data-panel-section="visitas">Todavía no hay visitas este mes.</p>) : null}
        <p className="municipal-panel-terms"><Link href="/condiciones-cuentas-municipales" target="_blank" data-panel-terms>Condiciones de uso del espacio municipal</Link></p>
      </> : null}
    </div>
  </div>;
}
