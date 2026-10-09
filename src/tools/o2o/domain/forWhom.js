/**
 * «Para quién» de cada O2O (RMR-TSK-0664). Un manager hace O2O cuando quiere y a
 * quien quiere de su rama del directorio; cada O2O guarda a quién va
 * (`personIds`). Empieza con sus directos marcados y él marca o desmarca al
 * resto. Directo = depende de su ficha en el directorio (`reportsToPersonId`),
 * tenga o no cuenta su jefe (RMR-TSK-0669).
 */

/**
 * @typedef {{ id: string, name: string, reportsToPersonId?: string|null }} BranchPerson
 */

const isDirect = (person, myPersonId) => !!myPersonId && person.reportsToPersonId === myPersonId;

/**
 * La rama partida en directos y resto; al resto se le dice de quién depende.
 * @param {ReadonlyArray<BranchPerson>} people
 * @param {string|null} myPersonId
 */
export function forWhomView(people, myPersonId) {
  const nameById = new Map(people.map((p) => [p.id, p.name]));
  return {
    directs: people.filter((p) => isDirect(p, myPersonId)).map((p) => ({ id: p.id, name: p.name })),
    rest: people.filter((p) => !isDirect(p, myPersonId)).map((p) => ({
      id: p.id, name: p.name, bossName: nameById.get(p.reportsToPersonId) ?? null,
    })),
  };
}

/** Lo que trae marcado un O2O nuevo: los directos. */
export function defaultForWhom(people, myPersonId) {
  return people.filter((p) => isDirect(p, myPersonId)).map((p) => p.id);
}

/**
 * A quién va un O2O. Los creados antes de «Para quién» no tienen la lista y
 * empiezan, como uno nuevo, con los directos marcados.
 * @param {{ personIds?: string[] }} o2o
 */
export function chosenIds(o2o, people, myPersonId) {
  return Array.isArray(o2o?.personIds) ? o2o.personIds : defaultForWhom(people, myPersonId);
}

/** Marca o desmarca a una persona. */
export function togglePerson(ids, personId) {
  return ids.includes(personId) ? ids.filter((id) => id !== personId) : [...ids, personId];
}

/** Marca (o desmarca) de golpe a todas las personas de `personIds`. */
export function setAll(ids, personIds, checked) {
  return checked
    ? [...ids, ...personIds.filter((id) => !ids.includes(id))]
    : ids.filter((id) => !personIds.includes(id));
}
