/**
 * Dominio puro de las referencias de aprendizaje aportadas por la tripulación
 * (RMR-TSK-0255): saneado y validación de una referencia (enlace + título + nota
 * opcional). Sin Firestore ni DOM. Una referencia la aporta un ingeniero a una
 * casa del mapa; se muestra a todos con el nombre de quien la añadió.
 */

/** Límites de longitud. */
export const REF_TITLE_MAX = 90;
export const REF_NOTE_MAX = 240;

/**
 * Sanea los campos de una referencia (trim + recorte). No incluye autoría ni
 * metadatos: los pone la capa de IO.
 * @param {{ url?: unknown, title?: unknown, note?: unknown }} [input]
 * @returns {{ url: string, title: string, note: string }}
 */
export function sanitizeReference(input = {}) {
  const url = typeof input.url === 'string' ? input.url.trim() : '';
  const title = (typeof input.title === 'string' ? input.title : '').trim().slice(0, REF_TITLE_MAX);
  const note = (typeof input.note === 'string' ? input.note : '').trim().slice(0, REF_NOTE_MAX);
  return { url, title, note };
}

/**
 * ¿Es una referencia válida para guardar? Exige una URL http(s) y un título.
 * @param {{ url?: string, title?: string }} ref
 * @returns {boolean}
 */
export function isValidReference(ref = {}) {
  const url = String(ref.url ?? '');
  const title = String(ref.title ?? '').trim();
  return Boolean(title) && /^https?:\/\/\S+/i.test(url);
}

/** Clave de agrupación de referencias de una casa: isla + ciudad. */
export function cityRefKey(islandId, cityId) {
  return `${String(islandId ?? '')}::${String(cityId ?? '')}`;
}
