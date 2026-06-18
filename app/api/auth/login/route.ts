import { NextResponse } from "next/server";
import { setSession, validateCredentials } from "@/lib/auth";

export async function POST(request: Request) {
  const payload = await request.json() as { email?: string; password?: string };
  const user = validateCredentials(payload.email ?? "", payload.password ?? "");

  if (!user) {
    return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
  }

  await setSession(user);
  return NextResponse.json({ user: { email: user.email, name: user.name, role: user.role } });
}
