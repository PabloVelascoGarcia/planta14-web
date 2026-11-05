// Iconos del tiempo (SVG en línea, sin dependencias), según el estado del cielo que da AEMET en texto («Despejado»,
// «Intervalos nubosos», «Nuboso con lluvia», «Nieve», «Tormenta», «Niebla»…). Son decorativos: el texto va al lado.

export type WeatherKind = "sol" | "intervalos" | "nubes" | "lluvia" | "nieve" | "tormenta" | "niebla";

export function weatherKind(sky: string): WeatherKind {
  const s = sky.toLowerCase();
  if (/tormenta/.test(s)) return "tormenta";
  if (/nieve/.test(s)) return "nieve";
  if (/lluvia|llovizna|chubasco/.test(s)) return "lluvia";
  if (/niebla|bruma|calima/.test(s)) return "niebla";
  if (/despejado/.test(s)) return "sol";
  if (/poco nuboso|intervalos|nubes altas/.test(s)) return "intervalos";
  return "nubes";
}

const sun = <><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" /></>;
/** Nube de unos 18 × 13 (desplazada `y` en vertical); con precipitación sube para dejar sitio debajo. */
const cloud = (y = 0) => <path transform={`translate(0 ${y})`} d="M7 19.5h10.2a4.3 4.3 0 0 0 .6-8.55A6.2 6.2 0 0 0 5.9 12.6 3.5 3.5 0 0 0 7 19.5z" />;

export function WeatherIcon({ sky, size = 40 }: { sky: string; size?: number }) {
  const kind = weatherKind(sky);
  const body = {
    sol: sun,
    intervalos: <><g transform="translate(1 1) scale(.55)">{sun}</g><g transform="translate(2 1.5) scale(.92)">{cloud()}</g></>,
    nubes: cloud(-2),
    lluvia: <>{cloud(-5)}<path d="M8.5 17.5l-1.2 3M12.5 17.5l-1.2 3M16.5 17.5l-1.2 3" /></>,
    nieve: <>{cloud(-5)}<path d="M8.5 18.5h.01M12 20.5h.01M15.5 18.5h.01M10.2 21.5h.01M13.8 21.5h.01" strokeWidth="2.4" /></>,
    tormenta: <>{cloud(-5)}<path d="M13 15l-2.3 3.6h3.2L11.6 22.5" /></>,
    niebla: <>{cloud(-6)}<path d="M4.5 17h15M6.5 20.5h11" /></>,
  }[kind];
  return <svg className={`weather-icon is-${kind}`} data-weather-icon={kind} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{body}</svg>;
}
