import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FiestaList } from "@/components/fiesta-list";
import { Newsletter } from "@/components/newsletter";
import { StatsScope } from "@/components/stats-beacon";
import { RichText } from "@/components/rich-text";
import { ShareButtons } from "@/components/share-buttons";
import { fiestaDates, getFiesta, getFiestas, upcoming } from "@/lib/fiestas";
import { jsonLdScript } from "@/lib/seo";
import { absoluteUrl, siteUrl } from "@/lib/site-config";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const fiesta = await getFiesta((await params).slug);
  if (!fiesta) return {};
  const description = `${fiesta.name} en ${fiesta.village} (${fiesta.town}), ${fiestaDates(fiesta)}. Programa de las fiestas.`;
  return { title: `${fiesta.name} · ${fiesta.village}`, description, alternates: { canonical: `/fiestas/${fiesta.slug}` },
    openGraph: { title: `${fiesta.name} · ${fiesta.village}`, description, url: `/fiestas/${fiesta.slug}`, type: "website" } };
}

export default async function FiestaPage({ params }: Props) {
  const fiesta = await getFiesta((await params).slug);
  if (!fiesta) notFound();
  const more = upcoming(await getFiestas()).filter(f => f.townSlug === fiesta.townSlug && f.slug !== fiesta.slug).slice(0, 4);
  const event = { "@context": "https://schema.org", "@type": "Event", name: `${fiesta.name} (${fiesta.village})`, startDate: fiesta.startDay, endDate: fiesta.endDay,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode", eventStatus: "https://schema.org/EventScheduled", url: absoluteUrl(`/fiestas/${fiesta.slug}`),
    location: { "@type": "Place", name: fiesta.village, address: { "@type": "PostalAddress", addressLocality: fiesta.village, addressRegion: "Asturias", addressCountry: "ES" } },
    ...(fiesta.image ? { image: [absoluteUrl(fiesta.image.url)] } : {}) };
  return (
    <article className="container-p14 py-8" data-fiesta={fiesta.slug}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(event) }} />
      <StatsScope town={fiesta.townSlug} section="fiestas" />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,760px)_300px]">
        <div>
          <p className="editorial-kicker"><Link href="/fiestas">Fiestas</Link> <span aria-hidden="true">/</span> <Link href={`/fiestas?concejo=${fiesta.townSlug}`}>{fiesta.town}</Link></p>
          <h1 className="mt-3 font-serif text-4xl font-black leading-[1.08] sm:text-6xl">{fiesta.name}</h1>
          <p className="mt-4 text-xl leading-8 text-coal-800">{fiesta.village} · <Link href={`/${fiesta.townSlug}`} className="hover:text-copper">{fiesta.town}</Link></p>
          <p className="mt-2 text-lg font-bold capitalize-first text-copper" data-fiesta-dates>{fiestaDates(fiesta)}</p>
          <ShareButtons url={`${siteUrl}/fiestas/${fiesta.slug}`} title={`${fiesta.name} · ${fiesta.village}`} />
          <div className="mt-8 flow-root">
            {/* Cartel pequeño y enmarcado, dentro de la ficha: acompaña al programa, no lo tapa. */}
            {fiesta.image ? <figure className="fiesta-poster" data-fiesta-poster>
              <img src={fiesta.image.url} srcSet={fiesta.image.srcSet} sizes={fiesta.image.srcSet ? "(min-width: 640px) 200px, 160px" : undefined} alt={fiesta.image.alt} loading="lazy" decoding="async" width={200} height={283} />
              <figcaption>Cartel: {fiesta.image.credit}</figcaption>
            </figure> : null}
            <h2 className="font-serif text-3xl font-black">Programa</h2>
            <div className="mt-4 space-y-4 font-serif text-lg leading-8 text-coal-900">
              {fiesta.description ? <p data-fiesta-description>{fiesta.description}</p> : null}{fiesta.program ? <RichText value={fiesta.program} /> : <p>El programa se publicará en cuanto lo tengamos.</p>}
            </div>
          </div>
          {fiesta.chronicle ? <p className="mt-8 border-t border-coal-900/15 pt-4"><Link href={`/noticia/${fiesta.chronicle.slug}`} className="inline-flex min-h-11 items-center text-lg font-bold text-copper hover:underline">Crónica: {fiesta.chronicle.title} ↗</Link></p> : null}
        </div>
        <aside className="space-y-8">
          {more.length ? <section><h2 className="border-b-2 border-coal-950 pb-2 font-serif text-2xl font-black">Más fiestas en {fiesta.town}</h2><div className="mt-2"><FiestaList fiestas={more} showTown={false} /></div></section> : null}
          <p><Link href="/fiestas/enviar" className="inline-flex min-h-11 items-center font-bold text-copper hover:underline">¿Organizas una fiesta? Envíanosla ↗</Link></p>
          <Newsletter source="fiesta" />
        </aside>
      </div>
    </article>
  );
}
