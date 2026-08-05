/**
 * Propiedad derivada del ORGANIGRAMA (épica RMR-PCS-0035 · F1).
 *
 * Decisión del usuario (2026-08-05): el organigrama manda. El dueño de una
 * ficha (`ownerLeaderUid`, el eje que gobiernan reglas y rosters) se DERIVA de
 * `reportsToPersonId` — el líder al que la persona reporta (al que sostiene,
 * en la pirámide invertida) — y nunca se edita a mano. Módulo puro: lo
 * comparten la CF de sincronización, el backfill y los tests.
 *
 * Reglas explícitas (nada de fallbacks silenciosos):
 *  - jefe con cuenta vinculada → su uid es el dueño (reason 'org');
 *  - sin reportsToPersonId → dueño null: solo superadmin (reason 'sin-superior');
 *  - jefe sin cuenta aún → SIN CAMBIO hasta que se selle (reason 'jefe-sin-cuenta');
 *  - jefe inexistente → SIN CAMBIO, dato roto que debe verse (reason 'jefe-desconocido');
 *  - self-fichas → SIN CAMBIO: su dueño es su titular (reason 'self').
 *
 * `ownerUid: undefined` significa «no tocar»; `null` significa «sin dueño».
 */

/**
 * @param {{ reportsToPersonId?: string|null, self?: boolean }} person
 * @param {Map<string, { uid?: string|null }>} peopleById
 * @returns {{ ownerUid: string|null|undefined, reason: 'org'|'sin-superior'|'jefe-sin-cuenta'|'jefe-desconocido'|'self' }}
 */
export function ownerUidFor(person, peopleById) {
  if (person?.self === true) return { ownerUid: undefined, reason: 'self' };
  const bossId = person?.reportsToPersonId ?? null;
  if (!bossId) return { ownerUid: null, reason: 'sin-superior' };
  const boss = peopleById.get(bossId);
  if (!boss) return { ownerUid: undefined, reason: 'jefe-desconocido' };
  if (!boss.uid) return { ownerUid: undefined, reason: 'jefe-sin-cuenta' };
  return { ownerUid: boss.uid, reason: 'org' };
}

/**
 * Subárbol TRANSITIVO de una persona en el organigrama (todo lo que sostiene,
 * a cualquier profundidad), sin incluirla. Anti-ciclos por registro de
 * visitados; anchura para orden de cercanía.
 * @template {{ id: string, reportsToPersonId?: string|null }} PersonLike
 * @param {ReadonlyArray<PersonLike>} people
 * @param {string} personId
 * @returns {PersonLike[]}
 */
export function subtreeOf(people, personId) {
  /** @type {Map<string, PersonLike[]>} */
  const children = new Map();
  for (const p of people ?? []) {
    const boss = p.reportsToPersonId ?? null;
    if (!boss) continue;
    if (!children.has(boss)) children.set(boss, []);
    children.get(boss).push(p);
  }
  const out = [];
  const visited = new Set([personId]);
  const queue = [...(children.get(personId) ?? [])];
  while (queue.length) {
    const next = queue.shift();
    if (visited.has(next.id)) continue;
    visited.add(next.id);
    out.push(next);
    queue.push(...(children.get(next.id) ?? []));
  }
  return out;
}
