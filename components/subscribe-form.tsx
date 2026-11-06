"use client";
import { useActionState, useId } from "react";
import Link from "next/link";
import { subscribe, type SubscribeState } from "@/app/(frontend)/boletin/actions";

const TOWNS = ["Mieres", "Lena", "Aller", "Morcín", "Riosa", "Ribera de Arriba"];
const slug = (name: string) => name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");

/**
 * Alta en el boletín con doble confirmación. `variant`: «split» (portada: a la izquierda `intro`, correo y botón; a la
 * derecha qué recibir y los concejos; consentimiento debajo, en letra pequeña), «compact» (pie: las opciones van
 * plegadas tras un enlace discreto) o «full». `tone`: «dark» sobre fondo oscuro.
 */
export function SubscribeForm({ source, variant = "full", tone = "dark", intro = null }: { source: "portada" | "pie" | "fiesta" | "noticia"; variant?: "full" | "compact" | "split"; tone?: "dark" | "light"; intro?: React.ReactNode }) {
  const [state, action, pending] = useActionState<SubscribeState, FormData>(subscribe, { ok: false });
  const id = useId();
  // Tras un error se repinta con lo que se había escrito (React vacía el formulario al terminar la acción).
  const v = state.values;
  const key = v ? JSON.stringify(v) : "inicial";
  const muted = tone === "dark" ? "text-white/80" : "text-coal-800";
  const box = tone === "dark" ? "border-white/40 bg-white text-coal-950" : "border-coal-900/30 bg-white text-coal-950";
  if (state.ok) return <p role="status" className={`text-[15px] leading-7 ${muted}`} data-subscribe-done>{state.message}</p>;
  const error = (name: string) => state.errors?.[name] ? <span className={`block text-[14px] font-bold ${tone === "dark" ? "text-amber-200" : "text-red-800"}`}>{state.errors[name]}</span> : null;
  // Casillas: 44 px de alto en pantallas táctiles; pequeñas y juntas en ordenador con ratón (.nl-check, globals.css).
  const check = "nl-check flex items-center gap-2 text-[15px]";
  const options = <>
    <fieldset className={variant === "split" ? "" : "mt-4"}><legend className="text-[14px] font-bold">Qué quieres recibir</legend>
      <label className={`mt-1 ${check}`}><input type="checkbox" name="topics" value="finde" defaultChecked={v ? v.topics.includes("finde") : true} className="h-4 w-4 shrink-0" /> Qué hacer este finde</label>
      <label className={check}><input type="checkbox" name="topics" value="avisos" defaultChecked={v ? v.topics.includes("avisos") : true} className="h-4 w-4 shrink-0" /> Avisos de mi concejo</label>
      {error("topics")}
    </fieldset>
    <fieldset className="mt-3"><legend className="text-[14px] font-bold">Tus concejos <span className="font-normal">(si no marcas ninguno, los seis)</span></legend>
      <div className="mt-1 grid grid-cols-2 gap-x-4 sm:grid-cols-3">{TOWNS.map(t => <label key={t} className={check}><input type="checkbox" name="towns" value={slug(t)} defaultChecked={v?.towns.includes(slug(t))} className="h-4 w-4 shrink-0" /> {t}</label>)}</div>
    </fieldset>
  </>;
  const small = variant === "full" ? "text-[14px] leading-6" : "text-[13px] leading-5";
  const consent = <>
    <label className={`nl-check mt-3 flex items-start gap-3 ${small}`}><input type="checkbox" name="consent" required defaultChecked={v?.consent} className="mt-0.5 h-4 w-4 shrink-0" />
      <span>Acepto recibir el boletín de Planta 14 por correo, según la política de privacidad. Me podré dar de baja con un clic desde cada correo.</span></label>
    {/* Enlace en su propia línea: zona táctil de 44 px en pantallas táctiles. */}
    <Link href="/privacidad" className={`nl-link ml-7 inline-flex items-center font-bold underline ${small}`}>Política de privacidad</Link>
    {error("consent")}
  </>;
  // Correo y botón: más bajos en el pie y la portada (44 px en pantallas táctiles). Texto de ejemplo corto para que
  // quepa entero en el móvil.
  const field = variant === "full" ? "min-h-12" : "nl-field";
  const email = <>
    <label htmlFor={`${id}-email`} className="text-[14px] font-bold">Tu correo</label>
    <div className="mt-1 flex flex-wrap gap-2">
      <input id={`${id}-email`} name="email" type="email" required autoComplete="email" defaultValue={v?.email} placeholder="tu@correo.es" className={`${field} min-w-0 flex-1 basis-40 border px-3 text-base ${box}`} />
      <button disabled={pending} className={`${field} px-5 text-base font-bold ${tone === "dark" ? "bg-copper text-white hover:bg-white hover:text-coal-950" : "bg-coal-950 text-white hover:bg-copper"} disabled:opacity-60`}>{pending ? "Enviando…" : "Suscribirme"}</button>
    </div>
    {error("email")}
  </>;
  const hidden = <>
    <input type="hidden" name="source" value={source} />
    <div aria-hidden="true" className="absolute left-[-9999px] h-px w-px overflow-hidden"><label>Web<input name="web" tabIndex={-1} autoComplete="off" /></label></div>
  </>;
  if (variant === "split") return (
    <form key={key} action={action} className="grid gap-x-10 gap-y-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]" data-subscribe-form={source} noValidate>
      {hidden}
      <div>{intro}<div className="mt-4">{email}</div></div>
      <div>{options}</div>
      <div className="md:col-span-2">{consent}{state.message && !state.ok ? <p role="alert" className="mt-2 text-[14px] font-bold">{state.message}</p> : null}</div>
    </form>
  );
  return (
    <form key={key} action={action} className="mt-4" data-subscribe-form={source} noValidate>
      {hidden}
      {email}
      {variant === "compact" ? <details className="mt-1" open={Boolean(state.errors?.topics)}><summary className="nl-link inline-flex cursor-pointer items-center text-[13px] underline underline-offset-2">Elegir concejos</summary>{options}</details> : options}
      {consent}
      {state.message && !state.ok ? <p role="alert" className="mt-2 text-[14px] font-bold">{state.message}</p> : null}
    </form>
  );
}
