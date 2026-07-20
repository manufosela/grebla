/**
 * Agrupación de tarjetas de retro (RMR-TSK-0281): dos o más notas que dicen lo
 * mismo se muestran como UNA sola con su contador.
 *
 * Modelo: cada nota puede llevar `groupId`. Todas las que comparten `groupId`
 * son el mismo grupo; la nota cuyo id ES el groupId es la PRINCIPAL (la que da
 * el texto visible). Se eligió esto en vez de un doc «grupo» aparte porque no
 * añade colección ni reglas nuevas y deshacer es sencillo: basta con quitar el
 * campo. Puro y testeable.
 *
 * @typedef {{ id: string, columnId: string, text: string, voters?: string[], groupId?: string|null }} Note
 * @typedef {{ id: string, columnId: string, text: string, notes: Note[], votes: number }} NoteGroup
 */

/** Id del grupo de una nota: el suyo propio si no está agrupada. @param {Note} note */
export function groupKeyOf(note) {
  return note?.groupId || note?.id;
}

/**
 * Agrupa las notas de una columna. Cada grupo toma el texto de su nota
 * PRINCIPAL (la de id === groupId); si esa nota ya no existe (se borró), toma la
 * primera del grupo para no perder el contenido. Los votos del grupo son los
 * votantes ÚNICOS de todas sus notas: si alguien votó dos notas que luego se
 * agrupan, cuenta una vez.
 * @param {ReadonlyArray<Note>} notes
 * @returns {NoteGroup[]}
 */
export function groupNotes(notes) {
  /** @type {Map<string, Note[]>} */
  const byGroup = new Map();
  for (const note of notes ?? []) {
    const key = groupKeyOf(note);
    byGroup.set(key, [...(byGroup.get(key) ?? []), note]);
  }
  return [...byGroup.entries()].map(([id, members]) => {
    const primary = members.find((n) => n.id === id) ?? members[0];
    const voters = new Set(members.flatMap((n) => n.voters ?? []));
    return {
      id,
      columnId: primary.columnId,
      text: primary.text,
      notes: members,
      votes: voters.size,
    };
  });
}

/**
 * Autores de un grupo, sin repetir y en orden de aparición (RMR-TSK-0285).
 *
 * Las tarjetas se escriben anónimas y se FIRMAN al revelarse: quien propone algo
 * lo defiende en el debate. Cuando varias personas dicen lo mismo y se agrupan,
 * interesan todos los nombres — «esto lo dicen tres» no es lo mismo que «esto lo
 * ha dicho una persona tres veces».
 *
 * Las notas anteriores a este cambio no tienen `authorName`: se descartan en vez
 * de inventar un nombre, así que un grupo antiguo simplemente no muestra firma.
 *
 * @param {{ notes?: ReadonlyArray<{ authorName?: string }> }} group
 * @returns {string[]}
 */
export function groupAuthors(group) {
  const names = (group?.notes ?? []).map((n) => String(n.authorName ?? '').trim()).filter(Boolean);
  return [...new Set(names)];
}

/**
 * Grupos ordenados por votos (desc) para la pestaña Resumen; a igualdad de
 * votos, las más grandes primero (más gente lo dijo).
 * @param {ReadonlyArray<Note>} notes
 * @returns {NoteGroup[]}
 */
export function summaryGroups(notes) {
  return groupNotes(notes).toSorted(
    (a, b) => b.votes - a.votes || b.notes.length - a.notes.length,
  );
}

/**
 * Parche para agrupar varias notas bajo la primera de ellas. Devuelve
 * `[{ id, groupId }]` con SOLO las notas que cambian, para no escribir de más.
 * Con menos de 2 notas no hay grupo que formar.
 * @param {ReadonlyArray<string>} noteIds
 * @returns {Array<{ id: string, groupId: string }>}
 */
export function groupPatch(noteIds) {
  const ids = [...new Set((noteIds ?? []).filter(Boolean))];
  if (ids.length < 2) return [];
  const groupId = ids[0];
  return ids.map((id) => ({ id, groupId }));
}

/**
 * Parche para deshacer un grupo: todas sus notas vuelven a `groupId: null`.
 * @param {ReadonlyArray<Note>} notes Todas las notas de la retro.
 * @param {string} groupId
 * @returns {Array<{ id: string, groupId: null }>}
 */
export function ungroupPatch(notes, groupId) {
  return (notes ?? [])
    .filter((n) => groupKeyOf(n) === groupId)
    .map((n) => ({ id: n.id, groupId: null }));
}
