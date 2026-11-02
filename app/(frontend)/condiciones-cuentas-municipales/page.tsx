import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";
import { owner } from "@/lib/legal";

export const metadata: Metadata = { title: "Condiciones de uso de las cuentas municipales", alternates: { canonical: "/condiciones-cuentas-municipales" } };

export default function Page() {
  return <LegalPage title="Condiciones de uso de las cuentas municipales">
    <p>Estas condiciones regulan el uso del panel de publicación de {owner.medium} por el personal de los ayuntamientos que tienen un espacio municipal contratado con {owner.name} ({owner.shortName}). Completan el contrato firmado con cada ayuntamiento y el contrato de encargo de tratamiento.</p>
    <h2>1. Cuentas</h2>
    <ul>
      <li>Las cuentas municipales las crea {owner.medium} a petición del ayuntamiento. Cada cuenta está vinculada a un único espacio municipal y es personal.</li>
      <li>La persona usuaria guarda sus credenciales en secreto y avisa de inmediato a <a href={`mailto:${owner.email}`}>{owner.email}</a> si sospecha que alguien las conoce.</li>
      <li>El ayuntamiento pide la baja de una cuenta cuando su titular deja de necesitarla.</li>
    </ul>
    <h2>2. Qué se puede publicar</h2>
    <ul>
      <li>Información de interés municipal: avisos, noticias, agenda, ayudas y anuncios del propio ayuntamiento.</li>
      <li>Lo publicado aparece al momento en el espacio del ayuntamiento, identificado como contenido municipal.</li>
      <li>El ayuntamiento es responsable de la veracidad y la legalidad de lo que publica, y de que los datos personales que incluya cumplan la normativa de protección de datos.</li>
      <li>No se permite publicar contenido ilícito, publicidad ajena al ayuntamiento, propaganda electoral en periodo de campaña ni datos personales innecesarios.</li>
    </ul>
    <h2 id="declaracion-imagen">3. Imágenes y declaración de derechos</h2>
    <p>Al subir una imagen, la persona usuaria marca la siguiente declaración, que queda registrada con su nombre de usuario, la fecha y la hora:</p>
    <blockquote className="legal-review" style={{ fontWeight: 400 }}>
      «El ayuntamiento declara que tiene los derechos necesarios para publicar esta imagen en Planta 14 y que el autor o crédito indicado es correcto.»
    </blockquote>
    <p>Con esa declaración, el ayuntamiento manifiesta que:</p>
    <ul>
      <li>es autor de la imagen o cuenta con autorización o licencia suficiente de su autor para publicarla en {owner.medium} y en las redes en las que se comparta el enlace;</li>
      <li>las personas reconocibles han consentido su publicación o existe otra base legal que la permita;</li>
      <li>el autor o crédito indicado es correcto.</li>
    </ul>
    <p>El ayuntamiento responde frente a terceros por las imágenes que publica. {owner.medium} retirará cualquier imagen ante una reclamación fundada. El texto completo está en el documento de declaración de derechos de imagen del contrato.</p>
    <h2>4. Retirada de contenido por Planta 14</h2>
    <p>{owner.medium} puede retirar una publicación municipal cuando incumpla estas condiciones o la ley, o cuando reciba una reclamación fundada. La publicación deja de verse en la web y el ayuntamiento ve el motivo en su panel. Un contenido retirado no se puede volver a publicar sin que {owner.medium} lo restablezca.</p>
    <h2>5. Registro de actividad</h2>
    <p>Para la seguridad del servicio se registra quién publica, edita, despublica o retira cada contenido y cuándo. Cada publicación municipal genera un aviso para la redacción de {owner.medium}.</p>
    <h2>6. Protección de datos</h2>
    <p>El tratamiento de los datos de las cuentas se explica en la <Link href="/privacidad">política de privacidad</Link>. Los datos personales contenidos en las publicaciones municipales se tratan conforme al contrato de encargo de tratamiento con cada ayuntamiento.</p>
    <h2>7. Suspensión y cambios</h2>
    <p>{owner.shortName} puede suspender una cuenta en caso de uso indebido o riesgo para la seguridad, y lo comunicará al ayuntamiento. Los cambios en estas condiciones se comunicarán a los ayuntamientos con antelación razonable.</p>
  </LegalPage>;
}
