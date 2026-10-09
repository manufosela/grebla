/**
 * «Para quién» de cada O2O (RMR-TSK-0664). Un manager hace O2O cuando quiere y a
 * quien quiere de su rama del directorio; cada O2O guarda a quién va
 * (`personIds`). Empieza con sus directos marcados y él marca o desmarca al
 * resto. Directo = su jefe más cercano con cuenta es quien hace el O2O.
 */

/**
 * @typedef {{ id: string, name: string, uid?: string|null, directoryManagerUids?: string[] }} BranchPerson
 */

const isDirect = (person, myUid) => (person.directoryManagerUids ?? [])[0] === myUid;

/**
 * La rama partida en directos y resto; al resto se le dice de quién depende.
 * @param {ReadonlyArray<BranchPerson>} people
 * @param {string} myUid
 */
export function forWhomView(people, myUid) {
  const nameByUid = new Map(people.filter((p) => p.uid).map((p) => [p.uid, p.name]));
  return {
    directs: people.filter((p) => isDirect(p, myUid)).map((p) => ({ id: p.id, name: p.name })),
    rest: people.filter((p) => !isDirect(p, myUid)).map((p) => ({
      id: p.id, name: p.name, bossName: nameByUid.get((p.directoryManagerUids ?? [])[0]) ?? null,
    })),
  };
}

/** Lo que trae marcado un O2O nuevo: los directos. */
export function defaultForWhom(people, myUid) {
  return people.filter((p) => isDirect(p, myUid)).map((p) => p.id);
}

/**
 * A quién va un O2O. Los creados antes de «Para quién» no tienen la lista y
 * empiezan, como uno nuevo, con los directos marcados.
 * @param {{ personIds?: string[] }} o2o
 */
export function chosenIds(o2o, people, myUid) {
  return Array.isArray(o2o?.personIds) ? o2o.personIds : defaultForWhom(people, myUid);
}

/** Marca o desmarca a una persona. */
export function togglePerson(ids, personId) {
  return ids.includes(personId) ? ids.filter((id) => id !== personId) : [...ids, personId];
}
