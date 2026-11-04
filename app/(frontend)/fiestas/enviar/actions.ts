"use server";
import { territories } from "@/lib/mock-data";
import { paragraphsToLexical } from "@/lib/rich-text";
import { siteUrl } from "@/lib/site-config";
import { slugify } from "@/lib/utils";

export type FiestaFormState = { ok: boolean; message?: string; errors?: Record<string, string>; values?: Record<string, string> };

const MAX_POSTER = 5 * 1024 * 1024;
const text = (form: FormData, name: string, max: number) => String(form.get(name) ?? "").trim().slice(0, max);
const day = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) ? value : "";

/** «Envía tu fiesta»: se guarda como borrador sin confirmar y se escribe a quien la envía para que confirme su correo. */
export async function sendFiesta(_previous: FiestaFormState, form: FormData): Promise<FiestaFormState> {
  // Campo trampa: invisible para las personas; si llega relleno, es un robot. Se responde como si todo fuera bien.
  if (text(form, "web", 200)) return { ok: true, message: "Gracias. Te hemos enviado un correo para confirmar el envío." };
  const { emailAvailable } = await import("@/cms/email");
  if (!emailAvailable()) return { ok: false, message: "Ahora mismo no podemos recibir fiestas por este formulario. Escríbenos a info@planta14.com." };
  const towns = Object.values(territories).flat();
  const values = {
    name: text(form, "name", 120), village: text(form, "village", 80), town: text(form, "town", 40),
    startDay: day(text(form, "startDay", 10)), endDay: day(text(form, "endDay", 10)) || day(text(form, "startDay", 10)),
    program: text(form, "program", 8000), organizer: text(form, "organizer", 120), submitterName: text(form, "submitterName", 120),
    email: text(form, "email", 200).toLowerCase(), phone: text(form, "phone", 40), posterCredit: text(form, "posterCredit", 160),
  };
  const poster = form.get("poster");
  const hasPoster = poster instanceof File && poster.size > 0;
  const errors: Record<string, string> = {};
  if (values.name.length < 3) errors.name = "Escribe el nombre de la fiesta.";
  if (values.village.length < 2) errors.village = "Indica el pueblo o barrio.";
  if (!towns.some(t => slugify(t) === values.town)) errors.town = "Elige el concejo.";
  if (!values.startDay) errors.startDay = "Indica el primer día.";
  if (values.endDay < values.startDay) errors.endDay = "El último día no puede ser anterior al primero.";
  if (values.organizer.length < 2) errors.organizer = "Indica quién organiza (comisión, asociación…).";
  if (values.submitterName.length < 2) errors.submitterName = "Escribe tu nombre.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = "Escribe un correo válido: te pediremos que lo confirmes.";
  if (form.get("privacy") !== "on") errors.privacy = "Necesitamos tu conformidad para guardar estos datos.";
  if (hasPoster) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(poster.type)) errors.poster = "El cartel debe ser JPG, PNG o WebP.";
    else if (poster.size > MAX_POSTER) errors.poster = "El cartel no puede pasar de 5 MB.";
    if (values.posterCredit.length < 2) errors.posterCredit = "Indica quién hizo el cartel.";
    if (form.get("posterRights") !== "on") errors.posterRights = "Marca la declaración de derechos del cartel o envía la fiesta sin cartel.";
  }
  // Se devuelven los valores para que el formulario no se vacíe al mostrar los errores (el archivo hay que volver a elegirlo).
  const kept = { ...values, endDay: text(form, "endDay", 10), posterRights: form.get("posterRights") === "on" ? "on" : "", privacy: form.get("privacy") === "on" ? "on" : "" };
  if (Object.keys(errors).length) return { ok: false, errors, values: kept, message: hasPoster ? "Revisa los campos marcados y vuelve a elegir el archivo del cartel." : "Revisa los campos marcados." };

  const { contentClient } = await import("@/lib/payload-content");
  const { hashToken, newToken, dayToStored } = await import("@/cms/festivals");
  const payload = await contentClient();
  // Como mucho 5 envíos al día desde el mismo correo.
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const recent = await payload.count({ collection: "festivals", overrideAccess: true, where: { and: [{ "submission.email": { equals: values.email } }, { createdAt: { greater_than: since } }] } });
  if (recent.totalDocs >= 5) return { ok: false, message: "Ya hemos recibido varias fiestas desde este correo hoy. Si falta alguna, escríbenos a info@planta14.com." };
  const town = (await payload.find({ collection: "towns", where: { slug: { equals: values.town } }, limit: 1, depth: 0, overrideAccess: true })).docs[0];
  if (!town) return { ok: false, errors: { town: "Elige el concejo." } };

  let image: number | null = null;
  if (hasPoster) {
    const media = await payload.create({ collection: "media", overrideAccess: true,
      context: { submissionRightsDeclaration: { statement: `v1 · ${values.submitterName} <${values.email}> (${values.organizer}) declara que tiene derecho a ceder este cartel a Planta 14 para publicarlo con la fiesta «${values.name}» y que la autoría indicada es correcta.` } },
      file: { data: Buffer.from(await poster.arrayBuffer()), mimetype: poster.type, name: `cartel-${slugify(values.name)}.${poster.type.split("/")[1]}`, size: poster.size },
      data: { alt: `Cartel de ${values.name} (${values.village})`, credit: values.posterCredit, rightsHolder: values.organizer, rightsType: "autorización" } as never });
    image = media.id;
  }
  const token = newToken();
  const fiesta = await payload.create({ collection: "festivals", overrideAccess: true, draft: true, data: {
    name: values.name, village: values.village, town: town.id, startDate: dayToStored(values.startDay), endDate: dayToStored(values.endDay),
    program: values.program ? paragraphsToLexical(values.program.split(/\n\s*\n|\r?\n/).map(p => p.trim()).filter(Boolean)) : undefined,
    image, organizer: values.organizer, contact: [values.submitterName, values.email, values.phone].filter(Boolean).join(" · "), recurring: true, origin: "publico",
    submission: { name: values.submitterName, email: values.email, confirmed: false, tokenHash: hashToken(token), tokenExpiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString() },
    _status: "draft" } as never });
  try {
    await payload.sendEmail({ to: values.email, subject: `Confirma el envío de «${values.name}» a Planta 14`,
      text: `Hola, ${values.submitterName}:\n\nHemos recibido «${values.name}» (${values.village}). Para que llegue a la redacción, confirma que este correo es tuyo:\n\n${siteUrl}/fiestas/confirmar?t=${token}\n\n` +
        `El enlace caduca en 7 días. Si no has enviado nada, ignora este mensaje y no guardaremos la fiesta en el calendario.\n\n— Planta 14` });
  } catch (error) {
    payload.logger.error({ err: error, msg: "No se pudo enviar la confirmación de una fiesta" });
    await payload.delete({ collection: "festivals", id: fiesta.id, overrideAccess: true });
    if (image) await payload.delete({ collection: "media", id: image, overrideAccess: true });
    return { ok: false, message: "No hemos podido enviarte el correo de confirmación. Inténtalo más tarde o escríbenos a info@planta14.com." };
  }
  return { ok: true, message: `Gracias. Te hemos enviado un correo a ${values.email}: confirma el envío y «${values.name}» llegará a la redacción, que la revisará antes de publicarla.` };
}

