/**
 * Ajustes de cada herramienta (/toolSettings/{toolId}) — RMR-TSK-0496.
 *
 * Distinto de /toolPolicies: la política dice QUIÉN entra y quién gestiona; esto
 * es lo que quien gestiona puede cambiar DENTRO de la herramienta. Hoy solo el
 * umbral de anonimato de Marea.
 *
 * Lectura: cualquier autenticado (la vista lo necesita para explicar por qué un
 * grupo aún no tiene media). Escritura: quien gobierna o gestiona la
 * herramienta, y con el suelo validado también en las reglas.
 */
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';
import { sanitizeMinCount, validateMinCount } from '../tools/pulse/domain/settings.js';

/** Ajustes de Marea, con el umbral ya saneado. @returns {Promise<{minCount: number}>} */
export async function getMareaSettings() {
  const snap = await getDoc(doc(db, 'toolSettings', 'marea'));
  return { minCount: sanitizeMinCount(snap.exists() ? snap.data().minCount : undefined) };
}

/**
 * Guarda el umbral de anonimato. Falla ruidosamente si no vale: corregirlo en
 * silencio dejaría a quien administra creyendo que guardó otra cosa.
 * @param {number} minCount
 * @returns {Promise<void>}
 */
export async function saveMareaMinCount(minCount) {
  const check = validateMinCount(minCount);
  if (!check.ok) throw new Error(check.reason);
  await setDoc(doc(db, 'toolSettings', 'marea'), { minCount, updatedAt: serverTimestamp() }, { merge: true });
}
