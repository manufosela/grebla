/**
 * Catálogo de GREMIOS de la instancia (`/guilds`, legible por cualquier
 * logado). Para el poker por gremios (RMR-PCS-0043) cuentan solo los GLOBALES:
 * un gremio personal de un líder (con `ownerLeaderUid`) no es un gremio de la
 * organización.
 */
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase.js';

/**
 * Gremios que ESTIMAN, de entre los del catálogo (puro): globales, con nombre y
 * sin `estimates: false` — un gremio puede existir en la ficha y no votar tareas
 * (decisión de Mánu, RMR-TSK-0532).
 *
 * Tech Lead, Engineering Manager y Product Management ya NO están en el
 * catálogo: son roles, no gremios (RMR-TSK-0613). Eran el ejemplo de
 * `estimates: false`; la marca sigue sirviendo para cualquier gremio que no vote.
 * @param {Array<{ name?: unknown, ownerLeaderUid?: unknown, estimates?: unknown }>} docs
 * @returns {string[]} nombres ordenados
 */
export function selectPokerGuilds(docs) {
  return (docs ?? [])
    .filter((g) => g && !g.ownerLeaderUid && typeof g.name === 'string' && g.name.trim() && g.estimates !== false)
    .map((g) => g.name.trim())
    .sort((a, b) => a.localeCompare(b, 'es'));
}

/** @returns {Promise<string[]>} nombres de los gremios globales que estiman, ordenados */
export async function listGlobalGuilds() {
  const snap = await getDocs(collection(db, 'guilds'));
  return selectPokerGuilds(snap.docs.map((d) => d.data()));
}
