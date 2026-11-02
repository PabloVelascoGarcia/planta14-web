import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_media_rights_type" AS ENUM('propia', 'licencia', 'autorización', 'institucional');
  CREATE TYPE "public"."enum_media_rights_scope" AS ENUM('demo', 'publicable');
  CREATE TYPE "public"."enum_articles_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__articles_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_towns_comarca" AS ENUM('Caudal', 'Nalón');
  CREATE TYPE "public"."enum_municipal_spaces_subscription_status" AS ENUM('demo', 'active', 'inactive');
  CREATE TYPE "public"."enum_municipal_spaces_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__municipal_spaces_v_version_subscription_status" AS ENUM('demo', 'active', 'inactive');
  CREATE TYPE "public"."enum__municipal_spaces_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_municipal_content_type" AS ENUM('news', 'notice', 'event', 'grant', 'announcement');
  CREATE TYPE "public"."enum_municipal_content_origin" AS ENUM('municipality');
  CREATE TYPE "public"."enum_municipal_content_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__municipal_content_v_version_type" AS ENUM('news', 'notice', 'event', 'grant', 'announcement');
  CREATE TYPE "public"."enum__municipal_content_v_version_origin" AS ENUM('municipality');
  CREATE TYPE "public"."enum__municipal_content_v_version_status" AS ENUM('draft', 'published');
  ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
  ALTER TYPE "public"."enum_users_role" RENAME TO "enum_users_role_phase1";
  CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'editor');
  ALTER TABLE "users" ALTER COLUMN "role" TYPE "public"."enum_users_role" USING "role"::text::"public"."enum_users_role";
  DROP TYPE "public"."enum_users_role_phase1";
  CREATE TABLE "articles" (
    "id" serial PRIMARY KEY NOT NULL,
    "legacy_i_d" varchar,
    "slug" varchar,
    "title" varchar,
    "excerpt" varchar,
    "body" jsonb,
    "image_id" integer,
    "author_id" integer,
    "town_id" integer,
    "section_id" integer,
    "date" varchar,
    "published_at" varchar,
    "scheduled_at" varchar,
    "seo_title" varchar,
    "seo_description" varchar,
    "seo_image_id" integer,
    "featured" boolean,
    "main" boolean,
    "opinion" boolean,
    "source_name" varchar,
    "source_author" varchar,
    "provenance" varchar,
    "source_url" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "_status" "enum_articles_status" DEFAULT 'draft'
  );

  CREATE TABLE "_articles_v" (
    "id" serial PRIMARY KEY NOT NULL,
    "parent_id" integer,
    "version_legacy_i_d" varchar,
    "version_slug" varchar,
    "version_title" varchar,
    "version_excerpt" varchar,
    "version_body" jsonb,
    "version_image_id" integer,
    "version_author_id" integer,
    "version_town_id" integer,
    "version_section_id" integer,
    "version_date" varchar,
    "version_published_at" varchar,
    "version_scheduled_at" varchar,
    "version_seo_title" varchar,
    "version_seo_description" varchar,
    "version_seo_image_id" integer,
    "version_featured" boolean,
    "version_main" boolean,
    "version_opinion" boolean,
    "version_source_name" varchar,
    "version_source_author" varchar,
    "version_provenance" varchar,
    "version_source_url" varchar,
    "version_updated_at" timestamp(3) with time zone,
    "version_created_at" timestamp(3) with time zone,
    "version__status" "enum__articles_v_version_status" DEFAULT 'draft',
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "latest" boolean
  );

  CREATE TABLE "authors" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar NOT NULL,
    "slug" varchar NOT NULL,
    "role" varchar,
    "bio" varchar,
    "email" varchar,
    "avatar_id" integer,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "sections" (
    "id" serial PRIMARY KEY NOT NULL,
    "slug" varchar NOT NULL,
    "name" varchar NOT NULL,
    "position" numeric DEFAULT 0,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "towns" (
    "id" serial PRIMARY KEY NOT NULL,
    "legacy_i_d" varchar,
    "slug" varchar NOT NULL,
    "name" varchar NOT NULL,
    "comarca" "enum_towns_comarca" NOT NULL,
    "visible" boolean DEFAULT true,
    "provenance" varchar,
    "source_url" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "municipal_spaces" (
    "id" serial PRIMARY KEY NOT NULL,
    "legacy_i_d" varchar,
    "name" varchar,
    "town_id" integer,
    "medium" varchar,
    "subscription_status" "enum_municipal_spaces_subscription_status",
    "subscription_starts_at" varchar,
    "subscription_ends_at" varchar,
    "contact_place" varchar,
    "contact_hours" varchar,
    "contact_note" varchar,
    "provenance" varchar,
    "source_url" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "_status" "enum_municipal_spaces_status" DEFAULT 'draft'
  );

  CREATE TABLE "_municipal_spaces_v" (
    "id" serial PRIMARY KEY NOT NULL,
    "parent_id" integer,
    "version_legacy_i_d" varchar,
    "version_name" varchar,
    "version_town_id" integer,
    "version_medium" varchar,
    "version_subscription_status" "enum__municipal_spaces_v_version_subscription_status",
    "version_subscription_starts_at" varchar,
    "version_subscription_ends_at" varchar,
    "version_contact_place" varchar,
    "version_contact_hours" varchar,
    "version_contact_note" varchar,
    "version_provenance" varchar,
    "version_source_url" varchar,
    "version_updated_at" timestamp(3) with time zone,
    "version_created_at" timestamp(3) with time zone,
    "version__status" "enum__municipal_spaces_v_version_status" DEFAULT 'draft',
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "latest" boolean
  );

  CREATE TABLE "municipal_content_attachments" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "url" varchar,
    "title" varchar
  );

  CREATE TABLE "municipal_content" (
    "id" serial PRIMARY KEY NOT NULL,
    "legacy_i_d" varchar,
    "space_id" integer,
    "type" "enum_municipal_content_type",
    "title" varchar,
    "excerpt" varchar,
    "body" varchar,
    "origin" "enum_municipal_content_origin" DEFAULT 'municipality',
    "published_at" varchar,
    "expires_at" varchar,
    "event_at" varchar,
    "place" varchar,
    "deadline" varchar,
    "image_id" integer,
    "demo" boolean DEFAULT true,
    "provenance" varchar,
    "source_url" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "_status" "enum_municipal_content_status" DEFAULT 'draft'
  );

  CREATE TABLE "_municipal_content_v_version_attachments" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" serial PRIMARY KEY NOT NULL,
    "url" varchar,
    "title" varchar,
    "_uuid" varchar
  );

  CREATE TABLE "_municipal_content_v" (
    "id" serial PRIMARY KEY NOT NULL,
    "parent_id" integer,
    "version_legacy_i_d" varchar,
    "version_space_id" integer,
    "version_type" "enum__municipal_content_v_version_type",
    "version_title" varchar,
    "version_excerpt" varchar,
    "version_body" varchar,
    "version_origin" "enum__municipal_content_v_version_origin" DEFAULT 'municipality',
    "version_published_at" varchar,
    "version_expires_at" varchar,
    "version_event_at" varchar,
    "version_place" varchar,
    "version_deadline" varchar,
    "version_image_id" integer,
    "version_demo" boolean DEFAULT true,
    "version_provenance" varchar,
    "version_source_url" varchar,
    "version_updated_at" timestamp(3) with time zone,
    "version_created_at" timestamp(3) with time zone,
    "version__status" "enum__municipal_content_v_version_status" DEFAULT 'draft',
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "latest" boolean
  );

  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'editor';
  ALTER TABLE "media" ADD COLUMN "rights_holder" varchar;
  ALTER TABLE "media" ADD COLUMN "rights_type" "enum_media_rights_type";
  ALTER TABLE "media" ADD COLUMN "rights_scope" "enum_media_rights_scope" DEFAULT 'demo' NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "articles_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "authors_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "sections_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "towns_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "municipal_spaces_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "municipal_content_id" integer;
  ALTER TABLE "articles" ADD CONSTRAINT "articles_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles" ADD CONSTRAINT "articles_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles" ADD CONSTRAINT "articles_town_id_towns_id_fk" FOREIGN KEY ("town_id") REFERENCES "public"."towns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles" ADD CONSTRAINT "articles_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles" ADD CONSTRAINT "articles_seo_image_id_media_id_fk" FOREIGN KEY ("seo_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_parent_id_articles_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_version_image_id_media_id_fk" FOREIGN KEY ("version_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_version_author_id_authors_id_fk" FOREIGN KEY ("version_author_id") REFERENCES "public"."authors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_version_town_id_towns_id_fk" FOREIGN KEY ("version_town_id") REFERENCES "public"."towns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_version_section_id_sections_id_fk" FOREIGN KEY ("version_section_id") REFERENCES "public"."sections"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_version_seo_image_id_media_id_fk" FOREIGN KEY ("version_seo_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "authors" ADD CONSTRAINT "authors_avatar_id_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "municipal_spaces" ADD CONSTRAINT "municipal_spaces_town_id_towns_id_fk" FOREIGN KEY ("town_id") REFERENCES "public"."towns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_municipal_spaces_v" ADD CONSTRAINT "_municipal_spaces_v_parent_id_municipal_spaces_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."municipal_spaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_municipal_spaces_v" ADD CONSTRAINT "_municipal_spaces_v_version_town_id_towns_id_fk" FOREIGN KEY ("version_town_id") REFERENCES "public"."towns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "municipal_content_attachments" ADD CONSTRAINT "municipal_content_attachments_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."municipal_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "municipal_content" ADD CONSTRAINT "municipal_content_space_id_municipal_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."municipal_spaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "municipal_content" ADD CONSTRAINT "municipal_content_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_municipal_content_v_version_attachments" ADD CONSTRAINT "_municipal_content_v_version_attachments_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_municipal_content_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_municipal_content_v" ADD CONSTRAINT "_municipal_content_v_parent_id_municipal_content_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."municipal_content"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_municipal_content_v" ADD CONSTRAINT "_municipal_content_v_version_space_id_municipal_spaces_id_fk" FOREIGN KEY ("version_space_id") REFERENCES "public"."municipal_spaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_municipal_content_v" ADD CONSTRAINT "_municipal_content_v_version_image_id_media_id_fk" FOREIGN KEY ("version_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "articles_legacy_i_d_idx" ON "articles" USING btree ("legacy_i_d");
  CREATE UNIQUE INDEX "articles_slug_idx" ON "articles" USING btree ("slug");
  CREATE INDEX "articles_image_idx" ON "articles" USING btree ("image_id");
  CREATE INDEX "articles_author_idx" ON "articles" USING btree ("author_id");
  CREATE INDEX "articles_town_idx" ON "articles" USING btree ("town_id");
  CREATE INDEX "articles_section_idx" ON "articles" USING btree ("section_id");
  CREATE INDEX "articles_seo_image_idx" ON "articles" USING btree ("seo_image_id");
  CREATE INDEX "articles_updated_at_idx" ON "articles" USING btree ("updated_at");
  CREATE INDEX "articles_created_at_idx" ON "articles" USING btree ("created_at");
  CREATE INDEX "articles__status_idx" ON "articles" USING btree ("_status");
  CREATE INDEX "_articles_v_parent_idx" ON "_articles_v" USING btree ("parent_id");
  CREATE INDEX "_articles_v_version_version_legacy_i_d_idx" ON "_articles_v" USING btree ("version_legacy_i_d");
  CREATE INDEX "_articles_v_version_version_slug_idx" ON "_articles_v" USING btree ("version_slug");
  CREATE INDEX "_articles_v_version_version_image_idx" ON "_articles_v" USING btree ("version_image_id");
  CREATE INDEX "_articles_v_version_version_author_idx" ON "_articles_v" USING btree ("version_author_id");
  CREATE INDEX "_articles_v_version_version_town_idx" ON "_articles_v" USING btree ("version_town_id");
  CREATE INDEX "_articles_v_version_version_section_idx" ON "_articles_v" USING btree ("version_section_id");
  CREATE INDEX "_articles_v_version_version_seo_image_idx" ON "_articles_v" USING btree ("version_seo_image_id");
  CREATE INDEX "_articles_v_version_version_updated_at_idx" ON "_articles_v" USING btree ("version_updated_at");
  CREATE INDEX "_articles_v_version_version_created_at_idx" ON "_articles_v" USING btree ("version_created_at");
  CREATE INDEX "_articles_v_version_version__status_idx" ON "_articles_v" USING btree ("version__status");
  CREATE INDEX "_articles_v_created_at_idx" ON "_articles_v" USING btree ("created_at");
  CREATE INDEX "_articles_v_updated_at_idx" ON "_articles_v" USING btree ("updated_at");
  CREATE INDEX "_articles_v_latest_idx" ON "_articles_v" USING btree ("latest");
  CREATE UNIQUE INDEX "authors_slug_idx" ON "authors" USING btree ("slug");
  CREATE INDEX "authors_avatar_idx" ON "authors" USING btree ("avatar_id");
  CREATE INDEX "authors_updated_at_idx" ON "authors" USING btree ("updated_at");
  CREATE INDEX "authors_created_at_idx" ON "authors" USING btree ("created_at");
  CREATE UNIQUE INDEX "sections_slug_idx" ON "sections" USING btree ("slug");
  CREATE INDEX "sections_updated_at_idx" ON "sections" USING btree ("updated_at");
  CREATE INDEX "sections_created_at_idx" ON "sections" USING btree ("created_at");
  CREATE UNIQUE INDEX "towns_legacy_i_d_idx" ON "towns" USING btree ("legacy_i_d");
  CREATE UNIQUE INDEX "towns_slug_idx" ON "towns" USING btree ("slug");
  CREATE INDEX "towns_updated_at_idx" ON "towns" USING btree ("updated_at");
  CREATE INDEX "towns_created_at_idx" ON "towns" USING btree ("created_at");
  CREATE UNIQUE INDEX "municipal_spaces_legacy_i_d_idx" ON "municipal_spaces" USING btree ("legacy_i_d");
  CREATE UNIQUE INDEX "municipal_spaces_town_idx" ON "municipal_spaces" USING btree ("town_id");
  CREATE INDEX "municipal_spaces_updated_at_idx" ON "municipal_spaces" USING btree ("updated_at");
  CREATE INDEX "municipal_spaces_created_at_idx" ON "municipal_spaces" USING btree ("created_at");
  CREATE INDEX "municipal_spaces__status_idx" ON "municipal_spaces" USING btree ("_status");
  CREATE INDEX "_municipal_spaces_v_parent_idx" ON "_municipal_spaces_v" USING btree ("parent_id");
  CREATE INDEX "_municipal_spaces_v_version_version_legacy_i_d_idx" ON "_municipal_spaces_v" USING btree ("version_legacy_i_d");
  CREATE INDEX "_municipal_spaces_v_version_version_town_idx" ON "_municipal_spaces_v" USING btree ("version_town_id");
  CREATE INDEX "_municipal_spaces_v_version_version_updated_at_idx" ON "_municipal_spaces_v" USING btree ("version_updated_at");
  CREATE INDEX "_municipal_spaces_v_version_version_created_at_idx" ON "_municipal_spaces_v" USING btree ("version_created_at");
  CREATE INDEX "_municipal_spaces_v_version_version__status_idx" ON "_municipal_spaces_v" USING btree ("version__status");
  CREATE INDEX "_municipal_spaces_v_created_at_idx" ON "_municipal_spaces_v" USING btree ("created_at");
  CREATE INDEX "_municipal_spaces_v_updated_at_idx" ON "_municipal_spaces_v" USING btree ("updated_at");
  CREATE INDEX "_municipal_spaces_v_latest_idx" ON "_municipal_spaces_v" USING btree ("latest");
  CREATE INDEX "municipal_content_attachments_order_idx" ON "municipal_content_attachments" USING btree ("_order");
  CREATE INDEX "municipal_content_attachments_parent_id_idx" ON "municipal_content_attachments" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "municipal_content_legacy_i_d_idx" ON "municipal_content" USING btree ("legacy_i_d");
  CREATE INDEX "municipal_content_space_idx" ON "municipal_content" USING btree ("space_id");
  CREATE INDEX "municipal_content_image_idx" ON "municipal_content" USING btree ("image_id");
  CREATE INDEX "municipal_content_updated_at_idx" ON "municipal_content" USING btree ("updated_at");
  CREATE INDEX "municipal_content_created_at_idx" ON "municipal_content" USING btree ("created_at");
  CREATE INDEX "municipal_content__status_idx" ON "municipal_content" USING btree ("_status");
  CREATE INDEX "_municipal_content_v_version_attachments_order_idx" ON "_municipal_content_v_version_attachments" USING btree ("_order");
  CREATE INDEX "_municipal_content_v_version_attachments_parent_id_idx" ON "_municipal_content_v_version_attachments" USING btree ("_parent_id");
  CREATE INDEX "_municipal_content_v_parent_idx" ON "_municipal_content_v" USING btree ("parent_id");
  CREATE INDEX "_municipal_content_v_version_version_legacy_i_d_idx" ON "_municipal_content_v" USING btree ("version_legacy_i_d");
  CREATE INDEX "_municipal_content_v_version_version_space_idx" ON "_municipal_content_v" USING btree ("version_space_id");
  CREATE INDEX "_municipal_content_v_version_version_image_idx" ON "_municipal_content_v" USING btree ("version_image_id");
  CREATE INDEX "_municipal_content_v_version_version_updated_at_idx" ON "_municipal_content_v" USING btree ("version_updated_at");
  CREATE INDEX "_municipal_content_v_version_version_created_at_idx" ON "_municipal_content_v" USING btree ("version_created_at");
  CREATE INDEX "_municipal_content_v_version_version__status_idx" ON "_municipal_content_v" USING btree ("version__status");
  CREATE INDEX "_municipal_content_v_created_at_idx" ON "_municipal_content_v" USING btree ("created_at");
  CREATE INDEX "_municipal_content_v_updated_at_idx" ON "_municipal_content_v" USING btree ("updated_at");
  CREATE INDEX "_municipal_content_v_latest_idx" ON "_municipal_content_v" USING btree ("latest");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_authors_fk" FOREIGN KEY ("authors_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sections_fk" FOREIGN KEY ("sections_id") REFERENCES "public"."sections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_towns_fk" FOREIGN KEY ("towns_id") REFERENCES "public"."towns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_municipal_spaces_fk" FOREIGN KEY ("municipal_spaces_id") REFERENCES "public"."municipal_spaces"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_municipal_content_fk" FOREIGN KEY ("municipal_content_id") REFERENCES "public"."municipal_content"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_articles_id_idx" ON "payload_locked_documents_rels" USING btree ("articles_id");
  CREATE INDEX "payload_locked_documents_rels_authors_id_idx" ON "payload_locked_documents_rels" USING btree ("authors_id");
  CREATE INDEX "payload_locked_documents_rels_sections_id_idx" ON "payload_locked_documents_rels" USING btree ("sections_id");
  CREATE INDEX "payload_locked_documents_rels_towns_id_idx" ON "payload_locked_documents_rels" USING btree ("towns_id");
  CREATE INDEX "payload_locked_documents_rels_municipal_spaces_id_idx" ON "payload_locked_documents_rels" USING btree ("municipal_spaces_id");
  CREATE INDEX "payload_locked_documents_rels_municipal_content_id_idx" ON "payload_locked_documents_rels" USING btree ("municipal_content_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // A downgrade must never promote an editor to a phase-1 administrator.
  await db.execute(sql`DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM users WHERE role::text = 'editor') THEN
      RAISE EXCEPTION 'Retira las cuentas editor antes de volver a fase 1; no se promoverán a admin';
    END IF;
  END $$;`)
  await db.execute(sql`
   ALTER TABLE "articles" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_articles_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "authors" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "sections" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "towns" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "municipal_spaces" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_municipal_spaces_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "municipal_content_attachments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "municipal_content" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_municipal_content_v_version_attachments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_municipal_content_v" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "articles" CASCADE;
  DROP TABLE "_articles_v" CASCADE;
  DROP TABLE "authors" CASCADE;
  DROP TABLE "sections" CASCADE;
  DROP TABLE "towns" CASCADE;
  DROP TABLE "municipal_spaces" CASCADE;
  DROP TABLE "_municipal_spaces_v" CASCADE;
  DROP TABLE "municipal_content_attachments" CASCADE;
  DROP TABLE "municipal_content" CASCADE;
  DROP TABLE "_municipal_content_v_version_attachments" CASCADE;
  DROP TABLE "_municipal_content_v" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_articles_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_authors_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_sections_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_towns_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_municipal_spaces_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_municipal_content_fk";

  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'admin'::text;
  DROP TYPE "public"."enum_users_role";
  CREATE TYPE "public"."enum_users_role" AS ENUM('admin');
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'admin'::"public"."enum_users_role";
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."enum_users_role" USING "role"::"public"."enum_users_role";
  DROP INDEX "payload_locked_documents_rels_articles_id_idx";
  DROP INDEX "payload_locked_documents_rels_authors_id_idx";
  DROP INDEX "payload_locked_documents_rels_sections_id_idx";
  DROP INDEX "payload_locked_documents_rels_towns_id_idx";
  DROP INDEX "payload_locked_documents_rels_municipal_spaces_id_idx";
  DROP INDEX "payload_locked_documents_rels_municipal_content_id_idx";
  ALTER TABLE "media" DROP COLUMN "rights_holder";
  ALTER TABLE "media" DROP COLUMN "rights_type";
  ALTER TABLE "media" DROP COLUMN "rights_scope";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "articles_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "authors_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "sections_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "towns_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "municipal_spaces_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "municipal_content_id";
  DROP TYPE "public"."enum_media_rights_type";
  DROP TYPE "public"."enum_media_rights_scope";
  DROP TYPE "public"."enum_articles_status";
  DROP TYPE "public"."enum__articles_v_version_status";
  DROP TYPE "public"."enum_towns_comarca";
  DROP TYPE "public"."enum_municipal_spaces_subscription_status";
  DROP TYPE "public"."enum_municipal_spaces_status";
  DROP TYPE "public"."enum__municipal_spaces_v_version_subscription_status";
  DROP TYPE "public"."enum__municipal_spaces_v_version_status";
  DROP TYPE "public"."enum_municipal_content_type";
  DROP TYPE "public"."enum_municipal_content_origin";
  DROP TYPE "public"."enum_municipal_content_status";
  DROP TYPE "public"."enum__municipal_content_v_version_type";
  DROP TYPE "public"."enum__municipal_content_v_version_origin";
  DROP TYPE "public"."enum__municipal_content_v_version_status";`)
}
