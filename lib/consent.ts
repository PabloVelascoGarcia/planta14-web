// Consent for non-essential cookies (Google Analytics 4). Shared by the server layout and the browser banner.

export const CONSENT_COOKIE = "planta14_consent";
/** Consent is asked again after this time (AEPD guidance: no more than 24 months). */
export const CONSENT_MAX_AGE_DAYS = 180;
export const CONSENT_VERSION = "1";
export type ConsentDecision = "accepted" | "rejected";

/** GA4 measurement ID from GA4_MEASUREMENT_ID (read on the server at request time). Invalid values are ignored. */
export function analyticsId(env: Record<string, string | undefined> = process.env): string | null {
  const id = env.GA4_MEASUREMENT_ID?.trim();
  return id && /^G-[A-Z0-9]{4,20}$/.test(id) ? id : null;
}

/** Reads the stored decision from a Cookie header / document.cookie string. Unknown versions count as no decision. */
export function readConsent(cookieString: string | null | undefined): ConsentDecision | null {
  const raw = (cookieString || "").split(/;\s*/).find(part => part.startsWith(`${CONSENT_COOKIE}=`))?.slice(CONSENT_COOKIE.length + 1);
  if (!raw) return null;
  let decoded: string;
  try { decoded = decodeURIComponent(raw); } catch { return null; }
  const [version, decision, extra] = decoded.split(":");
  if (extra !== undefined) return null;
  return version === CONSENT_VERSION && (decision === "accepted" || decision === "rejected") ? decision : null;
}

export function consentCookie(decision: ConsentDecision, secure: boolean) {
  return `${CONSENT_COOKIE}=${encodeURIComponent(`${CONSENT_VERSION}:${decision}`)}; Max-Age=${CONSENT_MAX_AGE_DAYS * 86400}; Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/** Names of the analytics cookies set by GA4 (_ga, _ga_<container>, legacy _gid/_gat). */
export function isAnalyticsCookie(name: string) {
  return /^(_ga|_ga_[A-Z0-9]+|_gid|_gat(_.*)?)$/.test(name);
}
