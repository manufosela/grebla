/**
 * Registro de las RUTAS DE ROL Y NIVEL del Modo Reto (JG-14).
 *
 * Cada rol vive en su propio módulo de esta carpeta (uno por disciplina; la
 * convención completa está en la cabecera de ./backend-php.js) y se registra
 * aquí. El catálogo cubre las 12 disciplinas del archipiélago (JG-15); un rol
 * que se quitara de CAREER_ROUTES dejaría de ofrecer itinerario en el selector.
 *
 * Consumidores:
 *  - scripts/seed-career-routes.mjs: publica /careerRoutes/{routeId} por hito.
 *  - routes.test.js: valida cada rol registrado contra la convención (paradas
 *    existentes en ISLAND_CONTENT, orden por prereqs, tamaños, hitos
 *    crecientes, entrada por Bases).
 *
 * Un hito de un rol (nombre, descripción y paradas en orden).
 * @typedef {Object} RouteTier
 * @property {string} name
 * @property {string} description
 * @property {ReadonlyArray<string>} stops
 *
 * El itinerario completo de un rol: sus tres hitos.
 * @typedef {Object} RouteTiers
 * @property {string} discipline
 * @property {string} roleName
 * @property {Partial<Record<'peritus'|'veteranus'|'magister', RouteTier>>} tiers
 */
import { ROUTE_TIERS as FRONTEND_ROUTE } from './frontend.js';
import { ROUTE_TIERS as BACKEND_PHP_ROUTE } from './backend-php.js';
import { ROUTE_TIERS as BACKEND_PYTHON_ROUTE } from './backend-python.js';
import { ROUTE_TIERS as POSTGRES_ROUTE } from './postgres.js';
import { ROUTE_TIERS as ANDROID_ROUTE } from './android.js';
import { ROUTE_TIERS as IOS_ROUTE } from './ios.js';
import { ROUTE_TIERS as DEVOPS_ROUTE } from './devops.js';
import { ROUTE_TIERS as AI_ENGINEER_ROUTE } from './ai-engineer.js';
import { ROUTE_TIERS as ENGINEERING_MANAGER_ROUTE } from './engineering-manager.js';
import { ROUTE_TIERS as SOFTWARE_ARCHITECT_ROUTE } from './software-architect.js';
import { ROUTE_TIERS as PRODUCT_MANAGER_ROUTE } from './product-manager.js';
import { ROUTE_TIERS as FDE_ROUTE } from './fde.js';
import { ROUTE_TIER_KEYS, routeDocId } from '../../domain/careerRoutes.js';

/**
 * Itinerarios por rol, indexados por disciplina (la misma del índice del
 * archipiélago), en el orden del archipiélago. Backend PHP fue el rol ejemplo
 * del ADR (JG-14); el resto del catálogo se diseña en JG-15.
 * @type {Readonly<Record<string, RouteTiers>>}
 */
export const CAREER_ROUTES = Object.freeze({
  [FRONTEND_ROUTE.discipline]: FRONTEND_ROUTE,
  [BACKEND_PHP_ROUTE.discipline]: BACKEND_PHP_ROUTE,
  [BACKEND_PYTHON_ROUTE.discipline]: BACKEND_PYTHON_ROUTE,
  [POSTGRES_ROUTE.discipline]: POSTGRES_ROUTE,
  [ANDROID_ROUTE.discipline]: ANDROID_ROUTE,
  [IOS_ROUTE.discipline]: IOS_ROUTE,
  [DEVOPS_ROUTE.discipline]: DEVOPS_ROUTE,
  [AI_ENGINEER_ROUTE.discipline]: AI_ENGINEER_ROUTE,
  [ENGINEERING_MANAGER_ROUTE.discipline]: ENGINEERING_MANAGER_ROUTE,
  [SOFTWARE_ARCHITECT_ROUTE.discipline]: SOFTWARE_ARCHITECT_ROUTE,
  [PRODUCT_MANAGER_ROUTE.discipline]: PRODUCT_MANAGER_ROUTE,
  [FDE_ROUTE.discipline]: FDE_ROUTE,
});

/**
 * Aplana el registro a documentos /careerRoutes listos para sembrar: uno por
 * hito, con el id `{disciplina}--{hito}` y los campos del ADR (discipline,
 * levelKey, name, description, stops, active). El seed añade updatedAt.
 * @returns {{ routeId: string, data: { discipline: string, levelKey: string,
 *   name: string, description: string, stops: string[], active: boolean } }[]}
 */
export function routeDocs() {
  return Object.values(CAREER_ROUTES).flatMap((role) =>
    ROUTE_TIER_KEYS.filter((key) => role.tiers[key]).map((key) => {
      const tier = /** @type {RouteTier} */ (role.tiers[key]);
      return {
        routeId: routeDocId(role.discipline, key),
        data: {
          discipline: role.discipline,
          levelKey: key,
          name: tier.name,
          description: tier.description,
          stops: [...tier.stops],
          active: true,
        },
      };
    }),
  );
}
