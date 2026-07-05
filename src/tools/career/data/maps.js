/**
 * Mapa de carrera de MUESTRA (en código): UNA isla dividida en comarcas (áreas).
 * Cada ciudad pertenece a una comarca. Se parte de un puerto neutro (`startPort`).
 * En MC-2 los mapas serán por tenant y podrán importarse de roadmap.sh.
 * Coordenadas x/y en 0..100.
 *
 * @typedef {import('../domain/types.js').CareerMap} CareerMap
 * @typedef {import('../domain/types.js').Area} Area
 */
import { RESOURCE_KINDS, RESOURCE_FORMATS } from '../domain/types.js';

/** Comarcas de la isla. Fundamentos es la comarca de entrada. */
/** @type {ReadonlyArray<Area>} */
export const ISLAND_AREAS = [
  { id: 'fundamentos', name: 'Fundamentos' },
  { id: 'frontend', name: 'Frontend' },
  { id: 'backend', name: 'Backend' },
  { id: 'data', name: 'Data' },
];

/**
 * La isla GREBLA. Todas las rutas parten de la comarca Fundamentos.
 * @type {CareerMap}
 */
export const ISLAND = {
  id: 'island',
  name: 'Isla GREBLA',
  startPort: { x: 4, y: 50 },
  areas: ISLAND_AREAS,
  cities: [
    // — Fundamentos (comarca de entrada) —
    { id: 'git', name: 'Git', kind: 'skill', area: 'fundamentos', x: 12, y: 50, weight: 1, prereqs: [] },
    { id: 'html', name: 'HTML', kind: 'tech', area: 'fundamentos', x: 12, y: 22, weight: 1, prereqs: [] },
    { id: 'css', name: 'CSS', kind: 'tech', area: 'fundamentos', x: 20, y: 34, weight: 1, prereqs: [] },
    {
      id: 'js',
      name: 'JavaScript',
      kind: 'tech',
      area: 'fundamentos',
      x: 28,
      y: 50,
      weight: 2,
      prereqs: ['html', 'css'],
      recommendations: [
        { kind: 'curso', label: 'JavaScript moderno (ES2025)' },
        { kind: 'doc', label: 'MDN — JavaScript', url: 'https://developer.mozilla.org/es/docs/Web/JavaScript' },
      ],
    },
    { id: 'testing', name: 'Testing', kind: 'skill', area: 'fundamentos', x: 24, y: 72, weight: 2, prereqs: ['js'] },

    // — Frontend —
    { id: 'ts', name: 'TypeScript', kind: 'tech', area: 'frontend', x: 50, y: 14, weight: 2, prereqs: ['js'] },
    { id: 'react', name: 'Componentes/React', kind: 'tech', area: 'frontend', x: 55, y: 30, weight: 3, prereqs: ['js'] },
    { id: 'a11y', name: 'Accesibilidad', kind: 'skill', area: 'frontend', x: 72, y: 16, weight: 2, prereqs: ['react'] },
    { id: 'perf', name: 'Rendimiento', kind: 'skill', area: 'frontend', x: 78, y: 36, weight: 3, prereqs: ['react', 'testing'] },
    { id: 'jquery', name: 'jQuery', kind: 'tech', area: 'frontend', x: 46, y: 42, weight: 1, prereqs: ['js'], deprecated: true },
    { id: 'arch-fe', name: 'Arquitectura FE', kind: 'milestone', area: 'frontend', x: 92, y: 24, weight: 4, prereqs: ['a11y', 'perf', 'ts'] },

    // — Backend —
    { id: 'lang', name: 'Lenguaje servidor', kind: 'tech', area: 'backend', x: 44, y: 66, weight: 1, prereqs: ['git'] },
    { id: 'api', name: 'APIs / REST', kind: 'tech', area: 'backend', x: 56, y: 60, weight: 2, prereqs: ['lang'] },
    { id: 'db', name: 'Bases de datos', kind: 'tech', area: 'backend', x: 56, y: 82, weight: 2, prereqs: ['lang'] },
    { id: 'auth', name: 'Auth & Seguridad', kind: 'skill', area: 'backend', x: 72, y: 64, weight: 3, prereqs: ['api'] },
    { id: 'docker', name: 'Contenedores', kind: 'tech', area: 'backend', x: 66, y: 90, weight: 2, prereqs: ['lang'] },
    { id: 'ci', name: 'CI/CD', kind: 'skill', area: 'backend', x: 84, y: 80, weight: 3, prereqs: ['testing', 'docker'] },
    { id: 'arch-be', name: 'Arquitectura BE', kind: 'milestone', area: 'backend', x: 94, y: 70, weight: 4, prereqs: ['auth', 'ci'] },

    // — Data —
    { id: 'sql', name: 'SQL', kind: 'tech', area: 'data', x: 50, y: 50, weight: 2, prereqs: ['db'] },
    { id: 'python', name: 'Python', kind: 'tech', area: 'data', x: 62, y: 46, weight: 2, prereqs: ['lang'] },
    { id: 'analytics', name: 'Analítica', kind: 'skill', area: 'data', x: 76, y: 50, weight: 3, prereqs: ['sql', 'python'] },
    { id: 'ml', name: 'Machine Learning', kind: 'milestone', area: 'data', x: 88, y: 52, weight: 4, prereqs: ['analytics'] },
  ],
};

