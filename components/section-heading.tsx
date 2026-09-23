import Link from "next/link";
type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  href?: string;
};

export function SectionHeading({ eyebrow, title, href }: SectionHeadingProps) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4 border-b-2 border-coal-950 pb-2">
      <div>
        {eyebrow ? (
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-copper">{eyebrow}</p>
        ) : null}
        <h2 className="font-serif text-3xl font-black leading-none text-coal-950">{title}</h2>
      </div>
      {href ? <Link href={href} className="text-xs font-bold text-copper whitespace-nowrap">Ver todo ↗</Link> : null}
    </div>
  );
}
