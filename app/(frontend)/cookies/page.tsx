import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { CookieSettingsButton } from "@/components/cookie-consent";
import { owner } from "@/lib/legal";
import { analyticsId } from "@/lib/consent";

export const metadata: Metadata = { title: "Política de cookies", alternates: { canonical: "/cookies" } };

export default function Page() {
  const analytics = Boolean(analyticsId());
  return <LegalPage title="Política de cookies">
    <p>{owner.medium}, editado por {owner.name} ({owner.shortName}), usa cookies propias necesarias para que la web funcione y, solo si lo aceptas, cookies de medición de Google Analytics 4. Antes de que elijas no se instala ninguna cookie de medición. Rechazar es tan sencillo como aceptar.</p>
    <h2>Cookies que usamos</h2>
    <table>
      <thead><tr><th>Cookie</th><th>Titular</th><th>Finalidad</th><th>Tipo</th><th>Duración</th></tr></thead>
      <tbody>
        <tr><td>planta14_consent</td><td>Propia</td><td>Recordar si aceptaste o rechazaste las cookies de medición</td><td>Técnica (exenta)</td><td>180 días</td></tr>
        <tr><td>payload-token</td><td>Propia</td><td>Mantener la sesión de las cuentas municipales y de la redacción</td><td>Técnica (exenta)</td><td>La sesión (2 horas)</td></tr>
        <tr><td>planta14_session</td><td>Propia</td><td>Sesión del panel de demostración de la redacción</td><td>Técnica (exenta)</td><td>La sesión</td></tr>
        <tr><td>_ga</td><td>Google</td><td>Distinguir visitantes de forma anónima para medir la audiencia</td><td>Analítica (requiere consentimiento)</td><td>2 años</td></tr>
        <tr><td>_ga_&lt;ID&gt;</td><td>Google</td><td>Mantener el estado de la sesión de medición</td><td>Analítica (requiere consentimiento)</td><td>2 años</td></tr>
      </tbody>
    </table>
    <p>Google Analytics se configura sin señales publicitarias ni personalización de anuncios. Información de Google: <a href="https://policies.google.com/technologies/cookies" rel="noopener noreferrer">policies.google.com/technologies/cookies</a>.</p>
    <h2>Cambiar tu elección</h2>
    <p>Puedes aceptar o rechazar las cookies de medición en cualquier momento. Al rechazarlas se borran las cookies de Google Analytics de este sitio.</p>
    {analytics ? <p><CookieSettingsButton /></p> : <p>Ahora mismo la medición de audiencia está desactivada en este sitio y no se usan cookies de Google.</p>}
    <p>También puedes borrar o bloquear las cookies desde la configuración de tu navegador.</p>
    <p>Para cualquier duda: <a href={`mailto:${owner.privacyEmail}`}>{owner.privacyEmail}</a>.</p>
  </LegalPage>;
}
