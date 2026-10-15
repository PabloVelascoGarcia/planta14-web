import { voiceDemoEnabled } from "@/lib/site-config";
import { municipalContents, getMunicipalSpace } from "@/lib/demo/municipal";
import { agenda } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";

export function AgendaList() {
  return (
    <div className="divide-y divide-coal-900/15 border-y border-coal-900/15">
      {(voiceDemoEnabled ? municipalContents.filter(c => c.type === "event" && getMunicipalSpace(c.space)).slice(0, 4).map(c => ({ title: c.title, date: c.eventAt!.slice(0, 10), place: c.place!, concejo: getMunicipalSpace(c.space)!.name.replace("Ayuntamiento de ", ""), description: "Agenda de muestra · Publica el ayuntamiento" })) : agenda).map((event) => (
        <article key={`${event.title}-${event.date}`} className="grid gap-2 py-4 sm:grid-cols-[150px_1fr]">
          <time className="text-xs font-black uppercase tracking-[0.16em] text-copper" dateTime={event.date}>
            {formatDate(event.date)}
          </time>
          <div>
            <h3 className="font-serif text-xl font-black">{event.title}</h3>
            <p className="mt-1 text-sm font-bold text-coal-800">{event.place}, {event.concejo}</p>
            <p className="mt-1 text-sm leading-6 text-coal-800">{event.description}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
