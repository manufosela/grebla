/**
 * Tipos del Mapa de Carrera. Una ciudad es un hito/skill/tecnología situado en el
 * mapa; las rutas son los prerequisitos entre ciudades. El journey es la ruta
 * personal de cada ingeniero (por tenant).
 *
 * @typedef {'skill'|'tech'|'milestone'} CityKind
 * @typedef {Object} City
 * @property {string} id
 * @property {string} name
 * @property {CityKind} kind
 * @property {number} x         Posición 0..100 en el mapa
 * @property {number} y         Posición 0..100 en el mapa
 * @property {number} weight    Importancia (puntos al alcanzarla)
 * @property {string[]} prereqs ids de ciudades prerequisito
 *
 * @typedef {Object} CareerMap
 * @property {string} id
 * @property {string} name
 * @property {string} tag       Rol/tecnología (frontend, backend…)
 * @property {City[]} cities
 *
 * @typedef {Object} Journey
 * @property {string|null} mapId
 * @property {string[]} visited
 * @property {string|null} current
 * @property {string|null} target
 */

export const EMPTY_JOURNEY = Object.freeze({ mapId: null, visited: [], current: null, target: null });

export {};
