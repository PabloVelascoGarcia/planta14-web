import Link from "next/link";
export function MagazineFooter() {
  return <footer className="n-footer"><Link href="/niebla" className="n-footer-brand">Planta 14<span>Una voz para las Cuencas</span></Link><p>Orgullo de historia.<br />Mirada al futuro</p><div><Link href="/">Portada diaria ↗</Link><Link href="/niebla">El semanal ↗</Link><Link href="/contacto">Contacto ↗</Link></div><small>Edición de demostración · Propuestas editoriales, no entrevistas ni reportajes realizados. Fotografías de archivo y contexto acreditadas.</small></footer>;
}
