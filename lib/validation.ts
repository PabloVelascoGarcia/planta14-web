import { territories, topics } from "@/lib/mock-data";

export function validateArticlePayload(payload: Record<string, unknown>) {
  const errors: string[] = [];
  const requiredFields = ["title", "excerpt", "body", "image", "date", "author", "comarca", "concejo", "topic", "status"];

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

  if (typeof payload.status === "string" && !["draft", "published", "scheduled", "unpublished"].includes(payload.status)) {
    errors.push("El estado editorial no es válido.");
  }

  if (payload.status === "scheduled" && (typeof payload.scheduledAt !== "string" || !payload.scheduledAt.trim())) {
    errors.push("Las noticias programadas necesitan fecha y hora de publicación.");
  }

  return errors;
}
