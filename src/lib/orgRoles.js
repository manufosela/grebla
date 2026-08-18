/**
 * Catálogo de roles del organigrama (/orgRoles), configurable por el superadmin
 * (RMR-PCS-0027 · F2). Cada rol define un nivel de la jerarquía por ETIQUETA:
 * { label, branch, reportsToRoleId }. La lógica de validación (ciclos, cadenas)
 * vive en el módulo puro ../tools/team/domain/orgRoles.js; aquí solo la IO.
 *
 * Lectura: cualquier autenticado (para pintar títulos/organigrama). Escritura:
 * solo superadmin (reglas de Firestore).
 */
import { doc, collection, getDocs, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';

/** @typedef {import('../tools/team/domain/orgRoles.js').OrgRole} OrgRole */

/** @param {import('firebase/firestore').DocumentData} data @param {string} id @returns {OrgRole} */
const toOrgRole = (data, id) => ({
  id,
  label: data.label ?? id,
  branch: data.branch ?? 'generico',
  reportsToRoleId: data.reportsToRoleId ?? null,
  // Capa canónica (RMR-TSK-0434): dónde vive en la pirámide; null = auto
  // (profundidad de cadena). Solo enteros >= 0 (lo demás se descarta).
  layer: Number.isInteger(data.layer) && data.layer >= 0 ? data.layer : null,
});

/** @returns {Promise<OrgRole[]>} */
export async function listOrgRoles() {
  const snap = await getDocs(collection(db, 'orgRoles'));
  return snap.docs.map((d) => toOrgRole(d.data(), d.id));
}

/**
 * Crea o actualiza un rol. `id` es la clave estable (slug); `merge` conserva
 * campos no enviados.
 * @param {string} id
 * @param {{ label: string, branch: string, reportsToRoleId?: string|null, layer?: number|null }} data
 * @returns {Promise<void>}
 */
export function saveOrgRole(id, data) {
  return setDoc(
    doc(db, 'orgRoles', id),
    {
      label: data.label,
      branch: data.branch,
      reportsToRoleId: data.reportsToRoleId ?? null,
      layer: Number.isInteger(data.layer) && data.layer >= 0 ? data.layer : null,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Reasigna solo el superior de un rol (mueve un nodo del organigrama). La
 * validación de ciclos la hace el llamador con assertValidReportsTo antes.
 * @param {string} id @param {string|null} reportsToRoleId
 * @returns {Promise<void>}
 */
export function setOrgRoleReportsTo(id, reportsToRoleId) {
  return setDoc(doc(db, 'orgRoles', id), { reportsToRoleId: reportsToRoleId || null }, { merge: true });
}

/** @param {string} id @returns {Promise<void>} */
export function deleteOrgRole(id) {
  return deleteDoc(doc(db, 'orgRoles', id));
}
