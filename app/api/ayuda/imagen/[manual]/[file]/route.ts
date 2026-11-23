import { readFile } from "node:fs/promises";
import path from "node:path";
import { helpAccess, isManual } from "@/lib/help-access";
import { IMAGE_DIRS } from "@/lib/manuals";

// Capturas de los manuales de la Ayuda: solo con la sesión que puede ver ese manual.
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ manual: string; file: string }> }) {
  const { manual, file } = await params;
  if (!isManual(manual) || !/^[a-z0-9-]+\.(png|jpe?g)$/.test(file)) return new Response("No existe", { status: 404 });
  if (!(await helpAccess(request.headers)).manuals.includes(manual)) return new Response("Inicia sesión", { status: 401 });
  const data = await readFile(path.join(process.cwd(), "docs/img", IMAGE_DIRS[manual], file)).catch(() => null);
  if (!data) return new Response("No existe", { status: 404 });
  return new Response(new Uint8Array(data), { headers: { "Content-Type": file.endsWith(".png") ? "image/png" : "image/jpeg", "Cache-Control": "private, max-age=3600" } });
}
