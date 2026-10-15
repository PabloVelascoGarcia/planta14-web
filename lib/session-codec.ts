import { createHmac, timingSafeEqual } from "node:crypto";
import type { CmsUser } from "./auth-types";

export function encodeSession(user: CmsUser, secret: string, now = Date.now()): string {
  if (secret.length < 32) throw new Error("CMS_AUTH_SECRET debe tener al menos 32 caracteres");
  // Select fields explicitly: credentials must never enter the cookie payload.
  const payload = Buffer.from(JSON.stringify({ email: user.email, name: user.name, role: user.role, exp: now + 8 * 60 * 60 * 1000 })).toString("base64url");
  return `${payload}.${signature(payload, secret)}`;
}

export function decodeSession(value: string, secret: string, now = Date.now()): CmsUser | null {
  if (secret.length < 32) return null;
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [payload, supplied] = parts;
  const expected = signature(payload, secret);
  const a = Buffer.from(supplied), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data || typeof data.email !== "string" || typeof data.name !== "string" || !["admin", "redactor"].includes(data.role) || typeof data.exp !== "number" || !Number.isFinite(data.exp) || data.exp <= now) return null;
    return { email: data.email, name: data.name, role: data.role };
  } catch { return null; }
}

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}
