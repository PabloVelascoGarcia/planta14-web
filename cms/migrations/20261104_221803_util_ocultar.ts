import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Servicios de «Útil» ocultos por concejo (los elige el ayuntamiento desde su panel).

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_util_visibility_hidden" AS ENUM('invierno', 'tiempo', 'farmacias', 'servicios', 'patrimonio', 'rutas', 'subvenciones', 'empleo');
  CREATE TABLE "util_visibility_hidden" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_util_visibility_hidden",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "util_visibility" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"summary" varchar,
  	"town_id" integer NOT NULL,
  	"updated_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "util_visibility_id" integer;
  ALTER TABLE "util_visibility_hidden" ADD CONSTRAINT "util_visibility_hidden_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."util_visibility"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "util_visibility" ADD CONSTRAINT "util_visibility_town_id_towns_id_fk" FOREIGN KEY ("town_id") REFERENCES "public"."towns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "util_visibility" ADD CONSTRAINT "util_visibility_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "util_visibility_hidden_order_idx" ON "util_visibility_hidden" USING btree ("order");
  CREATE INDEX "util_visibility_hidden_parent_idx" ON "util_visibility_hidden" USING btree ("parent_id");
  CREATE UNIQUE INDEX "util_visibility_town_idx" ON "util_visibility" USING btree ("town_id");
  CREATE INDEX "util_visibility_updated_by_idx" ON "util_visibility" USING btree ("updated_by_id");
  CREATE INDEX "util_visibility_updated_at_idx" ON "util_visibility" USING btree ("updated_at");
  CREATE INDEX "util_visibility_created_at_idx" ON "util_visibility" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_util_visibility_fk" FOREIGN KEY ("util_visibility_id") REFERENCES "public"."util_visibility"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_util_visibility_id_idx" ON "payload_locked_documents_rels" USING btree ("util_visibility_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "util_visibility_hidden" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "util_visibility" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "util_visibility_hidden" CASCADE;
  DROP TABLE "util_visibility" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_util_visibility_fk";
  
  DROP INDEX "payload_locked_documents_rels_util_visibility_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "util_visibility_id";
  DROP TYPE "public"."enum_util_visibility_hidden";`)
}
