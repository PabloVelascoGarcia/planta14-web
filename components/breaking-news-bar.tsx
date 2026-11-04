"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Barra de «Última hora» bajo la cabecera (no en las páginas de concejo, que no llevan la cabecera del periódico). */
export function BreakingNewsBar({ text, link, townSlugs = [] }: { text: string; link: string | null; townSlugs?: string[] }) {
  const pathname = usePathname();
  if (townSlugs.some(slug => pathname === `/${slug}` || pathname.startsWith(`/${slug}/`))) return null;
  const content = <><strong className="mr-2 uppercase tracking-[0.14em]">Última hora</strong><span>{text}</span>{link ? <span aria-hidden="true" className="ml-2">↗</span> : null}</>;
  return (
    <div role="region" aria-label="Última hora" className="bg-[#a3261b] text-white" data-breaking-news>
      <div className="container-p14 py-2 text-[15px] leading-6">
        {link ? (/^https:/.test(link) ? <a href={link} className="flex min-h-11 items-center hover:underline" rel="noopener noreferrer">{content}</a> : <Link href={link} className="flex min-h-11 items-center hover:underline">{content}</Link>) : <p className="flex min-h-11 items-center">{content}</p>}
      </div>
    </div>
  );
}
