import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";
import { owner } from "@/lib/legal";

export const metadata: Metadata = { title: "Política de privacidad", alternates: { canonical: "/privacidad" } };

export default function Page() {
  return <LegalPage title="Política de privacidad">
    <h2>Responsable del tratamiento</h2>
    <p>{owner.name} ({owner.shortName}), NIF {owner.nif}, {owner.address}. Teléfono {owner.phone}. Correo de privacidad: <a href={`mailto:${owner.privacyEmail}`}>{owner.privacyEmail}</a>. Delegado de protección de datos: [DELEGADO DE PROTECCIÓN DE DATOS, si se designa].</p>
    <h2>Qué datos tratamos y para qué</h2>
    <div className="legal-table" role="region" aria-label="Tratamientos de datos (desplázala en horizontal si no cabe)" tabIndex={0}><table>
      <thead><tr><th>Tratamiento</th><th>Datos</th><th>Base jurídica</th><th>Conservación</th></tr></thead>
      <tbody>
        <tr><td>Funcionamiento y seguridad de la web</td><td>Dirección IP, fecha y página solicitada en los registros técnicos del servidor</td><td>Interés legítimo en mantener la web disponible y segura (art. 6.1.f RGPD)</td><td>[PLAZO DE CONSERVACIÓN DE REGISTROS TÉCNICOS]</td></tr>
        <tr><td>Atención de consultas, rectificaciones y ejercicio de derechos</td><td>Nombre, correo y contenido del mensaje</td><td>Consentimiento al escribirnos y cumplimiento de obligaciones legales (art. 6.1.a y 6.1.c RGPD)</td><td>El tiempo necesario para responder y, después, el plazo de prescripción de posibles responsabilidades</td></tr>
        <tr><td>Boletín por correo</td><td>Correo electrónico, concejos y contenidos elegidos, fecha y texto del consentimiento, fechas de confirmación y de baja</td><td>Consentimiento, con doble confirmación por correo (art. 6.1.a RGPD y art. 21 LSSI). Puedes retirarlo en cualquier momento con el enlace de baja de cada correo</td><td>Mientras sigas suscrito. Las altas sin confirmar, como mucho 7 días para confirmar; tras la baja, solo el registro de la baja y el consentimiento, como prueba, durante el plazo de prescripción</td></tr>
        <tr><td>Cartas de los lectores</td><td>Nombre, apellidos, concejo, texto, correo, DNI o NIE y teléfono. Se publican solo el nombre, los apellidos, el concejo y el texto; DNI y teléfono se guardan cifrados y solo los ven la administración y el periodista responsable del concejo</td><td>Consentimiento al enviarla (art. 6.1.a RGPD)</td><td>DNI y teléfono: 24 meses, después se borran automáticamente. La carta publicada, mientras esté publicada</td></tr>
        <tr><td>Fiestas enviadas con «Envía tu fiesta»</td><td>Nombre, correo y teléfono de quien la envía y de la organización; cartel y su declaración de derechos</td><td>Consentimiento al enviarla (art. 6.1.a RGPD)</td><td>Mientras la fiesta esté en el calendario y, después, el tiempo necesario para atender posibles reclamaciones sobre lo publicado</td></tr>
        <tr><td>Cuentas del personal municipal y de la redacción</td><td>Nombre, correo, ayuntamiento, contraseñas protegidas mediante hash y registro de actividad (qué se publicó, editó o retiró y cuándo)</td><td>Ejecución del contrato con el ayuntamiento e interés legítimo en la seguridad y trazabilidad del servicio (art. 6.1.b y 6.1.f RGPD)</td><td>Mientras dure la relación y, después, [PLAZO DE CONSERVACIÓN DE CUENTAS Y AUDITORÍA]</td></tr>
      </tbody>
    </table></div>
    <p>Los datos personales que un ayuntamiento incluya en sus publicaciones se tratan por cuenta de ese ayuntamiento, que es su responsable. {owner.shortName} actúa como encargado del tratamiento conforme al contrato de encargo firmado con cada ayuntamiento.</p>
    <p>Para saber qué páginas se leen, Planta 14 usa un contador propio <strong>sin cookies ni datos personales</strong>: solo suma visitas por página, concejo, sección, día y procedencia general (buscadores, redes sociales, WhatsApp o acceso directo). No guarda la dirección IP, el navegador ni ningún identificador.</p>
    <h2>Destinatarios</h2>
    <p>No cedemos datos a terceros salvo obligación legal. Nos prestan servicios, como encargados del tratamiento:</p>
    <ul>
      <li>Alojamiento del servidor: [PROVEEDOR DE ALOJAMIENTO].</li>
      <li>Almacenamiento de imágenes: [PROVEEDOR DE ALMACENAMIENTO].</li>
      <li>Envío de correos: [PROVEEDOR DE CORREO].</li>
    </ul>
    <h2>Tus derechos</h2>
    <p>Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad escribiendo a <a href={`mailto:${owner.privacyEmail}`}>{owner.privacyEmail}</a>, indicando qué derecho ejerces.</p>
    <p>Si consideras que no hemos atendido correctamente tu solicitud, puedes reclamar ante la Agencia Española de Protección de Datos (<a href="https://www.aepd.es" rel="noopener noreferrer">www.aepd.es</a>).</p>
    <h2>Seguridad</h2>
    <p>El servicio debe operar con conexiones cifradas, credenciales individuales, permisos limitados por ayuntamiento, registro de actividad y copias de seguridad cifradas. La implantación y comprobación de estas medidas deben confirmarse antes de la puesta en servicio.</p>
    <p>Más información sobre cookies en la <Link href="/cookies">política de cookies</Link>.</p>
  </LegalPage>;
}
