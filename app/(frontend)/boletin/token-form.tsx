"use client";
import { useActionState } from "react";
import type { TokenState } from "./actions";

/** Botón de una página de enlace de correo (confirmar o darse de baja): una acción, un clic. */
export function TokenForm({ token, label, action }: { token: string; label: string; action: (state: TokenState, form: FormData) => Promise<TokenState> }) {
  const [state, run, pending] = useActionState<TokenState, FormData>(action, { ok: false, message: "" });
  if (state.message) return <p role="status" className="mt-6 border-l-4 border-moss bg-white/60 p-6 text-lg leading-8" data-token-result={state.ok}>{state.message}</p>;
  return <form action={run} className="mt-6"><input type="hidden" name="t" value={token} />
    <button disabled={pending} className="min-h-12 bg-coal-950 px-8 text-base font-bold text-white hover:bg-copper disabled:opacity-60">{pending ? "Un momento…" : label}</button></form>;
}
