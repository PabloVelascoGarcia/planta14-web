import { NextResponse } from "next/server";
import type { ArticleInput, ArticleStatus } from "@/lib/cms";
import { deleteArticle, saveArticle, updateArticleStatus } from "@/lib/cms";
import { canDeleteArticles, canPublishArticles, requireSession } from "@/lib/auth";
import { validateArticlePayload } from "@/lib/validation";

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, { params }: RouteProps) {
  const session = await requireSession();
  const { id } = await params;
  const payload = await request.json() as Record<string, unknown>;
  const errors = validateArticlePayload(payload);

  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  if (!canPublishArticles(session) && payload.status !== "draft") {
    return NextResponse.json({ error: "Un redactor solo puede guardar borradores" }, { status: 403 });
  }

  const article = await saveArticle({ ...payload, id } as ArticleInput);
  return NextResponse.json({ article });
}

export async function PATCH(request: Request, { params }: RouteProps) {
  const session = await requireSession();

  if (!canPublishArticles(session)) {
    return NextResponse.json({ error: "Solo un administrador puede cambiar el estado editorial" }, { status: 403 });
  }

  const { id } = await params;
  const payload = await request.json() as { status?: ArticleStatus };

  if (!payload.status || !["draft", "published", "scheduled", "unpublished"].includes(payload.status)) {
    return NextResponse.json({ error: "Estado no válido" }, { status: 400 });
  }

  await updateArticleStatus(id, payload.status);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: RouteProps) {
  const session = await requireSession();

  if (!canDeleteArticles(session)) {
    return NextResponse.json({ error: "Solo un administrador puede borrar noticias" }, { status: 403 });
  }

  const { id } = await params;
  await deleteArticle(id);
  return NextResponse.json({ ok: true });
}
