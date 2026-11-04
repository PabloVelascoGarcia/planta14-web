import type { Payload } from "payload";

type DashboardUser = { id: number | string; role?: string | null; name?: string | null; collection?: string };
const card = { display: "block", padding: "16px 18px", border: "1px solid var(--theme-elevation-150)", borderRadius: 6, textDecoration: "none", color: "inherit", background: "var(--theme-elevation-0)" } as const;
const count = { fontSize: 28, fontWeight: 800, lineHeight: 1.1, display: "block" } as const;

/** Inicio del CMS (antes del listado de colecciones): accesos directos para la redacción, según el rol. */
export async function CmsDashboard({ payload, user }: { payload: Payload; user?: DashboardUser | null }) {
  if (!user || user.collection !== "users" || !["admin", "editor"].includes(String(user.role))) return null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
  const [drafts, publishedToday, unreviewed] = await Promise.all([
    payload.count({ collection: "articles", overrideAccess: true, where: { and: [{ _status: { equals: "draft" } }, { createdBy: { equals: user.id } }] } }),
    payload.count({ collection: "articles", overrideAccess: true, where: { and: [{ _status: { equals: "published" } }, { date: { equals: today } }] } }),
    // Pendientes de revisar: lo que llega de fuera. La redacción ve lo asignado a ella; la administración, todo.
    payload.count({ collection: "notifications", overrideAccess: true, where: user.role === "admin" ? { reviewed: { equals: false } } : { and: [{ reviewed: { equals: false } }, { assignedTo: { equals: user.id } }] } }),
  ]);
  const list = "/cms/collections/articles";
  const links: { href: string; title: string; text: string; value?: number; id: string }[] = [
    { id: "nueva", href: `${list}/create`, title: "Nueva noticia", text: "Escribe y publica, o guarda como borrador." },
    { id: "borradores", href: `${list}?where[and][0][_status][equals]=draft&where[and][1][createdBy][equals]=${user.id}`, title: "Mis borradores", text: "Noticias que has creado y aún no están publicadas.", value: drafts.totalDocs },
    { id: "hoy", href: `${list}?where[and][0][_status][equals]=published&where[and][1][date][equals]=${today}`, title: "Publicadas hoy", text: `Noticias publicadas con fecha de hoy (${today.split("-").reverse().join("/")}).`, value: publishedToday.totalDocs },
    { id: "pendientes", href: user.role === "admin" ? "/cms/collections/notifications?where[reviewed][equals]=false" : `/cms/collections/notifications?where[and][0][reviewed][equals]=false&where[and][1][assignedTo][equals]=${user.id}`,
      title: "Pendientes de revisar", text: user.role === "admin" ? "Lo que ha llegado de fuera (ayuntamientos, fiestas enviadas…) y aún no está revisado." : "Lo que ha llegado de fuera de tus concejos (ayuntamientos, fiestas enviadas…) y aún no has revisado.", value: unreviewed.totalDocs },
  ];
  if (user.role === "admin") links.push(
    { id: "espacios", href: "/cms/collections/municipal-spaces", title: "Espacios municipales", text: "Estado, contacto e identidad visual (foto, lema, escudo y colores)." },
    { id: "usuarios", href: "/cms/collections/users", title: "Usuarios", text: "Cuentas de la redacción y de los ayuntamientos." },
  );
  return <section data-cms-dashboard={user.role} style={{ marginBottom: 32 }}>
    <h2 style={{ margin: "0 0 4px" }}>Hola{user.name ? `, ${user.name}` : ""}</h2>
    <p style={{ margin: "0 0 16px", opacity: 0.75 }}>Accesos directos de Planta 14.</p>
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
      {links.map(link => <a key={link.id} href={link.href} style={card} data-dashboard-link={link.id}>
        {link.value !== undefined ? <span style={count}>{link.value}</span> : null}
        <strong style={{ display: "block", marginTop: link.value !== undefined ? 4 : 0 }}>{link.title}</strong>
        <span style={{ display: "block", marginTop: 4, fontSize: 13, opacity: 0.75 }}>{link.text}</span>
      </a>)}
    </div>
  </section>;
}
