import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Sección «Útil»: Patrimonio (con foto), Rutas (con recorrido), Directorio de servicios municipales y la caché de las
// cuatro fuentes automáticas (DGT/Pajares, AEMET, BDNS, BOE), que no es una colección de Payload.

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TABLE IF NOT EXISTS "external_cache" (
    "key" varchar(120) PRIMARY KEY NOT NULL,
    "value" jsonb,
    "fetched_at" timestamp(3) with time zone,
    "checked_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
    "error" text,
    "notified_at" timestamp(3) with time zone
  );
   CREATE TYPE "public"."enum_heritage_review" AS ENUM('ok', 'coordenadas', 'dudoso', 'dudoso-coordenadas');
  CREATE TYPE "public"."enum_routes_review" AS ENUM('ok', 'coordenadas', 'dudoso', 'dudoso-coordenadas');
  CREATE TYPE "public"."enum_municipal_services_category" AS ENUM('ayuntamiento', 'salud', 'social', 'educacion', 'cultura', 'deportes', 'emergencias', 'transporte', 'medio-ambiente', 'turismo', 'otros');
  CREATE TABLE "heritage_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "heritage" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"town_id" integer NOT NULL,
  	"image_id" integer,
  	"kind" varchar,
  	"place" varchar,
  	"description" varchar,
  	"protection" varchar,
  	"protection_url" varchar,
  	"lat" numeric,
  	"lon" numeric,
  	"coordinates_note" varchar,
  	"doubts" varchar,
  	"reviewed" boolean DEFAULT false,
  	"external_i_d" varchar,
  	"review" "enum_heritage_review" DEFAULT 'ok',
  	"slug" varchar,
  	"published" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "routes_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "routes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"town_id" integer NOT NULL,
  	"code" varchar,
  	"also_in" varchar,
  	"start" varchar,
  	"end" varchar,
  	"distance_km" numeric,
  	"distance_note" varchar,
  	"elevation_up" numeric,
  	"elevation_down" numeric,
  	"difficulty" varchar,
  	"duration" varchar,
  	"description" varchar,
  	"gpx_url" varchar,
  	"gpx_label" varchar,
  	"track" jsonb,
  	"track_note" varchar,
  	"lat" numeric,
  	"lon" numeric,
  	"doubts" varchar,
  	"reviewed" boolean DEFAULT false,
  	"external_i_d" varchar,
  	"review" "enum_routes_review" DEFAULT 'ok',
  	"slug" varchar,
  	"published" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "routes_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"towns_id" integer
  );
  
  CREATE TABLE "municipal_services" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"town_id" integer NOT NULL,
  	"category" "enum_municipal_services_category" DEFAULT 'ayuntamiento' NOT NULL,
  	"place" varchar,
  	"address" varchar,
  	"phone" varchar,
  	"email" varchar,
  	"web" varchar,
  	"hours" varchar,
  	"notes" varchar,
  	"source_url" varchar,
  	"doubts" varchar,
  	"external_i_d" varchar,
  	"order" numeric DEFAULT 100,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "heritage_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "routes_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "municipal_services_id" integer;
  ALTER TABLE "heritage_sources" ADD CONSTRAINT "heritage_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."heritage"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "heritage" ADD CONSTRAINT "heritage_town_id_towns_id_fk" FOREIGN KEY ("town_id") REFERENCES "public"."towns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "heritage" ADD CONSTRAINT "heritage_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "routes_sources" ADD CONSTRAINT "routes_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "routes" ADD CONSTRAINT "routes_town_id_towns_id_fk" FOREIGN KEY ("town_id") REFERENCES "public"."towns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "routes_rels" ADD CONSTRAINT "routes_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "routes_rels" ADD CONSTRAINT "routes_rels_towns_fk" FOREIGN KEY ("towns_id") REFERENCES "public"."towns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "municipal_services" ADD CONSTRAINT "municipal_services_town_id_towns_id_fk" FOREIGN KEY ("town_id") REFERENCES "public"."towns"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "heritage_sources_order_idx" ON "heritage_sources" USING btree ("_order");
  CREATE INDEX "heritage_sources_parent_id_idx" ON "heritage_sources" USING btree ("_parent_id");
  CREATE INDEX "heritage_town_idx" ON "heritage" USING btree ("town_id");
  CREATE INDEX "heritage_image_idx" ON "heritage" USING btree ("image_id");
  CREATE UNIQUE INDEX "heritage_external_i_d_idx" ON "heritage" USING btree ("external_i_d");
  CREATE INDEX "heritage_review_idx" ON "heritage" USING btree ("review");
  CREATE UNIQUE INDEX "heritage_slug_idx" ON "heritage" USING btree ("slug");
  CREATE INDEX "heritage_published_idx" ON "heritage" USING btree ("published");
  CREATE INDEX "heritage_updated_at_idx" ON "heritage" USING btree ("updated_at");
  CREATE INDEX "heritage_created_at_idx" ON "heritage" USING btree ("created_at");
  CREATE INDEX "routes_sources_order_idx" ON "routes_sources" USING btree ("_order");
  CREATE INDEX "routes_sources_parent_id_idx" ON "routes_sources" USING btree ("_parent_id");
  CREATE INDEX "routes_town_idx" ON "routes" USING btree ("town_id");
  CREATE UNIQUE INDEX "routes_external_i_d_idx" ON "routes" USING btree ("external_i_d");
  CREATE INDEX "routes_review_idx" ON "routes" USING btree ("review");
  CREATE UNIQUE INDEX "routes_slug_idx" ON "routes" USING btree ("slug");
  CREATE INDEX "routes_published_idx" ON "routes" USING btree ("published");
  CREATE INDEX "routes_updated_at_idx" ON "routes" USING btree ("updated_at");
  CREATE INDEX "routes_created_at_idx" ON "routes" USING btree ("created_at");
  CREATE INDEX "routes_rels_order_idx" ON "routes_rels" USING btree ("order");
  CREATE INDEX "routes_rels_parent_idx" ON "routes_rels" USING btree ("parent_id");
  CREATE INDEX "routes_rels_path_idx" ON "routes_rels" USING btree ("path");
  CREATE INDEX "routes_rels_towns_id_idx" ON "routes_rels" USING btree ("towns_id");
  CREATE INDEX "municipal_services_town_idx" ON "municipal_services" USING btree ("town_id");
  CREATE UNIQUE INDEX "municipal_services_external_i_d_idx" ON "municipal_services" USING btree ("external_i_d");
  CREATE INDEX "municipal_services_updated_at_idx" ON "municipal_services" USING btree ("updated_at");
  CREATE INDEX "municipal_services_created_at_idx" ON "municipal_services" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_heritage_fk" FOREIGN KEY ("heritage_id") REFERENCES "public"."heritage"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_routes_fk" FOREIGN KEY ("routes_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_municipal_services_fk" FOREIGN KEY ("municipal_services_id") REFERENCES "public"."municipal_services"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_heritage_id_idx" ON "payload_locked_documents_rels" USING btree ("heritage_id");
  CREATE INDEX "payload_locked_documents_rels_routes_id_idx" ON "payload_locked_documents_rels" USING btree ("routes_id");
  CREATE INDEX "payload_locked_documents_rels_municipal_services_id_idx" ON "payload_locked_documents_rels" USING btree ("municipal_services_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP TABLE IF EXISTS "external_cache";
   ALTER TABLE "heritage_sources" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "heritage" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "routes_sources" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "routes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "routes_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "municipal_services" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "heritage_sources" CASCADE;
  DROP TABLE "heritage" CASCADE;
  DROP TABLE "routes_sources" CASCADE;
  DROP TABLE "routes" CASCADE;
  DROP TABLE "routes_rels" CASCADE;
  DROP TABLE "municipal_services" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_heritage_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_routes_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_municipal_services_fk";
  
  DROP INDEX "payload_locked_documents_rels_heritage_id_idx";
  DROP INDEX "payload_locked_documents_rels_routes_id_idx";
  DROP INDEX "payload_locked_documents_rels_municipal_services_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "heritage_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "routes_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "municipal_services_id";
  DROP TYPE "public"."enum_heritage_review";
  DROP TYPE "public"."enum_routes_review";
  DROP TYPE "public"."enum_municipal_services_category";`)
}
