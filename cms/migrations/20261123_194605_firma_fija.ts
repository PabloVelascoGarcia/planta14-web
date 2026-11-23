import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// «Firma fija» en Usuarios (la cuenta solo firma con su firma vinculada). Solo añade una columna a users: no toca
// noticias ni ningún otro dato. La firma «El Director» y las cuentas de la dirección se preparan con
// infra/deploy/firma-direccion.sh (no aquí: depende de las cuentas de cada instalación).

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ADD COLUMN "author_locked" boolean DEFAULT false;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" DROP COLUMN IF EXISTS "author_locked";`)
}
