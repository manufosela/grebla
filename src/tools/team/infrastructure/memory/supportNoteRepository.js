/**
 * Implementación in-memory de SupportNoteRepository (ver domain/ports.js).
 * R5: acompañamiento NO diagnóstico, sin nivel, separado de la dimensión
 * Emocional. La fecha se sella al crear.
 *
 * @typedef {import('../../domain/types.js').SupportNote} SupportNote
 * @typedef {import('../../domain/ports.js').SupportNoteRepository} SupportNoteRepository
 */

/** @param {{date?: string}} a @param {{date?: string}} b */
const byDateAsc = (a, b) => String(a.date ?? '').localeCompare(String(b.date ?? ''));

/**
 * @param {() => string} [now] Inyectable para tests deterministas (ISO date).
 * @returns {SupportNoteRepository}
 */
export function createMemorySupportNoteRepository(now = () => new Date().toISOString()) {
  /** @type {Map<string, SupportNote[]>} */
  const byPerson = new Map();

  return {
    async listByPerson(personId) {
      const list = byPerson.get(personId) ?? [];
      return [...list].sort(byDateAsc).map((n) => ({ ...n }));
    },
    async create(personId, text, author) {
      const id = crypto.randomUUID();
      const list = byPerson.get(personId) ?? [];
      // Coherente con Firestore: solo añadimos createdBy si hay autor.
      const note = { id, text, date: now() };
      if (author) note.createdBy = author;
      list.push(note);
      byPerson.set(personId, list);
      return id;
    },
    async remove(personId, id) {
      const list = byPerson.get(personId) ?? [];
      const index = list.findIndex((n) => n.id === id);
      if (index === -1) throw new Error(`SupportNote ${id} no existe`);
      list.splice(index, 1);
    },
  };
}
