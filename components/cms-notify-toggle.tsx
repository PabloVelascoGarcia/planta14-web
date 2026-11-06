"use client";
import { useState } from "react";
import { useAuth, useDocumentInfo, useFormFields } from "@payloadcms/ui";

/**
 * Perfil del CMS (redacción y administración): recibir o no un correo por cada publicación nueva de los ayuntamientos
 * de los concejos de los que eres responsable. Se guarda al momento, sin pulsar «Guardar».
 */
export function CmsNotifyToggle() {
  const { id } = useDocumentInfo();
  const { user } = useAuth();
  const stored = useFormFields(([fields]) => fields.notifyMunicipalPublications?.value);
  const [value, setValue] = useState<boolean | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  if (!id || !user) return null;
  const canEdit = user.id === id || (user as { role?: string }).role === "admin";
  const checked = value ?? stored !== false;
  const change = async (next: boolean) => {
    setValue(next); setState("saving");
    try {
      const response = await fetch(`/api/cms/users/${id}/avisos-municipales`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: next }) });
      if (!response.ok) throw new Error(String(response.status));
      setState("saved");
    } catch { setValue(!next); setState("error"); }
  };
  return <div style={{ margin: "8px 0 24px" }} data-notify-toggle>
    <p style={{ fontWeight: 700, margin: "0 0 6px" }}>Avisos por correo</p>
    <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, cursor: canEdit ? "pointer" : "default" }}>
      <input type="checkbox" checked={checked} disabled={!canEdit || state === "saving"} onChange={e => change(e.target.checked)} style={{ width: 18, height: 18, margin: 0, flex: "none" }} data-notify-municipal />
      <span>Recibir un correo por cada publicación nueva de los ayuntamientos de mis concejos</span>
    </label>
    <p style={{ fontSize: 13, opacity: 0.75, margin: "4px 0 0" }} role="status">
      {state === "saved" ? "Guardado." : state === "error" ? "No se pudo guardar. Vuelve a intentarlo." : "Se guarda al marcar o desmarcar. Lo que llega sigue apareciendo en «Mis concejos» y en «Pendientes de revisar»."}
    </p>
  </div>;
}
