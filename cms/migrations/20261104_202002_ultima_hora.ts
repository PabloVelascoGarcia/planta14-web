import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// «Última hora»: global breaking-news (barra bajo la cabecera).

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "breaking_news" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"active" boolean DEFAULT false,
  	"text" varchar,
  	"link" varchar,
  	"expires_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "breaking_news" CASCADE;`)
}
