"use client";
import { useState, type FormEvent } from "react";

const services = [
  ["publicidad", "Campañas y publicidad institucional en Planta 14"],
  ["boletin", "Boletín por correo para los vecinos del concejo"],
  ["estadisticas", "Informes de visitas de nuestro espacio"],
  ["cobertura", "Cobertura de actos y eventos del concejo"],
  ["agenda", "Agenda cultural y deportiva ampliada"],
  ["formacion", "Formación para publicar en el panel"],
  ["avisos-urgentes", "Avisos urgentes a los vecinos (correo o móvil)"],
] as const;

/** Buzón de sugerencias del panel municipal (colección Sugerencias; la ven la administración y el periodista del concejo). */
export function MunicipalSuggestions({ disabled = false }: { disabled?: boolean }) {
  const [chosen, setChosen] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chosen.length && !text.trim()) { setMessage("Marca algún servicio o escribe tu sugerencia."); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/panel/api/suggestions", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ services: chosen, text: text.trim() }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.errors?.[0]?.message || "No se ha podido enviar.");
      setChosen([]); setText(""); setMessage("Gracias. Hemos recibido tu sugerencia y la leerá el equipo de Planta 14.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se ha podido enviar."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="municipal-form municipal-suggestions" aria-label="Buzón de sugerencias" data-suggestions>
    <div className="municipal-step"><span>✉</span><h3>Buzón de sugerencias</h3></div>
    <p className="municipal-form-help">¿Qué más podría hacer Planta 14 por tu concejo? Marca lo que os interese y cuéntanoslo.</p>
    <fieldset className="municipal-checks"><legend className="municipal-form-help">Servicios que nos interesarían</legend>
      {services.map(([value, label]) => <label key={value} className="municipal-check"><input type="checkbox" checked={chosen.includes(value)} onChange={e => setChosen(c => e.target.checked ? [...c, value] : c.filter(x => x !== value))} /> {label}</label>)}
    </fieldset>
    <label>Tu sugerencia (opcional)<textarea value={text} onChange={e => setText(e.target.value)} maxLength={2000} rows={4} /></label>
    <div className="municipal-publish-actions"><button type="submit" className="municipal-cta" disabled={busy || disabled}>{busy ? "Enviando…" : "Enviar la sugerencia ↗"}</button></div>
    <div role="status" className={message ? "municipal-form-status" : ""}>{message}</div>
  </form>;
}
