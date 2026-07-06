/**
 * Resuelve el acceso del usuario a la instancia (modelo multi-leader, ADR
 * -OwN-T_4VB3Ut1Dbn-j8): superadmin (/admins/{uid}, ve todo), viewer
 * (/viewers/{uid}, ve todo en solo lectura, tipo C-level), líder
 * (/leaders/{uid}, gestiona sus personas), engineer (persona /people/{id} con su
 * cuenta vinculada, ve su propio espacio en solo lectura) o ninguno. Sustituye a
 * la resolución por tenant del modelo SaaS anterior: una instancia Firebase = una
 * organización.
 */
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase.js';
import { getMyPerson, sealInvite } from './engineer.js';

/** @typedef {'superadmin'|'viewer'|'leader'|'engineer'|null} AccessRole */

/**
 * Resuelve el rol de acceso del usuario. Prioridad: superadmin > viewer > leader
 * > engineer > null (el primero que exista gana). El campo `personId` solo está
 * presente para el rol engineer: es el id de la persona /people/{id} vinculada a
 * su cuenta.
 * @param {import('firebase/auth').User|null} user
 * @returns {Promise<{ role: AccessRole, uid: string|null, personId?: string }>}
 */
export async function resolveAccess(user) {
  if (!user) return { role: null, uid: null };
  const adminSnap = await getDoc(doc(db, 'admins', user.uid));
  if (adminSnap.exists()) return { role: 'superadmin', uid: user.uid };
  const viewerSnap = await getDoc(doc(db, 'viewers', user.uid));
  if (viewerSnap.exists()) return { role: 'viewer', uid: user.uid };
  const leaderSnap = await getDoc(doc(db, 'leaders', user.uid));
  if (leaderSnap.exists()) return { role: 'leader', uid: user.uid };
  const person = await getMyPerson(user.uid);
  if (person) return { role: 'engineer', uid: user.uid, personId: person.id };
  // Sin persona por uid: quizá esté pre-invitado por email (RMR-TSK-0167). Se
  // intenta sellar la invitación (Cloud Function) y, si engancha, se reintenta.
  if (await sealInvite()) {
    const linked = await getMyPerson(user.uid);
    if (linked) return { role: 'engineer', uid: user.uid, personId: linked.id };
  }
  return { role: null, uid: user.uid };
}
