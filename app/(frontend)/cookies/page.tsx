import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { owner } from "@/lib/legal";
import { contentSource } from "@/lib/content-source";

export const metadata: Metadata = { title: "Política de cookies", alternates: { canonical: "/cookies" } };

export default function Page() {
  return <LegalPage title="Política de cookies">
    <p>{owner.medium}, editado por {owner.name} ({owner.shortName}), usa solo cookies propias necesarias para que la web funcione. No usa cookies de medición, de publicidad ni de terceros: las estadísticas de visitas son propias y no usan cookies, así que no hace falta pedirte consentimiento.</p>
    <h2>Cookies que usamos</h2>
    <div className="legal-table" role="region" aria-label="Cookies y almacenamiento (desplázala en horizontal si no cabe)" tabIndex={0}><table>
      <thead><tr><th>Cookie</th><th>Titular</th><th>Finalidad</th><th>Tipo</th><th>Duración</th></tr></thead>
      <tbody>
        <tr><td>payload-token</td><td>Propia</td><td>Mantener la sesión de las cuentas municipales y de la redacción, después de iniciar sesión</td><td>Técnica (exenta)</td><td>2 horas; puede renovarse al mantener la sesión activa</td></tr>
        <tr><td>payload-theme</td><td>Propia</td><td>Recordar el tema claro u oscuro elegido en el CMS</td><td>Preferencia solicitada</td><td>365 días</td></tr>
        {contentSource() === "demo" ? <tr><td>planta14_session</td><td>Propia</td><td>Sesión del panel de demostración de la redacción, si se utiliza</td><td>Técnica (exenta)</td><td>8 horas</td></tr> : null}
      </tbody>
    </table></div>
    <p>También puedes borrar o bloquear las cookies desde la configuración de tu navegador.</p>
    <p>Para cualquier duda: <a href={`mailto:${owner.privacyEmail}`}>{owner.privacyEmail}</a>.</p>
  </LegalPage>;
}
