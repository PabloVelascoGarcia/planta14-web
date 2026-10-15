import Link from "next/link";
import type { MunicipalSpace } from "@/lib/demo/municipal";

export function MunicipalMasthead({ space, panel = false }: { space: MunicipalSpace; panel?: boolean }) {
  return <>
    <div className="municipal-topbar"><div className="container-p14"><Link href="/">← Volver a Planta 14</Link><span>El Caudal · Cerca de ti</span></div></div>
    <header className="municipal-masthead container-p14">
      <div className="municipal-identity"><div className="municipal-crest" aria-label="Marcador para el escudo municipal"><span aria-hidden="true">⌂</span><small>ESCUDO<br />MUNICIPAL</small></div><div><p className="municipal-kicker">{panel ? "Panel de publicación · Demostración" : "Espacio municipal en Planta 14"}</p><h1>{space.name}</h1><p className="municipal-subline">{panel ? "Tu concejo, al día. Publicar puede ser así de sencillo." : "Información útil. Vida local. Todo tu concejo, más cerca."}</p></div></div>
      <Link className="municipal-brand" href="/" aria-label="Planta 14, portada">Planta 14<span>Una voz para las Cuencas</span></Link>
    </header>
  </>;
}
