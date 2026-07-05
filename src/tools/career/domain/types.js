/**
 * Tipos del Mapa de Carrera. El mapa representa UNA isla dividida en comarcas
 * (áreas). Cada ciudad es un hito/skill/tecnología situado en una comarca; las
 * rutas son los prerequisitos entre ciudades. El journey es la ruta personal de
 * una PERSONA del equipo (no del uid del líder), y guarda evidencias por ciudad.
 *
 * @typedef {'skill'|'tech'|'milestone'} CityKind
 *
 * @typedef {'curso'|'formacion'|'doc'|'titulo'} RecommendationKind
 * @typedef {Object} Recommendation
 * @property {RecommendationKind} kind
 * @property {string} label
 * @property {string} [url]
 *
 * Recurso curado de una ciudad (MC-15). Sustituye a las recomendaciones en la
 * pestaña «Recursos» de la tarjeta (las recommendations siguen existiendo por
 * compatibilidad: la UI cae a ellas cuando una ciudad aún no tiene resources).
 * @typedef {'curso'|'post'|'libro'|'doc'} ResourceKind
 * @typedef {'papel'|'online'} ResourceFormat
 * @typedef {Object} Resource
 * @property {ResourceKind} kind
 * @property {string} label
 * @property {string|null} [url]
 * @property {ResourceFormat|null} [format]  Solo para libros (papel u online)
 *
 * @typedef {Object} City
 * @property {string} id
 * @property {string} name
 * @property {CityKind} kind
 * @property {string} area      id de la comarca (Area) a la que pertenece
 * @property {number} x         Posición 0..100 en el mapa
 * @property {number} y         Posición 0..100 en el mapa
 * @property {number} weight    Importancia (puntos al alcanzarla)
 * @property {string[]} prereqs ids de ciudades prerequisito
 * @property {boolean} [deprecated]            Tecnología/skill en desuso: no visitable
 * @property {Recommendation[]} [recommendations] Material recomendado (legado, compat)
 * @property {string[]} [keyPoints]  Puntos fundamentales a aprender (MC-15)
 * @property {string} [aiFocus]      Lente era-IA: qué hace la IA por ti y dónde profundizar tú (MC-15)
 * @property {Resource[]} [resources] Recursos curados de la pestaña «Recursos» (MC-15)
 *
 * @typedef {Object} Area     Comarca de la isla
 * @property {string} id
 * @property {string} name
 *
 * @typedef {Object} CareerMap   Un mapa = una isla
 * @property {string} id
 * @property {string} name
 * @property {Area[]} areas
 * @property {City[]} cities
 * @property {{x: number, y: number}} [startPort]  Puerto neutro de inicio
 *
 * @typedef {Object} IslandRef   Entrada del índice del archipiélago (MC-14)
 * @property {string} id         Id del doc /careerMap/{id}
 * @property {string} name
 * @property {string} [discipline]   Disciplina del ADR (frontend, devops…)
 * @property {number} x          Posición 0..100 en el mapa del mar
 * @property {number} y          Posición 0..100 en el mapa del mar
 * @property {boolean} [startIsland] Isla de inicio (la del doc actual)
 * @property {number} citizenshipPct % de certificados que otorga la CIUDADANÍA de la isla (MC-20)
 * @property {number} citiesTotal    Nº de ciudades NO deprecadas de su doc (lo mantiene el seed; 0 = aún sin sembrar)
 *
 * @typedef {Object} Archipelago  Índice /careerMap/_archipelago
 * @property {IslandRef[]} islands
 *
 * @typedef {Object} CityEvidence
 * @property {number} [priorExperienceYears]
 * @property {string[]} [formaciones]
 * @property {string[]} [cursos]
 * @property {string[]} [titulos]
 *
 * Reto ACTIVO del modo Reto (JG-5): una ruta por las casas de UNA isla en un
 * orden fijo (topológico por prerequisitos). El modo de juego es DERIVADO:
 * con challenge se juega en modo Reto, con null en modo Libre. Es
 * independiente de `plannedRoute` (la ruta personal no se pisa).
 * @typedef {Object} Challenge
 * @property {string} routeId        id de la isla de la ruta (una ruta por isla)
 * @property {string} name           rótulo del reto («Reto: Backend PHP»)
 * @property {string[]} stops        ids de las casas EN ORDEN de visita
 * @property {string|null} startedAt fecha ISO de inicio (null si aún no arrancó)
 *
 * @typedef {Object} Journey    GLOBAL por persona (abarca todo el archipiélago, MC-14)
 * @property {string[]} visitedCities          ids de ciudades visitadas
 * @property {string|null} currentCity         ciudad actual (donde está la persona)
 * @property {string[]} plannedRoute           ids de ciudades en la ruta planificada
 * @property {string} currentIsland            isla actual del archipiélago (default 'island')
 * @property {string[]} visitedIslands         ids de islas PISADAS (incluye la actual, MC-20)
 * @property {Record<string, CityEvidence>} evidences  evidencias por ciudad
 * @property {Challenge|null} challenge        reto activo del modo Reto (JG-5), o null
 */

/** Isla del archipiélago en la que arranca todo journey (el doc actual). */
export const DEFAULT_ISLAND_ID = 'island';

/** Tipos de recurso válidos de una ciudad (MC-15). @type {ReadonlyArray<ResourceKind>} */
export const RESOURCE_KINDS = Object.freeze(['curso', 'post', 'libro', 'doc']);

/** Formatos válidos de un libro (MC-15). @type {ReadonlyArray<ResourceFormat>} */
export const RESOURCE_FORMATS = Object.freeze(['papel', 'online']);

export const EMPTY_JOURNEY = Object.freeze({
  visitedCities: [],
  currentCity: null,
  plannedRoute: [],
  currentIsland: DEFAULT_ISLAND_ID,
  visitedIslands: [DEFAULT_ISLAND_ID],
  evidences: {},
  challenge: null,
});

export {};
