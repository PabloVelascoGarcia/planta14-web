import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ReactElement } from "react";

// Diseño gráfico propio de Planta 14, generado en el propio servidor (sin servicios de terceros ni IA):
// - Plantillas por sección para noticias sin foto (/plantillas/[slug].png, 1600×1000).
// - Imagen para compartir en redes de cada noticia (/noticia/[slug]/redes.jpg, 1200×630).
// Se pintan con next/og (Satori + Resvg, incluidos en Next) y la tipografía Gelasio de la web; se pasan a JPEG/PNG con
// sharp. Los textos se limpian de caracteres que la tipografía no tiene: así nunca se piden glifos a internet.

export const BRAND = { coal: "#1c1917", ink: "#0c0a09", copper: "#a4522d", paper: "#f8f6f1", neutral: "#e9e4dc" };

/** Plantillas: nombre visible y color de acento (variaciones de la paleta de la web). */
export const TEMPLATE_STYLES: Record<string, { label: string; accent: string }> = {
  sucesos: { label: "Sucesos", accent: "#8c3b2f" }, economia: { label: "Economía", accent: "#a4522d" }, empresas: { label: "Empresas", accent: "#62717b" },
  politica: { label: "Política", accent: "#7a2e3a" }, sociedad: { label: "Sociedad", accent: "#a4522d" }, deportes: { label: "Deportes", accent: "#53624a" },
  cultura: { label: "Cultura", accent: "#8a5a2b" }, patrimonio: { label: "Patrimonio", accent: "#6b5a3e" }, opinion: { label: "Opinión", accent: "#7a2e3a" },
  agenda: { label: "Agenda", accent: "#53624a" }, formacion: { label: "Formación", accent: "#62717b" }, ayudas: { label: "Ayudas", accent: "#a4522d" },
  empleo: { label: "Empleo", accent: "#53624a" }, fiestas: { label: "Fiestas", accent: "#b06a2c" }, planta14: { label: "Planta 14", accent: "#a4522d" },
};

/** Solo letras latinas, cifras y la puntuación habitual (lo que cubre Gelasio). */
export function cleanText(value: string, max = 160) {
  const text = value.normalize("NFC").replace(/[^ -~ -ſ‐-‧‰-›€]/g, "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).replace(/\s+\S*$/, "")}…` : text;
}

let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 700; style: "normal" }[]> | null = null;
function loadFonts() {
  const dir = path.join(process.cwd(), "node_modules/@fontsource/gelasio/files");
  fonts ??= Promise.all([
    readFile(path.join(dir, "gelasio-latin-400-normal.woff")).then(data => ({ name: "Gelasio", data, weight: 400 as const, style: "normal" as const })),
    readFile(path.join(dir, "gelasio-latin-700-normal.woff")).then(data => ({ name: "Gelasio", data, weight: 700 as const, style: "normal" as const })),
  ]);
  return fonts;
}

/** Pinta un elemento a PNG o JPEG con las medidas indicadas. */
export async function renderImage(element: ReactElement, width: number, height: number, format: "png" | "jpeg", quality = 82) {
  // next/og (Satori + Resvg) se carga al usarse, desde node_modules, sin pasar por la compilación: así no añade memoria a
  // `npm run build` (la imagen de la app conserva node_modules completo).
  const [{ ImageResponse }, sharp] = await Promise.all([import(/* webpackIgnore: true */ "next/og.js") as Promise<typeof import("next/og")>, import("sharp").then(m => m.default)]);
  const response = new ImageResponse(element, { width, height, fonts: await loadFonts() });
  const png = Buffer.from(await response.arrayBuffer());
  return format === "png" ? sharp(png).png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer() : sharp(png).jpeg({ quality, mozjpeg: true }).toBuffer();
}

function Brand({ size, color = "#ffffff" }: { size: number; color?: string }) {
  return <div style={{ display: "flex", alignItems: "baseline", gap: size * 0.35 }}>
    <span style={{ fontFamily: "Gelasio", fontWeight: 700, fontSize: size, color, letterSpacing: -size * 0.04 }}>Planta 14</span>
  </div>;
}

/** Plantilla gráfica de una sección (sin fotos ni ilustraciones): fondo oscuro, franjas de color y el nombre grande. */
export function templateElement(slug: string, width = 1600, height = 1000) {
  const style = TEMPLATE_STYLES[slug] ?? TEMPLATE_STYLES.planta14;
  const u = width / 1600;
  return <div style={{ width, height, display: "flex", flexDirection: "column", justifyContent: "space-between", background: BRAND.coal, padding: 96 * u, position: "relative" }}>
    <div style={{ position: "absolute", top: 0, right: 0, width: 620 * u, height, display: "flex",
      backgroundImage: `repeating-linear-gradient(135deg, ${style.accent} 0px, ${style.accent} ${34 * u}px, transparent ${34 * u}px, transparent ${78 * u}px)`, opacity: 0.55 }} />
    <div style={{ position: "absolute", top: 0, right: 0, width: 620 * u, height, display: "flex", backgroundImage: `linear-gradient(90deg, ${BRAND.coal} 0%, rgba(28,25,23,0) 70%)` }} />
    <div style={{ display: "flex", alignItems: "center", gap: 24 * u }}>
      <div style={{ width: 18 * u, height: 72 * u, background: style.accent, display: "flex" }} />
      <Brand size={64 * u} />
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 18 * u }}>
      <div style={{ width: 220 * u, height: 14 * u, background: style.accent, display: "flex" }} />
      <span style={{ fontFamily: "Gelasio", fontWeight: 700, fontSize: (style.label.length > 9 ? 150 : 190) * u, lineHeight: 1, color: "#ffffff", letterSpacing: -6 * u }}>{style.label}</span>
      <span style={{ fontFamily: "Gelasio", fontWeight: 400, fontSize: 40 * u, color: "#d6cfc6" }}>Una voz para las Cuencas</span>
    </div>
  </div>;
}

