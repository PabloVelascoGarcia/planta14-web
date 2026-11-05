import type { Field, Payload } from 'payload';

// Validación previa de los importadores contra el esquema REAL de la colección (los campos de Payload): campos
// obligatorios, longitudes máximas y mínimas, valores de las listas de selección, números y fechas. Se usa en
// --solo-comprobar y antes de escribir nada: si hay errores, se informan TODOS de una vez y no se importa nada.

type Data = Record<string, unknown>;
const empty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
const labelOf = (field: Field & { label?: unknown; name?: string }) => typeof field.label === 'string' ? field.label : field.name ?? '';

function check(fields: Field[], data: Data, path: string, errors: string[], skip: Set<string>) {
  for (const raw of fields) {
    const field = raw as Field & { name?: string; type: string; fields?: Field[]; tabs?: { name?: string; fields: Field[] }[] };
    if (field.type === 'row' || field.type === 'collapsible') { check(field.fields ?? [], data, path, errors, skip); continue; }
    if (field.type === 'tabs') { for (const tab of field.tabs ?? []) check(tab.fields, tab.name ? ((data[tab.name] ?? {}) as Data) : data, tab.name ? `${path}${tab.name}.` : path, errors, skip); continue; }
    if (!field.name || field.type === 'ui') continue;
    const name = `${path}${field.name}`;
    if (skip.has(name)) continue;
    const f = field as unknown as { required?: boolean; maxLength?: number; minLength?: number; min?: number; max?: number; hasMany?: boolean; virtual?: boolean;
      options?: (string | { value: string })[]; defaultValue?: unknown; admin?: { readOnly?: boolean } };
    if (f.virtual) continue;
    const value = data[field.name];
    const label = `«${labelOf(field)}»`;
    if (empty(value)) {
      if (f.required && f.defaultValue === undefined) errors.push(`falta ${label}`);
      continue;
    }
    switch (field.type) {
      case 'text': case 'textarea': case 'email': case 'code': {
        const values = f.hasMany && Array.isArray(value) ? value : [value];
        for (const v of values) {
          if (typeof v !== 'string') { errors.push(`${label} debe ser texto`); continue; }
          if (f.maxLength && v.length > f.maxLength) errors.push(`${label} tiene ${v.length} caracteres (máximo ${f.maxLength})`);
          if (f.minLength && v.length < f.minLength) errors.push(`${label} tiene ${v.length} caracteres (mínimo ${f.minLength})`);
          if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) errors.push(`${label} no es un correo válido`);
        }
        break;
      }
      case 'number': {
        const values = f.hasMany && Array.isArray(value) ? value : [value];
        for (const v of values) {
          if (typeof v !== 'number' || !Number.isFinite(v)) { errors.push(`${label} debe ser un número`); continue; }
          if (f.min !== undefined && v < f.min) errors.push(`${label} vale ${v} (mínimo ${f.min})`);
          if (f.max !== undefined && v > f.max) errors.push(`${label} vale ${v} (máximo ${f.max})`);
        }
        break;
      }
      case 'select': case 'radio': {
        const allowed = (f.options ?? []).map(o => typeof o === 'string' ? o : o.value);
        const values = f.hasMany && Array.isArray(value) ? value : [value];
        for (const v of values) if (!allowed.includes(String(v))) errors.push(`${label}: valor «${v}» no permitido (${allowed.join(', ')})`);
        break;
      }
      case 'date':
        if (Number.isNaN(new Date(String(value)).getTime())) errors.push(`${label}: fecha no válida «${value}»`);
        break;
      case 'checkbox':
        if (typeof value !== 'boolean') errors.push(`${label} debe ser sí o no`);
        break;
      case 'group':
        check(field.fields ?? [], value as Data, `${name}.`, errors, skip);
        break;
      case 'array':
        if (!Array.isArray(value)) { errors.push(`${label} debe ser una lista`); break; }
        value.forEach((row, i) => check(field.fields ?? [], row as Data, `${name}.${i}.`, errors, skip));
        break;
      default: break;
    }
  }
}

/**
 * Errores de un registro contra el esquema de la colección. `skip`: campos que rellena el servidor (slug, campos
 * calculados) o que se completan después de validar (foto, recorrido).
 */
export function validateRecord(payload: Payload, collection: string, data: Data, skip: string[] = []): string[] {
  const config = payload.collections[collection as keyof typeof payload.collections]?.config;
  if (!config) throw new Error(`Colección desconocida: ${collection}`);
  const errors: string[] = [];
  check(config.fields, data, '', errors, new Set(skip));
  return errors;
}
