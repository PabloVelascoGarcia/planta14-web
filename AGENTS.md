<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Manuales: se actualizan en el mismo encargo (regla permanente)

Cada encargo que cambie algo de lo que ven o usan la redacción (CMS) o los ayuntamientos (panel municipal) actualiza,
en ese mismo encargo y antes de la batería:

- el manual que corresponda: `docs/MANUAL-REDACCION.md` (redacción), `docs/MANUAL-AYUNTAMIENTOS.md` (ayuntamientos) o
  los dos;
- sus capturas: `docs/img/manual-redaccion/` y `docs/img/manual-ayuntamientos/`. Se regeneran con el panel y el CMS
  reales: `MANUAL_REDACCION=$PWD/docs/img/manual-redaccion` (bloque `participacion-redaccion-noticias`) y
  `MANUAL_AYUNTAMIENTO=$PWD/docs/img/manual-ayuntamientos` (bloque `participacion-ayuda`) al pasar
  `npm run test:participacion`.

Los manuales se muestran en la **Ayuda** del CMS (`/cms/ayuda`) y del panel (pestaña «Ayuda»), y en PDF; se generan en
cada compilación (`npm run build` → `scripts/generar-manuales.mjs`). Por eso se escriben para quien los lee, sin
términos técnicos ni rutas del repositorio. Lo que sea solo de administración va entre
`<!-- solo-administracion -->` y `<!-- /solo-administracion -->`. La prueba `participacion-ayuda` comprueba que no
aparezcan términos técnicos.
