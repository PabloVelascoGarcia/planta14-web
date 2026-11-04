import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Estadísticas propias (sin cookies ni datos personales): solo contadores agregados por día, página, concejo,
// sección y procedencia. No es una colección de Payload: la escribe /api/v y la leen el panel y las exportaciones.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TABLE IF NOT EXISTS "stats_daily" (
    "day" date NOT NULL,
    "path" varchar(200) NOT NULL,
    "town" varchar(40) NOT NULL DEFAULT '',
    "section" varchar(60) NOT NULL DEFAULT '',
    "source" varchar(20) NOT NULL,
    "views" integer NOT NULL DEFAULT 0,
    PRIMARY KEY ("day", "path", "town", "section", "source")
  );
  CREATE INDEX IF NOT EXISTS "stats_daily_town_day_idx" ON "stats_daily" ("town", "day");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "stats_daily";`)
}
