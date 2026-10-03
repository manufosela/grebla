/**
 * Sincronización del censo con Notion (RMR-TSK-0623, ADR -P1XxVvQPrufU13Bd4RF).
 * La hace la callable `notionSync` (solo superadmin); el último informe queda en
 * /config/notionSync. Que la instancia use Notion lo dice /config/org.notionSync:
 * la demo no lo tiene y sus personas se gestionan desde el admin.
 */
import { httpsCallable } from 'firebase/functions';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db, getRegionalFunctions } from './firebase.js';

/**
 * ¿Esta instancia toma el censo de Notion? Falla en alto: decidir «no» por un
 * error de lectura dejaría editables datos que no lo son.
 * @returns {Promise<boolean>}
 */
export async function isNotionSynced() {
  const snap = await getDoc(doc(db, 'config', 'org'));
  return snap.exists() && snap.data().notionSync === true;
}

/** Último informe guardado, o null si nunca se ha sincronizado. */
export async function getLastNotionSync() {
  const snap = await getDoc(doc(db, 'config', 'notionSync'));
  return snap.exists() ? snap.data() : null;
}

/**
 * Simula (`apply: false`) o aplica la sincronización y devuelve el informe.
 * @param {boolean} apply
 */
export async function runNotionSync(apply) {
  const fn = httpsCallable(await getRegionalFunctions(), 'notionSync', { timeout: 300_000 });
  const { data } = await fn({ apply });
  if (!data?.counts) throw new Error('El informe de Notion ha llegado mal formado.');
  return data;
}

/** Nombre de cada ficha por su id (el superadmin las lee todas), para el informe. */
export async function peopleNames() {
  const snap = await getDocs(collection(db, 'people'));
  return new Map(snap.docs.map((d) => [d.id, d.data().name ?? d.id]));
}
