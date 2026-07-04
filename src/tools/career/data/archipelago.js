/**
 * Archipiélago del Mapa de Carrera (MC-14): ÍNDICE de islas, funciones puras.
 *
 * El catálogo de carrera pasa de una isla única a un archipiélago: un doc por
 * isla en /careerMap/{islandId} (misma forma que hoy) más el índice
 * /careerMap/_archipelago con este modelo: `{ islands: IslandRef[] }`, donde
 * cada entrada lleva id, nombre, disciplina y su posición x/y (0..100) en el
 * MAPA DEL MAR (el overlay del archipiélago desde el que se viaja en barco).
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
 * Las 13 islas del archipiélago (ADR: una por disciplina). Solo la isla de
 * inicio tiene contenido real hoy; las demás se registran en el índice y sus
 * docs llegarán con el contenido curado (MC-16) — mientras tanto el tool las
 * muestra como isla-placeholder «En construcción» (playa + puerto + cartel).
 * Posiciones x/y (0..100) repartidas a mano por el mar, la de inicio al
 * centro-sur; el resto en una espiral suelta sin solapes.
 * @type {ReadonlyArray<IslandRef>}
 */
export const ARCHIPELAGO_ISLANDS = [
  { id: 'island', name: 'Bases de software', discipline: 'bases', x: 50, y: 76, startIsland: true },
  { id: 'frontend', name: 'Isla Frontend', discipline: 'frontend', x: 28, y: 54 },
  { id: 'backend-php', name: 'Isla Backend PHP', discipline: 'backend-php', x: 16, y: 30 },
  { id: 'backend-python', name: 'Isla Backend Python', discipline: 'backend-python', x: 32, y: 16 },
  { id: 'android', name: 'Isla Android', discipline: 'android', x: 52, y: 10 },
  { id: 'ios', name: 'Isla iOS', discipline: 'ios', x: 70, y: 16 },
  { id: 'ai-engineer', name: 'Isla AI Engineer', discipline: 'ai-engineer', x: 86, y: 26 },
  { id: 'devops', name: 'Isla DevOps', discipline: 'devops', x: 88, y: 48 },
  { id: 'postgres', name: 'Isla Postgres', discipline: 'postgres', x: 78, y: 62 },
  { id: 'engineering-manager', name: 'Isla Engineering Manager', discipline: 'engineering-manager', x: 16, y: 68 },
  { id: 'software-architect', name: 'Isla Software Architect', discipline: 'software-architect', x: 64, y: 38 },
  { id: 'product-manager', name: 'Isla Product Manager', discipline: 'product-manager', x: 40, y: 38 },
  { id: 'fde', name: 'Isla FDE', discipline: 'fde', x: 66, y: 74 },
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
 * @param {Record<string, unknown>} ref
 * @returns {IslandRef|null}
 */
function normalizeIslandRef(ref) {
  const id = String(ref?.id ?? '').trim();
  if (!id) return null;
  /** @type {IslandRef} */
  const out = {
    id,
    name: String(ref?.name ?? '').trim() || id,
    x: clampCoord(toFiniteNumber(ref?.x, 50)),
    y: clampCoord(toFiniteNumber(ref?.y, 50)),
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
