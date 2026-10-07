/**
 * Managers de O2O (RMR-TSK-0654/0655): a quién lleva cada uno para sus O2O. La
 * lista vive en la persona (`o2oManagerUids`) y la asigna a mano el superadmin;
 * no sale del dueño de la ficha ni de ser superadmin.
 */
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase.js';

/** Personas a las que `uid` está asignado como manager de O2O. */
export async function listMyO2OPeople(uid) {
  if (!uid) return [];
  const snap = await getDocs(query(collection(db, 'people'), where('o2oManagerUids', 'array-contains', uid)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
