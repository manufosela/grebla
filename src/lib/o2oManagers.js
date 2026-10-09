/**
 * Managers de O2O (RMR-TSK-0654/0655): a quién lleva cada uno para sus O2O. La
 * lista vive en la persona (`o2oManagerUids`) y la asigna a mano el superadmin;
 * no sale del dueño de la ficha ni de ser superadmin.
 */
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase.js';
import { mergeO2OPeople } from '../tools/o2o/domain/picker.js';

/** Personas a las que `uid` está asignado como manager de O2O, más toda su
 *  rama del directorio (`directoryManagerUids`, RMR-TSK-0662). */
export async function listMyO2OPeople(uid) {
  if (!uid) return [];
  const byField = (field) => getDocs(query(collection(db, 'people'), where(field, 'array-contains', uid)))
    .then((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  const [manual, branch] = await Promise.all([byField('o2oManagerUids'), byField('directoryManagerUids')]);
  return mergeO2OPeople(manual, branch);
}
