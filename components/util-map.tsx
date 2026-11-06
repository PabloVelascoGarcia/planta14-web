"use client";
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

/**
 * Mapa de OpenStreetMap (teselas oficiales, con su atribución) con el recorrido simplificado de una ruta o un punto.
 * Solo se carga cuando el lector pulsa «Ver el mapa»: hasta entonces la página no pide nada a terceros. Sin
 * JavaScript queda el enlace a openstreetmap.org.
 */
export function UtilMap({ track, point, title }: { track?: [number, number][][] | null; point?: [number, number] | null; title: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const element = box.current;
    if (!element || !shown) return;
    let map: import("leaflet").Map | null = null, cancelled = false;
    const draw = async () => {
      const L = await import("leaflet");
      if (cancelled || !element.isConnected) return;
      map = L.map(element, { scrollWheelZoom: false, attributionControl: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18,
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">colaboradores de OpenStreetMap</a>' }).addTo(map);
      if (track?.length) {
        const line = L.polyline(track, { color: "#a4522d", weight: 4, opacity: 0.9 }).addTo(map);
        L.circleMarker(track[0][0], { radius: 6, color: "#28241f", fillColor: "#fff", fillOpacity: 1, weight: 2 }).addTo(map).bindTooltip("Salida");
        map.fitBounds(line.getBounds(), { padding: [16, 16] });
      } else if (point) {
        L.circleMarker(point, { radius: 8, color: "#28241f", fillColor: "#a4522d", fillOpacity: 1, weight: 2 }).addTo(map).bindTooltip(title);
        map.setView(point, 15);
      }
    };
    void draw();
    return () => { cancelled = true; map?.remove(); };
  }, [track, point, title, shown]);
  const center = track?.[0]?.[0] ?? point;
  return <figure className="util-map" data-util-map={track?.length ? "track" : "point"} data-track-points={track?.reduce((n, s) => n + s.length, 0) ?? 0}>
    <div ref={box} className={`util-map-canvas${shown ? "" : " is-waiting"}`} role="img" aria-label={`Mapa: ${title}`}>
      {shown ? null : <button type="button" className="util-map-show" onClick={() => setShown(true)} data-util-map-show>Ver el mapa<small>Se carga desde OpenStreetMap</small></button>}
    </div>
    {center ? <figcaption><a href={`https://www.openstreetmap.org/?mlat=${center[0]}&mlon=${center[1]}#map=15/${center[0]}/${center[1]}`} target="_blank" rel="noopener noreferrer">Ver en OpenStreetMap ↗</a></figcaption> : null}
  </figure>;
}
