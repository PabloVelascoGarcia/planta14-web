"use client";
import { useActionState, useId } from "react";
import Link from "next/link";
import { subscribe, type SubscribeState } from "@/app/(frontend)/boletin/actions";

const TOWNS = ["Mieres", "Lena", "Aller", "Morcín", "Riosa", "Ribera de Arriba"];
const slug = (name: string) => name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");

/**
 * Alta en el boletín con doble confirmación. `variant`: «full» (portada, fichas) o «compact» (pie: las opciones van
 * plegadas). `tone`: «dark» sobre fondo oscuro.
 */
export function SubscribeForm({ source, variant = "full", tone = "dark" }: { source: "portada" | "pie" | "fiesta" | "noticia"; variant?: "full" | "compact"; tone?: "dark" | "light" }) {
  const [state, action, pending] = useActionState<SubscribeState, FormData>(subscribe, { ok: false });
  const id = useId();
  // Tras un error se repinta con lo que se había escrito (React vacía el formulario al terminar la acción).
  const v = state.values;
  const key = v ? JSON.stringify(v) : "inicial";
  const muted = tone === "dark" ? "text-white/80" : "text-coal-800";
  const box = tone === "dark" ? "border-white/40 bg-white text-coal-950" : "border-coal-900/30 bg-white text-coal-950";
  if (state.ok) return <p role="status" className={`text-[15px] leading-7 ${muted}`} data-subscribe-done>{state.message}</p>;
  const error = (name: string) => state.errors?.[name] ? <span className={`block text-[14px] font-bold ${tone === "dark" ? "text-amber-200" : "text-red-800"}`}>{state.errors[name]}</span> : null;
  const options = <>
    <fieldset className="mt-4"><legend className="text-[14px] font-bold">Qué quieres recibir</legend>
      <label className="mt-2 flex min-h-11 items-center gap-3 text-[15px]"><input type="checkbox" name="topics" value="finde" defaultChecked={v ? v.topics.includes("finde") : true} className="h-5 w-5" /> Qué hacer este finde</label>
      <label className="flex min-h-11 items-center gap-3 text-[15px]"><input type="checkbox" name="topics" value="avisos" defaultChecked={v ? v.topics.includes("avisos") : true} className="h-5 w-5" /> Avisos de mi concejo</label>
      {error("topics")}
    </fieldset>
    <fieldset className="mt-3"><legend className="text-[14px] font-bold">Tus concejos <span className="font-normal">(si no marcas ninguno, los seis)</span></legend>
      <div className="mt-1 grid grid-cols-2 gap-x-4 sm:grid-cols-3">{TOWNS.map(t => <label key={t} className="flex min-h-11 items-center gap-3 text-[15px]"><input type="checkbox" name="towns" value={slug(t)} defaultChecked={v?.towns.includes(slug(t))} className="h-5 w-5" /> {t}</label>)}</div>
    </fieldset>
  </>;
  return (
    <form key={key} action={action} className="mt-4" data-subscribe-form={source} noValidate>
      <input type="hidden" name="source" value={source} />
      <div aria-hidden="true" className="absolute left-[-9999px] h-px w-px overflow-hidden"><label>Web<input name="web" tabIndex={-1} autoComplete="off" /></label></div>
      <label htmlFor={`${id}-email`} className="text-[14px] font-bold">Tu correo</label>
      <div className="mt-1 flex flex-wrap gap-2">
        <input id={`${id}-email`} name="email" type="email" required autoComplete="email" defaultValue={v?.email} placeholder="nombre@correo.es" className={`min-h-12 min-w-0 flex-1 border px-3 text-base ${box}`} />
        <button disabled={pending} className={`min-h-12 px-5 text-base font-bold ${tone === "dark" ? "bg-copper text-white hover:bg-white hover:text-coal-950" : "bg-coal-950 text-white hover:bg-copper"} disabled:opacity-60`}>{pending ? "Enviando…" : "Suscribirme"}</button>
      </div>
      {error("email")}
      {variant === "compact" ? <details className="mt-2" open={Boolean(state.errors?.topics)}><summary className="flex min-h-11 cursor-pointer items-center text-[14px] font-bold">Elegir concejos y contenidos</summary>{options}</details> : options}
      <label className="mt-3 flex items-start gap-3 text-[14px] leading-6"><input type="checkbox" name="consent" required defaultChecked={v?.consent} className="mt-1 h-5 w-5 shrink-0" />
        <span>Acepto recibir el boletín de Planta 14 por correo. Me podré dar de baja con un clic desde cada correo. <Link href="/privacidad" className="py-1 font-bold underline">Política de privacidad</Link>.</span></label>
      {error("consent")}
      {state.message && !state.ok ? <p role="alert" className="mt-2 text-[14px] font-bold">{state.message}</p> : null}
    </form>
  );
}
