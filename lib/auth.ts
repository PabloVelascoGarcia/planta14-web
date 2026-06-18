import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { CmsUser } from "@/lib/auth-types";

const cookieName = "planta14_session";

export async function getSession(): Promise<CmsUser | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(cookieName)?.value;

  if (!value) {
    return null;
  }

  return verifySession(value);
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
  cookieStore.set(cookieName, signSession(user), {
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
  const users = configuredUsers();
  return users.find((user) => user.email === email && user.password === password) ?? null;
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
  return [
    {
      email: process.env.CMS_ADMIN_EMAIL ?? "admin@planta14.local",
      password: process.env.CMS_ADMIN_PASSWORD ?? "admin1234",
      name: "Administración",
      role: "admin" as const
    },
    {
      email: process.env.CMS_REDACTOR_EMAIL ?? "redactor@planta14.local",
      password: process.env.CMS_REDACTOR_PASSWORD ?? "redactor1234",
      name: "Redacción",
      role: "redactor" as const
    }
  ];
}

function signSession(user: CmsUser) {
  const payload = Buffer.from(JSON.stringify(user)).toString("base64url");
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

function verifySession(value: string): CmsUser | null {
  const [payload, signature] = value.split(".");

  if (!payload || !signature || !safeEqual(signature, sign(payload))) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as CmsUser;
  } catch {
    return null;
  }
}

function sign(payload: string) {
  return createHmac("sha256", process.env.CMS_AUTH_SECRET ?? "planta14-dev-secret")
    .update(payload)
    .digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}
