/**
 * Casos de uso del catálogo de SQUADS (RMR-TSK-0275).
 *
 * Un squad es una unidad de la ORGANIZACIÓN, no de un manager: varios EMs pueden
 * tener gente en el mismo squad, y una persona puede estar en más de uno. Por eso
 * el catálogo se gestiona global (desde el panel) y no con ámbito personal como
 * los gremios.
 *
 * OJO — diferencia con gremios/labels: las personas guardan el squad por **id**
 * (`Person.squadIds`), no por nombre. Así renombrar un squad NO obliga a tocar
 * ninguna persona (a diferencia de `renameGuild`, que va en cascada).
 *
 * @typedef {import('../../domain/ports.js').PersistencePort} PersistencePort
 * @typedef {import('../../domain/types.js').Squad} Squad
 */

/**
 * @param {PersistencePort} persistence
 * @param {string} name
 * @returns {Promise<string>}
 */
export function addSquad(persistence, name) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) throw new Error('El nombre del squad es obligatorio');
  return persistence.squads.create(trimmed);
}

/**
 * @param {PersistencePort} persistence
 * @returns {Promise<Squad[]>}
 */
export function listSquads(persistence) {
  return persistence.squads.list();
}

/**
 * Renombra un squad. No hay cascada: las personas lo referencian por id.
 * @param {PersistencePort} persistence @param {string} id @param {string} name
 * @returns {Promise<void>}
 */
export function renameSquad(persistence, id, name) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) throw new Error('El nombre del squad es obligatorio');
  return persistence.squads.rename(id, trimmed);
}

/**
 * @param {PersistencePort} persistence @param {string} id
 * @returns {Promise<void>}
 */
export function removeSquad(persistence, id) {
  return persistence.squads.remove(id);
}

/**
 * Sanea los squads de una persona: ids únicos, sin vacíos y en orden estable.
 * Una persona puede estar en VARIOS squads (decisión de producto), de ahí el
 * array en vez de un único `squadId`.
 * @param {unknown} value
 * @returns {string[]}
 */
export function normalizeSquadIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((id) => String(id ?? '').trim()).filter(Boolean))];
}

/**
 * Nombres de los squads de una persona, resueltos contra el catálogo. Los ids
 * que ya no existen (squad borrado) se descartan en vez de pintar un id crudo.
 * @param {ReadonlyArray<string>} squadIds
 * @param {ReadonlyArray<Squad>} catalog
 * @returns {string[]}
 */
export function squadNames(squadIds, catalog) {
  const byId = new Map((catalog ?? []).map((s) => [s.id, s.name]));
  return normalizeSquadIds(squadIds).map((id) => byId.get(id)).filter(Boolean);
}
