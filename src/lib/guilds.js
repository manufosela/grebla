/**
 * Catálogo de GREMIOS de la instancia (`/guilds`, legible por cualquier
 * logado). Para el poker por gremios (RMR-PCS-0043) cuentan solo los GLOBALES:
 * un gremio personal de un líder (con `ownerLeaderUid`) no es un gremio de la
 * organización.
 */
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase.js';

/** @returns {Promise<string[]>} nombres de los gremios globales, ordenados */
export async function listGlobalGuilds() {
  const snap = await getDocs(collection(db, 'guilds'));
  return snap.docs
    .map((d) => d.data())
    .filter((g) => !g.ownerLeaderUid && typeof g.name === 'string' && g.name.trim())
    .map((g) => g.name.trim())
    .sort((a, b) => a.localeCompare(b, 'es'));
}
