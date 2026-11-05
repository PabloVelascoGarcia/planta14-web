// Tipos de servicio municipal (los usa el CMS y la web; sin dependencias de Payload).
export const serviceCategories = [
  { label: 'Ayuntamiento y atención', value: 'ayuntamiento' }, { label: 'Salud', value: 'salud' }, { label: 'Servicios sociales', value: 'social' },
  { label: 'Educación', value: 'educacion' }, { label: 'Cultura y bibliotecas', value: 'cultura' }, { label: 'Deportes', value: 'deportes' },
  { label: 'Emergencias y seguridad', value: 'emergencias' }, { label: 'Transporte', value: 'transporte' }, { label: 'Puntos limpios y residuos', value: 'medio-ambiente' },
  { label: 'Turismo', value: 'turismo' },
  { label: 'Otros', value: 'otros' },
] as const;
