/**
 * Censo para el organigrama de personas (RMR-PCS-0042 · F1). Va por la callable
 * `orgDirectory` porque /people no es legible por cualquier logado: la función
 * proyecta solo lo que el organigrama pinta.
 */
import { httpsCallable } from 'firebase/functions';
import { getRegionalFunctions } from './firebase.js';

/**
 * @returns {Promise<import('../tools/team/domain/orgPeopleTree.js').DirectoryPerson[]>}
 */
export async function fetchOrgDirectory() {
  const fn = httpsCallable(await getRegionalFunctions(), 'orgDirectory');
  const { data } = await fn();
  // Una respuesta sin `people` no es un censo vacío: es un fallo, y se dice.
  if (!Array.isArray(data?.people)) throw new Error('El censo del organigrama ha llegado mal formado.');
  return data.people;
}
