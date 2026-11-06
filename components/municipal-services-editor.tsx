"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export type ServiceRow = { id: number; name: string; category: string; address: string | null; phone: string | null; email: string | null; web: string | null; hours: string | null; notes: string | null; order: number | null };
export const SERVICE_CATEGORIES: [string, string][] = [
  ["ayuntamiento", "Ayuntamiento y atención"], ["salud", "Salud"], ["social", "Servicios sociales"], ["educacion", "Educación"], ["cultura", "Cultura y bibliotecas"],
  ["deportes", "Deportes"], ["emergencias", "Emergencias y seguridad"], ["transporte", "Transporte"], ["medio-ambiente", "Agua, residuos y limpieza"], ["otros", "Otros"],
];
const blank = { id: null as number | null, name: "", category: "ayuntamiento", address: "", phone: "", email: "", web: "", hours: "", notes: "", order: "100" };

/** Directorio de servicios municipales de «Útil»: el ayuntamiento edita el de su concejo (el servidor fija el concejo). */
export function MunicipalServicesEditor({ services, disabled = false }: { services: ServiceRow[]; disabled?: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState(blank);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof blank>) => setForm(current => ({ ...current, ...patch }));
  async function call(path: string, method: string, body?: unknown) {
    const response = await fetch(`/api/cms/municipal-services${path}`, { method, credentials: "same-origin", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.errors?.[0]?.data?.errors?.[0]?.message || data?.errors?.[0]?.message || "No se ha podido guardar.");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) { setMessage("Escribe el nombre del servicio."); return; }
    setBusy(true); setMessage("");
    const data = { name: form.name.trim(), category: form.category, address: form.address.trim() || null, phone: form.phone.trim() || null, email: form.email.trim() || null,
      web: form.web.trim() || null, hours: form.hours.trim() || null, notes: form.notes.trim() || null, order: Number(form.order) || 100 };
    try {
      if (form.id) await call(`/${form.id}`, "PATCH", data); else await call("", "POST", data);
      setForm(blank); setOpen(null); setMessage("Guardado. Ya sale en «Útil» de tu concejo."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se ha podido guardar."); }
    finally { setBusy(false); }
  }
  async function remove(row: ServiceRow) {
    if (!window.confirm(`¿Quitar «${row.name}» del directorio?`)) return;
    setBusy(true); setMessage("");
    try { await call(`/${row.id}`, "DELETE"); setMessage("Quitado del directorio."); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No se ha podido quitar."); }
    finally { setBusy(false); }
  }
  const locked = busy || disabled;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<number | "new" | null>(null);
  const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const shown = services.filter(row => !query.trim() || norm(`${row.name} ${row.address ?? ""} ${row.phone ?? ""}`).includes(norm(query.trim())));
  const edit = (row: ServiceRow) => { setForm({ id: row.id, name: row.name, category: row.category, address: row.address ?? "", phone: row.phone ?? "", email: row.email ?? "", web: row.web ?? "", hours: row.hours ?? "", notes: row.notes ?? "", order: String(row.order ?? 100) }); setOpen(row.id); setMessage(""); };
  const close = () => { setForm(blank); setOpen(null); };
  // El formulario (alta o edición) se abre solo al pulsar «Añadir servicio» o «Editar», en su sitio.
  const editor = <form onSubmit={async e => { await submit(e); }} className="municipal-service-form" data-service-form>
      <label>Nombre<input value={form.name} onChange={e => set({ name: e.target.value })} maxLength={160} required autoFocus /></label>
      <label>Tipo<select value={form.category} onChange={e => set({ category: e.target.value })}>{SERVICE_CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Dirección<input value={form.address} onChange={e => set({ address: e.target.value })} maxLength={200} /></label>
      <label>Teléfono<input value={form.phone} onChange={e => set({ phone: e.target.value })} maxLength={60} inputMode="tel" /></label>
      <label>Correo<input type="email" value={form.email} onChange={e => set({ email: e.target.value })} maxLength={120} /></label>
      <label>Web<input value={form.web} onChange={e => set({ web: e.target.value })} maxLength={300} placeholder="https://" /></label>
      <label className="is-wide">Horario<textarea value={form.hours} onChange={e => set({ hours: e.target.value })} maxLength={500} rows={2} /></label>
      <label className="is-wide">Observaciones<textarea value={form.notes} onChange={e => set({ notes: e.target.value })} maxLength={600} rows={2} /></label>
      <div className="municipal-publish-actions is-wide"><button type="submit" className="municipal-cta" disabled={locked}>{form.id ? "Guardar los cambios ↗" : "Añadir al directorio ↗"}</button>
        <button type="button" className="municipal-text-link" onClick={close}>Cancelar</button></div>
    </form>;
  return <section className="municipal-form municipal-services-editor" aria-label="Directorio de servicios municipales" data-services-editor>
    <div className="municipal-step"><span>☎</span><h3>Directorio de servicios municipales</h3></div>
    <p className="municipal-form-help">Sale en la sección «Útil» de tu concejo: teléfonos, direcciones y horarios de los servicios del ayuntamiento.</p>
    <div className="municipal-list-tools">
      <label className="municipal-search"><span className="sr-only">Buscar en el directorio</span><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar servicio…" data-service-search /></label>
      <button type="button" className="municipal-cta is-small" disabled={locked} onClick={() => { setForm(blank); setOpen("new"); setMessage(""); }} data-service-add>Añadir servicio</button>
    </div>
    {open === "new" ? editor : null}
    <ul className="municipal-compact-list">{shown.map(row => <li key={row.id} data-service-row>
      <div className="municipal-row"><span className="municipal-row-main"><strong>{row.name}</strong> <small>{SERVICE_CATEGORIES.find(c => c[0] === row.category)?.[1]}{row.phone ? ` · ${row.phone}` : ""}</small></span>
        <span className="municipal-row-actions"><button type="button" className="municipal-text-link" disabled={locked} onClick={() => open === row.id ? close() : edit(row)}>{open === row.id ? "Cerrar" : "Editar"}</button>
          <button type="button" className="municipal-text-link" disabled={locked} onClick={() => remove(row)}>Quitar</button></span></div>
      {open === row.id ? editor : null}</li>)}
      {!services.length ? <li className="municipal-field-help">Todavía no hay servicios.</li> : !shown.length ? <li className="municipal-field-help">Ningún servicio con esa búsqueda.</li> : null}</ul>
    <div role="status" className={message ? "municipal-form-status" : ""}>{message}</div>
  </section>;
}
