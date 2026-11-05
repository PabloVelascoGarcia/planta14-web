import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Ajuste global «Fiestas en portada»: días antes del comienzo para «Fiestas esta semana» (7 si no se guarda).
// La activación por concejo y las páginas «Ver todos» de «Útil» no cambian la base de datos.

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "fiestas_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"days_before" numeric DEFAULT 7 NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "fiestas_settings" CASCADE;`)
}
