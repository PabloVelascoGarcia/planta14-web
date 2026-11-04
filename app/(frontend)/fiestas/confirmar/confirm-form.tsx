"use client";
import { useActionState } from "react";
import { confirmFiesta, type ConfirmState } from "../enviar/actions";

export function ConfirmForm({ token, name }: { token: string; name: string }) {
  const [state, action, pending] = useActionState<ConfirmState, FormData>(confirmFiesta, { ok: false, message: "" });
  if (state.message) return <p role="status" className="border-l-4 border-moss bg-white/60 p-6 text-lg leading-8" data-fiesta-confirmed={state.ok}>{state.message}</p>;
  return <form action={action} className="mt-6"><input type="hidden" name="t" value={token} />
    <button disabled={pending} className="min-h-12 bg-coal-950 px-8 text-base font-bold text-white hover:bg-copper disabled:opacity-60">{pending ? "Confirmando…" : `Confirmar el envío de «${name}»`}</button></form>;
}
