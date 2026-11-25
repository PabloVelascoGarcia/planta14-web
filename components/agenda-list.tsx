import Link from "next/link";
import { voiceDemoEnabled } from "@/lib/site-config";
import { municipalContents, getMunicipalSpace, spaceIsActive } from "@/lib/demo/municipal";
import { agenda } from "@/lib/mock-data";
import { formatDate, slugify } from "@/lib/utils";
import { getArticles } from "@/lib/cms";
import { contentSource } from '@/lib/content-source';
import { getMunicipalContents, getMunicipalSpace as getSpace } from '@/lib/municipal-content';
import { fiestaDates, getFiestas } from '@/lib/fiestas';

export type AgendaItem = { title: string; date: string; time?: string; place: string; concejo: string; description: string; href?: string };

/** Agenda con contenido real: eventos municipales, agenda general (noticias de Agenda con fecha) y fiestas, solo los próximos. */
async function payloadAgenda(limit: number): Promise<AgendaItem[]> {
  // PLANTA14_TEST_TODAY (AAAA-MM-DD) solo para pruebas con fecha fija.
  const today = process.env.PLANTA14_TEST_TODAY || new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
  const municipal = await Promise.all((await getMunicipalContents()).filter(c => c.type === 'event' && c.eventAt).map(async c => {
    // Solo los eventos de concejos con el espacio municipal activo (los inactivos no publican agenda municipal).
    const space = await getSpace(c.space);
    return space && spaceIsActive(space) ? { title: c.title, date: c.eventAt!.slice(0, 10), time: c.eventAt!.slice(11, 16) || undefined, place: c.place || '', concejo: space.name.replace('Ayuntamiento de ', ''), description: c.excerpt ? `${c.excerpt} · Publica el ayuntamiento` : 'Publica el ayuntamiento', href: `/${space.id}?seccion=event`, sort: c.eventAt! } : null;
  }));
  const general = (await getArticles()).filter(a => a.eventAt && slugify(a.topic) === 'agenda').map(a => ({
    title: a.title, date: a.eventAt!.slice(0, 10), time: a.eventAt!.slice(11, 16) || undefined, place: a.eventPlace || '', concejo: a.concejo,
    description: a.excerpt, href: `/noticia/${a.slug}`, sort: a.eventAt!,
  }));
  // Fiestas de las Cuencas: mientras no hayan terminado, con sus fechas.
  const fiestas = (await getFiestas()).filter(f => f.endDay >= today).map(f => ({
    title: f.name, date: f.startDay, until: f.endDay, time: undefined as string | undefined, place: f.village, concejo: f.town, description: `Fiestas · ${fiestaDates(f)}`, href: `/fiestas/${f.slug}`, sort: f.startDay,
  }));
  return [...general, ...fiestas, ...municipal.filter(e => e !== null)]
    .filter(e => ('until' in e && e.until ? e.until : e.date) >= today)
    .sort((a, b) => a.sort.localeCompare(b.sort))
    .slice(0, limit)
    .map(item => ({ title: item.title, date: item.date, time: item.time, place: item.place, concejo: item.concejo, description: item.description, href: 'href' in item ? String(item.href) : undefined }));
}

/** Próximas citas de la agenda (las mismas que pinta AgendaList), para saber antes si el bloque tiene algo. */
export async function getAgendaItems(limit = 4): Promise<AgendaItem[]> {
  if (contentSource() === 'payload') return payloadAgenda(limit);
  return voiceDemoEnabled
    ? municipalContents.filter(c => c.type === "event" && getMunicipalSpace(c.space)).slice(0, 4).map(c => ({ title: c.title, date: c.eventAt!.slice(0, 10), place: c.place!, concejo: getMunicipalSpace(c.space)!.name.replace("Ayuntamiento de ", ""), description: "Agenda de muestra · Publica el ayuntamiento" }))
    : agenda;
}

/** Sin citas próximas: `empty` (texto) o nada. */
export async function AgendaList({ limit = 4, items, empty }: { limit?: number; items?: AgendaItem[]; empty?: string } = {}) {
  const events = items ?? await getAgendaItems(limit);
  if (!events.length) return empty ? <p className="border-y border-coal-900/15 py-6 text-lg text-steel" data-empty-agenda>{empty}</p> : null;
  return (
    <div className="divide-y divide-coal-900/15 border-y border-coal-900/15">
      {events.map((event) => (
        <article key={`${event.title}-${event.date}`} className="grid gap-2 py-4 sm:grid-cols-[150px_1fr]">
          <time className="text-xs font-black uppercase tracking-[0.16em] text-copper" dateTime={event.date}>
            {formatDate(event.date)}{event.time ? ` · ${event.time} h` : ""}
          </time>
          <div>
            <h3 className="font-serif text-xl font-black">{event.href ? <Link href={event.href} className="hover:text-copper">{event.title}</Link> : event.title}</h3>
            <p className="mt-1 text-sm font-bold text-coal-800">{[event.place, event.concejo].filter(Boolean).join(", ")}</p>
            <p className="mt-1 text-sm leading-6 text-coal-800">{event.description}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
