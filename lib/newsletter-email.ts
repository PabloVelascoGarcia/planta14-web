import { owner } from "./legal";

// Correo del boletín: HTML sobrio con el estilo de Planta 14, hecho con tablas y estilos en línea (lo que leen bien
// Gmail, Outlook y los móviles), sin imágenes ni seguimiento, y su alternativa de texto plano.

export type NewsletterArticle = { title: string; excerpt: string; url: string; town: string; opinion: boolean; author: string };
export type NewsletterContent = { subject: string; intro: string | null; articles: NewsletterArticle[]; siteUrl: string; unsubscribeUrl: string; test?: boolean };

const esc = (value: string) => value.replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c]!);
const COPPER = "#a4522d", COAL = "#1c1917", PAPER = "#f7f4ee", MUTED = "#57534e";
const serif = "Georgia, 'Times New Roman', serif", sans = "Arial, Helvetica, sans-serif";
/** Pie: por qué lo recibe, baja en un clic y quién edita el boletín. */
export const editorLine = `${owner.medium}, medio editado por ${owner.name} (${owner.shortName}), NIF ${owner.nif}, ${owner.address}.`;

export function renderNewsletter(c: NewsletterContent): { html: string; text: string } {
  const paragraphs = (c.intro ?? "").split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const items = c.articles.map(a => `
        <tr><td style="padding:18px 0;border-top:1px solid #e3ddd3">
          <p style="margin:0 0 6px;font:bold 12px ${sans};letter-spacing:.08em;text-transform:uppercase;color:${COPPER}">${esc(a.opinion ? `Opinión · ${a.author}` : a.town)}</p>
          <a href="${esc(a.url)}" style="font:bold 21px/1.25 ${serif};color:${COAL};text-decoration:none">${esc(a.title)}</a>
          <p style="margin:8px 0 0;font:15px/1.6 ${sans};color:${MUTED}">${esc(a.excerpt)}</p>
          <p style="margin:8px 0 0"><a href="${esc(a.url)}" style="font:bold 14px ${sans};color:${COPPER}">Leer en Planta 14</a></p>
        </td></tr>`).join("");
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(c.subject)}</title></head>
<body style="margin:0;padding:0;background:${PAPER}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER}"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-top:4px solid ${COAL}">
      <tr><td style="padding:24px 24px 8px">
        ${c.test ? `<p style="margin:0 0 12px;padding:8px 10px;background:#fbf1eb;border:1px solid ${COPPER};font:bold 13px ${sans};color:${COPPER}">Prueba: solo te llega a ti.</p>` : ""}
        <p style="margin:0;font:900 30px/1 ${serif};color:${COAL}">Planta 14</p>
        <p style="margin:6px 0 0;font:12px ${sans};letter-spacing:.12em;text-transform:uppercase;color:${MUTED}">Boletín</p>
        <h1 style="margin:18px 0 0;font:bold 24px/1.25 ${serif};color:${COAL}">${esc(c.subject)}</h1>
        ${paragraphs.map(p => `<p style="margin:12px 0 0;font:16px/1.6 ${sans};color:${COAL}">${esc(p)}</p>`).join("")}
      </td></tr>
      <tr><td style="padding:8px 24px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${items}
      </table></td></tr>
      <tr><td style="padding:18px 24px 24px;border-top:1px solid #e3ddd3;font:13px/1.6 ${sans};color:${MUTED}">
        <p style="margin:0">Recibes este correo porque te suscribiste al boletín en <a href="${esc(c.siteUrl)}" style="color:${MUTED}">planta14.com</a>.
          <a href="${esc(c.unsubscribeUrl)}" style="color:${COPPER};font-weight:bold">Darte de baja con un clic</a>.</p>
        <p style="margin:8px 0 0">${esc(editorLine)}</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  const text = [
    c.test ? "PRUEBA: solo te llega a ti.\n" : "",
    `PLANTA 14 · BOLETÍN\n\n${c.subject}\n`,
    ...paragraphs.map(p => `${p}\n`),
    ...c.articles.map(a => `— ${a.opinion ? `Opinión · ${a.author}` : a.town}\n${a.title}\n${a.excerpt}\n${a.url}\n`),
    `Recibes este correo porque te suscribiste al boletín en planta14.com.\nDarte de baja con un clic: ${c.unsubscribeUrl}\n\n${editorLine}`,
  ].filter(Boolean).join("\n");
  return { html, text };
}
