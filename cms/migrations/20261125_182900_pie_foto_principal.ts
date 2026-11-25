import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// «Pie de foto» de la foto principal de la noticia (opcional). Solo añade una columna vacía a las noticias y a su
// historial de versiones: no cambia ninguna noticia existente. La vuelta atrás quita la columna (y los pies escritos).

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" ADD COLUMN "image_caption" varchar;
  ALTER TABLE "_articles_v" ADD COLUMN "version_image_caption" varchar;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" DROP COLUMN IF EXISTS "image_caption";
  ALTER TABLE "_articles_v" DROP COLUMN IF EXISTS "version_image_caption";`)
}
