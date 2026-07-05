/**
 * Catálogo de RUTAS DE ROL Y NIVEL del Modo Reto (JG-14): lógica PURA.
 *
 * Una ruta deja de ser «recórrete la isla» (JG-5) y pasa a ser el ITINERARIO
 * de un ROL a un HITO de la escala GREBLA — multi-isla, siempre entrando por
 * Bases — persistido como doc /careerRoutes/{disciplina}--{hito} y editable
 * por el superadmin (ADR JG-14). Aquí vive lo calculable sin Firestore ni
 * DOM: el saneo del doc leído, la agrupación por rol para el selector, el
 * mapeo nivel → hito de la sugerencia y la resolución parada → isla (los
 * stops son multi-isla). Puro y testeable en Vitest.
 *
 * @typedef {import('./types.js').IslandRef} IslandRef
 * @typedef {import('./types.js').Journey} Journey
 *
 * Ruta persistida ya saneada (doc /careerRoutes/{routeId}).
 * @typedef {Object} CareerRoute
 * @property {string} routeId      id del doc ({disciplina}--{hito})
 * @property {string} discipline   disciplina del rol (la de su isla)
 * @property {string} levelKey     hito de la escala: peritus|veteranus|magister
 * @property {string} name         rótulo («Backend PHP · Veteranus»)
 * @property {string} description  qué cubre el itinerario
 * @property {string[]} stops      ids de casas EN ORDEN de visita (multi-isla)
 * @property {boolean} active      false = retirada del catálogo (no se lista)
 *
 * Grupo del selector: un rol con sus hitos disponibles.
 * @typedef {Object} RoleRouteGroup
 * @property {string} discipline
 * @property {string} roleName
 * @property {Partial<Record<'peritus'|'veteranus'|'magister', CareerRoute>>} tiers
 */

/**
 * Los TRES HITOS de ruta por rol, en orden ascendente de la escala GREBLA
 * (ADR JG-14: Peritus ejecuta con autonomía, Veteranus decide y anticipa,
 * Magister transforma).
 * @type {ReadonlyArray<'peritus'|'veteranus'|'magister'>}
 */
export const ROUTE_TIER_KEYS = Object.freeze(['peritus', 'veteranus', 'magister']);

/**
 * Id del doc /careerRoutes de un hito: `{disciplina}--{hito}`. Firestore
 * prohíbe `/` en ids de documento, así que una disciplina con barra falla en
 * alto (es un error del contenido, no algo que sanear en silencio).
 * @param {string} discipline
 * @param {string} levelKey
 * @returns {string}
 */
export function routeDocId(discipline, levelKey) {
  const d = String(discipline ?? '').trim();
  const k = String(levelKey ?? '').trim();
  if (!d || !k || d.includes('/') || k.includes('/')) {
    throw new Error(`Id de ruta inválido: disciplina "${discipline}" + hito "${levelKey}".`);
  }
  return `${d}--${k}`;
}

/**
 * Hito según la POSICIÓN RELATIVA de un nivel dentro de su propio marco:
 * el tramo bajo (≤40% del orden máximo) apunta al primer hito, el medio
 * (≤80%) al segundo y la cima al tercero. Con los niveles L del career
 * framework (l1..l5) queda l1-l2 → peritus, l3-l4 → veteranus, l5 → magister.
 * @param {number} order
 * @param {number} maxOrder
 * @returns {'peritus'|'veteranus'|'magister'|null}
 */
export function tierKeyForRelativeOrder(order, maxOrder) {
  if (!Number.isFinite(order) || !Number.isFinite(maxOrder) || maxOrder < 1 || order < 1) return null;
  const ratio = order / maxOrder;
  if (ratio <= 0.4) return 'peritus';
  return ratio <= 0.8 ? 'veteranus' : 'magister';
}

/**
 * Hito sugerido a partir del `careerTargetLevelId` declarado por la persona.
 * El objetivo se resuelve ÚNICAMENTE contra los niveles del career framework
 * (`/careerFramework/engineering`: ids tipo 'l4', 'l3tl'…, cada uno con su
 * `order`), que es lo ÚNICO a lo que apunta careerTargetLevelId: el hito sale
 * de la posición relativa del nivel en su marco (tierKeyForRelativeOrder).
 * La escala de 7 niveles de las lecturas subjetivas (Tiro→Magister) NO pinta
 * nada aquí: es una taxonomía del tool Equipo, no del career path. Un id que
 * no casa con el marco no sugiere — la insignia es una pista, no un dato.
 * @param {string|number|null|undefined} targetLevelId
 * @param {ReadonlyArray<{id: string, order: number}>} [frameworkLevels] Niveles del career framework.
 * @returns {'peritus'|'veteranus'|'magister'|null}
 */
export function suggestedTierKey(targetLevelId, frameworkLevels = []) {
  if (targetLevelId === null || targetLevelId === undefined) return null;
  const raw = String(targetLevelId).trim().toLowerCase();
  if (!raw) return null;
  const fw = (frameworkLevels ?? []).filter((l) => l && typeof l.id === 'string');
  const byFramework = fw.find((l) => l.id.toLowerCase() === raw);
  if (!byFramework) return null;
  const maxOrder = Math.max(...fw.map((l) => Number(l.order) || 0));
  return tierKeyForRelativeOrder(Number(byFramework.order), maxOrder);
}

