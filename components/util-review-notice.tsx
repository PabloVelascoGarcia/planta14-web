"use client";
import { useFormFields } from "@payloadcms/ui";

/** Aviso arriba de una ficha de Patrimonio o Ruta: coordenadas pendientes (no sale en el mapa) o dudas sin revisar. */
export function UtilReviewNotice() {
  const lat = useFormFields(([fields]) => fields.lat?.value);
  const lon = useFormFields(([fields]) => fields.lon?.value);
  const track = useFormFields(([fields]) => fields.track?.value);
  const doubts = useFormFields(([fields]) => fields.doubts?.value);
  const reviewed = useFormFields(([fields]) => fields.reviewed?.value);
  const missing = !(typeof lat === "number" && typeof lon === "number") && !(Array.isArray(track) && track.length);
  const doubtful = Boolean(String(doubts ?? "").trim()) && !reviewed;
  if (!missing && !doubtful) return null;
  const box = { border: "1px solid #c98a1b", background: "#fff6e5", color: "#5a3b00", padding: "12px 16px", borderRadius: 4, marginBottom: 20, lineHeight: 1.5 } as const;
  return <div role="note" style={box} data-util-review>
    {missing ? <p style={{ margin: 0 }}><strong>Coordenadas pendientes.</strong> Sale en la lista del concejo pero no en el mapa. Completa la latitud y la longitud (WGS84) cuando estén comprobadas.</p> : null}
    {doubtful ? <p style={{ margin: missing ? "8px 0 0" : 0 }}><strong>Dudoso: revisar.</strong> {String(doubts)} Cuando esté comprobado, marca «Dudas revisadas».</p> : null}
  </div>;
}
