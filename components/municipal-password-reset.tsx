"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { hasTheme, identityStyle } from "@/lib/municipal-identity";
import type { MunicipalSpace } from "@/lib/demo/municipal";
import { MunicipalMasthead } from "./municipal-masthead";

import { MIN_PASSWORD_LENGTH } from "@/cms/password-reset";

// El token se lee una vez de la dirección (tras «#») y se conserva aunque luego se quite de la barra de direcciones.
let hashToken: string | undefined;
const readToken = () => (hashToken ??= new URLSearchParams(window.location.hash.slice(1)).get("token") || "");
const noSubscription = () => () => undefined;

/**
 * Página del enlace del correo «He olvidado mi contraseña» para las cuentas municipales
 * (/<concejo>/panel/restablecer#token=…). El token llega tras «#»: no pasa por el servidor hasta que se envía el
 * formulario. Al terminar, Payload deja la sesión iniciada y se vuelve al panel del concejo.
 */
export function MunicipalPasswordReset({ space, maintenance = null }: { space: MunicipalSpace; maintenance?: string | null }) {
  const router = useRouter();
  // null en el servidor (allí no hay «#»); en el navegador, el token o "".
  const token = useSyncExternalStore(noSubscription, readToken, () => null);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const panel = `/${space.id}/panel`;

  // Quita el token de la barra de direcciones y del historial.
  useEffect(() => { if (token && window.location.hash) window.history.replaceState(null, "", window.location.pathname); }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (password.length < MIN_PASSWORD_LENGTH) { setMessage(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`); return; }
    if (password !== repeat) { setMessage("Las dos contraseñas no coinciden."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/cms/users/reset-password", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const text = String(body?.errors?.[0]?.message || body?.message || "");
        setMessage(/actualiz/i.test(text) ? text : "El enlace no es válido o ha caducado (dura una hora y sirve una sola vez). Pide otro desde el panel.");
        return;
      }
      setDone(true);
      router.replace(panel);
      router.refresh();
    } catch { setMessage("No se ha podido cambiar la contraseña. Inténtalo de nuevo en unos minutos."); }
    finally { setBusy(false); }
  }

  return <div className={`municipal-shell ${hasTheme(space.identity) ? "aller-theme" : ""}`} style={identityStyle(space.identity)}>
    <MunicipalMasthead space={space} panel live />
    <div className="container-p14 municipal-panel-body">
      {maintenance ? <div className="municipal-demo-banner" role="status" data-maintenance="on"><span className="municipal-example">Mantenimiento</span><p>{maintenance}</p></div> : null}
      <div className="municipal-panel-heading"><div><p className="municipal-kicker">Cuenta de tu ayuntamiento</p><h2>Elige una<br />contraseña nueva.</h2></div></div>
      <div className="municipal-panel-grid">
        {token === null ? null : !token ? <div className="municipal-form" data-reset-state="sin-enlace">
          <p className="municipal-form-help">Este enlace no está completo. Abre el botón del correo que te enviamos o pide otro desde el panel con «¿Has olvidado tu contraseña?».</p>
          <Link className="municipal-text-link" href={panel}>Ir al panel de {space.name}</Link>
        </div> : done ? <div className="municipal-form" role="status" data-reset-state="hecho">
          <p className="municipal-form-status">Contraseña cambiada. Entrando en el panel…</p>
        </div> : <form onSubmit={submit} className="municipal-form" data-reset-state="formulario">
          <div className="municipal-step"><span>1</span><h3>Escribe tu contraseña nueva dos veces</h3></div>
          <p className="municipal-form-help">Al menos {MIN_PASSWORD_LENGTH} caracteres. Mejor una frase larga o una generada por un gestor de contraseñas.</p>
          <label>Contraseña nueva<input type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} value={password} onChange={e => setPassword(e.target.value)} required /></label>
          <label>Repite la contraseña<input type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} value={repeat} onChange={e => setRepeat(e.target.value)} required /></label>
          <div className="municipal-publish-actions"><button type="submit" className="municipal-cta" disabled={busy || Boolean(maintenance)}>{busy ? "Guardando…" : "Guardar y entrar ↗"}</button></div>
          <div role="status" className={message ? "municipal-form-status" : ""}>{message}</div>
          <Link className="municipal-text-link" href={panel}>Volver al panel</Link>
        </form>}
      </div>
    </div>
  </div>;
}
