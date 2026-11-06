import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Preferencia de la redacción: recibir o no por correo las publicaciones nuevas de los ayuntamientos de sus concejos (por defecto, sí).

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ADD COLUMN "notify_municipal_publications" boolean DEFAULT true;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" DROP COLUMN IF EXISTS "notify_municipal_publications";`)
}
