import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload';

// Al activar o desactivar un espacio municipal (o cambiar lo que oculta en «Útil») se revalida toda la web para que se
// note sin desplegar. Las páginas ya se generan en cada petición (layout dinámico); esto vacía además cualquier caché de
// Next. Fuera de una petición de Next (scripts, migraciones) no hay nada que revalidar y se ignora.
export async function revalidateSite() {
  try {
    const { revalidatePath } = await import('next/cache');
    revalidatePath('/', 'layout');
  } catch { /* fuera de Next */ }
}
export const revalidateAfterChange: CollectionAfterChangeHook = async ({ doc }) => { await revalidateSite(); return doc; };
export const revalidateAfterDelete: CollectionAfterDeleteHook = async ({ doc }) => { await revalidateSite(); return doc; };
