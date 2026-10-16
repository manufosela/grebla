/**
 * Persistencia de las recomendaciones del mapa (RMR-TSK-0739) en
 * /people/{personId}/careerRecommendations/{autoId}. La lógica vive en
 * src/tools/career/domain/recommendations.js; las reglas deciden quién puede qué
 * (RMR-TSK-0738): recomienda quien lleva a la persona, decide ella.
 *
 * @typedef {import('../tools/career/domain/recommendations.js').Recommendation} Recommendation
 */
import { collection, getDocs, addDoc, deleteDoc, doc, runTransaction } from 'firebase/firestore';
import { db } from './firebase.js';
import { newRecommendation, decideRecommendation, applyToRoute } from '../tools/career/domain/recommendations.js';

const recosOf = (personId) => collection(db, 'people', personId, 'careerRecommendations');

/**
 * @param {string} personId
 * @returns {Promise<Array<Recommendation & { id: string }>>}
 */
export async function listRecommendations(personId) {
  const snap = await getDocs(recosOf(personId));
  return snap.docs.map((d) => /** @type {any} */ ({ id: d.id, ...d.data() }));
}

/**
 * El manager recomienda una ruta prehecha o una casa.
 * @param {string} personId
 * @param {{ kind: 'route'|'city', routeId?: string|null, cityIds: string[], label: string, note?: string,
 *   by: { uid: string, name: string } }} input
 */
export async function recommend(personId, input) {
  await addDoc(recosOf(personId), newRecommendation({ ...input, at: new Date().toISOString() }));
}

/** Quien recomendó la retira mientras siga abierta. */
export async function withdrawRecommendation(personId, recId) {
  await deleteDoc(doc(recosOf(personId), recId));
}

/**
 * La persona decide. Aceptar añade a su ruta las casas que le falten, en la
 * MISMA transacción: o queda todo o nada.
 * @param {string} personId
 * @param {Recommendation & { id: string }} rec
 * @param {'accepted'|'dismissed'} decision
 */
export async function decideRecommendationFor(personId, rec, decision) {
  const recRef = doc(recosOf(personId), rec.id);
  const journeyRef = doc(db, 'people', personId, 'career', 'journey');
  await runTransaction(db, async (tx) => {
    // Se decide sobre lo guardado, no sobre la copia de la pantalla: si ya se
    // decidió (o se retiró) en otra pestaña, aquí falla en vez de pisarlo.
    const stored = await tx.get(recRef);
    if (!stored.exists()) throw new Error('Esta recomendación ya no existe: la retiró quien la hizo.');
    const current = stored.data();
    const patch = decideRecommendation(current, decision, new Date().toISOString());
    const journey = decision === 'accepted' ? await tx.get(journeyRef) : null;
    tx.update(recRef, patch);
    if (journey) tx.set(journeyRef, { plannedRoute: applyToRoute(journey.data()?.plannedRoute, current) }, { merge: true });
  });
}
