import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Cartas de los lectores (DNI y teléfono cifrados) y relación Pendientes → Carta.

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_letters_status" AS ENUM('sin-confirmar', 'pendiente', 'aprobada', 'rechazada');
  ALTER TYPE "public"."enum_notifications_kind" ADD VALUE 'letter-submission';
  CREATE TABLE "letters" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"summary" varchar,
  	"status" "enum_letters_status" DEFAULT 'sin-confirmar' NOT NULL,
  	"rejection_reason" varchar,
  	"title" varchar,
  	"text" varchar NOT NULL,
  	"first_name" varchar NOT NULL,
  	"last_name" varchar NOT NULL,
  	"town_id" integer NOT NULL,
  	"email" varchar NOT NULL,
  	"original_text" varchar,
  	"published_at" timestamp(3) with time zone,
  	"decided_by_id" integer,
  	"decided_at" timestamp(3) with time zone,
  	"personal_data_erased_at" timestamp(3) with time zone,
  	"dni_enc" varchar,
  	"phone_enc" varchar,
  	"person_key" varchar,
  	"token_hash" varchar,
  	"token_expires_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "notifications" ADD COLUMN "letter_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "letters_id" integer;
  ALTER TABLE "letters" ADD CONSTRAINT "letters_town_id_towns_id_fk" FOREIGN KEY ("town_id") REFERENCES "public"."towns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "letters" ADD CONSTRAINT "letters_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "letters_status_idx" ON "letters" USING btree ("status");
  CREATE INDEX "letters_town_idx" ON "letters" USING btree ("town_id");
  CREATE INDEX "letters_decided_by_idx" ON "letters" USING btree ("decided_by_id");
  CREATE INDEX "letters_person_key_idx" ON "letters" USING btree ("person_key");
  CREATE INDEX "letters_token_hash_idx" ON "letters" USING btree ("token_hash");
  CREATE INDEX "letters_updated_at_idx" ON "letters" USING btree ("updated_at");
  CREATE INDEX "letters_created_at_idx" ON "letters" USING btree ("created_at");
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_letter_id_letters_id_fk" FOREIGN KEY ("letter_id") REFERENCES "public"."letters"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_letters_fk" FOREIGN KEY ("letters_id") REFERENCES "public"."letters"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "notifications_letter_idx" ON "notifications" USING btree ("letter_id");
  CREATE INDEX "payload_locked_documents_rels_letters_id_idx" ON "payload_locked_documents_rels" USING btree ("letters_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "letters" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "letters" CASCADE;
  ALTER TABLE "notifications" DROP CONSTRAINT "notifications_letter_id_letters_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_letters_fk";
  
  ALTER TABLE "notifications" ALTER COLUMN "kind" SET DATA TYPE text;
  ALTER TABLE "notifications" ALTER COLUMN "kind" SET DEFAULT 'municipal-publication'::text;
  DROP TYPE "public"."enum_notifications_kind";
  CREATE TYPE "public"."enum_notifications_kind" AS ENUM('municipal-publication', 'festival-submission');
  ALTER TABLE "notifications" ALTER COLUMN "kind" SET DEFAULT 'municipal-publication'::"public"."enum_notifications_kind";
  ALTER TABLE "notifications" ALTER COLUMN "kind" SET DATA TYPE "public"."enum_notifications_kind" USING "kind"::"public"."enum_notifications_kind";
  DROP INDEX "notifications_letter_idx";
  DROP INDEX "payload_locked_documents_rels_letters_id_idx";
  ALTER TABLE "notifications" DROP COLUMN "letter_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "letters_id";
  DROP TYPE "public"."enum_letters_status";`)
}
