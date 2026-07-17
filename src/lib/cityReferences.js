/**
 * Referencias de aprendizaje aportadas por la tripulación (RMR-TSK-0255): recursos
 * que un ingeniero añade a una casa del mapa (lo que le ayudó a certificarse) y que
 * ven todos, con el nombre de quien las aportó. Colección /cityReferences, agrupadas
 * por `cityKey` (isla::ciudad). El doc del mapa es write-solo-superadmin, por eso los
 * aportes de la comunidad viven en su propia colección con reglas propias.
 *
 * La lógica pura (saneado, validación, clave) vive en tools/career/domain/references.js.
 */
import { collection, doc, addDoc, deleteDoc, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';
import { sanitizeReference, isValidReference, cityRefKey } from '../tools/career/domain/references.js';

const CITY_REFS = 'cityReferences';

/**
 * Suscripción EN VIVO a las referencias de una casa (más antiguas primero).
 * @param {string} islandId @param {string} cityId
 * @param {(refs: Array<Record<string, any>>) => void} onData
 * @param {(err: Error) => void} [onError]
 * @returns {import('firebase/firestore').Unsubscribe}
 */
export function watchCityReferences(islandId, cityId, onData, onError) {
  const q = query(collection(db, CITY_REFS), where('cityKey', '==', cityRefKey(islandId, cityId)));
  return onSnapshot(q, (snap) => {
    const refs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    // Orden client-side (evita índice compuesto; createdAt puede ser null recién creado).
    refs.sort((a, b) => (a.createdAt?.seconds ?? Infinity) - (b.createdAt?.seconds ?? Infinity));
    onData(refs);
  }, onError);
}

/**
 * Añade una referencia a una casa, firmada por el usuario (autoría). Lanza si la
 * referencia no es válida (URL http(s) + título).
 * @param {{ islandId: string, cityId: string, url: string, title: string, note?: string }} data
 * @param {{ uid: string, name?: string }} user
 * @returns {Promise<string>}
 */
export async function addCityReference(data, user) {
  if (!user?.uid) throw new Error('addCityReference requiere el usuario autor');
  const clean = sanitizeReference(data);
  if (!isValidReference(clean)) throw new Error('La referencia necesita un enlace (http/https) y un título.');
  const ref = await addDoc(collection(db, CITY_REFS), {
    cityKey: cityRefKey(data.islandId, data.cityId),
    islandId: String(data.islandId ?? ''),
    cityId: String(data.cityId ?? ''),
    url: clean.url,
    title: clean.title,
    note: clean.note,
    authorUid: user.uid,
    authorName: user.name ?? 'Anónimo',
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Borra una referencia (autor, o manager/superadmin por reglas). @param {string} id */
export function deleteCityReference(id) {
  return deleteDoc(doc(db, CITY_REFS, id));
}
