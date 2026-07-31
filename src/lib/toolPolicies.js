/**
 * Políticas de acceso a herramientas (/toolPolicies), configurables por el
 * superadmin (RMR-PCS-0027 · F3). Cada doc es { label, audience, managedBy }.
 * La lógica de decisión vive en el módulo puro ../tools/team/domain/toolAccess.js.
 *
 * Lectura: cualquier autenticado (para saber qué herramientas ve). Escritura:
 * solo superadmin (reglas de Firestore).
 */
import { doc, collection, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';

/** @typedef {import('../tools/team/domain/toolAccess.js').ToolPolicy} ToolPolicy */

/** @param {import('firebase/firestore').DocumentData} data @param {string} id @returns {ToolPolicy} */
const toPolicy = (data, id) => ({
  toolId: id,
  label: data.label ?? id,
  audience: data.audience ?? {},
  managedBy: data.managedBy ?? {},
});

/** @returns {Promise<ToolPolicy[]>} */
export async function listToolPolicies() {
  const snap = await getDocs(collection(db, 'toolPolicies'));
  return snap.docs.map((d) => toPolicy(d.data(), d.id));
}

/**
 * Guarda la política de una herramienta (merge para no pisar label).
 * @param {string} toolId
 * @param {{ label?: string, audience?: object, managedBy?: object }} data
 * @returns {Promise<void>}
 */
export function saveToolPolicy(toolId, data) {
  const patch = { updatedAt: serverTimestamp() };
  if (data.label !== undefined) patch.label = data.label;
  if (data.audience !== undefined) patch.audience = data.audience;
  if (data.managedBy !== undefined) patch.managedBy = data.managedBy;
  return setDoc(doc(db, 'toolPolicies', toolId), patch, { merge: true });
}
