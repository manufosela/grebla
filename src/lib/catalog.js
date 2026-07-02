/**
 * Gestión de los catálogos con ámbito (áreas, gremios y labels) por el SUPERADMIN:
 * ve todos los registros (globales y personales de los líderes), crea globales,
 * promueve un personal a global (quita su ownerLeaderUid) y borra. El líder
 * gestiona los suyos a través del adapter de la tool Equipo; esta lib es la vista
 * global del superadmin (reglas: write solo superadmin). El `kind` coincide con el
 * nombre de la colección raíz (`areas`, `guilds`, `labels`).
 *
 * @typedef {'areas'|'guilds'|'labels'} CatalogKind
 * @typedef {{ id: string, name: string, ownerLeaderUid?: string }} CatalogItem
 */
import { doc, collection, addDoc, getDocs, deleteDoc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from './firebase.js';

/**
 * Lista TODOS los ítems del catálogo (globales + personales de cualquier líder).
 * @param {CatalogKind} kind
 * @returns {Promise<CatalogItem[]>}
 */
export async function listCatalog(kind) {
  const snap = await getDocs(collection(db, kind));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Crea un ítem GLOBAL (sin ownerLeaderUid).
 * @param {CatalogKind} kind @param {string} name
 * @returns {Promise<void>}
 */
export async function createGlobal(kind, name) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) throw new Error('El nombre es obligatorio');
  await addDoc(collection(db, kind), { name: trimmed });
}

/**
 * Promueve un ítem personal a global: le quita el ownerLeaderUid (el mismo
 * registro pasa a global, sin romper las personas que ya lo referencian).
 * @param {CatalogKind} kind @param {string} id
 * @returns {Promise<void>}
 */
export function promoteToGlobal(kind, id) {
  return updateDoc(doc(db, kind, id), { ownerLeaderUid: deleteField() });
}

/**
 * @param {CatalogKind} kind @param {string} id
 * @returns {Promise<void>}
 */
export function removeFromCatalog(kind, id) {
  return deleteDoc(doc(db, kind, id));
}
