/**
 * Cliente de la Cloud Function `getMyO2O`: devuelve la proyección COMPARTIDA de
 * los O2O de la persona vinculada a la cuenta actual (resúmenes que su líder
 * decidió compartir + sus acciones). Nunca expone transcripción, notas privadas
 * ni el resumen privado del líder: eso lo filtra la función con el Admin SDK.
 *
 * @typedef {{ sessions: Array<{ date: string, sharedSummary: string }>, actions: Array<{ id: string, description: string, owner: string, status: string, doneAt?: string|null }> }} MyO2O
 */

/**
 * @returns {Promise<MyO2O>}
 */
export async function getMyO2O() {
  const { app } = await import('./firebase.js');
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const fns = getFunctions(app, 'europe-west1');
  const res = await httpsCallable(fns, 'getMyO2O')();
  return /** @type {MyO2O} */ (res.data);
}
