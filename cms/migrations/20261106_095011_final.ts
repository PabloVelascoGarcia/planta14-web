import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Encargo final: boletines (envío desde el CMS), fecha de comprobación de los servicios municipales y, en las fiestas, el estado «Por regla» con la fuente y la fecha de consulta de la fecha.

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_newsletters_status" AS ENUM('borrador', 'enviando', 'enviado', 'interrumpido');
  ALTER TYPE "public"."enum_festivals_date_status" ADD VALUE 'por-regla' BEFORE 'pendiente';
  ALTER TYPE "public"."enum__festivals_v_version_date_status" ADD VALUE 'por-regla' BEFORE 'pendiente';
  CREATE TABLE "newsletters" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"subject" varchar NOT NULL,
  	"intro" varchar,
  	"status" "enum_newsletters_status" DEFAULT 'borrador',
  	"test_sent_at" timestamp(3) with time zone,
  	"started_at" timestamp(3) with time zone,
  	"finished_at" timestamp(3) with time zone,
  	"sent_by_id" integer,
  	"stats_sent" numeric DEFAULT 0,
  	"stats_failed" numeric DEFAULT 0,
  	"stats_unsubscribed" numeric DEFAULT 0,
  	"stats_skipped" numeric DEFAULT 0,
  	"log" varchar,
  	"sent_to" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "newsletters_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"articles_id" integer
  );
  
  ALTER TABLE "festivals" ADD COLUMN "date_source" varchar;
  ALTER TABLE "festivals" ADD COLUMN "date_checked_at" varchar;
  ALTER TABLE "_festivals_v" ADD COLUMN "version_date_source" varchar;
  ALTER TABLE "_festivals_v" ADD COLUMN "version_date_checked_at" varchar;
  ALTER TABLE "municipal_services" ADD COLUMN "checked_at" varchar;
  ALTER TABLE "newsletters" ADD COLUMN "content_changed_at" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "newsletters_id" integer;
  ALTER TABLE "newsletters" ADD CONSTRAINT "newsletters_sent_by_id_users_id_fk" FOREIGN KEY ("sent_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "newsletters_rels" ADD CONSTRAINT "newsletters_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_rels" ADD CONSTRAINT "newsletters_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "newsletters_sent_by_idx" ON "newsletters" USING btree ("sent_by_id");
  CREATE INDEX "newsletters_updated_at_idx" ON "newsletters" USING btree ("updated_at");
  CREATE INDEX "newsletters_created_at_idx" ON "newsletters" USING btree ("created_at");
  CREATE INDEX "newsletters_rels_order_idx" ON "newsletters_rels" USING btree ("order");
  CREATE INDEX "newsletters_rels_parent_idx" ON "newsletters_rels" USING btree ("parent_id");
  CREATE INDEX "newsletters_rels_path_idx" ON "newsletters_rels" USING btree ("path");
  CREATE INDEX "newsletters_rels_articles_id_idx" ON "newsletters_rels" USING btree ("articles_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_newsletters_fk" FOREIGN KEY ("newsletters_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_newsletters_id_idx" ON "payload_locked_documents_rels" USING btree ("newsletters_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "newsletters" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "newsletters_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "newsletters" CASCADE;
  DROP TABLE "newsletters_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_newsletters_fk";
  
  ALTER TABLE "festivals" ALTER COLUMN "date_status" SET DATA TYPE text;
  UPDATE "festivals" SET "date_status" = 'pendiente' WHERE "date_status" = 'por-regla';
  ALTER TABLE "festivals" ALTER COLUMN "date_status" SET DEFAULT 'confirmada'::text;
  DROP TYPE "public"."enum_festivals_date_status";
  CREATE TYPE "public"."enum_festivals_date_status" AS ENUM('confirmada', 'pendiente', 'orientativa');
  ALTER TABLE "festivals" ALTER COLUMN "date_status" SET DEFAULT 'confirmada'::"public"."enum_festivals_date_status";
  ALTER TABLE "festivals" ALTER COLUMN "date_status" SET DATA TYPE "public"."enum_festivals_date_status" USING "date_status"::"public"."enum_festivals_date_status";
  ALTER TABLE "_festivals_v" ALTER COLUMN "version_date_status" SET DATA TYPE text;
  UPDATE "_festivals_v" SET "version_date_status" = 'pendiente' WHERE "version_date_status" = 'por-regla';
  ALTER TABLE "_festivals_v" ALTER COLUMN "version_date_status" SET DEFAULT 'confirmada'::text;
  DROP TYPE "public"."enum__festivals_v_version_date_status";
  CREATE TYPE "public"."enum__festivals_v_version_date_status" AS ENUM('confirmada', 'pendiente', 'orientativa');
  ALTER TABLE "_festivals_v" ALTER COLUMN "version_date_status" SET DEFAULT 'confirmada'::"public"."enum__festivals_v_version_date_status";
  ALTER TABLE "_festivals_v" ALTER COLUMN "version_date_status" SET DATA TYPE "public"."enum__festivals_v_version_date_status" USING "version_date_status"::"public"."enum__festivals_v_version_date_status";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_newsletters_id_idx";
  ALTER TABLE "festivals" DROP COLUMN "date_source";
  ALTER TABLE "festivals" DROP COLUMN "date_checked_at";
  ALTER TABLE "_festivals_v" DROP COLUMN "version_date_source";
  ALTER TABLE "_festivals_v" DROP COLUMN "version_date_checked_at";
  ALTER TABLE "municipal_services" DROP COLUMN "checked_at";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "newsletters_id";
  DROP TYPE "public"."enum_newsletters_status";`)
}