/**
 * Compatibilidad: el resto del tool sigue trabajando con una lista de mapas.
 * Hoy la lista contiene una única isla.
 * @type {ReadonlyArray<CareerMap>}
 */
export const SAMPLE_MAPS = [ISLAND];

// ── Persistencia del mapa (MC-3, multi-isla en MC-14) ───────────────────────
// Cada isla se guarda en Firestore (/careerMap/{islandId}). Estas funciones
// PURAS (sin Firebase) normalizan el documento leído y lo serializan para
// escribir; así pueden testearse sin depender de Firestore. La IO vive en
// src/lib/careerMap.js.

/**
 * Semilla/fallback del mapa: copia profunda de la isla en código. Se usa cuando
 * todavía no existe el documento /careerMap/island en Firestore.
 * @returns {CareerMap}
 */
export function seedCareerMap() {
  return structuredClone(ISLAND);
}

/**
 * Isla-PLACEHOLDER para una isla del archipiélago que aún no tiene documento
 * (MC-14): sin comarcas ni ciudades, solo el puerto de inicio. La generación
 * 3D ya tolera mapas vacíos (radio mínimo de isla, progreso 0), así que esta
 * isla se ve como playa + puerto con el cartel «En construcción» hasta que
 * llegue su contenido (MC-16).
 * @param {string} islandId
 * @param {string} [name] Nombre del índice del archipiélago (por defecto el id).
 * @returns {CareerMap}
 */
export function emptyCareerMap(islandId, name = '') {
  const id = String(islandId ?? '').trim();
  if (!id) throw new Error('emptyCareerMap requiere el id de la isla.');
  return {
    id,
    name: String(name ?? '').trim() || id,
    areas: [],
    cities: [],
    startPort: { ...ISLAND.startPort },
  };
}

/** @param {unknown} value @param {number} fallback @returns {number} */
function toFiniteNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Normaliza una comarca cruda del documento.
 * @param {{ id?: unknown, name?: unknown }} area
 * @returns {import('../domain/types.js').Area}
 */
function normalizeArea(area) {
  const id = String(area?.id ?? '').trim();
  const name = String(area?.name ?? id).trim();
  return { id, name: name || id };
}

/**
 * Normaliza una recomendación cruda del documento (descarta las vacías el caller).
 * @param {{ kind?: unknown, label?: unknown, url?: unknown }} rec
 * @returns {import('../domain/types.js').Recommendation}
 */
