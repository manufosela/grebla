/**
 * Persistencia Firestore del Mapa de Carrera (modelo multi-leader), por usuario:
 * /journeys/{uid} a nivel de instancia. `db` se inyecta.
 *
 * @typedef {import('firebase/firestore').Firestore} Firestore
 * @typedef {import('../../domain/ports.js').CareerStore} CareerStore
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';

const journeyDoc = (db, uid) => doc(db, 'journeys', uid);

/**
 * @param {Firestore} db
 * @returns {CareerStore}
 */
export function createFirestoreCareerStore(db) {
  if (!db) throw new Error('createFirestoreCareerStore requiere una instancia de Firestore (db)');
  return {
    journeys: {
      async get(uid) {
        const d = await getDoc(journeyDoc(db, uid));
        return d.exists() ? d.data() : null;
      },
      async save(uid, journey) {
        await setDoc(journeyDoc(db, uid), { ...journey }, { merge: true });
      },
    },
  };
}
