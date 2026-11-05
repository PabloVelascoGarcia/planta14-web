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
      setForm(blank); setMessage("Guardado. Ya sale en «Útil» de tu concejo."); router.refresh();
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
  return <section className="municipal-form municipal-services-editor" aria-label="Directorio de servicios municipales" data-services-editor>
    <div className="municipal-step"><span>☎</span><h3>Directorio de servicios municipales</h3></div>
    <p className="municipal-form-help">Sale en la sección «Útil» de tu concejo: teléfonos, direcciones y horarios de los servicios del ayuntamiento.</p>
    <ul>{services.map(row => <li key={row.id} data-service-row><span><strong>{row.name}</strong><br /><small>{SERVICE_CATEGORIES.find(c => c[0] === row.category)?.[1]}{row.phone ? ` · ${row.phone}` : ""}</small></span>
      <div><button type="button" className="municipal-text-link" disabled={locked} onClick={() => { setForm({ id: row.id, name: row.name, category: row.category, address: row.address ?? "", phone: row.phone ?? "", email: row.email ?? "", web: row.web ?? "", hours: row.hours ?? "", notes: row.notes ?? "", order: String(row.order ?? 100) }); setMessage(""); }}>Editar</button>
        <button type="button" className="municipal-text-link" disabled={locked} onClick={() => remove(row)}>Quitar</button></div></li>)}
      {!services.length ? <li className="municipal-field-help">Todavía no hay servicios.</li> : null}</ul>
    <form onSubmit={submit} data-service-form>
      <label>Nombre<input value={form.name} onChange={e => set({ name: e.target.value })} maxLength={160} required /></label>
      <label>Tipo<select value={form.category} onChange={e => set({ category: e.target.value })}>{SERVICE_CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Dirección<input value={form.address} onChange={e => set({ address: e.target.value })} maxLength={200} /></label>
      <label>Teléfono<input value={form.phone} onChange={e => set({ phone: e.target.value })} maxLength={60} inputMode="tel" /></label>
      <label>Correo<input type="email" value={form.email} onChange={e => set({ email: e.target.value })} maxLength={120} /></label>
      <label>Web<input value={form.web} onChange={e => set({ web: e.target.value })} maxLength={300} placeholder="https://" /></label>
      <label>Horario<textarea value={form.hours} onChange={e => set({ hours: e.target.value })} maxLength={500} rows={2} /></label>
      <label>Observaciones<textarea value={form.notes} onChange={e => set({ notes: e.target.value })} maxLength={600} rows={2} /></label>
      <div className="municipal-publish-actions"><button type="submit" className="municipal-cta" disabled={locked}>{form.id ? "Guardar los cambios ↗" : "Añadir al directorio ↗"}</button>
        {form.id ? <button type="button" className="municipal-text-link" onClick={() => setForm(blank)}>Cancelar</button> : null}</div>
      <div role="status" className={message ? "municipal-form-status" : ""}>{message}</div>
    </form>
  </section>;
}