export type ConfirmState = { ok: boolean; message: string };

/** Botón de la página de confirmación (no el enlace del correo: así los antivirus del correo no la confirman solos). */
export async function confirmFiesta(_previous: ConfirmState, form: FormData): Promise<ConfirmState> {
  const token = String(form.get("t") ?? "");
  const { contentClient } = await import("@/lib/payload-content");
  const { hashToken } = await import("@/cms/festivals");
  const { createPendingNotice } = await import("@/cms/responsables");
  const payload = await contentClient();
  const fiesta = token ? (await payload.find({ collection: "festivals", draft: true, overrideAccess: true, depth: 1, limit: 1, where: { "submission.tokenHash": { equals: hashToken(token) } } })).docs[0] : undefined;
  if (!fiesta || fiesta.submission?.confirmed) return { ok: false, message: "Este enlace ya se ha usado o no es válido." };
  if (!fiesta.submission?.tokenExpiresAt || new Date(fiesta.submission.tokenExpiresAt) < new Date()) return { ok: false, message: "El enlace ha caducado. Vuelve a enviar la fiesta, por favor." };
  await payload.update({ collection: "festivals", id: fiesta.id, draft: true, overrideAccess: true, data: { submission: { ...fiesta.submission, confirmed: true, confirmedAt: new Date().toISOString(), tokenHash: null, tokenExpiresAt: null } } as never });
  const town = typeof fiesta.town === "object" ? fiesta.town : null;
  await createPendingNotice(payload, undefined, { kind: "festival-submission", title: `Fiesta enviada: ${fiesta.name} (${fiesta.village})`, townID: town?.id ?? fiesta.town, townName: town?.name,
    detail: `${fiesta.submission?.name} (${fiesta.organizer}) ha enviado «${fiesta.name}» en ${fiesta.village}, del ${fiesta.startDay} al ${fiesta.endDay}. Está como borrador: revísala y publícala.\n` +
      `${(process.env.CMS_SERVER_URL || "").replace(/\/$/, "")}/cms/collections/festivals/${fiesta.id}`,
    data: { festival: fiesta.id } });
  return { ok: true, message: `Confirmado. «${fiesta.name}» ya está en la redacción de Planta 14, que la revisará antes de publicarla en el calendario de fiestas.` };
}
