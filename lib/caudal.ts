/**
 * «Caudal»: concejo oculto para lo comarcal (lo que afecta a varios concejos o a toda la comarca). Lo crea la
 * migración `redaccion`; no tiene página ni espacio municipal y no sale en la navegación (visible: false).
 */
export const CAUDAL = { slug: "caudal", name: "Caudal", label: "Caudal (varios concejos o toda la comarca)" } as const;
