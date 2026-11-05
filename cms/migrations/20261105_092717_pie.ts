import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Pie de página: ajustes globales «Lemas», «Pie de página» (enlace de WhatsApp) y «Principios editoriales».
// Hasta que la administración los guarde, la web usa los valores iniciales (cms/site-globals.ts).

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_mottos_under_masthead" AS ENUM('lema1', 'lema2', 'lema3');
  CREATE TYPE "public"."enum_mottos_side_note" AS ENUM('lema1', 'lema2', 'lema3');
  CREATE TYPE "public"."enum_mottos_footer" AS ENUM('lema1', 'lema2', 'lema3');
  CREATE TABLE "mottos" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"lema1" varchar DEFAULT 'Una voz para las Cuencas' NOT NULL,
  	"lema2" varchar DEFAULT 'Donde otros no llegan' NOT NULL,
  	"lema3" varchar DEFAULT 'Orgullo de historia. Mirada al futuro' NOT NULL,
  	"under_masthead" "enum_mottos_under_masthead" DEFAULT 'lema1' NOT NULL,
  	"side_note" "enum_mottos_side_note" DEFAULT 'lema2' NOT NULL,
  	"footer" "enum_mottos_footer" DEFAULT 'lema3' NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "footer_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"whatsapp" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "principles_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar NOT NULL,
  	"body" varchar NOT NULL
  );
  
  CREATE TABLE "principles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"provisional" boolean DEFAULT true,
  	"intro" varchar DEFAULT 'Estos son los compromisos con los que trabaja la redacción de Planta 14.',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "principles_sections" ADD CONSTRAINT "principles_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."principles"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "principles_sections_order_idx" ON "principles_sections" USING btree ("_order");
  CREATE INDEX "principles_sections_parent_id_idx" ON "principles_sections" USING btree ("_parent_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "mottos" CASCADE;
  DROP TABLE "footer_settings" CASCADE;
  DROP TABLE "principles_sections" CASCADE;
  DROP TABLE "principles" CASCADE;
  DROP TYPE "public"."enum_mottos_under_masthead";
  DROP TYPE "public"."enum_mottos_side_note";
  DROP TYPE "public"."enum_mottos_footer";`)
}
