import { NextResponse } from "next/server";
import { setSession, validateCredentials } from "@/lib/auth";

export async function POST(request: Request) {
  let payload: { email?: unknown; password?: unknown };
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 }); }
  if (!payload || typeof payload.email !== "string" || typeof payload.password !== "string" || payload.email.length > 254 || payload.password.length > 1024) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  const user = validateCredentials(payload.email ?? "", payload.password ?? "");

  if (!user) {
    return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
  }

  await setSession(user);
  return NextResponse.json({ user: { email: user.email, name: user.name, role: user.role } });
}
