import { NextResponse } from "next/server";
import { canManageAuthors, requireSession } from "@/lib/auth";
import { getAuthors, saveAuthor } from "@/lib/cms";

export async function GET() {
  await requireSession();
  return NextResponse.json({ authors: await getAuthors() });
}

export async function POST(request: Request) {
  const session = await requireSession();

  if (!canManageAuthors(session)) {
    return NextResponse.json({ error: "Solo un administrador puede crear autores" }, { status: 403 });
  }

  const payload = await request.json() as { name?: string; role?: string; bio?: string; email?: string; avatar?: string };

  if (!payload.name?.trim() || !payload.role?.trim() || !payload.bio?.trim()) {
    return NextResponse.json({ error: "Nombre, cargo y bio son obligatorios" }, { status: 400 });
  }

  const author = await saveAuthor({
    name: payload.name,
    role: payload.role,
    bio: payload.bio,
    email: payload.email,
    avatar: payload.avatar
  });

  return NextResponse.json({ author }, { status: 201 });
}
