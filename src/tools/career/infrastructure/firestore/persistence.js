/**
 * Persistencia Firestore del Mapa de Carrera (modelo persona unificada): el
 * journey vive en /people/{personId}/career/journey, dentro del subárbol de la
 * persona. Hereda las reglas de /people/{personId}/{document=**} (un líder dueño /
 * compartido / superadmin pueden leer/editar). `db` se inyecta.
 *
 * @typedef {import('firebase/firestore').Firestore} Firestore
 * @typedef {import('../../domain/ports.js').CareerStore} CareerStore
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';

const journeyDoc = (db, personId) => doc(db, 'people', personId, 'career', 'journey');

/**
 * @param {Firestore} db
 * @returns {CareerStore}
 */
export function createFirestoreCareerStore(db) {
  if (!db) throw new Error('createFirestoreCareerStore requiere una instancia de Firestore (db)');
  return {
    journeys: {
      async get(personId) {
        const d = await getDoc(journeyDoc(db, personId));
        return d.exists() ? d.data() : null;
      },
      async save(personId, journey) {
        await setDoc(journeyDoc(db, personId), { ...journey }, { merge: true });
      },
    },
  };
}
