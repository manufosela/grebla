/**
 * Lectura y escritura del orden de las tarjetas (RMR-TSK-0571).
 *
 * Un único documento, `/config/cardLayout`, con el orden de cada superficie. Lo
 * lee cualquiera con sesión —el orden es común a toda la organización— y solo lo
 * escribe el superadmin; las reglas de Firestore lo respaldan.
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase.js';
import { normalizeLayout } from '../tools/admin/domain/cardLayout.js';

const REF = () => doc(db, 'config', 'cardLayout');

/**
 * Orden guardado. Si no hay documento —o no se puede leer— se devuelve el orden
 * vacío: manda el del código. Una pantalla sin tarjetas por un fallo de lectura
 * sería mucho peor que un orden que no se aplica.
 * @returns {Promise<{ home: string[], admin: string[] }>}
 */
export async function getCardLayout() {
  try {
    const snap = await getDoc(REF());
    return normalizeLayout(snap.exists() ? snap.data() : null);
  } catch (err) {
    console.warn('Orden de tarjetas: no se pudo leer; se usa el del código.', err);
    return normalizeLayout(null);
  }
}

/**
 * Guarda el orden. Se sanea antes de escribir: lo que no vale no llega a
 * Firestore, y así el documento siempre se puede leer.
 * @param {{ home?: string[], admin?: string[] }} layout
 */
export async function saveCardLayout(layout) {
  await setDoc(REF(), normalizeLayout(layout), { merge: true });
}
