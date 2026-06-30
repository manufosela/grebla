/**
 * Resuelve el acceso del usuario a la instancia (modelo multi-leader, ADR
 * -OwN-T_4VB3Ut1Dbn-j8): superadmin (/admins/{uid}, ve todo), líder
 * (/leaders/{uid}, gestiona sus personas) o ninguno. Sustituye a la resolución
 * por tenant del modelo SaaS anterior: una instancia Firebase = una organización.
 */
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase.js';

/** @typedef {'superadmin'|'leader'|null} AccessRole */

/**
 * @param {import('firebase/auth').User|null} user
 * @returns {Promise<{ role: AccessRole, uid: string|null }>}
 */
export async function resolveAccess(user) {
  if (!user) return { role: null, uid: null };
  const adminSnap = await getDoc(doc(db, 'admins', user.uid));
  if (adminSnap.exists()) return { role: 'superadmin', uid: user.uid };
  const leaderSnap = await getDoc(doc(db, 'leaders', user.uid));
  if (leaderSnap.exists()) return { role: 'leader', uid: user.uid };
  return { role: null, uid: user.uid };
}
