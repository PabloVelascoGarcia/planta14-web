import { MAINTENANCE_MESSAGE, maintenanceActive } from "@/cms/maintenance";

// Aviso en la cabecera del /cms (admin.components.header). Componente de servidor: se evalúa en cada petición.
export function CmsMaintenanceBanner() {
  if (!maintenanceActive()) return null;
  return <div role="status" data-maintenance="on" style={{ background: "#fff4d6", borderBottom: "1px solid #e0b84c", color: "#3d2e00", padding: "10px 16px", fontSize: 14, lineHeight: 1.4 }}>
    <strong>Modo mantenimiento (solo lectura).</strong> {MAINTENANCE_MESSAGE}
  </div>;
}
