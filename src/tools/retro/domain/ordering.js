/**
 * Orden de las tarjetas de una retro (RMR-TSK-0659).
 *
 * Ordenar por votos EN VIVO hacía saltar las tarjetas con cada voto: con mucha
 * gente votando a la vez, nadie encontraba la que iba a votar. Ahora las
 * tarjetas se quedan en el orden en que se escribieron y quien facilita ordena
 * por votos al final con un botón (`sortByVotes` en la retro, igual que
 * `revealed`, para que todas las pantallas cambien a la vez).
 */

/**
 * ¿Se muestran las tarjetas ordenadas por votos? Una retro cerrada, siempre:
 * ya no se vota y lo útil es leer primero lo más votado.
 * @param {{ status?: string, sortByVotes?: boolean }|null} retro
 * @returns {boolean}
 */
export function isSortedByVotes(retro) {
  if (!retro) return false;
  return retro.status !== 'open' || retro.sortByVotes === true;
}

/** Milisegundos de creación; la nota con la hora aún sin sellar va la última. */
const createdMs = (note) => note.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;

/** Un grupo nace cuando nace la más antigua de sus notas. */
const bornMs = (group) => Math.min(...group.notes.map(createdMs));

/**
 * Grupos de tarjetas en orden estable: por hora de creación o, si se pide, por
 * votos (y a igualdad, el más antiguo primero).
 * @template {{ votes: number, notes: ReadonlyArray<{ createdAt?: { toMillis?: () => number }|null }> }} T
 * @param {ReadonlyArray<T>} groups
 * @param {boolean} byVotes
 * @returns {T[]}
 */
export function orderGroups(groups, byVotes) {
  return groups.toSorted((a, b) => (byVotes ? b.votes - a.votes : 0) || bornMs(a) - bornMs(b));
}
