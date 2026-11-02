import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_notifications_kind" AS ENUM('municipal-publication');
  CREATE TYPE "public"."enum_notifications_email_status" AS ENUM('disabled', 'sent', 'failed');
  CREATE TYPE "public"."enum_audit_log_action" AS ENUM('create', 'update', 'publish', 'unpublish', 'withdraw', 'reinstate', 'delete');
  ALTER TYPE "public"."enum_users_role" RENAME TO "enum_users_role_bloque2";
  CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'editor', 'municipal');
  ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
  ALTER TABLE "users" ALTER COLUMN "role" TYPE "public"."enum_users_role" USING "role"::text::"public"."enum_users_role";
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'editor'::"public"."enum_users_role";
  DROP TYPE "public"."enum_users_role_bloque2";
  CREATE TABLE "notifications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"kind" "enum_notifications_kind" DEFAULT 'municipal-publication' NOT NULL,
  	"content_id" integer,
  	"space_id" integer,
  	"title" varchar NOT NULL,
  	"published_by_id" integer,
  	"email_status" "enum_notifications_email_status" DEFAULT 'disabled' NOT NULL,
  	"reviewed" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "audit_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"action" "enum_audit_log_action" NOT NULL,
  	"target_collection" varchar NOT NULL,
  	"document_i_d" varchar NOT NULL,
  	"title" varchar,
  	"summary" varchar,
  	"space_id" integer,
  	"user_id" integer,
  	"user_email" varchar,
  	"user_role" varchar,
  	"reason" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users" ADD COLUMN "municipal_space_id" integer;
  ALTER TABLE "media" ADD COLUMN "uploaded_by_space_id" integer;
  ALTER TABLE "media" ADD COLUMN "published_uses" numeric DEFAULT 0;
  ALTER TABLE "media" ADD COLUMN "public_key" varchar;
  ALTER TABLE "municipal_content" ADD COLUMN "withdrawal_withdrawn" boolean DEFAULT false;
  ALTER TABLE "municipal_content" ADD COLUMN "withdrawal_reason" varchar;
  ALTER TABLE "municipal_content" ADD COLUMN "withdrawal_withdrawn_at" timestamp(3) with time zone;
  ALTER TABLE "municipal_content" ADD COLUMN "withdrawal_withdrawn_by_id" integer;
  ALTER TABLE "_municipal_content_v" ADD COLUMN "version_withdrawal_withdrawn" boolean DEFAULT false;
  ALTER TABLE "_municipal_content_v" ADD COLUMN "version_withdrawal_reason" varchar;
  ALTER TABLE "_municipal_content_v" ADD COLUMN "version_withdrawal_withdrawn_at" timestamp(3) with time zone;
  ALTER TABLE "_municipal_content_v" ADD COLUMN "version_withdrawal_withdrawn_by_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "notifications_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "audit_log_id" integer;
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_content_id_municipal_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."municipal_content"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_space_id_municipal_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."municipal_spaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_published_by_id_users_id_fk" FOREIGN KEY ("published_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_space_id_municipal_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."municipal_spaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "notifications_content_idx" ON "notifications" USING btree ("content_id");
  CREATE INDEX "notifications_space_idx" ON "notifications" USING btree ("space_id");
  CREATE INDEX "notifications_published_by_idx" ON "notifications" USING btree ("published_by_id");
  CREATE INDEX "notifications_reviewed_idx" ON "notifications" USING btree ("reviewed");
  CREATE INDEX "notifications_updated_at_idx" ON "notifications" USING btree ("updated_at");
  CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");
  CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");
  CREATE INDEX "audit_log_target_collection_idx" ON "audit_log" USING btree ("target_collection");
  CREATE INDEX "audit_log_document_i_d_idx" ON "audit_log" USING btree ("document_i_d");
  CREATE INDEX "audit_log_space_idx" ON "audit_log" USING btree ("space_id");
  CREATE INDEX "audit_log_user_idx" ON "audit_log" USING btree ("user_id");
  CREATE INDEX "audit_log_updated_at_idx" ON "audit_log" USING btree ("updated_at");
  CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");
  ALTER TABLE "users" ADD CONSTRAINT "users_municipal_space_id_municipal_spaces_id_fk" FOREIGN KEY ("municipal_space_id") REFERENCES "public"."municipal_spaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_space_id_municipal_spaces_id_fk" FOREIGN KEY ("uploaded_by_space_id") REFERENCES "public"."municipal_spaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "municipal_content" ADD CONSTRAINT "municipal_content_withdrawal_withdrawn_by_id_users_id_fk" FOREIGN KEY ("withdrawal_withdrawn_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_municipal_content_v" ADD CONSTRAINT "_municipal_content_v_version_withdrawal_withdrawn_by_id_users_id_fk" FOREIGN KEY ("version_withdrawal_withdrawn_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_notifications_fk" FOREIGN KEY ("notifications_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_audit_log_fk" FOREIGN KEY ("audit_log_id") REFERENCES "public"."audit_log"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_municipal_space_idx" ON "users" USING btree ("municipal_space_id");
  CREATE INDEX "media_uploaded_by_space_idx" ON "media" USING btree ("uploaded_by_space_id");
  CREATE INDEX "media_published_uses_idx" ON "media" USING btree ("published_uses");
  CREATE INDEX "municipal_content_withdrawal_withdrawal_withdrawn_idx" ON "municipal_content" USING btree ("withdrawal_withdrawn");
  CREATE INDEX "municipal_content_withdrawal_withdrawal_withdrawn_by_idx" ON "municipal_content" USING btree ("withdrawal_withdrawn_by_id");
  CREATE INDEX "_municipal_content_v_version_withdrawal_version_withdraw_idx" ON "_municipal_content_v" USING btree ("version_withdrawal_withdrawn");
  CREATE INDEX "_municipal_content_v_version_withdrawal_version_withdr_1_idx" ON "_municipal_content_v" USING btree ("version_withdrawal_withdrawn_by_id");
  CREATE INDEX "payload_locked_documents_rels_notifications_id_idx" ON "payload_locked_documents_rels" USING btree ("notifications_id");
  CREATE INDEX "payload_locked_documents_rels_audit_log_id_idx" ON "payload_locked_documents_rels" USING btree ("audit_log_id");`)
  // Backfill of the indexed counter used by anonymous media reads. Public copies are created afterwards
  // with "npm run cms:media:sync-public" (object storage is not part of a SQL transaction).
  await db.execute(sql`
  UPDATE "media" m SET "published_uses" =
    (SELECT count(*) FROM "articles" a WHERE a."_status"::text = 'published' AND (a."image_id" = m."id" OR a."seo_image_id" = m."id")) +
    (SELECT count(*) FROM "municipal_content" c WHERE c."_status"::text = 'published' AND c."image_id" = m."id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // A downgrade must never turn a municipal account into an editor or leave it without its space.
  await db.execute(sql`DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM users WHERE role::text = 'municipal') THEN
      RAISE EXCEPTION 'Retira las cuentas municipales antes de volver al bloque 2; no se convertirán en editor';
    END IF;
  END $$;`)
  await db.execute(sql`
   ALTER TABLE "notifications" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "audit_log" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "notifications" CASCADE;
  DROP TABLE "audit_log" CASCADE;
  ALTER TABLE "users" DROP CONSTRAINT "users_municipal_space_id_municipal_spaces_id_fk";
  
  ALTER TABLE "media" DROP CONSTRAINT "media_uploaded_by_space_id_municipal_spaces_id_fk";
  
  ALTER TABLE "municipal_content" DROP CONSTRAINT "municipal_content_withdrawal_withdrawn_by_id_users_id_fk";
  
  ALTER TABLE "_municipal_content_v" DROP CONSTRAINT "_municipal_content_v_version_withdrawal_withdrawn_by_id_users_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_notifications_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_audit_log_fk";
  
  ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;
  DROP TYPE "public"."enum_users_role";
  CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'editor');
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'editor'::"public"."enum_users_role";
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."enum_users_role" USING "role"::"public"."enum_users_role";
  DROP INDEX "users_municipal_space_idx";
  DROP INDEX "media_uploaded_by_space_idx";
  DROP INDEX "media_published_uses_idx";
  DROP INDEX "municipal_content_withdrawal_withdrawal_withdrawn_idx";
  DROP INDEX "municipal_content_withdrawal_withdrawal_withdrawn_by_idx";
  DROP INDEX "_municipal_content_v_version_withdrawal_version_withdraw_idx";
  DROP INDEX "_municipal_content_v_version_withdrawal_version_withdr_1_idx";
  DROP INDEX "payload_locked_documents_rels_notifications_id_idx";
  DROP INDEX "payload_locked_documents_rels_audit_log_id_idx";
  ALTER TABLE "users" DROP COLUMN "municipal_space_id";
  ALTER TABLE "media" DROP COLUMN "uploaded_by_space_id";
  ALTER TABLE "media" DROP COLUMN "published_uses";
  ALTER TABLE "media" DROP COLUMN "public_key";
  ALTER TABLE "municipal_content" DROP COLUMN "withdrawal_withdrawn";
  ALTER TABLE "municipal_content" DROP COLUMN "withdrawal_reason";
  ALTER TABLE "municipal_content" DROP COLUMN "withdrawal_withdrawn_at";
  ALTER TABLE "municipal_content" DROP COLUMN "withdrawal_withdrawn_by_id";
  ALTER TABLE "_municipal_content_v" DROP COLUMN "version_withdrawal_withdrawn";
  ALTER TABLE "_municipal_content_v" DROP COLUMN "version_withdrawal_reason";
  ALTER TABLE "_municipal_content_v" DROP COLUMN "version_withdrawal_withdrawn_at";
  ALTER TABLE "_municipal_content_v" DROP COLUMN "version_withdrawal_withdrawn_by_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "notifications_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "audit_log_id";
  DROP TYPE "public"."enum_notifications_kind";
  DROP TYPE "public"."enum_notifications_email_status";
  DROP TYPE "public"."enum_audit_log_action";`)
}
