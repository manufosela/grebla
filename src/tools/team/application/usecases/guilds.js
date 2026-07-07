/**
 * Casos de uso del catálogo de gremios (tecnologías/stack, transversales a la
 * disciplina) — CRUD del líder. Mismo patrón que las áreas de conocimiento.
 *
 * @typedef {import('../../domain/ports.js').PersistencePort} PersistencePort
 * @typedef {import('../../domain/types.js').Guild} Guild
 */

/**
 * @param {PersistencePort} persistence
 * @param {string} name
 * @returns {Promise<string>}
 */
export function addGuild(persistence, name) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) throw new Error('El nombre del gremio es obligatorio');
  return persistence.guilds.create(trimmed);
}

/**
 * @param {PersistencePort} persistence
 * @returns {Promise<Guild[]>}
 */
export function listGuilds(persistence) {
  return persistence.guilds.list();
}

/**
 * @param {PersistencePort} persistence
 * @param {string} id
 * @returns {Promise<void>}
 */
export function removeGuild(persistence, id) {
  return persistence.guilds.remove(id);
}

/**
 * Renombra un gremio del catálogo Y, en cascada, en todas las personas visibles
 * que lo tuvieran: las personas guardan el gremio por NOMBRE, así que renombrar
 * solo el catálogo dejaría a las personas con el nombre viejo.
 * @param {PersistencePort} persistence
 * @param {string} id
 * @param {string} newName
 * @returns {Promise<void>}
 */
export async function renameGuild(persistence, id, newName) {
  const name = String(newName ?? '').trim();
  if (!name) throw new Error('El nombre del gremio es obligatorio');
  const current = (await persistence.guilds.list()).find((g) => g.id === id);
  const oldName = current?.name;
  await persistence.guilds.update(id, { name });
  if (oldName && oldName !== name) {
    const people = await persistence.people.list();
    await Promise.all(
      people
        .filter((p) => (p.guilds ?? []).includes(oldName))
        .map((p) => persistence.people.update(p.id, { guilds: p.guilds.map((g) => (g === oldName ? name : g)) })),
    );
  }
}
