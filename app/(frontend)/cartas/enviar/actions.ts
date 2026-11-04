"use server";
import { territories } from "@/lib/mock-data";
import { siteUrl } from "@/lib/site-config";
import { slugify } from "@/lib/utils";

export type LetterState = { ok: boolean; message?: string; errors?: Record<string, string>; values?: Record<string, string> };
const text = (form: FormData, name: string, max: number) => String(form.get(name) ?? "").trim().slice(0, max);

/** «Escribe una carta»: queda sin confirmar hasta que el autor abre el enlace del correo y pulsa el botón. */
export async function sendLetter(_previous: LetterState, form: FormData): Promise<LetterState> {
  if (text(form, "web", 200)) return { ok: true, message: "Gracias. Te hemos enviado un correo para confirmar la carta." };
  const [{ emailAvailable }, letters] = await Promise.all([import("@/cms/email"), import("@/cms/letters")]);
  if (!emailAvailable()) return { ok: false, message: "Ahora mismo no podemos recibir cartas por este formulario. Inténtalo más tarde." };
  const values = { firstName: text(form, "firstName", 80), lastName: text(form, "lastName", 120), dni: text(form, "dni", 20), phone: text(form, "phone", 30),
    email: text(form, "email", 200).toLowerCase(), town: text(form, "town", 40), body: String(form.get("body") ?? "").replace(/\r\n/g, "\n").trim() };
  const towns = Object.values(territories).flat();
  const errors: Record<string, string> = {};
  if (values.firstName.length < 2) errors.firstName = "Escribe tu nombre.";
  if (values.lastName.length < 2) errors.lastName = "Escribe tus apellidos.";
  if (!letters.validDNI(values.dni)) errors.dni = "Revisa el DNI o NIE (con su letra).";
  if (!/^\+?[\d\s]{9,15}$/.test(values.phone)) errors.phone = "Escribe un teléfono de contacto.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = "Escribe un correo válido: te pediremos que lo confirmes.";
  if (!towns.some(t => slugify(t) === values.town)) errors.town = "Elige tu concejo.";
  if (values.body.length < 30) errors.body = "La carta es demasiado corta.";
  if (values.body.length > letters.LETTER_MAX_LENGTH) errors.body = `La carta no puede pasar de ${letters.LETTER_MAX_LENGTH} caracteres (tiene ${values.body.length}).`;
  if (form.get("rules") !== "on") errors.rules = "Tienes que aceptar las normas de las cartas.";
  if (form.get("privacy") !== "on") errors.privacy = "Tienes que aceptar la política de privacidad.";
  const kept = { ...values, rules: form.get("rules") === "on" ? "on" : "", privacy: form.get("privacy") === "on" ? "on" : "" };
  if (Object.keys(errors).length) return { ok: false, errors, values: kept, message: "Revisa los campos marcados." };

  const { contentClient } = await import("@/lib/payload-content");
  const { hashToken, newToken } = await import("@/cms/festivals");
  const payload = await contentClient();
  await letters.eraseExpiredPersonalData(payload).catch(() => 0);
  // Una carta al mes por persona (por DNI o por correo), contando las confirmadas de los últimos 30 días.
  const person = letters.personKey(values.dni);
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const recent = await payload.count({ collection: "letters", overrideAccess: true, where: { and: [{ createdAt: { greater_than: since } }, { status: { not_equals: "sin-confirmar" } },
    { or: [{ personKey: { equals: person } }, { email: { equals: values.email } }] }] } });
  if (recent.totalDocs > 0) return { ok: false, values: kept, message: "Solo publicamos una carta al mes por persona. Podrás enviar otra pasados 30 días desde la anterior." };
  const town = (await payload.find({ collection: "towns", where: { slug: { equals: values.town } }, limit: 1, depth: 0, overrideAccess: true })).docs[0];
  if (!town) return { ok: false, values: kept, errors: { town: "Elige tu concejo." } };
  const token = newToken();
  const letter = await payload.create({ collection: "letters", overrideAccess: true, data: {
    status: "sin-confirmar", firstName: values.firstName, lastName: values.lastName, email: values.email, town: town.id, text: values.body, originalText: values.body,
    dniEnc: letters.encryptPersonal(letters.normalizeDNI(values.dni)), phoneEnc: letters.encryptPersonal(values.phone.replace(/\s+/g, "")), personKey: person,
    tokenHash: hashToken(token), tokenExpiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString() } as never });
  try {
    await payload.sendEmail({ to: values.email, subject: "Confirma tu carta a Planta 14",
      text: `Hola, ${values.firstName}:\n\nHemos recibido tu carta. Para que llegue a la redacción, confirma que este correo es tuyo (el enlace caduca en 7 días):\n\n${siteUrl}/cartas/confirmar?t=${token}\n\n` +
        `La redacción la revisará según las normas (${siteUrl}/normas-cartas) antes de publicarla. Si no la has enviado tú, ignora este mensaje.\n\n— Planta 14` });
  } catch (error) {
    payload.logger.error({ err: error, msg: "No se pudo enviar la confirmación de una carta" });
    await payload.delete({ collection: "letters", id: letter.id, overrideAccess: true });
    return { ok: false, values: kept, message: "No hemos podido enviarte el correo de confirmación. Inténtalo más tarde." };
  }
  return { ok: true, message: `Gracias. Te hemos enviado un correo a ${values.email}: confirma la carta y llegará a la redacción, que la revisará antes de publicarla.` };
}

export type ConfirmLetterState = { ok: boolean; message: string };

/** Botón de /cartas/confirmar: la carta pasa a «pendiente» y se avisa al periodista responsable del concejo. */
export async function confirmLetter(_previous: ConfirmLetterState, form: FormData): Promise<ConfirmLetterState> {
  const token = String(form.get("t") ?? "");
  const [{ contentClient }, { hashToken }, { createPendingNotice }] = await Promise.all([import("@/lib/payload-content"), import("@/cms/festivals"), import("@/cms/responsables")]);
  const payload = await contentClient();
  const letter = token ? (await payload.find({ collection: "letters", overrideAccess: true, depth: 1, limit: 1, where: { tokenHash: { equals: hashToken(token) } } })).docs[0] : undefined;
  if (!letter || letter.status !== "sin-confirmar") return { ok: false, message: "Este enlace ya se ha usado o no es válido." };
  if (!letter.tokenExpiresAt || new Date(letter.tokenExpiresAt) < new Date()) return { ok: false, message: "El enlace ha caducado. Vuelve a enviar la carta, por favor." };
  await payload.update({ collection: "letters", id: letter.id, overrideAccess: true, context: { system: true }, data: { status: "pendiente", tokenHash: null, tokenExpiresAt: null } as never });
  const town = typeof letter.town === "object" ? letter.town : null;
  await createPendingNotice(payload, undefined, { kind: "letter-submission", title: `Carta de ${letter.firstName} ${letter.lastName} (${town?.name ?? "concejo"})`, townID: town?.id ?? letter.town, townName: town?.name,
    detail: `${letter.firstName} ${letter.lastName} ha enviado una carta de los lectores. Apruébala (puedes editarla) o recházala con un motivo:\n${(process.env.CMS_SERVER_URL || "").replace(/\/$/, "")}/cms/collections/letters/${letter.id}`,
    data: { letter: letter.id } });
  return { ok: true, message: "Confirmado. Tu carta ya está en la redacción de Planta 14, que la revisará según las normas. Te escribiremos cuando se publique o si no podemos publicarla." };
}