function normalizeRecommendation(rec) {
  /** @type {import('../domain/types.js').Recommendation} */
  const out = { kind: /** @type {any} */ (String(rec?.kind ?? 'doc')), label: String(rec?.label ?? '').trim() };
  const url = String(rec?.url ?? '').trim();
  if (url) out.url = url;
  return out;
}

/**
 * Normaliza un recurso crudo de la ciudad (MC-15). Devuelve null si no es
 * salvable: sin label o con un kind fuera del catálogo (nada de fallbacks
 * silenciosos a otro kind — un recurso mal tecleado se descarta entero).
 * El formato (papel/online) solo tiene sentido en libros; en el resto se tira.
 * @param {{ kind?: unknown, label?: unknown, url?: unknown, format?: unknown }} res
 * @returns {import('../domain/types.js').Resource|null}
 */
function normalizeResource(res) {
  const kind = String(res?.kind ?? '').trim();
  const label = String(res?.label ?? '').trim();
  if (!label || !RESOURCE_KINDS.includes(/** @type {any} */ (kind))) return null;
  /** @type {import('../domain/types.js').Resource} */
  const out = { kind: /** @type {any} */ (kind), label };
  const url = String(res?.url ?? '').trim();
  if (url) out.url = url;
  const format = String(res?.format ?? '').trim();
  if (kind === 'libro' && RESOURCE_FORMATS.includes(/** @type {any} */ (format))) {
    out.format = /** @type {any} */ (format);
  }
  return out;
}

/**
 * Sanea la lista de puntos fundamentales (MC-15): strings recortados, sin vacíos.
 * @param {unknown} value
 * @returns {string[]}
 */
function normalizeKeyPoints(value) {
  return Array.isArray(value) ? value.map((p) => String(p ?? '').trim()).filter(Boolean) : [];
}

/**
 * Normaliza una ciudad cruda del documento al modelo City.
 * @param {Record<string, unknown>} city
 * @returns {import('../domain/types.js').City}
 */
function normalizeCity(city) {
  /** @type {import('../domain/types.js').City} */
  const out = {
    id: String(city?.id ?? '').trim(),
    name: String(city?.name ?? '').trim(),
    kind: /** @type {any} */ (['skill', 'tech', 'milestone'].includes(/** @type {any} */ (city?.kind)) ? city.kind : 'tech'),
    area: String(city?.area ?? '').trim(),
    x: toFiniteNumber(city?.x, 0),
    y: toFiniteNumber(city?.y, 0),
    weight: toFiniteNumber(city?.weight, 1),
    prereqs: Array.isArray(city?.prereqs) ? city.prereqs.map((p) => String(p)).filter(Boolean) : [],
  };
  if (city?.deprecated === true) out.deprecated = true;
  const recs = Array.isArray(city?.recommendations)
    ? city.recommendations.map(normalizeRecommendation).filter((r) => r.label)
    : [];
  if (recs.length) out.recommendations = recs;
  // Contenido de la tarjeta (MC-15): keyPoints, aiFocus y resources. Los campos
  // vacíos NO viajan en el objeto (mismo criterio que recommendations).
  const summary = typeof city?.summary === 'string' ? city.summary.trim() : '';
  if (summary) out.summary = summary;
  const keyPoints = normalizeKeyPoints(city?.keyPoints);
  if (keyPoints.length) out.keyPoints = keyPoints;
  const aiFocus = String(city?.aiFocus ?? '').trim();
  if (aiFocus) out.aiFocus = aiFocus;
  const resources = Array.isArray(city?.resources)
    ? city.resources.map(normalizeResource).filter((r) => r !== null)
    : [];
  if (resources.length) out.resources = resources;
  return out;
}

/**
 * Reconstruye un CareerMap completo a partir del documento de Firestore. Si no
 * hay datos (documento inexistente): la isla de inicio ('island') cae a la
 * semilla en código; cualquier otra isla del archipiélago (MC-14) cae a su
 * isla-placeholder vacía («En construcción»).
 * @param {Record<string, unknown>|null|undefined} data  data() del documento /careerMap/{islandId}
 * @param {string} [islandId] Id de la isla (por defecto la de inicio, 'island').
 * @returns {CareerMap}
 */
