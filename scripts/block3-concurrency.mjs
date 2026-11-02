import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { sql } from '@payloadcms/db-postgres';

export async function testPublicConcurrency({ payload, article, image, actor }) {
  const { syncPublicMedia, cleanupLoggedOrphans } = await import('../cms/public-media.ts');
  const tx = await payload.db.beginTransaction();
  const req = { payload, transactionID: tx };
  let committed = false, second, cleaner;
  const waitForBlocked = async () => {
    for (let i = 0; i < 100; i++) {
      const result = await payload.db.drizzle.execute(sql`SELECT count(*) AS n FROM pg_locks WHERE locktype = 'advisory' AND classid = 1345401933 AND objid = ${image.id} AND NOT granted`);
      if (Number(result.rows[0].n) >= 2) return;
      await delay(20);
    }
    assert.fail('both the second transaction and reconciler must wait for the image lock');
  };
  try {
    // Refresh writes S3 and SQL, but the outer content transaction is deliberately left uncommitted.
    await syncPublicMedia(payload, image.id, req, { refresh: true });
    const pending = await payload.db.findOne({ collection: 'media', req, where: { id: { equals: image.id } } });
    let finished = false;
    second = payload.update({ collection: 'articles', id: article.id, user: actor, overrideAccess: false,
      data: { excerpt: 'Dos transacciones comparten la misma imagen' } }).then(doc => { finished = true; return doc; });
    // Even zero grace must not let cleanup remove a copy belonging to an open transaction.
    cleaner = cleanupLoggedOrphans(payload, Date.now() + 86400_000);
    await waitForBlocked();
    assert.equal(finished, false, 'S3 completion must not release the lock before COMMIT');
    await payload.db.commitTransaction(tx); committed = true;
    await Promise.all([second, cleaner]);
    const live = await payload.findByID({ collection: 'media', id: image.id, overrideAccess: true });
    assert.equal(live.publicKey, pending.publicKey, 'the waiting transaction reuses the committed copy');
    assert.equal(live.publishedUses, 1);
    assert.equal((await fetch(live.publicURL)).status, 200, 'reconciler preserves the in-flight copy');
    const ops = await payload.find({ collection: 'public-media-ops', overrideAccess: true, pagination: false,
      where: { and: [{ mediaId: { equals: image.id } }, { kind: { equals: 'create' } }, { status: { equals: 'applied' } }] } });
    assert.equal(ops.docs.length, 1, 'one live public copy, no competing creation');
    console.log('PASS: PostgreSQL image lock blocks competing content update and orphan cleanup until outer COMMIT; one live copy');
  } finally {
    if (!committed) await payload.db.rollbackTransaction(tx);
    await Promise.allSettled([second, cleaner].filter(Boolean));
  }
}
