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
 * @property {Recommendation[]} [recommendations] Material recomendado para alcanzarla
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
 * @typedef {Object} Journey    GLOBAL por persona (abarca todo el archipiélago, MC-14)
 * @property {string[]} visitedCities          ids de ciudades visitadas
 * @property {string|null} currentCity         ciudad actual (donde está la persona)
 * @property {string[]} plannedRoute           ids de ciudades en la ruta planificada
 * @property {string} currentIsland            isla actual del archipiélago (default 'island')
 * @property {Record<string, CityEvidence>} evidences  evidencias por ciudad
 */

/** Isla del archipiélago en la que arranca todo journey (el doc actual). */
export const DEFAULT_ISLAND_ID = 'island';

export const EMPTY_JOURNEY = Object.freeze({
  visitedCities: [],
  currentCity: null,
  plannedRoute: [],
  currentIsland: DEFAULT_ISLAND_ID,
  evidences: {},
});

export {};
