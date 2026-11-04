"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Baliza de las estadísticas propias: al mostrar cada página envía la dirección, la procedencia (referrer y
 * utm_source) y el concejo y la sección de la página (elemento [data-stats]). Sin cookies ni identificadores; se envía
 * con sendBeacon cuando el navegador está libre, así que no frena la página.
 */
export function StatsBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    const send = () => {
      try {
        const scope = document.querySelector<HTMLElement>("[data-stats]");
        const params = new URLSearchParams(window.location.search);
        const body = JSON.stringify({ p: pathname, r: document.referrer, u: params.get("utm_source") || "", t: scope?.dataset.statsTown || "", s: scope?.dataset.statsSection || "" });
        if (!navigator.sendBeacon?.("/api/v", body)) void fetch("/api/v", { method: "POST", body, keepalive: true });
      } catch { /* nada */ }
    };
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    if (idle) idle(send); else setTimeout(send, 1000);
  }, [pathname]);
  return null;
}

/** Concejo y sección de la página para las estadísticas (lo lee StatsBeacon). */
export function StatsScope({ town, section }: { town?: string; section?: string }) {
  return <span hidden data-stats data-stats-town={town || ""} data-stats-section={section || ""} />;
}
