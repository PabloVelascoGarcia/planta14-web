import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Responsables por concejo: Concejos → Periodista responsable y Pendientes de revisar → Asignado a (más el tipo
// «Fiesta enviada»). Además alinea media.rights_scope con el código (nulo permitido desde que «Ámbito» se oculta
// al crear; Payload sigue poniendo «demo» por defecto).

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_notifications_kind" ADD VALUE 'festival-submission';
  ALTER TABLE "media" ALTER COLUMN "rights_scope" DROP NOT NULL;
  ALTER TABLE "towns" ADD COLUMN "responsible_id" integer;
  ALTER TABLE "notifications" ADD COLUMN "assigned_to_id" integer;
  ALTER TABLE "towns" ADD CONSTRAINT "towns_responsible_id_users_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "towns_responsible_idx" ON "towns" USING btree ("responsible_id");
  CREATE INDEX "notifications_assigned_to_idx" ON "notifications" USING btree ("assigned_to_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "towns" DROP CONSTRAINT "towns_responsible_id_users_id_fk";
  
  ALTER TABLE "notifications" DROP CONSTRAINT "notifications_assigned_to_id_users_id_fk";
  
  ALTER TABLE "notifications" ALTER COLUMN "kind" SET DATA TYPE text;
  ALTER TABLE "notifications" ALTER COLUMN "kind" SET DEFAULT 'municipal-publication'::text;
  DROP TYPE "public"."enum_notifications_kind";
  CREATE TYPE "public"."enum_notifications_kind" AS ENUM('municipal-publication');
  ALTER TABLE "notifications" ALTER COLUMN "kind" SET DEFAULT 'municipal-publication'::"public"."enum_notifications_kind";
  ALTER TABLE "notifications" ALTER COLUMN "kind" SET DATA TYPE "public"."enum_notifications_kind" USING "kind"::"public"."enum_notifications_kind";
  DROP INDEX "towns_responsible_idx";
  DROP INDEX "notifications_assigned_to_idx";
  ALTER TABLE "media" ALTER COLUMN "rights_scope" SET NOT NULL;
  ALTER TABLE "towns" DROP COLUMN "responsible_id";
  ALTER TABLE "notifications" DROP COLUMN "assigned_to_id";`)
}
