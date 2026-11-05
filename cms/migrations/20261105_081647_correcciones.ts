import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Correcciones tras el despliegue en pruebas:
// - Fiestas: «Estado de la fecha» (confirmada, pendiente u orientativa 2025), fecha orientativa, fechas habituales,
//   descripción, fuentes, notas del catálogo e identificador del catálogo (importación idempotente). Las fiestas que ya
//   existen quedan como «Confirmada» (tienen sus fechas).
// - Caché de «Útil»: número de intentos fallidos seguidos, para la espera creciente del refresco en el servidor.
// - Servicios municipales: el horario admite 500 caracteres. No cambia la columna (es varchar sin límite en
//   PostgreSQL): el límite lo aplica la aplicación.

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "external_cache" ADD COLUMN IF NOT EXISTS "attempts" integer NOT NULL DEFAULT 0;
   CREATE TYPE "public"."enum_festivals_date_status" AS ENUM('confirmada', 'pendiente', 'orientativa');
  CREATE TYPE "public"."enum__festivals_v_version_date_status" AS ENUM('confirmada', 'pendiente', 'orientativa');
  CREATE TABLE "festivals_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"url" varchar,
  	"title" varchar
  );
  
  CREATE TABLE "_festivals_v_version_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"url" varchar,
  	"title" varchar,
  	"_uuid" varchar
  );
  
  ALTER TABLE "festivals" ADD COLUMN "date_status" "enum_festivals_date_status" DEFAULT 'confirmada';
  ALTER TABLE "festivals" ADD COLUMN "reference_dates" varchar;
  ALTER TABLE "festivals" ADD COLUMN "usual_dates" varchar;
  ALTER TABLE "festivals" ADD COLUMN "description" varchar;
  ALTER TABLE "festivals" ADD COLUMN "catalog_notes" varchar;
  ALTER TABLE "festivals" ADD COLUMN "external_i_d" varchar;
  ALTER TABLE "_festivals_v" ADD COLUMN "version_date_status" "enum__festivals_v_version_date_status" DEFAULT 'confirmada';
  ALTER TABLE "_festivals_v" ADD COLUMN "version_reference_dates" varchar;
  ALTER TABLE "_festivals_v" ADD COLUMN "version_usual_dates" varchar;
  ALTER TABLE "_festivals_v" ADD COLUMN "version_description" varchar;
  ALTER TABLE "_festivals_v" ADD COLUMN "version_catalog_notes" varchar;
  ALTER TABLE "_festivals_v" ADD COLUMN "version_external_i_d" varchar;
  ALTER TABLE "festivals_sources" ADD CONSTRAINT "festivals_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."festivals"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_festivals_v_version_sources" ADD CONSTRAINT "_festivals_v_version_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_festivals_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "festivals_sources_order_idx" ON "festivals_sources" USING btree ("_order");
  CREATE INDEX "festivals_sources_parent_id_idx" ON "festivals_sources" USING btree ("_parent_id");
  CREATE INDEX "_festivals_v_version_sources_order_idx" ON "_festivals_v_version_sources" USING btree ("_order");
  CREATE INDEX "_festivals_v_version_sources_parent_id_idx" ON "_festivals_v_version_sources" USING btree ("_parent_id");
  CREATE INDEX "festivals_date_status_idx" ON "festivals" USING btree ("date_status");
  CREATE UNIQUE INDEX "festivals_external_i_d_idx" ON "festivals" USING btree ("external_i_d");
  CREATE INDEX "_festivals_v_version_version_date_status_idx" ON "_festivals_v" USING btree ("version_date_status");
  CREATE INDEX "_festivals_v_version_version_external_i_d_idx" ON "_festivals_v" USING btree ("version_external_i_d");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "external_cache" DROP COLUMN IF EXISTS "attempts";
   ALTER TABLE "festivals_sources" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_festivals_v_version_sources" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "festivals_sources" CASCADE;
  DROP TABLE "_festivals_v_version_sources" CASCADE;
  DROP INDEX "festivals_date_status_idx";
  DROP INDEX "festivals_external_i_d_idx";
  DROP INDEX "_festivals_v_version_version_date_status_idx";
  DROP INDEX "_festivals_v_version_version_external_i_d_idx";
  ALTER TABLE "festivals" DROP COLUMN "date_status";
  ALTER TABLE "festivals" DROP COLUMN "reference_dates";
  ALTER TABLE "festivals" DROP COLUMN "usual_dates";
  ALTER TABLE "festivals" DROP COLUMN "description";
  ALTER TABLE "festivals" DROP COLUMN "catalog_notes";
  ALTER TABLE "festivals" DROP COLUMN "external_i_d";
  ALTER TABLE "_festivals_v" DROP COLUMN "version_date_status";
  ALTER TABLE "_festivals_v" DROP COLUMN "version_reference_dates";
  ALTER TABLE "_festivals_v" DROP COLUMN "version_usual_dates";
  ALTER TABLE "_festivals_v" DROP COLUMN "version_description";
  ALTER TABLE "_festivals_v" DROP COLUMN "version_catalog_notes";
  ALTER TABLE "_festivals_v" DROP COLUMN "version_external_i_d";
  DROP TYPE "public"."enum_festivals_date_status";
  DROP TYPE "public"."enum__festivals_v_version_date_status";`)
}
