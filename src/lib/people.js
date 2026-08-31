/**
 * Acciones sobre personas que requieren el Admin SDK (Cloud Functions), no
 * expresables desde el cliente Web.
 */

/**
 * Borra DEFINITIVAMENTE a una persona con su subárbol completo (plan de carrera,
 * valoraciones, lecturas, conversaciones, notas…) invocando la Cloud Function
 * `deletePerson` (Admin SDK `recursiveDelete`): el cliente Web no puede borrar
 * subcolecciones en cascada. La función valida que el llamante sea el dueño o un
 * superadmin y que la persona esté dada de baja. Lanza (HttpsError) si falla.
 * @param {string} personId
 * @returns {Promise<{ ok: boolean, deletedPersonId?: string }>}
 */
export async function deletePerson(personId) {
  const { getRegionalFunctions } = await import('./firebase.js');
  const { httpsCallable } = await import('firebase/functions');
  const fns = await getRegionalFunctions();
  const res = await httpsCallable(fns, 'deletePerson')({ personId });
  return /** @type {{ ok: boolean, deletedPersonId?: string }} */ (res.data);
}
