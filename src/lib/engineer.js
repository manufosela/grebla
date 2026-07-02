/**
 * Lectura de la persona vinculada a la cuenta autenticada (modelo engineer, G2).
 *
 * Una persona (/people/{id}) puede llevar `uid` = la cuenta vinculada; su titular
 * puede leerla en solo lectura mediante la query `where('uid','==', miUid)`, que
 * respaldan las reglas de Firestore (la condición de lectura usa el mismo campo
 * `uid` del filtro). Toda la IO de Firebase de este flujo vive SOLO en este módulo.
 *
 * @typedef {import('../tools/team/domain/types.js').Person} Person
 */
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from './firebase.js';

/**
 * Devuelve la persona vinculada a un `uid` (la cuenta del propio ingeniero), o
 * `null` si no hay ninguna. Consulta por el campo `uid`, único identificador de
 * la vinculación, respaldado por las reglas de Firestore para leer la propia
 * persona.
 * @param {string|null|undefined} uid  uid de la cuenta autenticada
 * @returns {Promise<(Person & { id: string })|null>}
 */
export async function getMyPerson(uid) {
  if (!uid) return null;
  const snap = await getDocs(
    query(collection(db, 'people'), where('uid', '==', uid), limit(1)),
  );
  const personDoc = snap.docs.at(0);
  return personDoc ? { id: personDoc.id, ...personDoc.data() } : null;
}
