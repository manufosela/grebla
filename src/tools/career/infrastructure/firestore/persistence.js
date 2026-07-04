/**
 * Persistencia Firestore del Mapa de Carrera (modelo persona unificada): el
 * journey vive en /people/{personId}/career/journey y los LOGROS con fecha
 * (MC-21) en /people/{personId}/career/achievements, dentro del subárbol de la
 * persona. Ambos heredan las reglas de /people/{personId}/{document=**} (un
 * líder dueño / compartido-edit / superadmin escriben; la cuenta vinculada del
 * ingeniero LEE). `db` se inyecta.
 *
 * Las CONSULTAS AL BRUJO (MC-22) viven en
 * /people/{personId}/career/wizard/questions/{questionId} (un doc por
 * consulta, bajo el doc-fantasma `wizard` del subárbol career: el path del
 * diseño original /career/questions/{qId} tiene 5 segmentos — colección, no
 * documento — y no puede alojar docs). Además de las reglas del subárbol, el
 * jugador vinculado (Person.uid == auth.uid) tiene una excepción ACOTADA:
 * crear consultas 'pending' y marcar la respuesta como vista (solo
 * status+seenAt) — ver firestore.rules.
 *
 * El TIEMPO DE JUEGO (MC-23) vive en /people/{personId}/career/playtime:
 * { totalMinutes, byDay: { 'YYYY-MM-DD': minutos } }, con incrementos
 * atómicos (increment()) y poda de días antiguos (deleteField).
 *
 * @typedef {import('firebase/firestore').Firestore} Firestore
 * @typedef {import('../../domain/ports.js').CareerStore} CareerStore
 */
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  collection,
  increment,
  deleteField,
} from 'firebase/firestore';

const journeyDoc = (db, personId) => doc(db, 'people', personId, 'career', 'journey');
const achievementsDoc = (db, personId) => doc(db, 'people', personId, 'career', 'achievements');
const questionsCol = (db, personId) =>
  collection(db, 'people', personId, 'career', 'wizard', 'questions');
const playtimeDoc = (db, personId) => doc(db, 'people', personId, 'career', 'playtime');

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
    achievements: {
      async get(personId) {
        const d = await getDoc(achievementsDoc(db, personId));
        return d.exists() ? d.data() : null;
      },
      // Solo-añadir (MC-21): merge de mapas anidados — los registros existentes
      // (sus fechas) nunca se pisan porque el parche solo trae claves nuevas
      // (lo garantiza newAchievements en el dominio). OJO Firestore: con
      // merge:true un mapa VACÍO ({}) sí entra en la máscara y REEMPLAZA al
      // existente (lo vaciaría) — las secciones sin claves se omiten del
      // escrito, y un parche sin nada que añadir no escribe.
      async save(personId, patch) {
        /** @type {Record<string, unknown>} */
        const data = {};
        if (Object.keys(patch.citizenships ?? {}).length > 0) data.citizenships = patch.citizenships;
        if (Object.keys(patch.badges ?? {}).length > 0) data.badges = patch.badges;
        if (Object.keys(data).length === 0) return;
        await setDoc(achievementsDoc(db, personId), data, { merge: true });
      },
    },
    // Consultas al brujo (MC-22): repos «tontos» — los campos (status, fechas
    // ISO, validación) los componen los casos de uso. markSeen escribe SOLO
    // status+seenAt: la máscara que permite la excepción del jugador vinculado.
    questions: {
      async listByPerson(personId) {
        const snap = await getDocs(questionsCol(db, personId));
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      },
      async ask(personId, question) {
        const ref = doc(questionsCol(db, personId)); // id autogenerado
        await setDoc(ref, { ...question });
        return { id: ref.id };
      },
      async answer(personId, questionId, patch) {
        await updateDoc(doc(questionsCol(db, personId), questionId), { ...patch });
      },
      async markSeen(personId, questionId, patch) {
        await updateDoc(doc(questionsCol(db, personId), questionId), {
          status: patch.status,
          seenAt: patch.seenAt,
        });
      },
    },
    // Tiempo de juego (MC-23): incrementos ATÓMICOS con increment() — total y
    // día suben juntos, sin transacciones ni leer-modificar-escribir (dos
    // pestañas del líder no se pisan). setDoc con merge crea el doc en el
    // primer flush. Escribe quien juega HOY: líder dueño / compartido-edit /
    // superadmin (las reglas del subárbol de la persona ya lo cubren); el
    // jugador vinculado NO escribe — cuando juegue con su cuenta habrá que
    // ampliar las reglas con una excepción acotada, como la del brujo.
    playtime: {
      async get(personId) {
        const d = await getDoc(playtimeDoc(db, personId));
        return d.exists() ? d.data() : null;
      },
      async increment(personId, { day, minutes }) {
        await setDoc(
          playtimeDoc(db, personId),
          { totalMinutes: increment(minutes), byDay: { [day]: increment(minutes) } },
          { merge: true },
        );
      },
      // Poda del histórico (MC-23): borra días antiguos con deleteField. Solo
      // se llama con el doc ya existente (la poda se decide sobre lo leído).
      async prune(personId, days) {
        if (days.length === 0) return;
        await updateDoc(
          playtimeDoc(db, personId),
          Object.fromEntries(days.map((day) => [`byDay.${day}`, deleteField()])),
        );
      },
    },
  };
}
