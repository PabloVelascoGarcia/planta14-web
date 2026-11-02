import { existsSync } from 'node:fs';
import { APIError, type CollectionBeforeOperationHook, type CollectionConfig } from 'payload';

// Modo mantenimiento: lo activa infra/deploy (deploy.sh, mantenimiento.sh) creando un archivo en una carpeta
// montada en el contenedor. Se comprueba en cada petición, así que no hace falta reconstruir ni reiniciar.
// Caddy aplica la misma regla por delante (infra/Caddyfile.production); esto cubre además las funciones de
// servidor del /cms y muestra el aviso.
export const MAINTENANCE_MESSAGE =
  'Planta 14 se está actualizando. Durante unos minutos puedes consultarlo todo, pero no guardar cambios. Lo publicado sigue en la web. Vuelve a intentarlo en un rato.';

export function maintenanceActive(): boolean {
  const flag = process.env.MAINTENANCE_FLAG_FILE;
  return Boolean(flag) && existsSync(flag as string);
}

const writes = new Set(['autosave', 'create', 'delete', 'forgotPassword', 'resetPassword', 'restoreVersion', 'update']);

export const maintenanceGuard: CollectionBeforeOperationHook = ({ operation }) => {
  if (writes.has(operation) && maintenanceActive()) throw new APIError(MAINTENANCE_MESSAGE, 503, undefined, true);
};

export function withMaintenanceGuard(collection: CollectionConfig): CollectionConfig {
  return { ...collection, hooks: { ...collection.hooks, beforeOperation: [maintenanceGuard, ...(collection.hooks?.beforeOperation ?? [])] } };
}
