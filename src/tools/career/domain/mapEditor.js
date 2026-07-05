/**
 * Editor del juego (JG-16): VALIDACIONES puras del contenido del mapa.
 *
 * El superadmin edita casas de las islas y rutas de rol desde /admin/juego;
 * antes de escribir en Firestore, estas funciones (sin Firestore ni DOM)
 * deciden si el contenido es coherente: ids con formato y únicos, prereqs
 * existentes y sin ciclos, comarca existente, paradas de ruta reales y sin
 * duplicados. Devuelven SIEMPRE `{ errors, warnings }`: un error bloquea el
 * guardado, un aviso se muestra pero deja guardar (p. ej. un orden de paradas
 * que viola prereqs es decisión editorial, no corrupción). Puro y testeable
 * en Vitest.
 *
 * @typedef {import('./types.js').CareerMap} CareerMap
 * @typedef {import('./types.js').City} City
 * @typedef {import('./careerRoutes.js').CareerRoute} CareerRoute
 *
 * Resultado de una validación del editor.
 * @typedef {Object} EditorCheck
 * @property {string[]} errors   Problemas que BLOQUEAN el guardado.
 * @property {string[]} warnings Avisos que no bloquean (se muestran).
 */
import { ROUTE_TIER_KEYS } from './careerRoutes.js';

/** Tipos de casa admitidos (los mismos de City.kind). */
export const CITY_KINDS = Object.freeze(['tech', 'skill', 'milestone']);

/** Peso mínimo y máximo de una casa (el contenido real usa 1..3; margen a 5). */
export const CITY_WEIGHT_MIN = 1;
export const CITY_WEIGHT_MAX = 5;

/**
 * Formato de id de casa: uno o dos segmentos slug separados por `/` (el
 * contenido curado MC-16 usa `disciplina/slug`; la isla semilla legada usa
 * slugs sin prefijo, y el editor debe poder tocarla sin declararla corrupta).
 */
const CITY_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?$/;

/** ¿`n` es un número finito dentro de [min, max]? @param {unknown} n @param {number} min @param {number} max */
function inRange(n, min, max) {
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
}

/**
 * ¿Los prereqs de `city` crean un CICLO con el resto de la isla? Se busca si
 * desde algún prereq de la casa se vuelve a alcanzar su id siguiendo las
 * aristas prereq → casa del grafo (isla + casa editada). El contenido previo
 * se asume acíclico (islands.test.js lo garantiza para el curado), así que
 * cualquier ciclo nuevo pasa por la casa editada.
 * @param {City} city
 * @param {ReadonlyArray<City>} others Resto de casas de la isla (sin `city`).
 * @returns {boolean}
 */
function createsCycle(city, others) {
  const prereqsById = new Map(others.map((c) => [c.id, c.prereqs ?? []]));
  prereqsById.set(city.id, city.prereqs ?? []);
  const seen = new Set();
  const pending = [...(city.prereqs ?? [])];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === city.id) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    pending.push(...(prereqsById.get(current) ?? []));
  }
  return false;
}

/** Errores de identidad de la casa (id y nombre). @param {City} city @param {ReadonlyArray<City>} others @returns {string[]} */
function cityIdentityErrors(city, others) {
  const errors = [];
  const id = String(city?.id ?? '').trim();
  if (!id) errors.push('La casa necesita un id.');
  else if (!CITY_ID_PATTERN.test(id)) {
    errors.push(`El id "${id}" no es un slug válido (minúsculas, dígitos y guiones, con "/" opcional).`);
  } else if (others.some((c) => c.id === id)) {
    errors.push(`Ya existe otra casa con el id "${id}" en la isla.`);
  }
  if (!String(city?.name ?? '').trim()) errors.push('La casa necesita un nombre.');
  return errors;
}

/** Errores de los atributos de la casa (tipo, comarca, peso y posición).
 * @param {City} city @param {ReadonlyArray<import('./types.js').Area>} areas @returns {string[]} */
