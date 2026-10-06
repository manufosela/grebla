/**
 * ¿Gestiona esta cuenta las encuestas? (RMR-TSK-0637). Lo mismo que dicen las
 * reglas (isSurveyAdmin en firestore.rules): el permiso de la herramienta
 * concedido por política, materializado en /toolManagers/surveys--{uid}, o la
 * colección antigua /surveyAdmins mientras dure la migración. Si el servidor
 * mirara solo una, la pantalla dejaría entrar y las acciones fallarían.
 * @param {{ doc: (path: string) => { get: () => Promise<{ exists: boolean }> } }} db
 * @param {string} uid
 */
export async function managesSurveys(db, uid) {
  if (!uid) return false;
  const [byPolicy, legacy] = await Promise.all([
    db.doc(`toolManagers/surveys--${uid}`).get(),
    db.doc(`surveyAdmins/${uid}`).get(),
  ]);
  return byPolicy.exists || legacy.exists;
}
