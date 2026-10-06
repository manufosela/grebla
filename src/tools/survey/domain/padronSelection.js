/**
 * A quién se envía una encuesta desde el padrón (RMR-TSK-0630). El padrón es
 * toda la empresa; la encuesta, a quien se MARCA: por defecto no va nadie. Se
 * marca por departamento (con estado parcial) y persona a persona, y «Todos» o
 * «Ninguno». La selección es un Set de emails en minúsculas. Puro.
 *
 * @typedef {{ email: string, metadata: { department?: string } }} Participant
 */

/** Rótulo de quien no tiene departamento en el padrón. */
export const NO_DEPARTMENT = 'Sin departamento';

const key = (email) => email.toLowerCase();
const departmentOf = (p) => p.metadata?.department || NO_DEPARTMENT;

/** @param {Participant[]} list @param {Set<string>} selected @returns {Participant[]} */
export function selectedOnes(list, selected) {
  return list.filter((p) => selected.has(key(p.email)));
}

/** Departamentos de la lista, ordenados, con «Sin departamento» al final. @param {Participant[]} list */
export function departmentsOf(list) {
  const names = [...new Set(list.map(departmentOf))];
  return [...names.filter((d) => d !== NO_DEPARTMENT).toSorted((a, b) => a.localeCompare(b, 'es')),
    ...names.filter((d) => d === NO_DEPARTMENT)];
}

/**
 * @param {Participant[]} list @param {Set<string>} selected @param {string} department
 * @returns {'all'|'some'|'none'}
 */
export function departmentState(list, selected, department) {
  const members = list.filter((p) => departmentOf(p) === department);
  const marked = members.filter((p) => selected.has(key(p.email))).length;
  if (marked === 0) return 'none';
  return marked === members.length ? 'all' : 'some';
}

/** Marca o desmarca a todo un departamento sin tocar a los demás. @returns {Set<string>} */
export function toggleDepartment(list, selected, department, on) {
  const next = new Set(selected);
  for (const p of list) {
    if (departmentOf(p) !== department) continue;
    if (on) next.add(key(p.email));
    else next.delete(key(p.email));
  }
  return next;
}

/** Marca o desmarca a una persona. @returns {Set<string>} */
export function togglePerson(selected, email, on) {
  const next = new Set(selected);
  if (on) next.add(key(email));
  else next.delete(key(email));
  return next;
}

/** «Todos»: la lista entera. @param {Participant[]} list @returns {Set<string>} */
export function selectAll(list) {
  return new Set(list.map((p) => key(p.email)));
}
