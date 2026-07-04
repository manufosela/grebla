/**
 * Ciudadanía por isla (MC-20): lógica PURA de la progresión del archipiélago.
 *
 * La terminología del juego (MC-15/MC-20): completar una casa = CERTIFICADO;
 * completar el % objetivo de certificados de una isla = CIUDADANÍA de esa
 * isla. Acumular ciudadanías da badges: SUPER-CIUDADANO (≥ 3 ciudadanías
 * INCLUYENDO la de la isla de inicio) y LEYENDA (≥ 6).
 *
 * Todo se calcula BARATO desde el journey global y el índice del archipiélago
 * (sin cargar los 13 docs de isla): los ids de ciudad son únicos globales
 * prefijados por la disciplina de su isla (MC-16, 'bases/git', 'frontend/…'),
 * así que contar certificados por isla es filtrar visitedCities por prefijo;
 * el total de ciudades de cada isla viaja en el índice (`citiesTotal`, lo
 * mantienen los seeds) y el objetivo en `citizenshipPct`.
 *
 * OJO isla de inicio: su id de doc es 'island' pero su disciplina es 'bases'
 * (sus ciudades son 'bases/…') — SIEMPRE se cuenta por `discipline` del ref,
 * nunca por el id.
 *
 * Aritmética de `achieved` en ENTEROS (certificates·100 ≥ target·total): sin
 * redondeos flotantes que regalen o roben una ciudadanía en el umbral. El
 * `pct` expuesto se trunca (floor) para que lo mostrado nunca supere el real:
 * con objetivos enteros, «pct ≥ targetPct en pantalla» ⟺ `achieved`.
 *
 * @typedef {import('./types.js').Journey} Journey
 * @typedef {import('./types.js').IslandRef} IslandRef
 */
import { DEFAULT_ISLAND_ID } from './types.js';
import { justVisitedCity } from './celebration.js';

/** Ciudadanías necesarias para el badge SUPER-CIUDADANO (incluyendo Bases). */
export const SUPER_CITIZEN_MIN = 3;
/** Ciudadanías necesarias para el badge LEYENDA del archipiélago. */
export const LEGEND_MIN = 6;

/**
 * Estado de ciudadanía de UNA isla para un journey.
 * @typedef {Object} IslandCitizenship
 * @property {number} certificates Certificados conseguidos en la isla.
 * @property {number} total        Ciudades de la isla (citiesTotal del índice; 0 = sin sembrar).
 * @property {number} pct          % conseguido, truncado a entero (0 si total = 0).
 * @property {number} targetPct    Objetivo de la isla (citizenshipPct del índice).
 * @property {boolean} achieved    true si total > 0 y se alcanzó el objetivo (exacto, sin redondeos).
 */

/**
 * Progresión agregada del archipiélago.
 * @typedef {Object} ArchipelagoProgress
 * @property {(IslandCitizenship & {id: string, name: string})[]} islands Por isla, en el orden del índice.
 * @property {number} citizenships   Nº de ciudadanías logradas.
 * @property {number} islandsVisited Nº de islas del índice pisadas (journey.visitedIslands).
 * @property {boolean} superCitizen  ≥ SUPER_CITIZEN_MIN ciudadanías incluyendo la isla de inicio.
 * @property {boolean} legend        ≥ LEGEND_MIN ciudadanías.
 */

/**
 * Nº de CERTIFICADOS (ciudades visitadas) de una disciplina: las visitadas del
 * journey cuyo id lleva el prefijo `{discipline}/`. Para la isla de inicio la
 * disciplina es 'bases' (nunca su id 'island').
 * @param {Journey} journey
 * @param {string} discipline Disciplina de la isla (frontend, bases, devops…).
 * @returns {number}
 */
export function islandCertificates(journey, discipline) {
  const prefix = `${String(discipline ?? '').trim()}/`;
  if (prefix === '/') return 0; // sin disciplina no hay prefijo que contar
  return (journey?.visitedCities ?? []).filter((id) => id.startsWith(prefix)).length;
}

