import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Formulario de noticia para la redacción.
// - Texto: de lista de párrafos (JSON) a texto enriquecido (Lexical), sin pérdida: un párrafo por elemento.
// - Fechas: publishedAt, scheduledAt y agenda.eventAt pasan de texto a fecha y hora. «AAAA-MM-DD» sin hora se toma
//   como las 09:00 de Madrid; «AAAA-MM-DDTHH:MM» sin zona, como hora de Madrid; ISO con zona, tal cual. Si una
//   noticia no tenía publishedAt, se toma de `date`. Con publicación programada, la fecha de publicación es la
//   programada. `date` (AAAA-MM-DD) se recalcula a partir de la fecha de publicación.
// - Usuarios: «Firma (autor vinculado)».
// down: vuelve a texto (fechas en ISO) y a lista de párrafos (texto plano por bloque; se pierde el formato).

type Node = { type: string; text?: string; children?: Node[] }
const textNode = (text: string) => ({ type: 'text', text, format: 0, detail: 0, mode: 'normal', style: '', version: 1 })
const paragraph = (text: string) => ({ type: 'paragraph', children: [textNode(text)], direction: 'ltr', format: '', indent: 0, version: 1, textFormat: 0, textStyle: '' })
const toLexical = (paragraphs: unknown[]) => ({ root: { type: 'root', direction: 'ltr', format: '', indent: 0, version: 1,
  children: paragraphs.filter((p): p is string => typeof p === 'string').map(p => p.trim()).filter(Boolean).map(paragraph) } })
const plain = (node: Node): string => node.type === 'text' ? node.text ?? '' : node.type === 'linebreak' ? '\n' : (node.children ?? []).map(plain).join('')
function toParagraphs(value: { root?: Node } | null): string[] {
  const out: string[] = []
  const walk = (node: Node) => {
    if (node.type === 'list') { for (const item of node.children ?? []) walk(item); return }
    if (['paragraph', 'heading', 'quote', 'listitem'].includes(node.type)) {
      const t = plain({ ...node, children: (node.children ?? []).filter(c => c.type !== 'list') }).trim(); if (t) out.push(t)
      for (const child of node.children ?? []) if (child.type === 'list') walk(child)
      return
    }
    for (const child of node.children ?? []) walk(child)
  }
  if (value?.root) walk(value.root)
  return out
}

async function convertBodies(db: MigrateUpArgs['db'], table: 'articles' | '_articles_v', column: 'body' | 'version_body', direction: 'up' | 'down') {
  const rows = (await db.execute(sql.raw(`SELECT id, "${column}" AS body FROM "${table}" WHERE "${column}" IS NOT NULL`))).rows as { id: number; body: unknown }[]
  for (const row of rows) {
    let next: unknown = null
    if (direction === 'up' && Array.isArray(row.body)) next = toLexical(row.body)
    if (direction === 'down' && row.body && typeof row.body === 'object' && !Array.isArray(row.body)) next = toParagraphs(row.body as { root?: Node })
    if (next !== null) await db.execute(sql`UPDATE ${sql.raw(`"${table}"`)} SET ${sql.raw(`"${column}"`)} = ${JSON.stringify(next)}::jsonb WHERE id = ${row.id}`)
  }
}

const TO_TIMESTAMP = (column: string) => `CASE
  WHEN "${column}" IS NULL OR btrim("${column}") = '' THEN NULL
  WHEN "${column}" ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN ("${column}" || ' 09:00')::timestamp AT TIME ZONE 'Europe/Madrid'
  WHEN "${column}" ~ '^\\d{4}-\\d{2}-\\d{2}[T ]\\d{2}:\\d{2}(:\\d{2}(\\.\\d+)?)?$' THEN replace("${column}", 'T', ' ')::timestamp AT TIME ZONE 'Europe/Madrid'
  WHEN "${column}" ~ '^\\d{4}-\\d{2}-\\d{2}[T ]\\d{2}:\\d{2}(:\\d{2}(\\.\\d+)?)?(Z|[+-]\\d{2}(:?\\d{2})?)$' THEN "${column}"::timestamptz
  ELSE NULL END`
const TO_TEXT = (column: string) => `to_char("${column}" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const [table, prefix] of [['articles', ''], ['_articles_v', 'version_']] as const) {
    for (const column of [`${prefix}published_at`, `${prefix}scheduled_at`, `${prefix}agenda_event_at`]) {
      await db.execute(sql.raw(`ALTER TABLE "${table}" ALTER COLUMN "${column}" SET DATA TYPE timestamp(3) with time zone USING ${TO_TIMESTAMP(column)}`))
    }
    const date = `${prefix}date`, published = `${prefix}published_at`, scheduled = `${prefix}scheduled_at`
    await db.execute(sql.raw(`UPDATE "${table}" SET "${published}" = (${TO_TIMESTAMP(date)}) WHERE "${published}" IS NULL`))
    await db.execute(sql.raw(`UPDATE "${table}" SET "${published}" = "${scheduled}" WHERE "${scheduled}" IS NOT NULL`))
    await db.execute(sql.raw(`UPDATE "${table}" SET "${date}" = to_char("${published}" AT TIME ZONE 'Europe/Madrid', 'YYYY-MM-DD') WHERE "${published}" IS NOT NULL`))
  }
  await convertBodies(db, 'articles', 'body', 'up')
  await convertBodies(db, '_articles_v', 'version_body', 'up')
  await db.execute(sql`
  ALTER TABLE "users" ADD COLUMN "author_id" integer;
  ALTER TABLE "users" ADD CONSTRAINT "users_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "users_author_idx" ON "users" USING btree ("author_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "users" DROP CONSTRAINT "users_author_id_authors_id_fk";
  DROP INDEX "users_author_idx";
  ALTER TABLE "users" DROP COLUMN "author_id";`)
  for (const [table, prefix] of [['articles', ''], ['_articles_v', 'version_']] as const) {
    for (const column of [`${prefix}published_at`, `${prefix}scheduled_at`, `${prefix}agenda_event_at`]) {
      await db.execute(sql.raw(`ALTER TABLE "${table}" ALTER COLUMN "${column}" SET DATA TYPE varchar USING ${TO_TEXT(column)}`))
    }
  }
  await convertBodies(db, 'articles', 'body', 'down')
  await convertBodies(db, '_articles_v', 'version_body', 'down')
}
