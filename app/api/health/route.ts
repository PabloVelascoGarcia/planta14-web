import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { cmsEnabled } from "@/cms/environment";
import { createHealthProbe } from "@/lib/health-probe";

// Liveness for an external monitor: 200 when the web, the database and the storage answer, 503 otherwise.
// The body only says ok/error per component; details stay in the server log. Never cached.
export const dynamic = "force-dynamic";
type Check = "ok" | "error" | "not-configured";
const TIMEOUT_MS = 4000;

async function database(): Promise<Check> {
  const [{ contentClient }, { sql }] = await Promise.all([import("@/lib/payload-content"), import("@payloadcms/db-postgres")]);
  const payload = await contentClient();
  await (payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<unknown> } }).drizzle.execute(sql`SELECT 1`);
  return "ok";
}

let client: S3Client | undefined;
async function storage(): Promise<Check> {
  client ??= new S3Client({
    maxAttempts: 1,
    region: process.env.S3_REGION || "us-east-1", endpoint: process.env.S3_ENDPOINT || undefined, forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID || "disabled", secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "disabled" },
  });
  await client.send(new HeadBucketCommand({ Bucket: process.env.S3_BUCKET || "" }), { abortSignal: AbortSignal.timeout(TIMEOUT_MS) });
  return "ok";
}

const probe = (name: string, check: () => Promise<Check>) => createHealthProbe(check, {
  onError: error => console.error(`[health] ${name} failed:`, error instanceof Error ? error.message : error),
});
const databaseProbe = probe("database", database), storageProbe = probe("storage", storage);

export async function GET() {
  const enabled = cmsEnabled();
  const [db, s3]: Check[] = enabled ? (await Promise.all([databaseProbe(), storageProbe()])).map(ok => ok ? "ok" : "error") : ["not-configured", "not-configured"];
  const healthy = db !== "error" && s3 !== "error";
  return Response.json({ status: healthy ? "ok" : "error", checks: { database: db, storage: s3 } },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
}
export const HEAD = async () => new Response(null, { status: (await GET()).status, headers: { "Cache-Control": "no-store" } });