/**
 * Imagen para redes (1200×630): la foto ya recortada (o la plantilla), el titular, el concejo principal y la marca. Un
 * cartel va completo a la izquierda sobre fondo neutro; una ilustración generada con IA lleva su rótulo.
 */
export function socialCardElement({ title, kicker, photo, poster, ai, template }: { title: string; kicker: string; photo?: string | null; poster?: boolean; ai?: boolean; template?: string }) {
  const text = cleanText(title, 140), place = cleanText(kicker, 40).toUpperCase();
  const size = text.length > 95 ? 44 : text.length > 60 ? 52 : 60;
  if (!photo) {
    // Sin foto: el diseño de la plantilla de la sección, con el titular en grande.
    const style = TEMPLATE_STYLES[template ?? "planta14"] ?? TEMPLATE_STYLES.planta14;
    return <div style={{ width: 1200, height: 630, display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative", background: BRAND.coal, padding: "44px 52px" }}>
      <div style={{ position: "absolute", top: 0, right: 0, width: 420, height: 630, display: "flex", opacity: 0.5,
        backgroundImage: `repeating-linear-gradient(135deg, ${style.accent} 0px, ${style.accent} 26px, transparent 26px, transparent 60px)` }} />
      <div style={{ position: "absolute", top: 0, right: 0, width: 420, height: 630, display: "flex", backgroundImage: `linear-gradient(90deg, ${BRAND.coal} 0%, rgba(28,25,23,0) 75%)` }} />
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ width: 12, height: 48, background: style.accent, display: "flex" }} /><Brand size={42} />
        <span style={{ fontFamily: "Gelasio", fontSize: 26, color: "#d6cfc6", marginLeft: 12 }}>{style.label}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 940 }}>
        <span style={{ fontFamily: "Gelasio", fontWeight: 700, fontSize: 24, color: "#f0b48c", letterSpacing: 2 }}>{place}</span>
        <span style={{ fontFamily: "Gelasio", fontWeight: 700, fontSize: size + 4, lineHeight: 1.1, color: "#fff" }}>{text}</span>
      </div>
    </div>;
  }
  const label = ai ? <div style={{ position: "absolute", top: 24, right: 24, display: "flex", padding: "6px 14px", background: "rgba(12,10,9,.88)", color: "#fff", fontFamily: "Gelasio", fontWeight: 700, fontSize: 22 }}>Ilustración generada con IA</div> : null;
  if (poster) {
    return <div style={{ width: 1200, height: 630, display: "flex", background: BRAND.coal }}>
      <div style={{ width: 470, height: 630, display: "flex", alignItems: "center", justifyContent: "center", background: BRAND.neutral, position: "relative" }}>
        <img src={photo} width={470} height={630} style={{ width: 470, height: 630, objectFit: "contain" }} alt="" />
        {label}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "48px 52px" }}>
        <Brand size={40} />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <span style={{ fontFamily: "Gelasio", fontWeight: 700, fontSize: 24, color: "#e3a17d", letterSpacing: 2 }}>{place}</span>
          <span style={{ fontFamily: "Gelasio", fontWeight: 700, fontSize: size - 6, lineHeight: 1.12, color: "#fff" }}>{text}</span>
        </div>
      </div>
    </div>;
  }
  return <div style={{ width: 1200, height: 630, display: "flex", position: "relative", background: BRAND.coal }}>
    <img src={photo} width={1200} height={630} style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, objectFit: "cover" }} alt="" />
    <div style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, display: "flex", backgroundImage: "linear-gradient(180deg, rgba(12,10,9,0) 30%, rgba(12,10,9,.55) 55%, rgba(12,10,9,.92) 100%)" }} />
    <div style={{ position: "absolute", top: 28, left: 32, display: "flex", padding: "8px 16px", background: BRAND.copper }}><Brand size={30} /></div>
    {label}
    <div style={{ position: "absolute", left: 48, right: 48, bottom: 40, display: "flex", flexDirection: "column", gap: 12 }}>
      <span style={{ fontFamily: "Gelasio", fontWeight: 700, fontSize: 24, color: "#f0b48c", letterSpacing: 2 }}>{place}</span>
      <span style={{ fontFamily: "Gelasio", fontWeight: 700, fontSize: size, lineHeight: 1.1, color: "#fff" }}>{text}</span>
    </div>
  </div>;
}
