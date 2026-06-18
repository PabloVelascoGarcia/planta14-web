import { NextResponse } from "next/server";
import { canManageAuthors, requireSession } from "@/lib/auth";
import { deleteAuthor, updateAuthor } from "@/lib/cms";

type RouteProps = {
  params: Promise<{ slug: string }>;
};

export async function DELETE(_: Request, { params }: RouteProps) {
  const session = await requireSession();

  if (!canManageAuthors(session)) {
    return NextResponse.json({ error: "Solo un administrador puede borrar autores" }, { status: 403 });
  }

  const { slug } = await params;
  await deleteAuthor(slug);
  return NextResponse.json({ ok: true });
}

export async function PUT(request: Request, { params }: RouteProps) {
  const session = await requireSession();

  if (!canManageAuthors(session)) {
    return NextResponse.json({ error: "Solo un administrador puede editar autores" }, { status: 403 });
  }

  const { slug } = await params;
  const payload = await request.json() as { name?: string; role?: string; bio?: string; email?: string; avatar?: string };

  if (!payload.name?.trim() || !payload.role?.trim() || !payload.bio?.trim()) {
    return NextResponse.json({ error: "Nombre, cargo y bio son obligatorios" }, { status: 400 });
  }

  const author = await updateAuthor(slug, {
    name: payload.name,
    role: payload.role,
    bio: payload.bio,
    email: payload.email,
    avatar: payload.avatar
  });

  return NextResponse.json({ author });
}