/**
 * Sanea un doc /careerRoutes/{routeId} al modelo actual, o null si no es una
 * ruta usable: routeId, disciplina, un hito válido y al menos una parada son
 * obligatorios; las paradas se limpian como en normalizeChallenge (strings no
 * vacíos, sin duplicados, orden preservado). El nombre cae al routeId si
 * falta — la identidad de la ruta son sus paradas, no su rótulo.
 * @param {unknown} raw data() del documento
 * @param {string} routeId id del doc
 * @returns {CareerRoute|null}
 */
export function normalizeCareerRoute(raw, routeId) {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const value = /** @type {Record<string, unknown>} */ (raw);
  const id = String(routeId ?? '').trim();
  const discipline = typeof value.discipline === 'string' ? value.discipline.trim() : '';
  const levelKey = typeof value.levelKey === 'string' ? value.levelKey.trim() : '';
  const stops = [
    ...new Set(
      (Array.isArray(value.stops) ? value.stops : [])
        .map((s) => (typeof s === 'string' ? s.trim() : ''))
        .filter(Boolean),
    ),
  ];
  if (!id || !discipline || !ROUTE_TIER_KEYS.includes(levelKey) || stops.length === 0) return null;
  const name = typeof value.name === 'string' && value.name.trim() ? value.name.trim() : id;
  return {
    routeId: id,
    discipline,
    levelKey: /** @type {'peritus'|'veteranus'|'magister'} */ (levelKey),
    name,
    description: typeof value.description === 'string' ? value.description.trim() : '',
    stops,
    active: value.active !== false,
  };
}

/** Rótulo del ROL de una ruta: lo que precede al « · {hito}» de su nombre
 * (o la disciplina si el nombre no sigue el patrón). @param {CareerRoute} route */
function roleNameOf(route) {
  const head = route.name.split(' · ').at(0)?.trim();
  return head || route.discipline;
}

/**
 * Agrupa el catálogo por ROL para el selector del Modo Reto: un grupo por
 * disciplina con sus hitos disponibles (solo rutas activas), ordenado por
 * nombre de rol. Dentro del grupo los hitos se recorren con ROUTE_TIER_KEYS
 * (orden ascendente de la escala).
 * @param {ReadonlyArray<CareerRoute>} routes
 * @returns {RoleRouteGroup[]}
 */
export function groupRoutesByRole(routes) {
  /** @type {Map<string, RoleRouteGroup>} */
  const groups = new Map();
  for (const route of routes ?? []) {
    if (!route.active) continue;
    const group = groups.get(route.discipline) ?? {
      discipline: route.discipline,
      roleName: roleNameOf(route),
      tiers: {},
    };
    group.tiers[route.levelKey] = route;
    groups.set(route.discipline, group);
  }
  return [...groups.values()].toSorted((a, b) => a.roleName.localeCompare(b.roleName, 'es'));
}

/**
 * Isla a la que pertenece una parada: los ids de casa van prefijados por la
 * DISCIPLINA de su isla ('bases/git', 'backend-php/php-8'…) y el índice del
 * archipiélago resuelve disciplina → isla (ojo: la isla de Bases tiene doc id
 * 'island' pero disciplina 'bases'). Parada sin prefijo conocido → null.
 * @param {string|null|undefined} cityId
 * @param {ReadonlyArray<IslandRef>} islands Índice del archipiélago.
 * @returns {string|null} id de la isla, o null.
 */
export function islandOfStop(cityId, islands) {
  const prefix = String(cityId ?? '').split('/').at(0) ?? '';
  if (!prefix) return null;
  return (islands ?? []).find((i) => i.discipline === prefix)?.id ?? null;
}

/**
 * Disciplina del JUGADOR para la insignia «Sugerida para ti», INFERIDA del
 * juego (no hay un campo de disciplina en la persona) y acotada a las
 * disciplinas que tienen ruta en el catálogo. Cadena de señales, de más a
 * menos fiable:
 *  1. el reto ACTIVO (su routeId lleva la disciplina delante del `--`);
 *  2. la isla ACTUAL del journey;
 *  3. la disciplina con MÁS certificados (prefijo de visitedCities; empate →
 *     orden alfabético, determinista).
 * Sin señal → null (no se destaca nada). Es una pista de UI, no un dato
 * crítico: la degradación está documentada aquí.
 * @param {Journey|null|undefined} journey
 * @param {ReadonlyArray<IslandRef>} islands Índice del archipiélago.
 * @param {ReadonlySet<string>} routeDisciplines Disciplinas con ruta en el catálogo.
 * @returns {string|null}
 */
export function playerRouteDiscipline(journey, islands, routeDisciplines) {
  const fromChallenge = String(journey?.challenge?.routeId ?? '').split('--').at(0) ?? '';
  if (routeDisciplines.has(fromChallenge)) return fromChallenge;
  const currentDiscipline =
    (islands ?? []).find((i) => i.id === journey?.currentIsland)?.discipline ?? '';
  if (routeDisciplines.has(currentDiscipline)) return currentDiscipline;
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const cityId of journey?.visitedCities ?? []) {
    const prefix = cityId.split('/').at(0) ?? '';
    if (routeDisciplines.has(prefix)) counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
  }
  const best = [...counts.entries()].toSorted(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'),
  ).at(0);
  return best ? best[0] : null;
}
