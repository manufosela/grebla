/**
 * Recomendaciones del manager sobre el mapa de carrera (RMR-TSK-0737). El
 * manager PROPONE una ruta prehecha o una casa, con una nota; la persona DECIDE:
 * la acepta (sus casas pasan a su ruta) o la descarta. Su plan es suyo.
 * Vive en /people/{personId}/careerRecommendations. Módulo PURO.
 *
 * @typedef {'route'|'city'} RecommendationKind
 * @typedef {'open'|'accepted'|'dismissed'} RecommendationStatus
 * @typedef {{ kind: RecommendationKind, routeId: string|null, cityIds: string[], label: string, note: string,
 *   by: { uid: string, name: string }, at: string, status: RecommendationStatus, decidedAt: string|null }} Recommendation
 */

const KINDS = ['route', 'city'];
const DECISIONS = ['accepted', 'dismissed'];
const NOTE_MAX = 500;
/** Las rutas prehechas tienen decenas de casas como mucho. */
const CITIES_MAX = 60;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** Solo ISO 8601 en UTC con milisegundos, tal cual la da toISOString. */
function checkInstant(at) {
  if (typeof at !== 'string' || !ISO_UTC.test(at) || new Date(at).toISOString() !== at) throw new Error(`Fecha no válida: «${at}».`);
}

const cleanId = (v) => (typeof v === 'string' && v && v === v.trim() && !v.includes('/') ? v : null);
/** Las casas se llaman «isla/casa» (RMR-TSK-0772): tramos no vacíos unidos por «/». */
const cleanCityId = (v) => (typeof v === 'string' && v === v.trim() && v.split('/').every(Boolean) ? v : null);

/**
 * Recomendación nueva, validada.
 * @returns {Recommendation}
 */
export function newRecommendation({ kind, routeId = null, cityIds, label, note = '', by, at }) {
  if (!KINDS.includes(kind)) throw new Error(`Tipo de recomendación desconocido: «${kind}».`);
  const ids = Array.isArray(cityIds) ? cityIds.map(cleanCityId) : [];
  if (ids.length === 0 || ids.includes(null) || ids.length > CITIES_MAX) throw new Error('La recomendación necesita las casas que propone.');
  if (new Set(ids).size !== ids.length) throw new Error('La recomendación lleva una casa repetida.');
  if (kind === 'city' && ids.length !== 1) throw new Error('Una casa es una casa: recomienda una casa cada vez.');
  if (kind === 'route' && !cleanId(routeId)) throw new Error('Falta la ruta que se recomienda.');
  const text = typeof note === 'string' ? note.trim() : '';
  if (text.length > NOTE_MAX) throw new Error(`La nota no puede pasar de ${NOTE_MAX} caracteres.`);
  const name = typeof label === 'string' ? label.trim() : '';
  if (!name) throw new Error('Falta el nombre de lo que se recomienda.');
  const uid = typeof by?.uid === 'string' ? by.uid.trim() : '';
  const who = typeof by?.name === 'string' ? by.name.trim() : '';
  if (!uid || !who) throw new Error('Falta el autor de la recomendación.');
  checkInstant(at);
  return {
    kind, routeId: kind === 'route' ? routeId : null, cityIds: ids, label: name, note: text,
    by: { uid, name: who }, at, status: 'open', decidedAt: null,
  };
}

/**
 * Lo que cambia al decidir. Solo se decide una vez.
 * @param {{ status: RecommendationStatus }} rec
 * @param {'accepted'|'dismissed'} decision
 * @param {string} at
 * @returns {{ status: RecommendationStatus, decidedAt: string }}
 */
export function decideRecommendation(rec, decision, at) {
  if (!DECISIONS.includes(decision)) throw new Error(`Decisión desconocida: «${decision}».`);
  if (rec?.status !== 'open') throw new Error('Esta recomendación ya está decidida.');
  checkInstant(at);
  return { status: decision, decidedAt: at };
}

/**
 * La ruta de la persona tras aceptar: añade al final, en orden, las casas que
 * aún no tiene. Lo que ya tenía no se mueve: su orden es suyo.
 * @param {ReadonlyArray<string>|null|undefined} route
 * @param {{ cityIds: string[] }} rec
 * @returns {string[]}
 */
export function applyToRoute(route, rec) {
  const out = [...(route ?? [])];
  const have = new Set(out);
  for (const id of rec.cityIds) {
    if (have.has(id)) continue;
    have.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Lo que queda por decidir, lo más reciente primero.
 * @template {{ status: string, at: string }} R
 * @param {R[]} list
 * @returns {R[]}
 */
export function openRecommendations(list) {
  return (list ?? []).filter((r) => r.status === 'open').toSorted((a, b) => b.at.localeCompare(a.at));
}
