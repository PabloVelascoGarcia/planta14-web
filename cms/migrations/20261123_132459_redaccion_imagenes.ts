import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Redacción (24/11): varios concejos y secciones por noticia, etiquetas, imágenes en el texto y galerías, carteles,
// plantillas, tipo de imagen (IA) y otros concejos en las estadísticas.
// - El concejo y la sección que ya tenía cada noticia pasan a ser el principal SIN mover datos: siguen en las mismas
//   columnas (articles.town_id y articles.section_id). «Otros concejos», «secciones secundarias» y «etiquetas» van en la
//   tabla nueva articles_rels (y _articles_v_rels para las versiones), vacía al empezar: no se pierde nada.
// - stats_daily.extra_towns: otros concejos de la noticia vista («,lena,aller,»), para que cuente en las estadísticas
//   de cada uno sin duplicar el total.
// Vuelta atrás (down): borra lo nuevo (otros concejos, secciones secundarias, etiquetas, tipo de imagen…); el concejo y
// la sección principales no se tocan.

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_media_image_kind" AS ENUM('foto', 'grafico', 'ia');
  CREATE TYPE "public"."enum_articles_template" AS ENUM('none', 'sucesos', 'economia', 'empresas', 'politica', 'sociedad', 'deportes', 'cultura', 'patrimonio', 'opinion', 'agenda', 'formacion', 'ayudas', 'empleo', 'fiestas');
  CREATE TYPE "public"."enum__articles_v_version_template" AS ENUM('none', 'sucesos', 'economia', 'empresas', 'politica', 'sociedad', 'deportes', 'cultura', 'patrimonio', 'opinion', 'agenda', 'formacion', 'ayudas', 'empleo', 'fiestas');
  CREATE TABLE "articles_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"towns_id" integer,
  	"sections_id" integer,
  	"tags_id" integer,
  	"media_id" integer
  );
  
  CREATE TABLE "_articles_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"towns_id" integer,
  	"sections_id" integer,
  	"tags_id" integer,
  	"media_id" integer
  );
  
  CREATE TABLE "tags" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "media" ADD COLUMN "image_kind" "enum_media_image_kind" DEFAULT 'foto';
  ALTER TABLE "articles" ADD COLUMN "image_poster" boolean;
  ALTER TABLE "articles" ADD COLUMN "template" "enum_articles_template" DEFAULT 'none';
  ALTER TABLE "articles" ADD COLUMN "has_gallery" boolean DEFAULT false;
  ALTER TABLE "_articles_v" ADD COLUMN "version_image_poster" boolean;
  ALTER TABLE "_articles_v" ADD COLUMN "version_template" "enum__articles_v_version_template" DEFAULT 'none';
  ALTER TABLE "_articles_v" ADD COLUMN "version_has_gallery" boolean DEFAULT false;
  ALTER TABLE "festivals" ADD COLUMN "image_poster" boolean DEFAULT true;
  ALTER TABLE "_festivals_v" ADD COLUMN "version_image_poster" boolean DEFAULT true;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "tags_id" integer;
  ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_towns_fk" FOREIGN KEY ("towns_id") REFERENCES "public"."towns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_sections_fk" FOREIGN KEY ("sections_id") REFERENCES "public"."sections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_rels" ADD CONSTRAINT "_articles_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_rels" ADD CONSTRAINT "_articles_v_rels_towns_fk" FOREIGN KEY ("towns_id") REFERENCES "public"."towns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_rels" ADD CONSTRAINT "_articles_v_rels_sections_fk" FOREIGN KEY ("sections_id") REFERENCES "public"."sections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_rels" ADD CONSTRAINT "_articles_v_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_rels" ADD CONSTRAINT "_articles_v_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "articles_rels_order_idx" ON "articles_rels" USING btree ("order");
  CREATE INDEX "articles_rels_parent_idx" ON "articles_rels" USING btree ("parent_id");
  CREATE INDEX "articles_rels_path_idx" ON "articles_rels" USING btree ("path");
  CREATE INDEX "articles_rels_towns_id_idx" ON "articles_rels" USING btree ("towns_id");
  CREATE INDEX "articles_rels_sections_id_idx" ON "articles_rels" USING btree ("sections_id");
  CREATE INDEX "articles_rels_tags_id_idx" ON "articles_rels" USING btree ("tags_id");
  CREATE INDEX "articles_rels_media_id_idx" ON "articles_rels" USING btree ("media_id");
  CREATE INDEX "_articles_v_rels_order_idx" ON "_articles_v_rels" USING btree ("order");
  CREATE INDEX "_articles_v_rels_parent_idx" ON "_articles_v_rels" USING btree ("parent_id");
  CREATE INDEX "_articles_v_rels_path_idx" ON "_articles_v_rels" USING btree ("path");
  CREATE INDEX "_articles_v_rels_towns_id_idx" ON "_articles_v_rels" USING btree ("towns_id");
  CREATE INDEX "_articles_v_rels_sections_id_idx" ON "_articles_v_rels" USING btree ("sections_id");
  CREATE INDEX "_articles_v_rels_tags_id_idx" ON "_articles_v_rels" USING btree ("tags_id");
  CREATE INDEX "_articles_v_rels_media_id_idx" ON "_articles_v_rels" USING btree ("media_id");
  CREATE UNIQUE INDEX "tags_slug_idx" ON "tags" USING btree ("slug");
  CREATE INDEX "tags_updated_at_idx" ON "tags" USING btree ("updated_at");
  CREATE INDEX "tags_created_at_idx" ON "tags" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "articles_has_gallery_idx" ON "articles" USING btree ("has_gallery");
  CREATE INDEX "_articles_v_version_version_has_gallery_idx" ON "_articles_v" USING btree ("version_has_gallery");
  CREATE INDEX "payload_locked_documents_rels_tags_id_idx" ON "payload_locked_documents_rels" USING btree ("tags_id");
  ALTER TABLE "stats_daily" ADD COLUMN IF NOT EXISTS "extra_towns" varchar(300) NOT NULL DEFAULT '';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "stats_daily" DROP COLUMN IF EXISTS "extra_towns";
  ALTER TABLE "articles_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_articles_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tags" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "articles_rels" CASCADE;
  DROP TABLE "_articles_v_rels" CASCADE;
  DROP TABLE "tags" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_tags_fk";
  
  DROP INDEX "articles_has_gallery_idx";
  DROP INDEX "_articles_v_version_version_has_gallery_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_tags_id_idx";
  ALTER TABLE "media" DROP COLUMN "image_kind";
  ALTER TABLE "articles" DROP COLUMN "image_poster";
  ALTER TABLE "articles" DROP COLUMN "template";
  ALTER TABLE "articles" DROP COLUMN "has_gallery";
  ALTER TABLE "_articles_v" DROP COLUMN "version_image_poster";
  ALTER TABLE "_articles_v" DROP COLUMN "version_template";
  ALTER TABLE "_articles_v" DROP COLUMN "version_has_gallery";
  ALTER TABLE "festivals" DROP COLUMN "image_poster";
  ALTER TABLE "_festivals_v" DROP COLUMN "version_image_poster";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "tags_id";
  DROP TYPE "public"."enum_media_image_kind";
  DROP TYPE "public"."enum_articles_template";
  DROP TYPE "public"."enum__articles_v_version_template";`)
}
