import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";
import { owner } from "@/lib/legal";

export const metadata: Metadata = { title: "Aviso legal", alternates: { canonical: "/aviso-legal" } };

export default function Page() {
  return <LegalPage title="Aviso legal">
    <h2>Titular del sitio</h2>
    <p>En cumplimiento del artículo 10 de la Ley 34/2002, de servicios de la sociedad de la información y de comercio electrónico (LSSI), se informa de que {owner.medium} es un medio de comunicación digital editado por:</p>
    <ul>
      <li><strong>Titular:</strong> {owner.name} ({owner.shortName})</li>
      <li><strong>NIF:</strong> {owner.nif}</li>
      <li><strong>Domicilio:</strong> {owner.address}</li>
      <li><strong>Teléfono:</strong> {owner.phone}</li>
      <li><strong>Correo electrónico:</strong> <a href={`mailto:${owner.email}`}>{owner.email}</a></li>
      <li><strong>Datos registrales:</strong> Registro Mercantil de Asturias, {owner.registry}</li>
    </ul>
    <h2>Objeto</h2>
    <p>{owner.medium} publica información y opinión sobre la vida local de las cuencas mineras asturianas y ofrece a los ayuntamientos que lo contratan un espacio municipal propio. El acceso a la web es gratuito y no requiere registro, salvo para las cuentas municipales y de la redacción.</p>
    <h2>Contenido municipal</h2>
    <p>Los espacios municipales recogen avisos, noticias, agenda y otra información publicada directamente por cada ayuntamiento, bajo su responsabilidad, y aparecen identificados como contenido del ayuntamiento. {owner.medium} puede retirar ese contenido indicando el motivo, conforme a las <Link href="/condiciones-cuentas-municipales">condiciones de uso de las cuentas municipales</Link>.</p>
    <h2>Propiedad intelectual</h2>
    <p>Los textos, fotografías, diseño y marca de {owner.medium} pertenecen a su titular o a sus autores y se publican con su autorización. Las imágenes indican su autor o crédito. No se permite su reproducción, distribución o transformación sin autorización, salvo los usos permitidos por la ley, como la cita con indicación de la fuente y enlace al original.</p>
    <h2>Responsabilidad</h2>
    <p>{owner.shortName} trabaja para que la información publicada sea veraz y esté actualizada, y rectificará los errores que se le comuniquen. No responde de los contenidos de sitios de terceros enlazados desde la web ni de interrupciones del servicio ajenas a su control.</p>
    <h2>Derecho de rectificación y contacto</h2>
    <p>Cualquier persona puede solicitar la rectificación de una información que le afecte, conforme a la Ley Orgánica 2/1984, escribiendo a <a href={`mailto:${owner.email}`}>{owner.email}</a>.</p>
    <h2>Privacidad y cookies</h2>
    <p>El tratamiento de datos personales se explica en la <Link href="/privacidad">política de privacidad</Link> y el uso de cookies en la <Link href="/cookies">política de cookies</Link>.</p>
    <h2>Legislación aplicable</h2>
    <p>Este aviso se rige por la legislación española.</p>
  </LegalPage>;
}
