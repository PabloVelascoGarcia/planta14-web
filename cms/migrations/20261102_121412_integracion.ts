import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   -- The operations log is durable on purpose: "down" keeps it, so after a SQL rollback or downgrade
  -- cms:media:sync-public can still find and delete public objects that no record references any more.
  DO $$ BEGIN
    IF to_regtype('public.enum_public_media_ops_kind') IS NULL THEN CREATE TYPE "public"."enum_public_media_ops_kind" AS ENUM('create', 'delete'); END IF;
    IF to_regtype('public.enum_public_media_ops_status') IS NULL THEN CREATE TYPE "public"."enum_public_media_ops_status" AS ENUM('pending', 'applied', 'failed', 'cleaned'); END IF;
    IF to_regtype('public.enum_public_media_ops_purge') IS NULL THEN CREATE TYPE "public"."enum_public_media_ops_purge" AS ENUM('none', 'disabled', 'sent', 'failed'); END IF;
  END $$;
  CREATE TABLE IF NOT EXISTS "public_media_ops" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"kind" "enum_public_media_ops_kind" NOT NULL,
  	"media_id" numeric NOT NULL,
  	"bucket" varchar NOT NULL,
  	"key_prefix" varchar NOT NULL,
  	"objects" jsonb NOT NULL,
  	"status" "enum_public_media_ops_status" DEFAULT 'pending' NOT NULL,
  	"purge" "enum_public_media_ops_purge",
  	"error" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "media" ADD COLUMN "public_bucket" varchar;
  ALTER TABLE "media" ADD COLUMN "rights_declaration_declared" boolean DEFAULT false;
  ALTER TABLE "media" ADD COLUMN "rights_declaration_statement" varchar;
  ALTER TABLE "media" ADD COLUMN "rights_declaration_declared_by_id" integer;
  ALTER TABLE "media" ADD COLUMN "rights_declaration_declared_at" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "public_media_ops_id" integer;
  CREATE INDEX IF NOT EXISTS "public_media_ops_media_id_idx" ON "public_media_ops" USING btree ("media_id");
  CREATE INDEX IF NOT EXISTS "public_media_ops_key_prefix_idx" ON "public_media_ops" USING btree ("key_prefix");
  CREATE INDEX IF NOT EXISTS "public_media_ops_status_idx" ON "public_media_ops" USING btree ("status");
  CREATE INDEX IF NOT EXISTS "public_media_ops_updated_at_idx" ON "public_media_ops" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "public_media_ops_created_at_idx" ON "public_media_ops" USING btree ("created_at");
  ALTER TABLE "media" ADD CONSTRAINT "media_rights_declaration_declared_by_id_users_id_fk" FOREIGN KEY ("rights_declaration_declared_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_public_media_ops_fk" FOREIGN KEY ("public_media_ops_id") REFERENCES "public"."public_media_ops"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "media_rights_declaration_rights_declaration_declared_by_idx" ON "media" USING btree ("rights_declaration_declared_by_id");
  CREATE INDEX "payload_locked_documents_rels_public_media_ops_id_idx" ON "payload_locked_documents_rels" USING btree ("public_media_ops_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Rights declarations are evidence (who declared what, and when): never discarded implicitly.
  await db.execute(sql`DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM media WHERE rights_declaration_declared) THEN
      RAISE EXCEPTION 'Hay declaraciones de derechos de imágenes municipales: expórtalas antes de revertir esta migración';
    END IF;
  END $$;`)
  // public_media_ops and its types are kept (durable log; see up).
  await db.execute(sql`
  ALTER TABLE "media" DROP CONSTRAINT "media_rights_declaration_declared_by_id_users_id_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_public_media_ops_fk";
  DROP INDEX "media_rights_declaration_rights_declaration_declared_by_idx";
  DROP INDEX "payload_locked_documents_rels_public_media_ops_id_idx";
  ALTER TABLE "media" DROP COLUMN "public_bucket";
  ALTER TABLE "media" DROP COLUMN "rights_declaration_declared";
  ALTER TABLE "media" DROP COLUMN "rights_declaration_statement";
  ALTER TABLE "media" DROP COLUMN "rights_declaration_declared_by_id";
  ALTER TABLE "media" DROP COLUMN "rights_declaration_declared_at";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "public_media_ops_id";`)
}
