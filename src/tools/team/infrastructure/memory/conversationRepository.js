/**
 * Implementación in-memory de ConversationRepository (ver domain/ports.js).
 * Conversaciones O2O/catch-up por persona; listado ascendente por fecha.
 *
 * @typedef {import('../../domain/types.js').Conversation} Conversation
 * @typedef {import('../../domain/ports.js').ConversationRepository} ConversationRepository
 */

/** @param {{date?: string}} a @param {{date?: string}} b */
const byDateAsc = (a, b) => String(a.date ?? '').localeCompare(String(b.date ?? ''));

/**
 * @returns {ConversationRepository}
 */
export function createMemoryConversationRepository() {
  /** @type {Map<string, Conversation[]>} */
  const byPerson = new Map();

  return {
    async listByPerson(personId) {
      const list = byPerson.get(personId) ?? [];
      return [...list].sort(byDateAsc).map((c) => ({ ...c }));
    },
    async create(personId, input) {
      const id = crypto.randomUUID();
      const list = byPerson.get(personId) ?? [];
      list.push({ ...input, id });
      byPerson.set(personId, list);
      return id;
    },
    async update(personId, id, patch) {
      const list = byPerson.get(personId) ?? [];
      const index = list.findIndex((c) => c.id === id);
      if (index === -1) throw new Error(`Conversation ${id} no existe`);
      list[index] = { ...list[index], ...patch, id };
    },
  };
}
