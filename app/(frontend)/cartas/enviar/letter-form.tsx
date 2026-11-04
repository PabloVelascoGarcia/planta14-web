"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { sendLetter, type LetterState } from "./actions";

const field = "grid gap-2 text-[15px] font-bold";
const input = "admin-input min-h-12 text-base font-normal";
const hint = "text-[13px] font-normal text-steel";
const MAX = 2000;

export function LetterForm({ towns }: { towns: { slug: string; name: string }[] }) {
  const [state, action, pending] = useActionState<LetterState, FormData>(sendLetter, { ok: false });
  const v = state.values ?? {};
  const [length, setLength] = useState((v.body ?? "").length);
  if (state.ok) return <div role="status" className="border-l-4 border-moss bg-white/60 p-6 text-lg leading-8" data-letter-sent>{state.message}</div>;
  const error = (name: string) => state.errors?.[name] ? <span className="text-[14px] font-bold text-red-800" id={`${name}-error`}>{state.errors[name]}</span> : null;
  return (
    <form key={JSON.stringify(v)} action={action} className="grid max-w-2xl gap-6" data-letter-form noValidate>
      {state.message ? <p role="alert" className="border-l-4 border-red-800 bg-white/60 p-4 font-bold">{state.message}</p> : null}
      <div aria-hidden="true" className="absolute left-[-9999px] h-px w-px overflow-hidden"><label>Web<input name="web" tabIndex={-1} autoComplete="off" /></label></div>
      <fieldset className="grid gap-5"><legend className="font-serif text-2xl font-black">Tus datos</legend>
        <p className={hint}>Se publican tu nombre, tus apellidos y tu concejo. El DNI, el teléfono y el correo no se publican nunca: sirven para comprobar que la carta es tuya. DNI y teléfono se guardan cifrados y se borran a los 24 meses.</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className={field}>Nombre<input name="firstName" required maxLength={80} defaultValue={v.firstName} className={input} autoComplete="given-name" />{error("firstName")}</label>
          <label className={field}>Apellidos<input name="lastName" required maxLength={120} defaultValue={v.lastName} className={input} autoComplete="family-name" />{error("lastName")}</label>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className={field}>DNI o NIE<input name="dni" required maxLength={20} defaultValue={v.dni} className={input} autoComplete="off" />{error("dni")}</label>
          <label className={field}>Teléfono<input name="phone" required maxLength={30} defaultValue={v.phone} className={input} autoComplete="tel" />{error("phone")}</label>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className={field}>Correo electrónico<input name="email" type="email" required maxLength={200} defaultValue={v.email} className={input} autoComplete="email" /><span className={hint}>Te pediremos que lo confirmes.</span>{error("email")}</label>
          <label className={field}>Concejo<select name="town" required defaultValue={v.town ?? ""} className={input}><option value="" disabled>Elige tu concejo</option>{towns.map(t => <option key={t.slug} value={t.slug}>{t.name}</option>)}</select>{error("town")}</label>
        </div>
      </fieldset>
      <fieldset className="grid gap-3"><legend className="font-serif text-2xl font-black">Tu carta</legend>
        <label className={field}>Texto<textarea name="body" required rows={12} maxLength={MAX} defaultValue={v.body} onChange={e => setLength(e.target.value.length)} className={`${input} py-3`} /></label>
        <span className={hint} aria-live="polite" data-letter-count>{length} de {MAX} caracteres</span>{error("body")}
      </fieldset>
      <div className="grid gap-3">
        <label className="flex items-start gap-3 text-[15px]"><input name="rules" type="checkbox" required defaultChecked={v.rules === "on"} className="mt-1 h-5 w-5 shrink-0" /><span>He leído y acepto las <Link href="/normas-cartas" className="font-bold underline">normas de las cartas de los lectores</Link>.</span></label>{error("rules")}
        <label className="flex items-start gap-3 text-[15px]"><input name="privacy" type="checkbox" required defaultChecked={v.privacy === "on"} className="mt-1 h-5 w-5 shrink-0" /><span>Acepto que Planta 14 trate estos datos para verificar y publicar la carta, según la <Link href="/privacidad" className="font-bold underline">política de privacidad</Link>.</span></label>{error("privacy")}
      </div>
      <button disabled={pending} className="min-h-12 justify-self-start bg-coal-950 px-8 text-base font-bold text-white hover:bg-copper disabled:opacity-60">{pending ? "Enviando…" : "Enviar la carta"}</button>
    </form>
  );
}
