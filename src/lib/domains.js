/**
 * Lectura y escritura del catálogo de DOMINIOS y SUBDOMINIOS
 * (ADR «De squads a dominios y subdominios»).
 *
 * Colecciones de la organización, planas y de primer nivel:
 *   /domains/{id}      { key, name, channel? }
 *   /subdomains/{id}   { key, name, domainKey, linearProject?, githubTeam? }
 *
 * El subdominio referencia a su dominio por `domainKey` y no por el id del
 * documento: `key` es la clave del contrato entre sistemas, y así el enganche se
 * lee igual desde GREBLA, desde el portal o desde un volcado. Las reglas exigen
 * que ambos vengan con `key` y que el subdominio traiga su `domainKey`.
 *
 * Las lee cualquiera con acceso (para pintar a qué pertenece cada persona) y las
 * escribe solo el superadmin, igual que el catálogo al que sustituyen.
 *
 * La lógica pura —validar claves, agrupar, rotular— vive en
 * src/tools/team/domain/domains.js; aquí solo está la IO.
 */
import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';

const DOMAINS = 'domains';
const SUBDOMAINS = 'subdomains';

/** @param {import('firebase/firestore').QuerySnapshot} snap */
const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

/**
 * Catálogo de dominios, ordenado por nombre.
 * @returns {Promise<Array<{ id: string, key: string, name: string, channel?: string }>>}
 */
export async function listDomains() {
  return rows(await getDocs(collection(db, DOMAINS)))
    .toSorted((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'es'));
}

/**
 * Catálogo de subdominios, ordenado por nombre.
 * @returns {Promise<Array<{ id: string, key: string, name: string, domainKey: string,
 *   linearProject?: string, githubTeam?: string }>>}
 */
export async function listSubdomains() {
  return rows(await getDocs(collection(db, SUBDOMAINS)))
    .toSorted((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'es'));
}

/**
 * Crea un dominio. El `key` se pasa explícito —nunca se deriva aquí del nombre—
 * porque es la clave del contrato: derivarla es lo que hoy parte las series
 * históricas al renombrar.
 * @param {{ key: string, name: string, channel?: string }} data
 * @returns {Promise<string>} id del documento
 */
export async function createDomain({ key, name, channel = '' }) {
  const payload = { key, name, createdAt: serverTimestamp() };
  if (channel) payload.channel = channel;
  const created = await addDoc(collection(db, DOMAINS), payload);
  return created.id;
}

/**
 * Crea un subdominio dentro de un dominio.
 * @param {{ key: string, name: string, domainKey: string, linearProject?: string, githubTeam?: string }} data
 * @returns {Promise<string>}
 */
export async function createSubdomain({ key, name, domainKey, linearProject = '', githubTeam = '' }) {
  const payload = { key, name, domainKey, createdAt: serverTimestamp() };
  if (linearProject) payload.linearProject = linearProject;
  if (githubTeam) payload.githubTeam = githubTeam;
  const created = await addDoc(collection(db, SUBDOMAINS), payload);
  return created.id;
}

/**
 * Renombra un dominio o subdominio. NO toca su `key`: ese es justo el punto del
 * modelo — el rótulo se puede cambiar cuantas veces haga falta sin que nada más
 * se entere.
 * @param {'domain'|'subdomain'} kind
 * @param {string} id
 * @param {string} name
 * @returns {Promise<void>}
 */
export function renameScope(kind, id, name) {
  return updateDoc(doc(db, kind === 'domain' ? DOMAINS : SUBDOMAINS, id), { name });
}

/**
 * Fija la identidad externa de un subdominio (proyecto de Linear, team de
 * GitHub): la de MEDICIÓN vive aquí, no en el dominio, porque es de donde salen
 * las métricas.
 * @param {string} id
 * @param {{ linearProject?: string, githubTeam?: string }} identity
 * @returns {Promise<void>}
 */
export function setSubdomainIdentity(id, { linearProject = '', githubTeam = '' }) {
  return updateDoc(doc(db, SUBDOMAINS, id), { linearProject, githubTeam });
}

/**
 * Fija el canal de Slack de un dominio: la identidad de COMUNICACIÓN vive en el
 * dominio, que es donde está la gente.
 * @param {string} id
 * @param {string} channel
 * @returns {Promise<void>}
 */
export function setDomainChannel(id, channel) {
  return updateDoc(doc(db, DOMAINS, id), { channel });
}

/**
 * Borra un subdominio. El caller debe haber comprobado que no tiene métricas
 * publicadas: borrarlo con serie viva la deja huérfana en el portal.
 * @param {string} id
 * @returns {Promise<void>}
 */
export function deleteSubdomain(id) {
  return deleteDoc(doc(db, SUBDOMAINS, id));
}

/**
 * Escribe un dominio con id conocido. Solo lo usa la migración desde el catálogo
 * antiguo, que CONSERVA los ids para no romper las referencias existentes.
 * @param {string} id
 * @param {{ key: string, name: string, channel?: string }} data
 * @returns {Promise<void>}
 */
export function putDomainWithId(id, data) {
  return setDoc(doc(db, DOMAINS, id), data, { merge: true });
}

/**
 * Escribe un subdominio con id conocido. Igual que el anterior: solo migración.
 * @param {string} id
 * @param {{ key: string, name: string, domainKey: string }} data
 * @returns {Promise<void>}
 */
export function putSubdomainWithId(id, data) {
  return setDoc(doc(db, SUBDOMAINS, id), data, { merge: true });
}
