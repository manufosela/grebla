/**
 * A quién puede hacer O2O cada manager: su rama del directorio (RMR-TSK-0665).
 * La calcula el trigger de organigrama en `directoryManagerUids`; no hay lista a
 * mano. A quién va cada O2O se elige en su pestaña «Para quién».
 */
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase.js';

/** Personas de la rama de `uid` en el directorio, directas e indirectas. */
export async function listMyO2OPeople(uid) {
  if (!uid) return [];
  const snap = await getDocs(query(collection(db, 'people'), where('directoryManagerUids', 'array-contains', uid)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
