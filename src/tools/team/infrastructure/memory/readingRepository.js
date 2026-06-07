/**
 * Implementación in-memory de ReadingRepository (ver domain/ports.js). Genérica:
 * la misma factoría sirve para las cuatro dimensiones (R1). Mantiene el histórico
 * y lo devuelve ascendente por fecha (R2); `latest` = lectura más reciente.
 *
 * @typedef {import('../../domain/ports.js').ReadingRepository} ReadingRepository
 */

/** @param {{date?: string}} a @param {{date?: string}} b */
const byDateAsc = (a, b) => String(a.date ?? '').localeCompare(String(b.date ?? ''));

/**
 * @returns {ReadingRepository}
 */
export function createMemoryReadingRepository() {
  /** @type {Map<string, Array<{ id: string } & Record<string, unknown>>>} */
  const byPerson = new Map();

  return {
    async add(personId, payload) {
      const id = crypto.randomUUID();
      const list = byPerson.get(personId) ?? [];
      list.push({ id, ...payload });
      byPerson.set(personId, list);
      return id;
    },
    async listByPerson(personId) {
      const list = byPerson.get(personId) ?? [];
      return [...list].sort(byDateAsc).map((reading) => ({ ...reading }));
    },
    async latest(personId) {
      const list = byPerson.get(personId) ?? [];
      if (list.length === 0) return null;
      const newest = [...list].sort(byDateAsc).at(-1);
      return newest ? { ...newest } : null;
    },
  };
}