export function normalizeCareerMap(data, islandId = 'island') {
  if (!data) return islandId === 'island' ? seedCareerMap() : emptyCareerMap(islandId);
  const name = String(data.name ?? '').trim();
  const startPort =
    data.startPort && typeof data.startPort === 'object'
      ? { x: toFiniteNumber(/** @type {any} */ (data.startPort).x, ISLAND.startPort.x), y: toFiniteNumber(/** @type {any} */ (data.startPort).y, ISLAND.startPort.y) }
      : { ...ISLAND.startPort };
  return {
    id: islandId,
    name: name || (islandId === 'island' ? ISLAND.name : islandId),
    areas: Array.isArray(data.areas) ? data.areas.map(normalizeArea).filter((a) => a.id) : [],
    cities: Array.isArray(data.cities) ? data.cities.map(normalizeCity).filter((c) => c.id) : [],
    startPort,
  };
}

/**
 * Serializa un CareerMap a un objeto plano apto para Firestore (sin `undefined`,
 * que Firestore rechaza). Solo persiste areas/cities/startPort/name.
 * @param {CareerMap} map
 * @returns {{ name: string, areas: import('../domain/types.js').Area[], cities: object[], startPort: {x:number,y:number} }}
 */
export function serializeCareerMap(map) {
  const cities = (map?.cities ?? []).map((c) => {
    /** @type {Record<string, unknown>} */
    const city = {
      id: String(c.id ?? '').trim(),
      name: String(c.name ?? '').trim(),
      kind: c.kind,
      area: String(c.area ?? '').trim(),
      x: toFiniteNumber(c.x, 0),
      y: toFiniteNumber(c.y, 0),
      weight: toFiniteNumber(c.weight, 1),
      prereqs: Array.isArray(c.prereqs) ? c.prereqs.map((p) => String(p)).filter(Boolean) : [],
    };
    if (c.deprecated) city.deprecated = true;
    const recs = (c.recommendations ?? [])
      .filter((r) => r && String(r.label ?? '').trim())
      .map((r) => {
        /** @type {Record<string, unknown>} */
        const rec = { kind: r.kind, label: String(r.label).trim() };
        const url = String(r.url ?? '').trim();
        if (url) rec.url = url;
        return rec;
      });
    if (recs.length) city.recommendations = recs;
    // Contenido de la tarjeta (MC-15): mismo saneo que la lectura (normalize*),
    // así lo que se escribe en Firestore ya va limpio y sin `undefined`.
    const summary = typeof c.summary === 'string' ? c.summary.trim() : '';
    if (summary) city.summary = summary;
    const keyPoints = normalizeKeyPoints(c.keyPoints);
    if (keyPoints.length) city.keyPoints = keyPoints;
    const aiFocus = String(c.aiFocus ?? '').trim();
    if (aiFocus) city.aiFocus = aiFocus;
    const resources = (c.resources ?? []).map(normalizeResource).filter((r) => r !== null);
    if (resources.length) city.resources = resources;
    return city;
  });
  return {
    // Sin nombre: cae al id de la isla (multi-isla, MC-14) y, en último
    // término, al nombre de la isla semilla.
    name: String(map?.name ?? '').trim() || String(map?.id ?? '').trim() || ISLAND.name,
    areas: (map?.areas ?? []).map((a) => ({ id: String(a.id ?? '').trim(), name: String(a.name ?? '').trim() || String(a.id ?? '').trim() })).filter((a) => a.id),
    cities,
    startPort: map?.startPort
      ? { x: toFiniteNumber(map.startPort.x, ISLAND.startPort.x), y: toFiniteNumber(map.startPort.y, ISLAND.startPort.y) }
      : { ...ISLAND.startPort },
  };
}
