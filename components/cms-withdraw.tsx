"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Row = { id: number; title: string; typeLabel: string; spaceName: string; status: string; date: string; webHref: string | null; cmsHref: string; withdrawn: boolean };

/**
 * Una fila de «Publicado por los ayuntamientos» en la bandeja, siempre con la misma disposición sea cual sea la longitud
 * del título: a la izquierda, tipo y título en una línea y debajo ayuntamiento, estado y fecha; a la derecha, las
 * acciones. «Retirar» abre el motivo debajo, a todo el ancho: la misma retirada que en la ficha (motivo obligatorio,
 * aplicada a la versión pública y registrada en la auditoría).
 */
export function CmsPublicationRow({ row }: { row: Row }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");
  const submit = async () => {
    if (!reason.trim()) { setError("Indica el motivo de la retirada."); return; }
    setState("saving"); setError("");
    try {
      const response = await fetch(`/api/cms/municipal-content/${row.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withdrawal: { withdrawn: true, reason: reason.trim() } }) });
      if (!response.ok) { const body = await response.json().catch(() => null) as { errors?: { message?: string }[] } | null; throw new Error(body?.errors?.[0]?.message || String(response.status)); }
      setOpen(false); router.refresh();
    } catch (e) { setState("error"); setError(`No se pudo retirar: ${(e as Error).message}`); return; }
    setState("idle");
  };
  return <li style={styles.row} data-publication-item={row.id}>
    <div style={styles.main}>
      <div style={styles.line} data-publication-line="1"><span style={styles.type}>{row.typeLabel}</span> <strong style={styles.title} title={row.title}>{row.title}</strong></div>
      <div style={styles.meta} data-publication-line="2">{row.spaceName} · <span data-publication-status>{row.status}</span> · {row.date}</div>
    </div>
    <div style={styles.actions} data-publication-actions>
      {row.webHref ? <a href={row.webHref} target="_blank" rel="noopener" style={styles.link} data-publication-web>Ver en la web</a> : null}
      <a href={row.cmsHref} style={styles.link}>Abrir</a>
      {!row.withdrawn && !open ? <button type="button" onClick={() => setOpen(true)} style={styles.button} data-withdraw-open={row.id}>Retirar</button> : null}
    </div>
    {open ? <div style={styles.form} data-withdraw-form={row.id}>
      <label style={{ display: "grid", gap: 4, fontSize: 13 }}>Motivo de la retirada de «{row.title}» (lo verá el ayuntamiento en su panel)
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} required style={{ font: "inherit", padding: 8 }} data-withdraw-reason /></label>
      <span style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button type="button" className="btn btn--style-primary btn--size-small" style={{ margin: 0 }} disabled={state === "saving"} onClick={submit} data-withdraw-submit>{state === "saving" ? "Retirando…" : "Retirar la publicación"}</button>
        <button type="button" onClick={() => { setOpen(false); setError(""); }} style={styles.button}>Cancelar</button>
      </span>
      {error ? <p role="alert" style={{ color: "var(--theme-error-500)", fontSize: 13, margin: 0 }}>{error}</p> : null}
    </div> : null}
  </li>;
}
const styles = {
  row: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", columnGap: 16, rowGap: 8, alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--theme-elevation-150)" },
  main: { minWidth: 0, display: "grid", gap: 2 },
  line: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  type: { fontSize: 13, opacity: 0.75, marginRight: 6 },
  title: { fontWeight: 700 },
  meta: { fontSize: 13, opacity: 0.75, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  actions: { display: "flex", gap: 12, alignItems: "center", justifyContent: "flex-end", whiteSpace: "nowrap" },
  link: { fontSize: 13, textDecoration: "underline" },
  button: { background: "none", border: 0, padding: 0, color: "var(--theme-success-500, inherit)", textDecoration: "underline", cursor: "pointer", font: "inherit", fontSize: 13 },
  form: { gridColumn: "1 / -1", display: "grid", gap: 6 },
} as const;
