import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { cmsEnabled } from "@/cms/environment";

// Liveness for an external monitor: 200 when the web, the database and the storage answer, 503 otherwise.
// The body only says ok/error per component; details stay in the server log. Never cached.
export const dynamic = "force-dynamic";
type Check = "ok" | "error" | "not-configured";
const TIMEOUT_MS = 4000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS))]);
}

async function database(): Promise<Check> {
  const [{ contentClient }, { sql }] = await Promise.all([import("@/lib/payload-content"), import("@payloadcms/db-postgres")]);
  const payload = await withTimeout(contentClient());
  await withTimeout((payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<unknown> } }).drizzle.execute(sql`SELECT 1`));
  return "ok";
}

let client: S3Client | undefined;
async function storage(): Promise<Check> {
  client ??= new S3Client({
    region: process.env.S3_REGION || "us-east-1", endpoint: process.env.S3_ENDPOINT || undefined, forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID || "disabled", secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "disabled" },
  });
  await withTimeout(client.send(new HeadBucketCommand({ Bucket: process.env.S3_BUCKET || "" })));
  return "ok";
}

async function run(name: string, check: () => Promise<Check>): Promise<Check> {
  try { return await check(); }
  catch (error) { console.error(`[health] ${name} failed:`, error instanceof Error ? error.message : error); return "error"; }
}

export async function GET() {
  const enabled = cmsEnabled();
  const [db, s3] = enabled ? await Promise.all([run("database", database), run("storage", storage)]) : ["not-configured", "not-configured"] as Check[];
  const healthy = db !== "error" && s3 !== "error";
  return Response.json({ status: healthy ? "ok" : "error", checks: { database: db, storage: s3 } },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
export const HEAD = async () => new Response(null, { status: (await GET()).status, headers: { "Cache-Control": "no-store" } });
