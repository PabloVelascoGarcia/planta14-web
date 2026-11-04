"use client";
import { useState } from "react";
import { useDocumentInfo } from "@payloadcms/ui";

/** Barra lateral de una fiesta guardada: crea con un clic el borrador del año siguiente y lo abre. */
export function FestivalNextYear() {
  const { id } = useDocumentInfo();
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  if (!id) return null;
  const duplicate = async () => {
    setState("working");
    try {
      const response = await fetch(`/api/cms/festivals/${id}/siguiente-ano`, { method: "POST", credentials: "include" });
      if (!response.ok) throw new Error(String(response.status));
      const copy = await response.json() as { id: number };
      window.location.assign(`/cms/collections/festivals/${copy.id}`);
    } catch { setState("error"); }
  };
  return (
    <div style={{ marginBottom: 24 }}>
      <button type="button" className="btn btn--style-secondary btn--size-medium" style={{ margin: 0 }} onClick={duplicate} disabled={state === "working"} data-festival-next-year>
        {state === "working" ? "Creando…" : "Duplicar para el año siguiente"}
      </button>
      <p style={{ fontSize: 13, opacity: 0.75, margin: "8px 0 0" }}>
        Crea un borrador con el mismo programa y las mismas fechas un año después (mismo día de la semana). Revisa fechas y programa antes de publicarlo.
      </p>
      {state === "error" ? <p role="alert" style={{ color: "var(--theme-error-500)", fontSize: 13 }}>No se pudo duplicar. Guarda la fiesta y vuelve a intentarlo.</p> : null}
    </div>
  );
}
