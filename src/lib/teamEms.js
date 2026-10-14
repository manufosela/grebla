/**
 * EM por equipo (RMR-TSK-0717) en /config/org.teamEms: { equipoDeNotion: idDeFicha }.
 * Lo edita el superadmin (reglas de /config/org); al guardar, la Cloud Function
 * syncTeamEms recalcula dueños, O2O y revisores de esos equipos.
 */
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from './firebase.js';

const orgDoc = () => doc(db, 'config', 'org');

/** @returns {Promise<{ teamEms: Record<string, string>, people: Array<object> }>} */
export async function loadTeamEms() {
  const [org, people] = await Promise.all([getDoc(orgDoc()), getDocs(collection(db, 'people'))]);
  return {
    teamEms: org.data()?.teamEms ?? {},
    people: people.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
}

/**
 * Sustituye el mapa entero (mergeFields): un equipo que se queda sin EM desaparece,
 * y el resto de /config/org no se toca.
 * @param {Record<string, string>} teamEms
 */
export async function saveTeamEms(teamEms) {
  await setDoc(orgDoc(), { teamEms }, { mergeFields: ['teamEms'] });
}