function cityAttributeErrors(city, areas) {
  const errors = [];
  if (!CITY_KINDS.includes(city?.kind)) {
    errors.push(`Tipo de casa desconocido: "${city?.kind}".`);
  }
  const area = String(city?.area ?? '').trim();
  if (!areas.some((a) => a.id === area)) {
    errors.push(`La comarca "${area}" no existe en la isla.`);
  }
  const weight = city?.weight;
  if (!Number.isInteger(weight) || weight < CITY_WEIGHT_MIN || weight > CITY_WEIGHT_MAX) {
    errors.push(`El peso debe ser un entero entre ${CITY_WEIGHT_MIN} y ${CITY_WEIGHT_MAX}.`);
  }
  if (!inRange(city?.x, 0, 100) || !inRange(city?.y, 0, 100)) {
    errors.push('La posición x/y debe estar entre 0 y 100.');
  }
  return errors;
}

/** Longitud mínima orientativa del resumen didáctico de la casa (JG-18). */
export const CITY_SUMMARY_MIN_LENGTH = 80;

/**
 * Revisión del resumen didáctico «¿Qué es?» de la casa (JG-18). El campo es
 * OPCIONAL: sin él la tarjeta pinta su placeholder. Si viene, debe ser un
 * texto; uno demasiado corto solo AVISA (decisión editorial, no corrupción).
 * @param {City} city
 * @returns {EditorCheck}
 */
function citySummaryCheck(city) {
  const summary = city?.summary;
  if (summary === undefined) return { errors: [], warnings: [] };
  if (typeof summary !== 'string') {
    return { errors: ['El resumen «¿Qué es?» debe ser un texto.'], warnings: [] };
  }
  if (summary.trim().length < CITY_SUMMARY_MIN_LENGTH) {
    return {
      errors: [],
      warnings: [
        `El resumen «¿Qué es?» es muy corto (menos de ${CITY_SUMMARY_MIN_LENGTH} caracteres): cuenta qué es y para qué sirve.`,
      ],
    };
  }
  return { errors: [], warnings: [] };
}

/** Errores de los prereqs de la casa (existencia, sin duplicados, sin ciclos).
 * @param {City} city @param {ReadonlyArray<City>} others @returns {string[]} */
function cityPrereqErrors(city, others) {
  const errors = [];
  const prereqs = Array.isArray(city?.prereqs) ? city.prereqs : [];
  const otherIds = new Set(others.map((c) => c.id));
  for (const prereq of prereqs) {
    if (prereq === city?.id) errors.push('Una casa no puede ser prerequisito de sí misma.');
    else if (!otherIds.has(prereq)) errors.push(`El prerequisito "${prereq}" no existe en la isla.`);
  }
  if (new Set(prereqs).size !== prereqs.length) errors.push('Hay prerequisitos duplicados.');
  if (errors.length === 0 && createsCycle(city, others)) {
    errors.push('Los prerequisitos crean un ciclo con otras casas de la isla.');
  }
  return errors;
}

/**
 * Valida una casa contra su isla antes de guardarla. `island` es el mapa de
 * la isla SIN la casa editada en `cities` (al editar, el caller la excluye;
 * al añadir, pasa las casas tal cual): así la unicidad del id y los ciclos se
 * evalúan contra «las demás».
 * @param {City} city Casa candidata (nueva o edición completa).
 * @param {Pick<CareerMap, 'areas'|'cities'>} island Isla destino sin la casa editada.
 * @returns {EditorCheck}
 */
export function validateCity(city, island) {
  const others = island?.cities ?? [];
  const areas = island?.areas ?? [];
  const summaryCheck = citySummaryCheck(city);
  const errors = [
    ...cityIdentityErrors(city, others),
    ...cityAttributeErrors(city, areas),
    ...cityPrereqErrors(city, others),
    ...summaryCheck.errors,
  ];
  return { errors, warnings: summaryCheck.warnings };
}

/**
 * Índice casa → isla del contenido completo cargado: resuelve una parada de
 * ruta a su casa y al id del doc de su isla (ojo: la isla de Bases tiene doc
 * id 'island' pero sus casas llevan prefijo 'bases/'; por eso se indexa por
 * id de casa, no por prefijo).
 * @param {ReadonlyArray<CareerMap>} islands Docs de isla cargados.
 * @returns {Map<string, { city: City, islandId: string }>}
 */
