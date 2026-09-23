import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { CmsUser } from "@/lib/auth-types";

import { encodeSession, decodeSession } from "@/lib/session-codec";

const cookieName = "planta14_session";

export async function getSession(): Promise<CmsUser | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(cookieName)?.value;

  if (!value) {
    return null;
  }

  const secret = authSecret();
  return secret ? decodeSession(value, secret) : null;
}

export async function requireSession() {
  const session = await getSession();

  if (!session) {
    throw new Error("No autorizado");
  }

  return session;
}

export async function setSession(user: CmsUser) {
  const cookieStore = await cookies();
  const secret = authSecret();
  if (!secret) throw new Error("Configura CMS_AUTH_SECRET antes de iniciar sesión");
  cookieStore.set(cookieName, encodeSession(user, secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(cookieName);
}

export function validateCredentials(email: string, password: string): CmsUser | null {
  if (!authSecret()) return null;
  const match = configuredUsers().find(user => user.email === email && safeEqual(user.password, password));
  return match ? { email: match.email, name: match.name, role: match.role } : null;
}

export function canManageAuthors(user: CmsUser) {
  return user.role === "admin";
}

export function canDeleteArticles(user: CmsUser) {
  return user.role === "admin";
}

export function canPublishArticles(user: CmsUser) {
  return user.role === "admin";
}

function configuredUsers() {
  const development = process.env.NODE_ENV !== "production";
  return [
    {
      email: process.env.CMS_ADMIN_EMAIL ?? (development ? "admin@planta14.local" : ""),
      password: process.env.CMS_ADMIN_PASSWORD ?? (development ? "admin1234" : ""),
      name: "Administración",
      role: "admin" as const
    },
    {
      email: process.env.CMS_REDACTOR_EMAIL ?? (development ? "redactor@planta14.local" : ""),
      password: process.env.CMS_REDACTOR_PASSWORD ?? (development ? "redactor1234" : ""),
      name: "Redacción",
      role: "redactor" as const
    }
  ].filter(user => user.email && user.password);
}

function authSecret() {
  const value = process.env.CMS_AUTH_SECRET;
  if (value && value.length >= 32) return value;
  return process.env.NODE_ENV !== "production" ? "planta14-local-development-only-secret" : null;
}

function safeEqual(a: string, b: string) {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}
