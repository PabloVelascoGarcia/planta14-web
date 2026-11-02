"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { consentCookie, isAnalyticsCookie, readConsent, type ConsentDecision } from "@/lib/consent";

export const OPEN_COOKIE_SETTINGS = "planta14:open-cookie-settings";

declare global { interface Window { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void } }

function loadAnalytics(gaId: string) {
  if (document.getElementById("planta14-ga4")) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer!.push(arguments); }; // eslint-disable-line prefer-rest-params
  window.gtag("consent", "default", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
  window.gtag("js", new Date());
  window.gtag("config", gaId, { anonymize_ip: true, allow_google_signals: false, allow_ad_personalization_signals: false });
  const script = document.createElement("script");
  script.id = "planta14-ga4";
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
  document.head.appendChild(script);
}

/** Removes GA cookies on this host and its parent domains (GA sets them on the registrable domain). */
function removeAnalyticsCookies() {
  const parts = location.hostname.split(".");
  const domains = ["", ...parts.map((_, i) => parts.slice(i).join(".")).filter(d => d.includes("."))];
  for (const name of document.cookie.split(/;\s*/).map(c => c.split("=")[0]).filter(isAnalyticsCookie)) {
    for (const domain of domains) document.cookie = `${name}=; Max-Age=0; Path=/${domain ? `; Domain=${domain}` : ""}`;
  }
}

/**
 * Cookie banner. Nothing non-essential runs before a decision: GA4 is injected only after "Aceptar".
 * "Rechazar" has the same weight as "Aceptar". The choice can be changed from the footer.
 */
export function CookieConsent({ gaId }: { gaId: string }) {
  const [open, setOpen] = useState(false);
  const decide = useCallback((decision: ConsentDecision) => {
    const previous = readConsent(document.cookie);
    document.cookie = consentCookie(decision, location.protocol === "https:");
    setOpen(false);
    if (decision === "accepted") loadAnalytics(gaId);
    else {
      removeAnalyticsCookies();
      // A loaded gtag cannot be unloaded: reload so the page runs without it.
      if (previous === "accepted") location.reload();
    }
  }, [gaId]);
  useEffect(() => {
    const decision = readConsent(document.cookie);
    const frame = requestAnimationFrame(() => {
      if (decision === "accepted") loadAnalytics(gaId);
      else { removeAnalyticsCookies(); setOpen(decision === null); }
    });
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS, reopen);
    return () => { cancelAnimationFrame(frame); window.removeEventListener(OPEN_COOKIE_SETTINGS, reopen); };
  }, [gaId]);
  if (!open) return null;
  return <div role="dialog" aria-modal="false" aria-labelledby="cookie-consent-title" className="cookie-consent">
    <div className="container-p14 cookie-consent-inner">
      <div>
        <p id="cookie-consent-title" className="cookie-consent-title">Cookies de medición</p>
        <p>Usamos cookies propias necesarias y, solo si nos das permiso, Google Analytics para saber cuántas personas leen Planta 14. Puedes cambiar tu elección cuando quieras desde el pie de página. <Link href="/cookies">Política de cookies</Link></p>
      </div>
      <div className="cookie-consent-actions">
        <button type="button" onClick={() => decide("rejected")}>Rechazar</button>
        <button type="button" onClick={() => decide("accepted")}>Aceptar</button>
      </div>
    </div>
  </div>;
}

export function CookieSettingsButton() {
  return <button type="button" className="hover:text-white text-left" onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS))}>Configurar cookies</button>;
}
