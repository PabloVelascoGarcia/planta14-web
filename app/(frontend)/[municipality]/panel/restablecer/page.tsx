import { notFound } from "next/navigation";
import { spaceIsActive } from "@/lib/demo/municipal";
import { getMunicipalSpace } from "@/lib/municipal-content";
import { contentSource } from "@/lib/content-source";
import { MunicipalPasswordReset } from "@/components/municipal-password-reset";

export function generateMetadata() {
  return { title: "Contraseña nueva · Panel municipal", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
}

/** Enlace del correo «He olvidado mi contraseña» de las cuentas municipales (cms/password-reset.ts). */
export default async function Page({ params }: { params: Promise<{ municipality: string }> }) {
  const { municipality } = await params;
  const space = await getMunicipalSpace(municipality);
  // Solo con el CMS real y en espacios activos, como el panel.
  if (contentSource() === "demo" || !space || !spaceIsActive(space)) notFound();
  const { MAINTENANCE_MESSAGE, maintenanceActive } = await import("@/cms/maintenance");
  return <MunicipalPasswordReset space={space} maintenance={maintenanceActive() ? MAINTENANCE_MESSAGE : null} />;
}
