import Link from "next/link";
import { territories, topics } from "@/lib/mock-data";
import { slugify } from "@/lib/utils";

const secondaryLinks = topics.map((topic) => ({
  label: topic,
  href: topic === "Opinión" ? "/opinion" : topic === "Agenda" ? "/agenda" : `/tema/${slugify(topic)}`
})).concat({ label: "Admin", href: "/admin" });

export function Header() {
  return (
    <header className="bg-paper">
      <div className="container-p14 py-4 sm:py-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 border-b border-coal-900/15 pb-4 md:flex-row md:items-end md:justify-between">
            <Link href="/" className="group w-fit">
              <span className="block text-[11px] font-bold uppercase tracking-[0.24em] text-copper">
                Periódico digital de las cuencas
              </span>
              <span className="mt-1 block font-serif text-5xl font-black leading-none text-coal-950 sm:text-6xl">
                Planta 14
              </span>
            </Link>
            <nav aria-label="Secciones secundarias" className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold">
              {secondaryLinks.map((link) => (
                <Link key={link.label} href={link.href} className="text-coal-800 hover:text-copper">
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <nav aria-label="Territorio" className="grid gap-3 md:grid-cols-2">
            {Object.entries(territories).map(([comarca, concejos]) => (
              <div key={comarca} className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                <Link
                  href={`/comarca/${slugify(comarca)}`}
                  className="bg-coal-950 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white"
                >
                  {comarca}
                </Link>
                {concejos.map((concejo) => (
                  <Link
                    key={concejo}
                    href={`/concejo/${slugify(concejo)}`}
                    className="font-semibold text-coal-900 hover:text-copper"
                  >
                    {concejo}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