export function buildCityIndex(islands) {
  /** @type {Map<string, { city: City, islandId: string }>} */
  const index = new Map();
  for (const island of islands ?? []) {
    for (const city of island?.cities ?? []) {
      if (!index.has(city.id)) index.set(city.id, { city, islandId: island.id });
    }
  }
  return index;
}

/** Errores de metadatos de la ruta (disciplina, hito, nombre).
 * @param {Partial<CareerRoute>} route @returns {string[]} */
function routeMetaErrors(route) {
  const errors = [];
  if (!String(route?.discipline ?? '').trim()) errors.push('La ruta necesita una disciplina.');
  if (!ROUTE_TIER_KEYS.includes(route?.levelKey)) {
    errors.push(`Hito desconocido: "${route?.levelKey}" (peritus, veteranus o magister).`);
  }
  if (!String(route?.name ?? '').trim()) errors.push('La ruta necesita un nombre.');
  return errors;
}

/**
 * Avisos de ORDEN de la ruta: paradas que se visitan antes que alguno de sus
 * prerequisitos intra-isla cuando ambos son paradas (la convención de rutas
 * pide A antes que B si A es prereq de B). Es un AVISO, no un error: el
 * superadmin puede querer un orden pedagógico distinto.
 * @param {ReadonlyArray<string>} stops
 * @param {Map<string, { city: City, islandId: string }>} cityIndex
 * @returns {string[]}
 */
function routeOrderWarnings(stops, cityIndex) {
  const position = new Map(stops.map((stop, i) => [stop, i]));
  const warnings = [];
  for (const stop of stops) {
    const entry = cityIndex.get(stop);
    for (const prereq of entry?.city?.prereqs ?? []) {
      const prereqAt = position.get(prereq);
      if (prereqAt !== undefined && prereqAt > position.get(stop)) {
        warnings.push(`"${prereq}" es prerequisito de "${stop}" y se visita después.`);
      }
    }
  }
  return warnings;
}

/**
 * Valida una ruta de rol contra el contenido de las islas antes de guardarla.
 * Errores: metadatos incompletos, sin paradas, paradas duplicadas o que no
 * existen en ninguna isla. Avisos: orden que viola prereqs intra-isla.
 * @param {Partial<CareerRoute>} route Ruta candidata (nueva o edición completa).
 * @param {ReadonlyArray<CareerMap>} islandsContent Docs de isla cargados.
 * @returns {EditorCheck}
 */
export function validateRoute(route, islandsContent) {
  const errors = routeMetaErrors(route);
  const stops = Array.isArray(route?.stops) ? route.stops : [];
  if (stops.length === 0) errors.push('La ruta necesita al menos una parada.');
  const seen = new Set();
  for (const stop of stops) {
    if (seen.has(stop)) errors.push(`La parada "${stop}" está duplicada.`);
    seen.add(stop);
  }
  const cityIndex = buildCityIndex(islandsContent);
  for (const stop of seen) {
    if (!cityIndex.has(stop)) errors.push(`La parada "${stop}" no existe en ninguna isla.`);
  }
  return { errors, warnings: routeOrderWarnings(stops, cityIndex) };
}

/**
 * Rutas del catálogo que pasan por una casa: lo que se le enseña al
 * superadmin al confirmar un borrado (las rutas afectadas se quedan con una
 * parada inexistente hasta que las edite). Sobre journeys ajenos no hay
 * consulta posible desde el cliente: el aviso es genérico en la UI.
 * @param {string} cityId
 * @param {ReadonlyArray<CareerRoute>} routes Catálogo cargado (incluidas inactivas).
 * @returns {CareerRoute[]}
 */
export function routesAffectedByCity(cityId, routes) {
  const id = String(cityId ?? '').trim();
  if (!id) return [];
  return (routes ?? []).filter((route) => (route.stops ?? []).includes(id));
}

/**
 * Nº de casas NO deprecadas de una lista: el valor que el índice del
 * archipiélago guarda como `citiesTotal` (MC-20) y que el editor debe
 * mantener al añadir/quitar casas.
 * @param {ReadonlyArray<City>} cities
 * @returns {number}
 */
export function activeCitiesTotal(cities) {
  return (cities ?? []).filter((city) => city.deprecated !== true).length;
}
