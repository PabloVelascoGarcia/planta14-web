"use client";
import { useActionState } from "react";
import Link from "next/link";
import { sendFiesta, type FiestaFormState } from "./actions";

const field = "grid gap-2 text-[15px] font-bold";
const input = "admin-input min-h-12 text-base font-normal";
const hint = "text-[13px] font-normal text-steel";

export function FiestaForm({ towns }: { towns: { slug: string; name: string }[] }) {
  const [state, action, pending] = useActionState<FiestaFormState, FormData>(sendFiesta, { ok: false });
  if (state.ok) return <div role="status" className="border-l-4 border-moss bg-white/60 p-6 text-lg leading-8" data-fiesta-sent>{state.message}</div>;
  const error = (name: string) => state.errors?.[name] ? <span className="text-[14px] font-bold text-red-800" id={`${name}-error`}>{state.errors[name]}</span> : null;
  return (
    <form action={action} className="grid max-w-2xl gap-6" data-fiesta-form noValidate>
      {state.message ? <p role="alert" className="border-l-4 border-red-800 bg-white/60 p-4 font-bold">{state.message}</p> : null}
      {/* Trampa para robots: no la rellenes. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-px w-px overflow-hidden"><label>Web<input name="web" tabIndex={-1} autoComplete="off" /></label></div>
      <fieldset className="grid gap-5"><legend className="font-serif text-2xl font-black">La fiesta</legend>
        <label className={field}>Nombre de la fiesta<input name="name" required maxLength={120} className={input} placeholder="San Juan, El Carmen, Santa Bárbara…" />{error("name")}</label>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className={field}>Pueblo o barrio<input name="village" required maxLength={80} className={input} />{error("village")}</label>
          <label className={field}>Concejo<select name="town" required className={input} defaultValue=""><option value="" disabled>Elige el concejo</option>{towns.map(t => <option key={t.slug} value={t.slug}>{t.name}</option>)}</select>{error("town")}</label>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className={field}>Primer día<input name="startDay" type="date" required className={input} />{error("startDay")}</label>
          <label className={field}>Último día<input name="endDay" type="date" className={input} /><span className={hint}>Déjalo vacío si dura un solo día.</span>{error("endDay")}</label>
        </div>
        <label className={field}>Programa<textarea name="program" rows={9} maxLength={8000} className={`${input} py-3`} placeholder={"Sábado 15\n12:00 Misa y procesión\n18:00 Juegos infantiles\n23:00 Verbena"} /><span className={hint}>Un acto por línea; deja una línea en blanco entre días. La redacción lo revisará.</span></label>
      </fieldset>
      <fieldset className="grid gap-5"><legend className="font-serif text-2xl font-black">Cartel (opcional)</legend>
        <label className={field}>Archivo del cartel<input name="poster" type="file" accept="image/jpeg,image/png,image/webp" className="text-base font-normal" /><span className={hint}>JPG, PNG o WebP, hasta 5 MB.</span>{error("poster")}</label>
        <label className={field}>Autoría del cartel<input name="posterCredit" maxLength={160} className={input} placeholder="Quién lo diseñó o hizo la foto" />{error("posterCredit")}</label>
        <label className="flex items-start gap-3 text-[15px]"><input name="posterRights" type="checkbox" className="mt-1 h-5 w-5 shrink-0" /><span>Declaro que la organización tiene derecho a ceder este cartel a Planta 14 para publicarlo con la fiesta y que la autoría indicada es correcta.</span></label>{error("posterRights")}
      </fieldset>
      <fieldset className="grid gap-5"><legend className="font-serif text-2xl font-black">Quién la envía</legend>
        <p className={hint}>Estos datos no se publican: solo sirven para que la redacción pueda contactar contigo.</p>
        <label className={field}>Organiza<input name="organizer" required maxLength={120} className={input} placeholder="Comisión de fiestas, asociación vecinal…" />{error("organizer")}</label>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className={field}>Tu nombre<input name="submitterName" required maxLength={120} className={input} autoComplete="name" />{error("submitterName")}</label>
          <label className={field}>Teléfono (opcional)<input name="phone" maxLength={40} className={input} autoComplete="tel" /></label>
        </div>
        <label className={field}>Correo electrónico<input name="email" type="email" required maxLength={200} className={input} autoComplete="email" /><span className={hint}>Te enviaremos un enlace para confirmar el envío.</span>{error("email")}</label>
        <label className="flex items-start gap-3 text-[15px]"><input name="privacy" type="checkbox" required className="mt-1 h-5 w-5 shrink-0" /><span>Acepto que Planta 14 guarde estos datos para revisar y publicar la fiesta, según la <Link href="/privacidad" className="font-bold underline">política de privacidad</Link>.</span></label>{error("privacy")}
      </fieldset>
      <button disabled={pending} className="min-h-12 justify-self-start bg-coal-950 px-8 text-base font-bold text-white hover:bg-copper disabled:opacity-60">{pending ? "Enviando…" : "Enviar la fiesta"}</button>
    </form>
  );
}