/**
 * Ciudadanía de una isla: certificados frente al total y objetivo del índice.
 * `achieved` exige total > 0 (una isla sin sembrar, citiesTotal = 0, nunca
 * regala la ciudadanía) y compara en enteros: certificates·100 ≥ target·total.
 * @param {Journey} journey
 * @param {IslandRef} islandRef Entrada del índice (normalizada: trae citizenshipPct y citiesTotal).
 * @returns {IslandCitizenship}
 */
export function islandCitizenship(journey, islandRef) {
  const certificates = islandCertificates(journey, islandRef?.discipline ?? '');
  const total = islandRef?.citiesTotal ?? 0;
  const targetPct = islandRef?.citizenshipPct ?? 0;
  return {
    certificates,
    total,
    pct: total > 0 ? Math.floor((certificates * 100) / total) : 0,
    targetPct,
    achieved: total > 0 && certificates * 100 >= targetPct * total,
  };
}

/**
 * Progresión COMPLETA del archipiélago para un journey: la ciudadanía de cada
 * isla del índice más los agregados (ciudadanías, islas pisadas y badges).
 * `islandsVisited` cuenta solo islas que EXISTEN en el índice (una isla
 * retirada del índice no infla el marcador N/13 del HUD).
 * @param {Journey} journey
 * @param {IslandRef[]} islands Islas del índice del archipiélago (normalizadas).
 * @returns {ArchipelagoProgress}
 */
export function archipelagoProgress(journey, islands) {
  const list = islands ?? [];
  const perIsland = list.map((ref) => ({
    id: ref.id,
    name: ref.name,
    ...islandCitizenship(journey, ref),
  }));
  const citizenships = perIsland.filter((i) => i.achieved).length;
  const startAchieved = perIsland.some((i) => i.id === DEFAULT_ISLAND_ID && i.achieved);
  const knownIds = new Set(list.map((i) => i.id));
  const islandsVisited = new Set(
    (journey?.visitedIslands ?? []).filter((id) => knownIds.has(id)),
  ).size;
  return {
    islands: perIsland,
    citizenships,
    islandsVisited,
    superCitizen: citizenships >= SUPER_CITIZEN_MIN && startAchieved,
    legend: citizenships >= LEGEND_MIN,
  };
}

/**
 * Celebración pendiente tras un cambio de journey (MC-20).
 * @typedef {(
 *   {kind: 'island', islandId: string, islandName: string} |
 *   {kind: 'super'} |
 *   {kind: 'legend'}
 * )} CitizenshipEvent
 */

/**
 * Eventos de celebración que dispara un cambio de journey, EN ORDEN de
 * anuncio (isla → super-ciudadano → leyenda; secuenciales, nunca solapados).
 * Mismo gating que la celebración de certificado (MC-11): solo el gesto real
 * de «obtener certificado» (visitadas anteriores + exactamente una) cuenta —
 * cargar el journey de otra persona o retirar certificados no anuncia nada.
 * Un evento sale cuando su condición pasa de NO cumplida a cumplida.
 * @param {Journey|undefined} prevJourney Journey anterior al cambio.
 * @param {Journey} nextJourney Journey nuevo.
 * @param {IslandRef[]} islands Islas del índice del archipiélago.
 * @returns {CitizenshipEvent[]}
 */
export function citizenshipCelebrations(prevJourney, nextJourney, islands) {
  const justId = justVisitedCity(prevJourney?.visitedCities, nextJourney?.visitedCities);
  if (justId === null) return [];
  const before = archipelagoProgress(prevJourney, islands);
  const after = archipelagoProgress(nextJourney, islands);
  /** @type {CitizenshipEvent[]} */
  const events = [];
  for (const isle of after.islands) {
    const prev = before.islands.find((i) => i.id === isle.id);
    if (isle.achieved && prev?.achieved !== true) {
      events.push({ kind: 'island', islandId: isle.id, islandName: isle.name });
    }
  }
  if (after.superCitizen && !before.superCitizen) events.push({ kind: 'super' });
  if (after.legend && !before.legend) events.push({ kind: 'legend' });
  return events;
}
