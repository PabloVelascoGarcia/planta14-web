"use client";
import { useEffect } from "react";

// /cms/ayuda abierta desde un enlace de otra web: comprueba la sesión del CMS desde la propia página (petición del mismo
// sitio) y vuelve a cargar la Ayuda con ella; sin sesión, a la pantalla de acceso.
export function HelpSessionCheck({ login }: { login: string }) {
  useEffect(() => {
    fetch("/api/cms/users/me", { credentials: "same-origin", cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then(body => window.location.replace(body?.user ? `/cms/ayuda${window.location.hash}` : login))
      .catch(() => window.location.replace(login));
  }, [login]);
  return <p style={{ padding: 24 }} data-cms-help-check>Comprobando la sesión…</p>;
}
