import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Suscriptores del boletín (doble confirmación por correo; solo administración).

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_subscribers_topics" AS ENUM('finde', 'avisos');
  CREATE TYPE "public"."enum_subscribers_pending_topics" AS ENUM('finde', 'avisos');
  CREATE TYPE "public"."enum_subscribers_status" AS ENUM('pendiente', 'confirmado', 'baja');
  CREATE TABLE "subscribers_topics" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_subscribers_topics",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "subscribers_pending_topics" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_subscribers_pending_topics",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "subscribers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"status" "enum_subscribers_status" DEFAULT 'pendiente' NOT NULL,
  	"source" varchar,
  	"consent_text" varchar,
  	"consent_accepted_at" timestamp(3) with time zone,
  	"confirmed_at" timestamp(3) with time zone,
  	"unsubscribed_at" timestamp(3) with time zone,
  	"pending_source" varchar,
  	"pending_token_hash" varchar,
  	"pending_expires_at" timestamp(3) with time zone,
  	"unsubscribe_token" varchar,
  	"last_email_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "subscribers_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"towns_id" integer
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "subscribers_id" integer;
  ALTER TABLE "subscribers_topics" ADD CONSTRAINT "subscribers_topics_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."subscribers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "subscribers_pending_topics" ADD CONSTRAINT "subscribers_pending_topics_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."subscribers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "subscribers_rels" ADD CONSTRAINT "subscribers_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."subscribers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "subscribers_rels" ADD CONSTRAINT "subscribers_rels_towns_fk" FOREIGN KEY ("towns_id") REFERENCES "public"."towns"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "subscribers_topics_order_idx" ON "subscribers_topics" USING btree ("order");
  CREATE INDEX "subscribers_topics_parent_idx" ON "subscribers_topics" USING btree ("parent_id");
  CREATE INDEX "subscribers_pending_topics_order_idx" ON "subscribers_pending_topics" USING btree ("order");
  CREATE INDEX "subscribers_pending_topics_parent_idx" ON "subscribers_pending_topics" USING btree ("parent_id");
  CREATE UNIQUE INDEX "subscribers_email_idx" ON "subscribers" USING btree ("email");
  CREATE INDEX "subscribers_status_idx" ON "subscribers" USING btree ("status");
  CREATE INDEX "subscribers_pending_pending_token_hash_idx" ON "subscribers" USING btree ("pending_token_hash");
  CREATE UNIQUE INDEX "subscribers_unsubscribe_token_idx" ON "subscribers" USING btree ("unsubscribe_token");
  CREATE INDEX "subscribers_updated_at_idx" ON "subscribers" USING btree ("updated_at");
  CREATE INDEX "subscribers_created_at_idx" ON "subscribers" USING btree ("created_at");
  CREATE INDEX "subscribers_rels_order_idx" ON "subscribers_rels" USING btree ("order");
  CREATE INDEX "subscribers_rels_parent_idx" ON "subscribers_rels" USING btree ("parent_id");
  CREATE INDEX "subscribers_rels_path_idx" ON "subscribers_rels" USING btree ("path");
  CREATE INDEX "subscribers_rels_towns_id_idx" ON "subscribers_rels" USING btree ("towns_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_subscribers_fk" FOREIGN KEY ("subscribers_id") REFERENCES "public"."subscribers"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_subscribers_id_idx" ON "payload_locked_documents_rels" USING btree ("subscribers_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "subscribers_topics" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "subscribers_pending_topics" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "subscribers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "subscribers_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "subscribers_topics" CASCADE;
  DROP TABLE "subscribers_pending_topics" CASCADE;
  DROP TABLE "subscribers" CASCADE;
  DROP TABLE "subscribers_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_subscribers_fk";
  
  DROP INDEX "payload_locked_documents_rels_subscribers_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "subscribers_id";
  DROP TYPE "public"."enum_subscribers_topics";
  DROP TYPE "public"."enum_subscribers_pending_topics";
  DROP TYPE "public"."enum_subscribers_status";`)
}
