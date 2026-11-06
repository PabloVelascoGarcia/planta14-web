"use client";
import { useState } from "react";
import { useAuth, useDocumentInfo, useFormFields } from "@payloadcms/ui";

/**
 * Perfil del CMS (redacción y administración), «Avisos y resumen»: el resumen diario de las 8:00 y «Fuera hasta».
 * Mientras estás fuera, los avisos de tus concejos van al otro redactor y no recibes el resumen. Se guarda con su
 * propio botón (la redacción no puede editar el resto de su cuenta).
 */
export function CmsNotifyToggle() {
  const { id } = useDocumentInfo();
  const { user } = useAuth();
  const storedDigest = useFormFields(([fields]) => fields.dailyDigest?.value);
  const storedAway = useFormFields(([fields]) => fields.awayUntil?.value);
  const [digest, setDigest] = useState<boolean | null>(null);
  const [away, setAway] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  if (!id || !user) return null;
  const canEdit = user.id === id || (user as { role?: string }).role === "admin";
  const digestValue = digest ?? storedDigest !== false;
  const awayValue = away ?? (typeof storedAway === "string" ? storedAway : "");
  const save = async (body: { dailyDigest?: boolean; awayUntil?: string | null }) => {
    setState("saving");
    try {
      const response = await fetch(`/api/cms/users/${id}/preferencias`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error(String(response.status));
      setState("saved");
    } catch { setState("error"); }
  };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
  const awayActive = Boolean(awayValue) && awayValue >= today;
  return <div style={{ margin: "8px 0 24px", display: "grid", gap: 10 }} data-newsroom-preferences>
    <p style={{ fontWeight: 700, margin: 0 }}>Avisos y resumen</p>
    <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, cursor: canEdit ? "pointer" : "default" }}>
      <input type="checkbox" checked={digestValue} disabled={!canEdit || state === "saving"} style={{ width: 18, height: 18, margin: 0, flex: "none" }} data-daily-digest
        onChange={e => { setDigest(e.target.checked); void save({ dailyDigest: e.target.checked }); }} />
      <span>Recibir el resumen diario a las 8:00 (solo si hay algo: lo publicado por los ayuntamientos de mis concejos y lo pendiente)</span>
    </label>
    <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
      <label style={{ display: "grid", gap: 4 }}>Fuera hasta (incluido)
        <input type="date" value={awayValue} disabled={!canEdit || state === "saving"} onChange={e => setAway(e.target.value)} style={{ minHeight: 40, padding: "0 8px" }} data-away-until /></label>
      <button type="button" className="btn btn--style-secondary btn--size-small" style={{ margin: 0 }} disabled={!canEdit || state === "saving"} onClick={() => save({ awayUntil: awayValue || null })} data-away-save>Guardar la fecha</button>
      {awayValue ? <button type="button" className="btn btn--style-secondary btn--size-small" style={{ margin: 0 }} disabled={!canEdit || state === "saving"} onClick={() => { setAway(""); void save({ awayUntil: null }); }} data-away-clear>Ya estoy de vuelta</button> : null}
    </div>
    <p style={{ fontSize: 13, opacity: 0.75, margin: 0 }} role="status">
      {state === "saved" ? "Guardado." : state === "error" ? "No se pudo guardar. Vuelve a intentarlo."
        : awayActive ? `Fuera hasta el ${awayValue.split("-").reverse().join("/")}: los avisos de tus concejos van al otro redactor y no recibes el resumen.`
        : "Mientras estés fuera, los avisos de tus concejos van al otro redactor. La bandeja es compartida: lo pendiente se puede resolver desde cualquier cuenta."}
    </p>
  </div>;
}
