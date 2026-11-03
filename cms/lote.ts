import type { Field } from 'payload';
import { adminOnly } from './access';

/** Lote de una carga de ensayo (npm run cms:ensayo:cargar). Solo lo ve y cambia la administración. Vacío = contenido normal. */
export const loteField: Field = {
  name: 'lote', label: 'Lote de la carga de ensayo', type: 'select', index: true,
  options: [{ label: 'Ensayo (se borra al retirar el ensayo)', value: 'ensayo' }, { label: 'Definitivo (se conserva)', value: 'definitivo' }],
  access: { read: adminOnly, create: adminOnly, update: adminOnly },
  admin: { position: 'sidebar', description: 'Solo para la carga de ensayo. «Ensayo» se borra con npm run cms:ensayo:retirar; vacío o «Definitivo», nunca.' },
};
