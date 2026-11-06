"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** No pinta su contenido en el panel municipal (/[concejo]/panel…): p. ej., el boletín del pie. */
export function HideOnPanel({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  return /^\/[^/]+\/panel(\/|$)/.test(pathname) ? null : <>{children}</>;
}
