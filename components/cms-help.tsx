import type { AdminViewServerProps } from "payload";
import Link from "next/link";
import { DefaultTemplate } from "@payloadcms/next/templates";
import { HelpBrowser } from "./help-browser";

// /cms/ayuda: el manual de la redacción dentro del CMS (solo redacción y administración). El apartado de
// administración, solo para la administración.
export async function HelpView(props: AdminViewServerProps) {
  const { initPageResult, searchParams, params, i18n, payload, user, locale, permissions } = props;
  const me = initPageResult.req.user as { collection?: string; role?: string | null } | null;
  const editorial = me?.collection === "users" && ["admin", "editor"].includes(String(me.role));
  const body = editorial ? await (async () => {
    const { getManual, helpSections } = await import("@/lib/manuals");
    const manual = await getManual("redaccion", { admin: me!.role === "admin" });
    const updated = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" }).format(new Date(manual.generatedAt));
    return <HelpBrowser title={manual.title} sections={helpSections("redaccion", manual)} pdfHref="/api/ayuda/pdf?manual=redaccion" updated={updated} />;
  })() : <p>Solo para la redacción.</p>;
  return <DefaultTemplate i18n={i18n} locale={locale} params={params} payload={payload} permissions={permissions} searchParams={searchParams} user={user} visibleEntities={initPageResult.visibleEntities}>
    <div className="gutter--left gutter--right" id="ayuda-inicio" style={{ paddingTop: 24, paddingBottom: 48 }} data-cms-help>{body}</div>
  </DefaultTemplate>;
}

/** Enlace «Ayuda» en el menú lateral del CMS. */
export function CmsHelpLink() {
  return <Link href="/cms/ayuda" className="nav__link" data-nav-help style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontWeight: 600 }}>
    <span aria-hidden="true" style={{ display: "inline-flex", width: 20, height: 20, borderRadius: "50%", border: "1.5px solid currentColor", alignItems: "center", justifyContent: "center", fontSize: 12 }}>?</span>
    <span className="nav__link-label">Ayuda</span>
  </Link>;
}
