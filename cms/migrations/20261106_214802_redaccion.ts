import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Redacción: bandeja «Pendiente de revisar» (concejo, decisión, quién y cuándo; sugerencias), motivos de rechazo, resumen diario y «Fuera hasta» en el perfil, y el concejo oculto «Caudal» para lo comarcal. El día del último resumen enviado se guarda en external_cache (estado de la web en marcha), no aquí.

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_notifications_decision" AS ENUM('aprobado', 'rechazado', 'revisado');
  ALTER TYPE "public"."enum_notifications_kind" ADD VALUE 'suggestion';
  CREATE TABLE "newsroom_settings_rejection_reasons" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"reason" varchar NOT NULL
  );
  
  CREATE TABLE "newsroom_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "users" ADD COLUMN "daily_digest" boolean DEFAULT true;
  ALTER TABLE "users" ADD COLUMN "away_until" varchar;
  ALTER TABLE "notifications" ADD COLUMN "town_id" integer;
  ALTER TABLE "notifications" ADD COLUMN "suggestion_id" integer;
  ALTER TABLE "notifications" ADD COLUMN "decision" "enum_notifications_decision";
  ALTER TABLE "notifications" ADD COLUMN "reject_reason" varchar;
  ALTER TABLE "notifications" ADD COLUMN "reject_note" varchar;
  ALTER TABLE "notifications" ADD COLUMN "resolved_by_id" integer;
  ALTER TABLE "notifications" ADD COLUMN "resolved_at" timestamp(3) with time zone;
  ALTER TABLE "newsroom_settings_rejection_reasons" ADD CONSTRAINT "newsroom_settings_rejection_reasons_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."newsroom_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "newsroom_settings_rejection_reasons_order_idx" ON "newsroom_settings_rejection_reasons" USING btree ("_order");
  CREATE INDEX "newsroom_settings_rejection_reasons_parent_id_idx" ON "newsroom_settings_rejection_reasons" USING btree ("_parent_id");
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_town_id_towns_id_fk" FOREIGN KEY ("town_id") REFERENCES "public"."towns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_suggestion_id_suggestions_id_fk" FOREIGN KEY ("suggestion_id") REFERENCES "public"."suggestions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "notifications_town_idx" ON "notifications" USING btree ("town_id");
  CREATE INDEX "notifications_suggestion_idx" ON "notifications" USING btree ("suggestion_id");
  CREATE INDEX "notifications_resolved_by_idx" ON "notifications" USING btree ("resolved_by_id");
  -- «Caudal»: concejo oculto para lo comarcal (sin página ni espacio municipal, fuera de la navegación).
  INSERT INTO "towns" ("slug", "name", "comarca", "visible", "provenance") VALUES ('caudal', 'Caudal', 'Caudal', false, 'redaccion') ON CONFLICT ("slug") DO NOTHING;
  -- Concejo de lo que ya estaba en «Pendientes de revisar».
  UPDATE "notifications" n SET "town_id" = f."town_id" FROM "festivals" f WHERE n."festival_id" = f."id" AND n."town_id" IS NULL;
  UPDATE "notifications" n SET "town_id" = l."town_id" FROM "letters" l WHERE n."letter_id" = l."id" AND n."town_id" IS NULL;
  UPDATE "notifications" n SET "town_id" = s."town_id" FROM "municipal_spaces" s WHERE n."space_id" = s."id" AND n."town_id" IS NULL;
  -- Las publicaciones municipales ya no esperan revisión: van al resumen diario.
  UPDATE "notifications" SET "reviewed" = true, "decision" = 'revisado' WHERE "kind" = 'municipal-publication' AND "reviewed" IS NOT TRUE;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   -- «Caudal» se queda (puede tener noticias o fiestas); se quitan las sugerencias de la bandeja antes de cambiar el tipo.
  DELETE FROM "notifications" WHERE "kind" = 'suggestion';
  ALTER TABLE "newsroom_settings_rejection_reasons" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "newsroom_settings" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "newsroom_settings_rejection_reasons" CASCADE;
  DROP TABLE "newsroom_settings" CASCADE;
  ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_town_id_towns_id_fk";
  
  ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_suggestion_id_suggestions_id_fk";
  
  ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_resolved_by_id_users_id_fk";
  
  ALTER TABLE "notifications" ALTER COLUMN "kind" SET DATA TYPE text;
  ALTER TABLE "notifications" ALTER COLUMN "kind" SET DEFAULT 'municipal-publication'::text;
  DROP TYPE "public"."enum_notifications_kind";
  CREATE TYPE "public"."enum_notifications_kind" AS ENUM('municipal-publication', 'festival-submission', 'letter-submission');
  ALTER TABLE "notifications" ALTER COLUMN "kind" SET DEFAULT 'municipal-publication'::"public"."enum_notifications_kind";
  ALTER TABLE "notifications" ALTER COLUMN "kind" SET DATA TYPE "public"."enum_notifications_kind" USING "kind"::"public"."enum_notifications_kind";
  DROP INDEX "notifications_town_idx";
  DROP INDEX "notifications_suggestion_idx";
  DROP INDEX "notifications_resolved_by_idx";
  ALTER TABLE "users" DROP COLUMN "daily_digest";
  ALTER TABLE "users" DROP COLUMN "away_until";
  ALTER TABLE "notifications" DROP COLUMN "town_id";
  ALTER TABLE "notifications" DROP COLUMN "suggestion_id";
  ALTER TABLE "notifications" DROP COLUMN "decision";
  ALTER TABLE "notifications" DROP COLUMN "reject_reason";
  ALTER TABLE "notifications" DROP COLUMN "reject_note";
  ALTER TABLE "notifications" DROP COLUMN "resolved_by_id";
  ALTER TABLE "notifications" DROP COLUMN "resolved_at";
  DROP TYPE "public"."enum_notifications_decision";`)
}
