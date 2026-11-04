/** Encima de la lista de Suscriptores: exportación en CSV (punto y coma, UTF-8; se abre con Excel o LibreOffice). */
export function SubscribersExport() {
  const link = { display: "inline-block", marginRight: 16, fontWeight: 700 } as const;
  // Son descargas de archivo (una respuesta CSV de la API), no páginas: <a download>, no <Link>.
  return <p style={{ margin: "0 0 16px" }} data-subscribers-export>
    {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
    <a href="/api/cms/subscribers/exportar?estado=confirmado" download style={link}>Exportar confirmados (CSV)</a>
    {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
    <a href="/api/cms/subscribers/exportar" download style={link}>Exportar todos (CSV)</a>
  </p>;
}
