/**
 * Lectura del catálogo de unidades de Flujo (LEAN) para poblar selectores en
 * contextos que NO tienen la persistencia del tool LEAN — en concreto la
 * configuración de repos DORA (RMR-TSK-0362), que necesita ofrecer los squads
 * (equipos) y chapters (gremios) YA definidos en lugar de texto libre. Así DORA
 * agrega por las MISMAS unidades que LEAN y el push al portal: mismos nombres →
 * mismos slugs (ver functions/portal.js: slugifySquad(unit.name || linearLabel)).
 *
 * Las reglas permiten leer /leanTeams a cualquier usuario autenticado, así que
 * cada editor puede elegir de todo el catálogo de la organización.
 */
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase.js';

const byName = (a, b) => a.localeCompare(b, 'es');

/**
 * Nombre visible de una unidad LEAN: `name` y, si falta, su `linearLabel`.
 * Espeja el criterio del push al portal para que el slug coincida.
 * @param {{ name?: string, linearLabel?: string }|null|undefined} unit
 * @returns {string}
 */
export function unitDisplayName(unit) {
  const name = typeof unit?.name === 'string' ? unit.name.trim() : '';
  if (name) return name;
  return typeof unit?.linearLabel === 'string' ? unit.linearLabel.trim() : '';
}

/**
 * Separa las unidades LEAN en squads (equipos) y chapters (gremios) por su
 * nombre visible, deduplicado y ordenado. Función pura (testeable sin red).
 * @param {Array<{ kind?: string, name?: string, linearLabel?: string }>} units
 * @returns {{ squads: string[], chapters: string[] }}
 */
export function unitNamesByKind(units) {
  const list = Array.isArray(units) ? units : [];
  const pick = (kind) => [...new Set(
    list.filter((u) => u?.kind === kind).map(unitDisplayName).filter(Boolean),
  )].toSorted(byName);
  return { squads: pick('squad'), chapters: pick('chapter') };
}

/**
 * Incluye `current` como opción aunque no esté en el catálogo, para no romper
 * repos que ya tengan un equipo escrito a mano (compatibilidad con texto libre).
 * @param {string[]} catalog
 * @param {string} current
 * @returns {string[]}
 */
export function withCurrentOption(catalog, current) {
  const value = typeof current === 'string' ? current.trim() : '';
  if (!value || catalog.includes(value)) return catalog;
  return [...catalog, value].toSorted(byName);
}

/**
 * Une el catálogo con los valores actuales que no figuren en él (selección
 * múltiple de gremios): conserva los gremios ya asignados a mano.
 * @param {string[]} catalog
 * @param {string[]} currentList
 * @returns {string[]}
 */
export function withCurrentOptions(catalog, currentList) {
  const extras = (Array.isArray(currentList) ? currentList : [])
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter((v) => v && !catalog.includes(v));
  if (extras.length === 0) return catalog;
  return [...new Set([...catalog, ...extras])].toSorted(byName);
}

/**
 * Catálogo de unidades LEAN de la organización para los selectores DORA.
 * @returns {Promise<{ squads: string[], chapters: string[] }>}
 */
export async function listLeanUnits() {
  const snap = await getDocs(collection(db, 'leanTeams'));
  return unitNamesByKind(snap.docs.map((d) => d.data()));
}
