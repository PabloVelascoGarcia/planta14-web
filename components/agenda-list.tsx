import { voiceDemoEnabled } from "@/lib/site-config";
import { voiceAgenda } from "@/lib/voice-demo";
import { agenda } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";

export function AgendaList() {
  return (
    <div className="divide-y divide-coal-900/15 border-y border-coal-900/15">
      {(voiceDemoEnabled ? voiceAgenda : agenda).map((event) => (
        <article key={`${event.title}-${event.date}`} className="grid gap-2 py-4 sm:grid-cols-[150px_1fr]">
          <time className="text-xs font-black uppercase tracking-[0.16em] text-copper" dateTime={event.date}>
            {formatDate(event.date)}
          </time>
          <div>
            <h3 className="font-serif text-xl font-black">{event.title}</h3>
            <p className="mt-1 text-sm font-bold text-coal-800">{event.place}, {event.concejo}</p>
            <p className="mt-1 text-sm leading-6 text-coal-800">{event.description}</p>
            {event.sourceUrl ? <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-bold text-copper">Información en La Voz de Asturias ↗</a> : null}
          </div>
        </article>
      ))}
    </div>
  );
}
