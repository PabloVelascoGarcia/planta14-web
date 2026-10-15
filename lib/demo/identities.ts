import type { CSSProperties } from "react";
import records from "./data/municipal-identities.json";
import { allerIdentity } from "./aller";

type Identity = typeof allerIdentity & {
  name: string; accent: string; dark: string; soft: string; border: string;
  crestLicenseUrl: string; imageLicenseUrl: string; official: string; tourism: string;
};
const identities: Record<string, Identity> = {
  aller: { ...allerIdentity, name: "Aller", accent: "#315c49", dark: "#243d32", soft: "#edf0e6", border: "#d3ddc9", crestLicenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/", imageLicenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/", official: "https://www.aller.es/", tourism: "https://visitaaller.es/" },
  ...records
};
export function getMunicipalIdentity(slug: string): Identity | undefined { return identities[slug]; }
export function identityStyle(identity?: Identity): CSSProperties | undefined {
  return identity ? { "--municipal-copper": identity.accent, "--local-dark": identity.dark, "--local-soft": identity.soft, "--local-border": identity.border } as CSSProperties : undefined;
}
