import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" ADD COLUMN "show_in_town" boolean DEFAULT true;
  ALTER TABLE "_articles_v" ADD COLUMN "version_show_in_town" boolean DEFAULT true;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" DROP COLUMN "show_in_town";
  ALTER TABLE "_articles_v" DROP COLUMN "version_show_in_town";`)
}
