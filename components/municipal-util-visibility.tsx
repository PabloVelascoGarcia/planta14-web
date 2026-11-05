"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UTIL_SERVICES } from "@/lib/util-services";

/** Qué servicios de «Útil» salen en la página del concejo (por defecto, todos). No afecta a noticias ni a lo editorial. */
export function MunicipalUtilVisibility({ hidden, territory, disabled = false }: { hidden: string[]; territory: string; disabled?: boolean }) {
  const router = useRouter();
  const [off, setOff] = useState<string[]>(hidden);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/cms/util-visibility/concejo", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hidden: off }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || "No se ha podido guardar.");
      setMessage(off.length ? "Guardado. Los servicios desmarcados ya no salen en tu concejo." : "Guardado. Salen todos los servicios.");
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se ha podido guardar."); }
    finally { setBusy(false); }
  }
  return <section className="municipal-form" aria-label="Servicios de Útil en tu concejo" data-util-visibility>
    <div className="municipal-step"><span>✓</span><h3>Servicios de «Útil» en tu concejo</h3></div>
    <p className="municipal-form-help">Por defecto salen todos en <a href={`/${territory}#util`} className="municipal-text-link">la página de tu concejo</a>. Desmarca los que no quieras mostrar. Las noticias y los contenidos de Planta 14 no se pueden ocultar.</p>
    <fieldset>{UTIL_SERVICES.map(s => <label key={s.key} className="municipal-check"><input type="checkbox" checked={!off.includes(s.key)} disabled={busy || disabled}
      onChange={e => setOff(current => e.target.checked ? current.filter(k => k !== s.key) : [...current, s.key])} /> {s.label}</label>)}</fieldset>
    <div className="municipal-publish-actions"><button type="button" className="municipal-cta" onClick={save} disabled={busy || disabled}>{busy ? "Guardando…" : "Guardar ↗"}</button></div>
    <div role="status" className={message ? "municipal-form-status" : ""}>{message}</div>
  </section>;
}
