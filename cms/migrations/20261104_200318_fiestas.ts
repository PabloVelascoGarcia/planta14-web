import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Fiestas de las Cuencas: colección «festivals» (con versiones y borradores) y relación Pendientes → Fiesta.

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_festivals_origin" AS ENUM('redaccion', 'publico');
  CREATE TYPE "public"."enum_festivals_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__festivals_v_version_origin" AS ENUM('redaccion', 'publico');
  CREATE TYPE "public"."enum__festivals_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "festivals" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"village" varchar,
  	"town_id" integer,
  	"start_date" timestamp(3) with time zone,
  	"end_date" timestamp(3) with time zone,
  	"program" jsonb,
  	"image_id" integer,
  	"chronicle_id" integer,
  	"recurring" boolean DEFAULT true,
  	"organizer" varchar,
  	"contact" varchar,
  	"origin" "enum_festivals_origin" DEFAULT 'redaccion',
  	"submission_name" varchar,
  	"submission_email" varchar,
  	"submission_confirmed" boolean DEFAULT false,
  	"submission_confirmed_at" timestamp(3) with time zone,
  	"submission_token_hash" varchar,
  	"submission_token_expires_at" timestamp(3) with time zone,
  	"slug" varchar,
  	"start_day" varchar,
  	"end_day" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_festivals_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_festivals_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_name" varchar,
  	"version_village" varchar,
  	"version_town_id" integer,
  	"version_start_date" timestamp(3) with time zone,
  	"version_end_date" timestamp(3) with time zone,
  	"version_program" jsonb,
  	"version_image_id" integer,
  	"version_chronicle_id" integer,
  	"version_recurring" boolean DEFAULT true,
  	"version_organizer" varchar,
  	"version_contact" varchar,
  	"version_origin" "enum__festivals_v_version_origin" DEFAULT 'redaccion',
  	"version_submission_name" varchar,
  	"version_submission_email" varchar,
  	"version_submission_confirmed" boolean DEFAULT false,
  	"version_submission_confirmed_at" timestamp(3) with time zone,
  	"version_submission_token_hash" varchar,
  	"version_submission_token_expires_at" timestamp(3) with time zone,
  	"version_slug" varchar,
  	"version_start_day" varchar,
  	"version_end_day" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__festivals_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  ALTER TABLE "notifications" ADD COLUMN "festival_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "festivals_id" integer;
  ALTER TABLE "festivals" ADD CONSTRAINT "festivals_town_id_towns_id_fk" FOREIGN KEY ("town_id") REFERENCES "public"."towns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "festivals" ADD CONSTRAINT "festivals_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "festivals" ADD CONSTRAINT "festivals_chronicle_id_articles_id_fk" FOREIGN KEY ("chronicle_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_festivals_v" ADD CONSTRAINT "_festivals_v_parent_id_festivals_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."festivals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_festivals_v" ADD CONSTRAINT "_festivals_v_version_town_id_towns_id_fk" FOREIGN KEY ("version_town_id") REFERENCES "public"."towns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_festivals_v" ADD CONSTRAINT "_festivals_v_version_image_id_media_id_fk" FOREIGN KEY ("version_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_festivals_v" ADD CONSTRAINT "_festivals_v_version_chronicle_id_articles_id_fk" FOREIGN KEY ("version_chronicle_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "festivals_town_idx" ON "festivals" USING btree ("town_id");
  CREATE INDEX "festivals_image_idx" ON "festivals" USING btree ("image_id");
  CREATE INDEX "festivals_chronicle_idx" ON "festivals" USING btree ("chronicle_id");
  CREATE INDEX "festivals_submission_submission_confirmed_idx" ON "festivals" USING btree ("submission_confirmed");
  CREATE INDEX "festivals_submission_submission_token_hash_idx" ON "festivals" USING btree ("submission_token_hash");
  CREATE UNIQUE INDEX "festivals_slug_idx" ON "festivals" USING btree ("slug");
  CREATE INDEX "festivals_start_day_idx" ON "festivals" USING btree ("start_day");
  CREATE INDEX "festivals_end_day_idx" ON "festivals" USING btree ("end_day");
  CREATE INDEX "festivals_updated_at_idx" ON "festivals" USING btree ("updated_at");
  CREATE INDEX "festivals_created_at_idx" ON "festivals" USING btree ("created_at");
  CREATE INDEX "festivals__status_idx" ON "festivals" USING btree ("_status");
  CREATE INDEX "_festivals_v_parent_idx" ON "_festivals_v" USING btree ("parent_id");
  CREATE INDEX "_festivals_v_version_version_town_idx" ON "_festivals_v" USING btree ("version_town_id");
  CREATE INDEX "_festivals_v_version_version_image_idx" ON "_festivals_v" USING btree ("version_image_id");
  CREATE INDEX "_festivals_v_version_version_chronicle_idx" ON "_festivals_v" USING btree ("version_chronicle_id");
  CREATE INDEX "_festivals_v_version_submission_version_submission_confi_idx" ON "_festivals_v" USING btree ("version_submission_confirmed");
  CREATE INDEX "_festivals_v_version_submission_version_submission_token_idx" ON "_festivals_v" USING btree ("version_submission_token_hash");
  CREATE INDEX "_festivals_v_version_version_slug_idx" ON "_festivals_v" USING btree ("version_slug");
  CREATE INDEX "_festivals_v_version_version_start_day_idx" ON "_festivals_v" USING btree ("version_start_day");
  CREATE INDEX "_festivals_v_version_version_end_day_idx" ON "_festivals_v" USING btree ("version_end_day");
  CREATE INDEX "_festivals_v_version_version_updated_at_idx" ON "_festivals_v" USING btree ("version_updated_at");
  CREATE INDEX "_festivals_v_version_version_created_at_idx" ON "_festivals_v" USING btree ("version_created_at");
  CREATE INDEX "_festivals_v_version_version__status_idx" ON "_festivals_v" USING btree ("version__status");
  CREATE INDEX "_festivals_v_created_at_idx" ON "_festivals_v" USING btree ("created_at");
  CREATE INDEX "_festivals_v_updated_at_idx" ON "_festivals_v" USING btree ("updated_at");
  CREATE INDEX "_festivals_v_latest_idx" ON "_festivals_v" USING btree ("latest");
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_festival_id_festivals_id_fk" FOREIGN KEY ("festival_id") REFERENCES "public"."festivals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_festivals_fk" FOREIGN KEY ("festivals_id") REFERENCES "public"."festivals"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "notifications_festival_idx" ON "notifications" USING btree ("festival_id");
  CREATE INDEX "payload_locked_documents_rels_festivals_id_idx" ON "payload_locked_documents_rels" USING btree ("festivals_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "festivals" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_festivals_v" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "festivals" CASCADE;
  DROP TABLE "_festivals_v" CASCADE;
  ALTER TABLE "notifications" DROP CONSTRAINT "notifications_festival_id_festivals_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_festivals_fk";
  
  DROP INDEX "notifications_festival_idx";
  DROP INDEX "payload_locked_documents_rels_festivals_id_idx";
  ALTER TABLE "notifications" DROP COLUMN "festival_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "festivals_id";
  DROP TYPE "public"."enum_festivals_origin";
  DROP TYPE "public"."enum_festivals_status";
  DROP TYPE "public"."enum__festivals_v_version_origin";
  DROP TYPE "public"."enum__festivals_v_version_status";`)
}
