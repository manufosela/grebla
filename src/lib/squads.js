/**
 * Lectura del catálogo de squads para contextos que NO tienen la persistencia
 * del tool Equipo — en concreto «Mi espacio» del ingeniero, que tira de `lib/`
 * (RMR-TSK-0277). La gestión (crear/renombrar/borrar) sigue viviendo en los
 * casos de uso del tool, que es donde se edita el catálogo.
 *
 * Las reglas permiten leer /squads a cualquiera con acceso, justamente para que
 * cada persona pueda ver a qué squad pertenece.
 */
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase.js';

/**
 * Catálogo de squads de la organización, ordenado por nombre.
 * @returns {Promise<Array<{ id: string, name: string, color?: string }>>}
 */
export async function listSquadsCatalog() {
  const snap = await getDocs(collection(db, 'squads'));
  return snap.docs
    .map((d) => ({ id: d.id, name: d.data().name ?? d.id, color: d.data().color ?? '' }))
    .toSorted((a, b) => a.name.localeCompare(b.name, 'es'));
}
