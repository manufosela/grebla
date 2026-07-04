/**
 * Archipiélago del Mapa de Carrera (MC-14): ÍNDICE de islas, funciones puras.
 *
 * El catálogo de carrera pasa de una isla única a un archipiélago: un doc por
 * isla en /careerMap/{islandId} (misma forma que hoy) más el índice
 * /careerMap/_archipelago con este modelo: `{ islands: IslandRef[] }`, donde
 * cada entrada lleva id, nombre, disciplina, su posición x/y (0..100) en el
 * MAPA DEL MAR (el overlay del archipiélago desde el que se viaja en barco)
 * y, desde MC-20, el objetivo de ciudadanía (`citizenshipPct`) y el nº de
 * ciudades no deprecadas de su doc (`citiesTotal`, lo mantienen los seeds).
 *
 * Como en maps.js, estas funciones NO tocan Firebase: normalizan el documento
 * leído y lo serializan para escribir (saneo de tipos, ids únicos, descarte de
 * entradas inválidas), de modo que se testean sin Firestore. La IO vive en
 * src/lib/careerMap.js.
 *
 * @typedef {import('../domain/types.js').IslandRef} IslandRef
 * @typedef {import('../domain/types.js').Archipelago} Archipelago
 */
import { DEFAULT_ISLAND_ID } from '../domain/types.js';

/** Id de la isla de INICIO (el doc /careerMap/island actual, «Bases de software»). */
export const START_ISLAND_ID = DEFAULT_ISLAND_ID;

/**
 * Objetivo de ciudadanía por defecto (MC-20) para islas que no traen el suyo:
 * islas creadas a mano por el superadmin desde /admin o índices anteriores a
 * MC-20. Es una migración deliberada (documentada aquí), no un fallback
 * silencioso: el valor queda visible en el HUD y es editable en el índice.
 */
export const DEFAULT_CITIZENSHIP_PCT = 80;

/**
 * Las 13 islas del archipiélago (ADR: una por disciplina). Solo la isla de
 * inicio tiene contenido real hoy; las demás se registran en el índice y sus
 * docs llegarán con el contenido curado (MC-16) — mientras tanto el tool las
 * muestra como isla-placeholder «En construcción» (playa + puerto + cartel).
 * Posiciones x/y (0..100) repartidas a mano por el mar, la de inicio al
 * centro-sur; el resto en una espiral suelta sin solapes.
 *
 * MC-20 — progresión por isla:
 *  - `citizenshipPct`: % de certificados (ciudades no deprecadas visitadas)
 *    que otorga la CIUDADANÍA de la isla. Bases exige el 100%; el resto según
 *    la dureza del ADR (85 técnica profunda, 90 management, 80 desarrollo,
 *    75 plataforma/móvil, 70 emergentes).
 *  - `citiesTotal`: nº de ciudades NO deprecadas del doc de la isla. La fuente
 *    de verdad la mantienen los seeds (scripts/seed-islands.mjs) al sembrar;
 *    aquí van los valores del contenido en código (islands.test.js los valida
 *    contra ISLAND_CONTENT para que no se queden obsoletos).
 * @type {ReadonlyArray<IslandRef>}
 */
export const ARCHIPELAGO_ISLANDS = [
  { id: 'island', name: 'Bases de software', discipline: 'bases', x: 50, y: 76, startIsland: true, citizenshipPct: 100, citiesTotal: 25 },
  { id: 'frontend', name: 'Isla Frontend', discipline: 'frontend', x: 28, y: 54, citizenshipPct: 80, citiesTotal: 24 },
  { id: 'backend-php', name: 'Isla Backend PHP', discipline: 'backend-php', x: 16, y: 30, citizenshipPct: 80, citiesTotal: 23 },
  { id: 'backend-python', name: 'Isla Backend Python', discipline: 'backend-python', x: 32, y: 16, citizenshipPct: 80, citiesTotal: 21 },
  { id: 'android', name: 'Isla Android', discipline: 'android', x: 52, y: 10, citizenshipPct: 75, citiesTotal: 23 },
  { id: 'ios', name: 'Isla iOS', discipline: 'ios', x: 70, y: 16, citizenshipPct: 75, citiesTotal: 22 },
  { id: 'ai-engineer', name: 'Isla AI Engineer', discipline: 'ai-engineer', x: 86, y: 26, citizenshipPct: 70, citiesTotal: 21 },
  { id: 'devops', name: 'Isla DevOps', discipline: 'devops', x: 88, y: 48, citizenshipPct: 75, citiesTotal: 24 },
  { id: 'postgres', name: 'Isla Postgres', discipline: 'postgres', x: 78, y: 62, citizenshipPct: 85, citiesTotal: 23 },
  { id: 'engineering-manager', name: 'Isla Engineering Manager', discipline: 'engineering-manager', x: 16, y: 68, citizenshipPct: 90, citiesTotal: 22 },
  { id: 'software-architect', name: 'Isla Software Architect', discipline: 'software-architect', x: 64, y: 38, citizenshipPct: 85, citiesTotal: 23 },
  { id: 'product-manager', name: 'Isla Product Manager', discipline: 'product-manager', x: 40, y: 38, citizenshipPct: 90, citiesTotal: 20 },
  { id: 'fde', name: 'Isla FDE', discipline: 'fde', x: 66, y: 74, citizenshipPct: 70, citiesTotal: 20 },
];

