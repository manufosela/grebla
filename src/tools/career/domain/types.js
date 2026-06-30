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
 * @typedef {Object} CityEvidence
 * @property {number} [priorExperienceYears]
 * @property {string[]} [formaciones]
 * @property {string[]} [cursos]
 * @property {string[]} [titulos]
 *
 * @typedef {Object} Journey
 * @property {string[]} visitedCities          ids de ciudades visitadas
 * @property {string|null} currentCity         ciudad actual (donde está la persona)
 * @property {string[]} plannedRoute           ids de ciudades en la ruta planificada
 * @property {Record<string, CityEvidence>} evidences  evidencias por ciudad
 */

export const EMPTY_JOURNEY = Object.freeze({
  visitedCities: [],
  currentCity: null,
  plannedRoute: [],
  evidences: {},
});

export {};
