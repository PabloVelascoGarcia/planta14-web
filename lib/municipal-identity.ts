import type { CSSProperties } from "react";

/**
 * Identidad visual de un espacio municipal (foto de cabecera, lema, escudo, colores y enlaces).
 * Con CONTENT_SOURCE=payload sale de Espacios municipales en el CMS; en la demo, de lib/demo/identities.ts.
 * Todo es opcional: lo que falte se omite y la página usa el diseño neutro.
 */
export type MunicipalStory = { id: string; number: string; label: string; title: string; text: string; href: string };
export type MunicipalIdentity = {
  name: string;
  image?: string; imageAlt?: string; imageCredit?: string; imageSource?: string; imageLicenseUrl?: string;
  title?: string; subtitle?: string;
  crest?: string; crestCredit?: string; crestSource?: string; crestLicenseUrl?: string;
  accent?: string; dark?: string; soft?: string; border?: string;
  official?: string; tourism?: string;
  stories: MunicipalStory[];
};

/** El diseño propio del concejo solo se aplica con los cuatro colores; si falta alguno, diseño neutro. */
export function hasTheme(identity?: MunicipalIdentity): identity is MunicipalIdentity & { accent: string; dark: string; soft: string; border: string } {
  return Boolean(identity?.accent && identity.dark && identity.soft && identity.border);
}
export function identityStyle(identity?: MunicipalIdentity): CSSProperties | undefined {
  return hasTheme(identity) ? { "--municipal-copper": identity.accent, "--local-dark": identity.dark, "--local-soft": identity.soft, "--local-border": identity.border } as CSSProperties : undefined;
}
