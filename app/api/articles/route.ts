import { NextResponse } from "next/server";
import type { ArticleInput } from "@/lib/cms";
import { saveArticle } from "@/lib/cms";
import { territories, topics } from "@/lib/mock-data";

export async function POST(request: Request) {
  const payload = await request.json() as Record<string, unknown>;
  const errors = validateArticle(payload);

  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const article = await saveArticle(payload as ArticleInput);

  return NextResponse.json({ article }, { status: 201 });
}

function validateArticle(payload: Record<string, unknown>) {
  const errors: string[] = [];
  const requiredFields = ["title", "excerpt", "body", "image", "date", "author", "comarca", "concejo", "topic"];

  for (const field of requiredFields) {
    const value = payload[field];
    if (typeof value !== "string" || !value.trim()) {
      errors.push(`El campo ${field} es obligatorio.`);
    }
  }

  if (payload.comarca !== "Caudal" && payload.comarca !== "Nalón") {
    errors.push("La comarca no es válida.");
  }

  if (typeof payload.comarca === "string" && typeof payload.concejo === "string") {
    const comarca = payload.comarca as keyof typeof territories;
    if (!territories[comarca]?.includes(payload.concejo)) {
      errors.push("El concejo no pertenece a la comarca seleccionada.");
    }
  }

  if (typeof payload.topic === "string" && !topics.includes(payload.topic)) {
    errors.push("La temática no es válida.");
  }

  return errors;
}
