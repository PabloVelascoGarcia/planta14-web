import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Fiestas: aviso «Se ha despublicado sola…» cuando una fiesta publicada pasa a fecha pendiente u orientativa.

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "festivals" ADD COLUMN "unpublished_notice" varchar;
  ALTER TABLE "_festivals_v" ADD COLUMN "version_unpublished_notice" varchar;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "festivals" DROP COLUMN "unpublished_notice";
  ALTER TABLE "_festivals_v" DROP COLUMN "version_unpublished_notice";`)
}
