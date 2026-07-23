/**
 * Resuelve el acceso del usuario a la instancia (modelo multi-leader, ADR
 * -OwN-T_4VB3Ut1Dbn-j8): superadmin (/admins/{uid}, ve todo), supermanager
 * (/supermanagers/{uid}, Head of X que ve y actúa sobre la rama de EMs que le
 * reportan, ADR -Oy8_OLDtE0a), viewer (/viewers/{uid}, ve todo en solo lectura,
 * tipo C-level), líder (/leaders/{uid}, gestiona sus personas), engineer (persona
 * /people/{id} con su cuenta vinculada, ve su propio espacio en solo lectura) o
 * ninguno. Sustituye a la resolución por tenant del modelo SaaS anterior: una
 * instancia Firebase = una organización.
 */
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase.js';
import { getMyPerson, sealInvite } from './engineer.js';
import { accessAxes, viewsFor } from './accessRoles.js';

/** @typedef {'superadmin'|'supermanager'|'viewer'|'leader'|'engineer'|null} AccessRole */
/** @typedef {import('./accessRoles.js').FunctionalRole} FunctionalRole */
/** @typedef {import('./accessRoles.js').InstanceAccess} InstanceAccess */

/**
 * Resuelve el acceso del usuario en DOS EJES ORTOGONALES (ADR RMR-PCS-0024):
 *  - `functionalRole`: qué es (supermanager/leader/engineer) — define su alcance.
 *  - `instanceAccess`: gobierno de la instancia (admin/viewer), independiente.
 *  - `role`: el rol único DERIVADO por compatibilidad (misma prioridad de
 *    siempre: superadmin > supermanager > viewer > leader > engineer) mientras
 *    se migran los consumidores; NO cambia respecto al modelo anterior.
 *  - `personId`: id de la persona /people/{id} vinculada, si la tiene (ahora
 *    puede acompañar a un admin/leader con ficha; es aditivo, solo lo lee la
 *    vista de ingeniero).
 *
 * La pertenencia a las 4 colecciones se lee en paralelo (antes era secuencial
 * con return temprano). `getMyPerson` es una lectura sin efectos y se consulta
 * siempre para poder poblar el eje funcional aunque el uid sea además admin. El
 * único paso con efecto, `sealInvite`, se mantiene EXACTAMENTE en el mismo caso
 * que antes: cuando el usuario no tiene ningún acceso (ni funcional ni gobierno).
 * @param {import('firebase/auth').User|null} user
 * @returns {Promise<{ role: AccessRole, uid: string|null, personId?: string,
 *   functionalRole: FunctionalRole, instanceAccess: InstanceAccess }>}
 */
export async function resolveAccess(user) {
  if (!user) return { role: null, uid: null, functionalRole: null, instanceAccess: null };
  const [adminSnap, supermanagerSnap, viewerSnap, leaderSnap, person] = await Promise.all([
    getDoc(doc(db, 'admins', user.uid)),
    getDoc(doc(db, 'supermanagers', user.uid)),
    getDoc(doc(db, 'viewers', user.uid)),
    getDoc(doc(db, 'leaders', user.uid)),
    getMyPerson(user.uid),
  ]);
  let membership = {
    admin: adminSnap.exists(),
    viewer: viewerSnap.exists(),
    supermanager: supermanagerSnap.exists(),
    leader: leaderSnap.exists(),
    engineer: !!person,
  };
  let personId = person?.id;

  // Sin ningún acceso: quizá esté pre-invitado por email (RMR-TSK-0167). Se
  // intenta sellar la invitación (Cloud Function, único paso con efecto) y, si
  // engancha, se reintenta cargar la persona — mismo caso y flujo que antes.
  const axes = accessAxes(membership);
  if (!axes.functionalRole && !axes.instanceAccess && await sealInvite()) {
    const linked = await getMyPerson(user.uid);
    if (linked) { membership = { ...membership, engineer: true }; personId = linked.id; }
  }

  const { role, functionalRole, instanceAccess } = accessAxes(membership);
  return { role, uid: user.uid, personId, functionalRole, instanceAccess };
}

/** @typedef {import('./accessRoles.js').ViewKey} ViewKey */

/**
 * Vistas entre las que el usuario puede conmutar (RMR-TSK-0250), derivadas de sus
 * DOS EJES reales (RMR-TSK-0304): así un admin que además es manager conserva su
 * vista de manager de SU equipo, en vez de que el gobierno le tape la faceta
 * funcional. La vista «engineer» se ofrece como preview a manager/head; si no
 * tienen ficha, «Mi espacio» lo avisa.
 * @param {import('firebase/auth').User|null} user
 * @returns {Promise<{ role: AccessRole, uid: string|null, functionalRole: FunctionalRole, instanceAccess: InstanceAccess, views: ViewKey[] }>}
 */
export async function resolveViews(user) {
  const { role, uid, functionalRole, instanceAccess } = await resolveAccess(user);
  return { role, uid, functionalRole, instanceAccess, views: viewsFor({ functionalRole, instanceAccess }) };
}
