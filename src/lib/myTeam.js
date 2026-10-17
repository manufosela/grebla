/**
 * ¿Tiene esta cuenta a alguien a cargo? (RMR-TSK-0747). Mi equipo es para
 * managers: quien tiene el rol de líder pero nadie debajo —ni en el organigrama
 * ni como dueño de una ficha fuera de él— no tiene equipo que mirar.
 */
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from './firebase.js';
import { inMyTeam } from '../tools/team/domain/teamScope.js';

/**
 * @param {string} uid
 * @returns {Promise<boolean>}
 */
export async function hasPeopleBelow(uid) {
  const people = collection(db, 'people');
  const [below, owned] = await Promise.all([
    getDocs(query(people, where('directoryManagerUids', 'array-contains', uid), limit(1))),
    getDocs(query(people, where('ownerLeaderUid', '==', uid))),
  ]);
  // Una ficha propia solo cuenta si está fuera del organigrama: dentro, manda
  // quién la tiene por encima, con la misma regla que la lista (inMyTeam).
  return !below.empty || owned.docs.some((d) => inMyTeam(d.data(), uid));
}
