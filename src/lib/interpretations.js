/**
 * Interpretación con IA de las métricas de una herramienta (RMR-TSK-0610).
 *
 * Hay UNA interpretación vigente por herramienta, en `/interpretations/{tool}`:
 * la genera el superadmin y la lee todo el que tenga acceso. No es una por
 * persona a propósito — si cada cual viera la suya, discutir sobre ella sería
 * discutir sobre cosas distintas.
 *
 * El cliente solo LEE ese documento: lo escribe la Cloud Function con el Admin
 * SDK (las reglas ponen `write: false`). Aquí no se calcula nada: se manda el
 * resumen que ya está en pantalla y se guarda lo que responde.
 */
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, getRegionalFunctions } from './firebase.js';

/**
 * La interpretación vigente, o `null` si no hay ninguna todavía o no se pudo
 * leer. No tenerla es normal —nadie la ha pedido aún— y por eso no es un error
 * que haya que enseñar.
 * @param {string} tool
 * @returns {Promise<object|null>}
 */
export async function getInterpretation(tool) {
  try {
    const snap = await getDoc(doc(db, 'interpretations', tool));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

/**
 * Pide una interpretación nueva del resumen que se está viendo y devuelve la
 * guardada. Falla en alto: quien pulsa el botón tiene que enterarse de que no
 * salió, en vez de quedarse mirando la anterior creyendo que es nueva.
 * @param {string} tool
 * @param {unknown} summary  el MISMO resumen que hay en pantalla
 * @returns {Promise<object>}
 */
export async function requestInterpretation(tool, summary) {
  const call = httpsCallable(await getRegionalFunctions(), 'interpretMetrics');
  const { data } = await call({ tool, summary });
  return data?.interpretation ?? null;
}
