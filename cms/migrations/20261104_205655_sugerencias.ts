import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Buzón de sugerencias del panel municipal.

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_suggestions_services" AS ENUM('publicidad', 'boletin', 'estadisticas', 'cobertura', 'agenda', 'formacion', 'avisos-urgentes');
  CREATE TABLE "suggestions_services" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_suggestions_services",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "suggestions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"summary" varchar,
  	"space_id" integer,
  	"town_id" integer,
  	"text" varchar,
  	"assigned_to_id" integer,
  	"created_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "suggestions_id" integer;
  ALTER TABLE "suggestions_services" ADD CONSTRAINT "suggestions_services_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."suggestions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_space_id_municipal_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."municipal_spaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_town_id_towns_id_fk" FOREIGN KEY ("town_id") REFERENCES "public"."towns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "suggestions_services_order_idx" ON "suggestions_services" USING btree ("order");
  CREATE INDEX "suggestions_services_parent_idx" ON "suggestions_services" USING btree ("parent_id");
  CREATE INDEX "suggestions_space_idx" ON "suggestions" USING btree ("space_id");
  CREATE INDEX "suggestions_town_idx" ON "suggestions" USING btree ("town_id");
  CREATE INDEX "suggestions_assigned_to_idx" ON "suggestions" USING btree ("assigned_to_id");
  CREATE INDEX "suggestions_created_by_idx" ON "suggestions" USING btree ("created_by_id");
  CREATE INDEX "suggestions_updated_at_idx" ON "suggestions" USING btree ("updated_at");
  CREATE INDEX "suggestions_created_at_idx" ON "suggestions" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_suggestions_fk" FOREIGN KEY ("suggestions_id") REFERENCES "public"."suggestions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_suggestions_id_idx" ON "payload_locked_documents_rels" USING btree ("suggestions_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "suggestions_services" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "suggestions" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "suggestions_services" CASCADE;
  DROP TABLE "suggestions" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_suggestions_fk";
  
  DROP INDEX "payload_locked_documents_rels_suggestions_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "suggestions_id";
  DROP TYPE "public"."enum_suggestions_services";`)
}
