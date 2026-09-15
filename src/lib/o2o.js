/**
 * Cliente de la Cloud Function `getMyO2O`: devuelve la proyección COMPARTIDA de
 * los O2O de la persona vinculada a la cuenta actual (resúmenes que su líder
 * decidió compartir + sus acciones + el O2O que viene). Nunca expone
 * transcripción, notas privadas, el resumen privado del líder ni la guía que él
 * usará durante la conversación: eso lo filtra la función con el Admin SDK.
 *
 * @typedef {{ id: string, text: string }} PreQuestion
 * @typedef {{ id: string, title: string, questions: PreQuestion[] }} PreSection
 * @typedef {{ periodId: string, leaderUid: string, name: string, form: { intro: string, sections: PreSection[] } }} UpcomingO2O
 * @typedef {{ sessions: Array<{ date: string, sharedSummary: string }>, actions: Array<{ id: string, description: string, owner: string, status: string, doneAt?: string|null }>, upcoming: UpcomingO2O[] }} MyO2O
 */

/**
 * @returns {Promise<MyO2O>}
 */
export async function getMyO2O() {
  const { getRegionalFunctions } = await import('./firebase.js');
  const { httpsCallable } = await import('firebase/functions');
  const fns = await getRegionalFunctions();
  const res = await httpsCallable(fns, 'getMyO2O')();
  return /** @type {MyO2O} */ (res.data);
}
