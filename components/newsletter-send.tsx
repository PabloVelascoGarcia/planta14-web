"use client";
import { useState } from "react";
import { useDocumentInfo } from "@payloadcms/ui";

/**
 * Barra lateral del boletín: «Enviarme una prueba» (al correo de quien lo pide) y «Enviar a todos», con confirmación.
 * El servidor exige una prueba de la versión guardada antes del envío a todos.
 */
export function NewsletterSend() {
  const { id } = useDocumentInfo();
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!id) return <p style={{ fontSize: 13, opacity: 0.75, marginBottom: 24 }}>Guarda el boletín para poder enviarte una prueba.</p>;
  const call = async (path: string, init?: RequestInit) => {
    const response = await fetch(`/api/cms/newsletters/${id}/${path}`, { credentials: "include", ...init });
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw new Error(String(body.error ?? `Error ${response.status}`));
    return body;
  };
  const test = async () => {
    setBusy(true); setMessage(null);
    try { const r = await call("prueba", { method: "POST" }); setMessage({ text: `Prueba enviada a ${r.to} (${r.articles} noticias). Revísala antes de enviarla a todos.` }); }
    catch (error) { setMessage({ text: (error as Error).message, error: true }); }
    finally { setBusy(false); }
  };
  const sendAll = async () => {
    setBusy(true); setMessage(null);
    try {
      const info = await call("destinatarios");
      if (!window.confirm(`¿Enviar este boletín a ${info.confirmed} suscriptores confirmados? No se puede deshacer.`)) return;
      await call("enviar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmar: true }) });
      setMessage({ text: "Envío en marcha, por lotes. Recarga la página para ver el resultado (Enviados, Fallos y Bajas)." });
    } catch (error) { setMessage({ text: (error as Error).message, error: true }); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ marginBottom: 24, display: "grid", gap: 10 }} data-newsletter-send>
      <button type="button" className="btn btn--style-secondary btn--size-medium" style={{ margin: 0 }} onClick={test} disabled={busy} data-newsletter-test>Enviarme una prueba</button>
      <button type="button" className="btn btn--style-primary btn--size-medium" style={{ margin: 0 }} onClick={sendAll} disabled={busy} data-newsletter-all>Enviar a todos</button>
      <p style={{ fontSize: 13, opacity: 0.75, margin: 0 }}>Guarda los cambios antes de probar. Solo se puede enviar a todos después de una prueba de la versión guardada.</p>
      {message ? <p role={message.error ? "alert" : "status"} style={{ fontSize: 13, margin: 0, color: message.error ? "var(--theme-error-500)" : undefined }}>{message.text}</p> : null}
    </div>
  );
}