/**
 * Semilla/fallback del índice: copia profunda de las 13 islas en código. Se usa
 * cuando todavía no existe el documento /careerMap/_archipelago en Firestore
 * (y es lo que siembra scripts/seed-archipelago.mjs).
 * @returns {Archipelago}
 */
export function seedArchipelago() {
  return structuredClone({ islands: ARCHIPELAGO_ISLANDS });
}

/** @param {unknown} value @param {number} fallback @returns {number} */
function toFiniteNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Acota una coordenada del mapa del mar al rango 0..100. @param {number} n */
function clampCoord(n) {
  return Math.min(Math.max(n, 0), 100);
}

/**
 * Normaliza una entrada cruda del índice. Devuelve null si no tiene id (el
 * caller la descarta).
 *
 * MC-20: toda entrada sale con `citizenshipPct` (entero 0..100; índices
 * anteriores a MC-20 o islas de superadmin sin objetivo caen al valor de la
 * isla homónima de la semilla y, si tampoco existe, a DEFAULT_CITIZENSHIP_PCT)
 * y con `citiesTotal` (entero ≥ 0; 0 = «aún sin sembrar», el seed lo escribe).
 * @param {Record<string, unknown>} ref
 * @returns {IslandRef|null}
 */
function normalizeIslandRef(ref) {
  const id = String(ref?.id ?? '').trim();
  if (!id) return null;
  const seedPct = ARCHIPELAGO_ISLANDS.find((i) => i.id === id)?.citizenshipPct ?? DEFAULT_CITIZENSHIP_PCT;
  /** @type {IslandRef} */
  const out = {
    id,
    name: String(ref?.name ?? '').trim() || id,
    x: clampCoord(toFiniteNumber(ref?.x, 50)),
    y: clampCoord(toFiniteNumber(ref?.y, 50)),
    citizenshipPct: Math.round(clampCoord(toFiniteNumber(ref?.citizenshipPct, seedPct))),
    citiesTotal: Math.max(Math.round(toFiniteNumber(ref?.citiesTotal, 0)), 0),
  };
  const discipline = String(ref?.discipline ?? '').trim();
  if (discipline) out.discipline = discipline;
  if (ref?.startIsland === true) out.startIsland = true;
  return out;
}

/**
 * Reconstruye el archipiélago a partir del documento de Firestore: sanea tipos,
 * descarta entradas sin id y deduplica por id (gana la primera aparición,
 * conservando el orden del documento — es el orden de pintado del mapa del
 * mar). Si no hay datos (documento inexistente) devuelve la semilla en código.
 * @param {Record<string, unknown>|null|undefined} data data() de /careerMap/_archipelago
 * @returns {Archipelago}
 */
export function normalizeArchipelago(data) {
  if (!data) return seedArchipelago();
  const seen = new Set();
  const islands = (Array.isArray(data.islands) ? data.islands : [])
    .map(normalizeIslandRef)
    .filter((island) => {
      if (island === null || seen.has(island.id)) return false;
      seen.add(island.id);
      return true;
    });
  return { islands };
}

/**
 * Serializa el archipiélago a un objeto plano apto para Firestore (sin
 * `undefined`): mismos saneos que la normalización (ids únicos, entradas sin
 * id fuera), y los campos opcionales solo se persisten cuando aportan valor.
 * @param {Archipelago} arch
 * @returns {{ islands: IslandRef[] }}
 */
export function serializeArchipelago(arch) {
  return normalizeArchipelago({ islands: arch?.islands ?? [] });
}
