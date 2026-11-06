"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Acciones de un elemento de la bandeja: aprobar (publicar la fiesta o la carta, sugerencia atendida) o rechazar
 * eligiendo un motivo de la lista, con texto libre opcional. Si otra persona lo resolvió antes, lo dice.
 */
export function CmsInboxActions({ id, approveLabel, reasons }: { id: number; approveLabel: string; reasons: string[] }) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const send = async (body: Record<string, string>) => {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/cms/notifications/${id}/resolver`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) { setError(result.error || "No se pudo resolver."); if (response.status === 409) router.refresh(); return; }
      router.refresh();
    } catch { setError("No se pudo resolver. Vuelve a intentarlo."); } finally { setBusy(false); }
  };
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginLeft: "auto" }} data-inbox-actions={id}>
    {!rejecting ? <>
      <button type="button" className="btn btn--style-primary btn--size-small" style={{ margin: 0 }} disabled={busy} onClick={() => send({ action: "aprobar" })} data-inbox-approve>{approveLabel}</button>
      <button type="button" className="btn btn--style-secondary btn--size-small" style={{ margin: 0 }} disabled={busy} onClick={() => setRejecting(true)} data-inbox-reject>Rechazar</button>
    </> : <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "end", flexBasis: "100%" }} data-inbox-reject-form>
      <label style={{ display: "grid", gap: 4, fontSize: 13 }}>Motivo
        <select value={reason} onChange={e => setReason(e.target.value)} style={{ minHeight: 36 }} data-inbox-reason>
          <option value="" disabled>Elige un motivo</option>{reasons.map(r => <option key={r} value={r}>{r}</option>)}</select></label>
      <label style={{ display: "grid", gap: 4, fontSize: 13, flex: "1 1 220px" }}>Nota (opcional)
        <input value={note} onChange={e => setNote(e.target.value)} maxLength={1000} style={{ minHeight: 36, padding: "0 8px" }} data-inbox-note /></label>
      <button type="button" className="btn btn--style-primary btn--size-small" style={{ margin: 0 }} disabled={busy || !reason} onClick={() => send({ action: "rechazar", reason, note })} data-inbox-reject-confirm>Rechazar</button>
      <button type="button" className="btn btn--style-secondary btn--size-small" style={{ margin: 0 }} disabled={busy} onClick={() => { setRejecting(false); setError(""); }}>Cancelar</button>
    </div>}
    {error ? <p role="alert" style={{ flexBasis: "100%", color: "var(--theme-error-500)", fontSize: 13, margin: 0 }} data-inbox-error>{error}</p> : null}
  </div>;
}
