// Logotipo de Planta 14 en el CMS: pantalla de acceso (Logo) e icono del menú (Icon), en lugar de los de Payload.
export function CmsLogo() {
  return <div style={{ display: "flex", alignItems: "center", gap: 14 }} data-cms-logo>
    <img src="/marca/planta14-icono.png" alt="" width={56} height={56} style={{ borderRadius: 8 }} />
    <span style={{ fontFamily: "Gelasio, Georgia, serif", fontWeight: 700, fontSize: 34, letterSpacing: "-0.03em", lineHeight: 1 }}>Planta 14</span>
  </div>;
}
export function CmsIcon() {
  return <img src="/marca/planta14-icono.png" alt="Planta 14" width={26} height={26} style={{ borderRadius: 5, display: "block" }} data-cms-icon />;
}
