/**
 * Notas PRIVADAS del manager sobre una persona (RMR-TSK-0636): sus performance
 * reviews y cualquier texto que dé contexto, con la fecha en que se hicieron.
 * La persona no las ve nunca (lo garantizan las reglas de /managerNotes). Puro.
 */

export const NOTE_TYPES = Object.freeze([
  Object.freeze({ id: 'perf-review', label: 'Performance review' }),
  Object.freeze({ id: 'contexto', label: 'Contexto' }),
]);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const text = (v) => (typeof v === 'string' ? v.trim() : '');

/** AAAA-MM-DD y además un día que existe (2026-02-31 no). */
function isCalendarDate(value) {
  if (!ISO_DATE.test(value ?? '')) return false;
  const day = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === value;
}

/** Por qué no se puede guardar una nota (vacío si se puede). */
export function noteErrors(draft) {
  const errors = [];
  if (!NOTE_TYPES.some((t) => t.id === draft?.type)) errors.push('Elige el tipo de nota.');
  if (!isCalendarDate(draft?.date)) errors.push('La fecha debe ser AAAA-MM-DD.');
  if (!text(draft?.content)) errors.push('Escribe el contenido.');
  return errors;
}

/** Lo que se guarda: recortado y, sin título, el nombre del tipo. */
export function cleanNote(draft) {
  const label = NOTE_TYPES.find((t) => t.id === draft.type)?.label ?? '';
  return { type: draft.type, date: draft.date, title: text(draft.title) || label, content: text(draft.content) };
}

/** De la más reciente a la más antigua. */
export function sortNotes(notes) {
  return notes.toSorted((a, b) => String(b.date).localeCompare(String(a.date)));
}
