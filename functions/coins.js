/**
 * TRIBBU-COINS (CP-2): contratos, canónico y lógica pura del EMISOR.
 *
 * ESPEJO de src/tools/career/domain/coins.js (functions/ no importa de src/,
 * igual que computeRepoMetrics es espejo de metrics.js en DORA): los
 * CONTRATOS, el JSON canónico y el hash deben producir EXACTAMENTE lo mismo
 * que en el cliente — si tocas algo aquí, tócalo allí en el mismo commit. La
 * parte de ciudadanías replica la aritmética ENTERA de citizenship.js
 * (certificates·100 ≥ targetPct·total, nunca flotantes) para que la Function
 * y el cliente coincidan siempre en el umbral.
 *
 * Aquí NO hay Firestore ni KMS: todo es puro y verificable con node --check
 * (la IO vive en index.js y la firma en signer.js).
 */
import { createHash } from 'node:crypto';

/** Versión vigente de los contratos de emisión. */
export const RULE_VERSION = 1;

/** prevHash del primer apunte del ledger. */
export const GENESIS_HASH = '0'.repeat(64);

/**
 * CONTRATOS v1 (espejo del cliente):
 * certificado = peso(1-3)×10; ciudadanía = 100; super-ciudadano = 500;
 * leyenda = 1000; carpool completado = paradas×2.
 */
export const CONTRACTS_V1 = Object.freeze({
  /** @param {number} weight */
  certificate: (weight) => weight * 10,
  citizenship: 100,
  superCitizen: 500,
  legend: 1000,
  /** @param {number} stops */
  carpoolCompleted: (stops) => stops * 2,
});

/** Ciudadanías para ⭐ super-ciudadano (incluyendo la isla de inicio) y 👑 leyenda. */
export const SUPER_CITIZEN_MIN = 3;
export const LEGEND_MIN = 6;

/** Isla de INICIO del archipiélago (id de doc 'island', disciplina 'bases'). */
export const START_ISLAND_ID = 'island';

// ── Ids deterministas (idempotencia) ────────────────────────────────────────

/** '/' no es válido en un id de doc de Firestore: 'bases/git' → 'bases~git'. @param {string} cityId */
export const cityKey = (cityId) => String(cityId ?? '').replaceAll('/', '~');

/** @param {string} personId @param {string} cityId */
export const certEntryId = (personId, cityId) => `cert:${personId}:${cityKey(cityId)}`;
/** @param {string} personId @param {string} islandId */
export const citizenshipEntryId = (personId, islandId) => `citz:${personId}:${islandId}`;
/** @param {string} personId @param {'superCitizen'|'legend'} badge */
export const badgeEntryId = (personId, badge) => `badge:${personId}:${badge}`;
/** @param {string} carpoolId @param {string} personId */
export const carpoolEntryId = (carpoolId, personId) => `carpool:${carpoolId}:${personId}`;

// ── Canónico y hash (espejo EXACTO del cliente) ─────────────────────────────

/**
 * JSON canónico: claves ordenadas en todos los niveles, arrays en su orden,
 * sin claves undefined.
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(',')}]`;
  const obj = /** @type {Record<string, unknown>} */ (value);
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
}

/**
 * Texto canónico de un apunte: todo MENOS hash/sig/kid. `id` y `unsigned` SÍ
 * entran (el marcador de degradación queda protegido por el hash).
 * @param {Record<string, unknown>} entry
 * @returns {string}
 */
export function canonicalEntry(entry) {
  const rest = { ...entry };
  delete rest.hash;
  delete rest.sig;
  delete rest.kid;
  return canonicalJson(rest);
}

/** sha256 hex de un texto (node:crypto; el cliente usa Web Crypto — mismo resultado). @param {string} text */
export function sha256Hex(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

// ── Diff del journey ────────────────────────────────────────────────────────

/**
 * Ciudades AÑADIDAS al journey en esta escritura, saneadas, sin duplicados y
 * ordenadas (orden determinista de emisión). Retirar ciudades no resta nunca:
 * el ledger es historia, solo se añaden apuntes.
 * @param {unknown} beforeCities visitedCities del doc anterior (o undefined)
 * @param {unknown} afterCities  visitedCities del doc nuevo
 * @returns {string[]}
 */
export function addedCities(beforeCities, afterCities) {
  const clean = (list) =>
    new Set(
      (Array.isArray(list) ? list : [])
        .filter((c) => typeof c === 'string' && c.trim() !== '')
        .map((c) => c.trim()),
    );
  const before = clean(beforeCities);
  return [...clean(afterCities).difference(before)].toSorted();
}

// ── Ciudadanías y badges (espejo de citizenship.js) ─────────────────────────

/**
 * Entrada mínima del índice del archipiélago que necesita el emisor.
 * @typedef {Object} EmitterIslandRef
 * @property {string} id
 * @property {string} name
 * @property {string} discipline
 * @property {number} citizenshipPct
 * @property {number} citiesTotal
 */

/**
 * Sanea las entradas del doc /careerMap/_archipelago a lo que el emisor
 * necesita. Entradas sin id o sin disciplina se descartan (no hay prefijo que
 * contar); pct y total se fuerzan a entero ≥ 0.
 * @param {unknown} rawIslands  data().islands del índice
 * @returns {EmitterIslandRef[]}
 */
export function normalizeIslands(rawIslands) {
  return (Array.isArray(rawIslands) ? rawIslands : [])
    .map((ref) => {
      const id = String(ref?.id ?? '').trim();
      const discipline = String(ref?.discipline ?? '').trim();
      if (!id || !discipline) return null;
      const pct = Number(ref?.citizenshipPct);
      const total = Number(ref?.citiesTotal);
      return {
        id,
        name: String(ref?.name ?? '').trim() || id,
        discipline,
        citizenshipPct: Number.isFinite(pct) ? Math.max(Math.round(pct), 0) : 0,
        citiesTotal: Number.isFinite(total) ? Math.max(Math.round(total), 0) : 0,
      };
    })
    .filter((ref) => ref !== null);
}

/**
 * Islas cuya CIUDADANÍA cumple el journey dado, con la MISMA aritmética
 * entera que el cliente (citizenship.js): certificados de la isla = ciudades
 * visitadas con prefijo `{discipline}/`; lograda si total > 0 y
 * certificates·100 ≥ targetPct·total.
 * @param {string[]} visitedCities
 * @param {EmitterIslandRef[]} islands
 * @returns {EmitterIslandRef[]} En el orden del índice.
 */
export function achievedCitizenships(visitedCities, islands) {
  return islands.filter((isle) => {
    const prefix = `${isle.discipline}/`;
    const certificates = visitedCities.filter((id) => id.startsWith(prefix)).length;
    return isle.citiesTotal > 0 && certificates * 100 >= isle.citizenshipPct * isle.citiesTotal;
  });
}

/**
 * Badges que cumplen las ciudadanías logradas (espejo de archipelagoProgress):
 * ⭐ super-ciudadano = ≥ 3 INCLUYENDO la isla de inicio; 👑 leyenda = ≥ 6.
 * @param {EmitterIslandRef[]} achieved  Resultado de achievedCitizenships.
 * @returns {{ superCitizen: boolean, legend: boolean }}
 */
export function earnedBadges(achieved) {
  const startAchieved = achieved.some((isle) => isle.id === START_ISLAND_ID);
  return {
    superCitizen: achieved.length >= SUPER_CITIZEN_MIN && startAchieved,
    legend: achieved.length >= LEGEND_MIN,
  };
}
