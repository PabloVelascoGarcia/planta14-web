import { sql, type PostgresAdapter } from '@payloadcms/db-postgres';
import type { Payload, PayloadRequest } from 'payload';

/** Same lock for request hooks and reconciliation, held until COMMIT/ROLLBACK, never just until S3 finishes. */
export async function withPublicMediaLock<T>(payload: Payload, id: number, req: PayloadRequest | undefined,
  run: (req: PayloadRequest) => Promise<T>): Promise<T> {
  const existing = await req?.transactionID;
  const owned = existing == null;
  const transactionID = existing ?? await payload.db.beginTransaction();
  if (transactionID == null) throw new Error('Las copias públicas requieren transacciones PostgreSQL');
  const lockedReq = owned ? { ...req, payload, transactionID } as PayloadRequest : req!;
  try {
    const session = (payload.db as unknown as PostgresAdapter).sessions[transactionID];
    if (!session) throw new Error('No existe la transacción de la copia pública');
    // Namespace P14M; integer media IDs. Parameterized, shared across processes and CLI workers.
    await session.db.execute(sql`SELECT pg_advisory_xact_lock(1345401933, ${id}::integer)`);
    const result = await run(lockedReq);
    if (owned) await payload.db.commitTransaction(transactionID);
    return result;
  } catch (error) {
    if (owned) await payload.db.rollbackTransaction(transactionID);
    throw error;
  }
}
