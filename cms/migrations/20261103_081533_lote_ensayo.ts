import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Lote de la carga de ensayo (ensayo/definitivo) en noticias, contenidos municipales, imágenes y autores; agenda
// general en noticias; estado previo de los espacios activados para el ensayo. down se niega si queda ensayo
// cargado: sin la marca ya no se podría retirar (npm run cms:ensayo:retirar).

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_media_lote" AS ENUM('ensayo', 'definitivo');
  CREATE TYPE "public"."enum_articles_lote" AS ENUM('ensayo', 'definitivo');
  CREATE TYPE "public"."enum__articles_v_version_lote" AS ENUM('ensayo', 'definitivo');
  CREATE TYPE "public"."enum_authors_lote" AS ENUM('ensayo', 'definitivo');
  CREATE TYPE "public"."enum_municipal_content_lote" AS ENUM('ensayo', 'definitivo');
  CREATE TYPE "public"."enum__municipal_content_v_version_lote" AS ENUM('ensayo', 'definitivo');
  ALTER TABLE "media" ADD COLUMN "lote" "enum_media_lote";
  ALTER TABLE "articles" ADD COLUMN "agenda_event_at" varchar;
  ALTER TABLE "articles" ADD COLUMN "agenda_place" varchar;
  ALTER TABLE "articles" ADD COLUMN "lote" "enum_articles_lote";
  ALTER TABLE "_articles_v" ADD COLUMN "version_agenda_event_at" varchar;
  ALTER TABLE "_articles_v" ADD COLUMN "version_agenda_place" varchar;
  ALTER TABLE "_articles_v" ADD COLUMN "version_lote" "enum__articles_v_version_lote";
  ALTER TABLE "authors" ADD COLUMN "lote" "enum_authors_lote";
  ALTER TABLE "municipal_spaces" ADD COLUMN "ensayo_previo" jsonb;
  ALTER TABLE "_municipal_spaces_v" ADD COLUMN "version_ensayo_previo" jsonb;
  ALTER TABLE "municipal_content" ADD COLUMN "lote" "enum_municipal_content_lote";
  ALTER TABLE "_municipal_content_v" ADD COLUMN "version_lote" "enum__municipal_content_v_version_lote";
  CREATE INDEX "media_lote_idx" ON "media" USING btree ("lote");
  CREATE INDEX "articles_lote_idx" ON "articles" USING btree ("lote");
  CREATE INDEX "_articles_v_version_version_lote_idx" ON "_articles_v" USING btree ("version_lote");
  CREATE INDEX "authors_lote_idx" ON "authors" USING btree ("lote");
  CREATE INDEX "municipal_content_lote_idx" ON "municipal_content" USING btree ("lote");
  CREATE INDEX "_municipal_content_v_version_version_lote_idx" ON "_municipal_content_v" USING btree ("version_lote");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const loaded = (await db.execute(sql`SELECT (SELECT count(*) FROM articles WHERE lote = 'ensayo') + (SELECT count(*) FROM municipal_content WHERE lote = 'ensayo')
    + (SELECT count(*) FROM media WHERE lote = 'ensayo') + (SELECT count(*) FROM authors WHERE lote = 'ensayo')
    + (SELECT count(*) FROM municipal_spaces WHERE ensayo_previo IS NOT NULL) AS n`)).rows[0] as { n: number | string }
  if (Number(loaded.n) > 0) throw new Error('Hay contenido de la carga de ensayo: retíralo (npm run cms:ensayo:retirar) antes de deshacer esta migración')
  await db.execute(sql`
   DROP INDEX "media_lote_idx";
  DROP INDEX "articles_lote_idx";
  DROP INDEX "_articles_v_version_version_lote_idx";
  DROP INDEX "authors_lote_idx";
  DROP INDEX "municipal_content_lote_idx";
  DROP INDEX "_municipal_content_v_version_version_lote_idx";
  ALTER TABLE "media" DROP COLUMN "lote";
  ALTER TABLE "articles" DROP COLUMN "agenda_event_at";
  ALTER TABLE "articles" DROP COLUMN "agenda_place";
  ALTER TABLE "articles" DROP COLUMN "lote";
  ALTER TABLE "_articles_v" DROP COLUMN "version_agenda_event_at";
  ALTER TABLE "_articles_v" DROP COLUMN "version_agenda_place";
  ALTER TABLE "_articles_v" DROP COLUMN "version_lote";
  ALTER TABLE "authors" DROP COLUMN "lote";
  ALTER TABLE "municipal_spaces" DROP COLUMN "ensayo_previo";
  ALTER TABLE "_municipal_spaces_v" DROP COLUMN "version_ensayo_previo";
  ALTER TABLE "municipal_content" DROP COLUMN "lote";
  ALTER TABLE "_municipal_content_v" DROP COLUMN "version_lote";
  DROP TYPE "public"."enum_media_lote";
  DROP TYPE "public"."enum_articles_lote";
  DROP TYPE "public"."enum__articles_v_version_lote";
  DROP TYPE "public"."enum_authors_lote";
  DROP TYPE "public"."enum_municipal_content_lote";
  DROP TYPE "public"."enum__municipal_content_v_version_lote";`)
}
