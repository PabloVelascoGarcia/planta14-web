import { NextResponse } from "next/server";
import type { ArticleInput } from "@/lib/cms";
import { getAllArticles, saveArticle } from "@/lib/cms";
import { canPublishArticles, requireSession } from "@/lib/auth";
import { validateArticlePayload } from "@/lib/validation";

export async function GET() {
  await requireSession();
  return NextResponse.json({ articles: await getAllArticles() });
}

export async function POST(request: Request) {
  const session = await requireSession();
  const payload = await request.json() as Record<string, unknown>;
  const errors = validateArticlePayload(payload);

  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  if (!canPublishArticles(session) && payload.status !== "draft") {
    return NextResponse.json({ error: "Un redactor solo puede guardar borradores" }, { status: 403 });
  }

  const article = await saveArticle(payload as ArticleInput);
  return NextResponse.json({ article }, { status: 201 });
}
