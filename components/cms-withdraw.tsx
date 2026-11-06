"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * «Retirar» en «Mis concejos»: la misma retirada que en la ficha del contenido (Retirado + Motivo), con el motivo
 * obligatorio. El servidor la aplica a la versión pública y la registra en la auditoría.
 */
export function CmsWithdraw({ id, title }: { id: number; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");
  const submit = async () => {
    if (!reason.trim()) { setError("Indica el motivo de la retirada."); return; }
    setState("saving"); setError("");
    try {
      const response = await fetch(`/api/cms/municipal-content/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withdrawal: { withdrawn: true, reason: reason.trim() } }) });
      if (!response.ok) { const body = await response.json().catch(() => null) as { errors?: { message?: string }[] } | null; throw new Error(body?.errors?.[0]?.message || String(response.status)); }
      setOpen(false); router.refresh();
    } catch (e) { setState("error"); setError(`No se pudo retirar: ${(e as Error).message}`); return; }
    setState("idle");
  };
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={link} data-withdraw-open={id}>Retirar</button>;
  return <div style={{ flexBasis: "100%", display: "grid", gap: 6, marginTop: 6 }} data-withdraw-form={id}>
    <label style={{ display: "grid", gap: 4, fontSize: 13 }}>Motivo de la retirada de «{title}» (lo verá el ayuntamiento en su panel)
      <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} required style={{ font: "inherit", padding: 8 }} data-withdraw-reason /></label>
    <span style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <button type="button" className="btn btn--style-primary btn--size-small" style={{ margin: 0 }} disabled={state === "saving"} onClick={submit} data-withdraw-submit>{state === "saving" ? "Retirando…" : "Retirar la publicación"}</button>
      <button type="button" onClick={() => { setOpen(false); setError(""); }} style={link}>Cancelar</button>
    </span>
    {error ? <p role="alert" style={{ color: "var(--theme-error-500)", fontSize: 13, margin: 0 }}>{error}</p> : null}
  </div>;
}
const link = { background: "none", border: 0, padding: 0, color: "var(--theme-success-500, inherit)", textDecoration: "underline", cursor: "pointer", font: "inherit", fontSize: 13 } as const;
