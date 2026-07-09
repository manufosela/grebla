/**
 * Casos de uso del catálogo de labels (gremios/equipos). Mismo patrón que los
 * roles de equipo: el líder crea personales; el superadmin gestiona globales.
 *
 * @typedef {import('../../domain/ports.js').PersistencePort} PersistencePort
 * @typedef {import('../../domain/types.js').Label} Label
 */

/**
 * @param {PersistencePort} persistence
 * @param {string} name
 * @param {{ subLabel?: string, color?: string }} [extra]  Metadatos opcionales del label.
 * @returns {Promise<string>}
 */
export function addLabel(persistence, name, extra = {}) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) throw new Error('El nombre del label es obligatorio');
  return persistence.labels.create(trimmed, extra);
}

/**
 * Actualiza metadatos del label (subLabel/color) sin tocar el nombre (el nombre
 * se cambia con renameLabel, que cascadea a /people). Cadena vacía = borrar campo.
 * @param {PersistencePort} persistence
 * @param {string} id
 * @param {{ subLabel?: string, color?: string }} patch
 * @returns {Promise<void>}
 */
export function updateLabelMeta(persistence, id, patch) {
  const meta = {};
  if (patch.subLabel !== undefined) meta.subLabel = String(patch.subLabel).trim();
  if (patch.color !== undefined) meta.color = String(patch.color).trim();
  return persistence.labels.update(id, meta);
}

/**
 * @param {PersistencePort} persistence
 * @returns {Promise<Label[]>}
 */
export function listLabels(persistence) {
  return persistence.labels.list();
}

/**
 * @param {PersistencePort} persistence
 * @param {string} id
 * @returns {Promise<void>}
 */
export function removeLabel(persistence, id) {
  return persistence.labels.remove(id);
}

/**
 * Renombra un label del catálogo Y, en cascada, en todas las personas visibles
 * que lo tuvieran (las personas guardan el label por NOMBRE).
 * @param {PersistencePort} persistence
 * @param {string} id
 * @param {string} newName
 * @returns {Promise<void>}
 */
export async function renameLabel(persistence, id, newName) {
  const name = String(newName ?? '').trim();
  if (!name) throw new Error('El nombre del label es obligatorio');
  const current = (await persistence.labels.list()).find((l) => l.id === id);
  const oldName = current?.name;
  await persistence.labels.update(id, { name });
  if (oldName && oldName !== name) {
    const people = await persistence.people.list();
    await Promise.all(
      people
        .filter((p) => (p.labels ?? []).includes(oldName))
        .map((p) => persistence.people.update(p.id, { labels: p.labels.map((l) => (l === oldName ? name : l)) })),
    );
  }
}
