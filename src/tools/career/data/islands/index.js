/**
 * Registro del CONTENIDO curado de las islas del archipiélago (MC-16).
 *
 * Cada isla con contenido vive en su propio módulo de esta carpeta (uno por
 * disciplina; la convención completa está en la cabecera de ./bases.js) y se
 * registra aquí. Las islas que aún no aparecen en ISLAND_CONTENT se ven en el
 * juego como isla-placeholder «En construcción» (MC-14).
 *
 * Consumidores:
 *  - scripts/seed-islands.mjs: siembra /careerMap/{islandId} isla a isla.
 *  - islands.test.js: valida TODA isla registrada contra la convención
 *    (ids únicos con prefijo, prereqs internos, posiciones, contenido).
 *
 * @typedef {import('../../domain/types.js').CareerMap} CareerMap
 */
import { BASES_ISLAND } from './bases.js';
import { FRONTEND_ISLAND } from './frontend.js';
import { BACKEND_PHP_ISLAND } from './backend-php.js';
import { BACKEND_PYTHON_ISLAND } from './backend-python.js';
import { POSTGRES_ISLAND } from './postgres.js';
import { ANDROID_ISLAND } from './android.js';
import { IOS_ISLAND } from './ios.js';
import { DEVOPS_ISLAND } from './devops.js';
import { AI_ENGINEER_ISLAND } from './ai-engineer.js';
import { ENGINEERING_MANAGER_ISLAND } from './engineering-manager.js';
import { SOFTWARE_ARCHITECT_ISLAND } from './software-architect.js';
import { PRODUCT_MANAGER_ISLAND } from './product-manager.js';
import { FDE_ISLAND } from './fde.js';

/**
 * Contenido por isla, indexado por el id del doc /careerMap/{islandId}
 * (el mismo id que usa el índice del archipiélago). Las 13 islas del ADR:
 * la de inicio «Bases de software» (id 'island', disciplina 'bases') + las
 * 12 disciplinas.
 * @type {Readonly<Record<string, CareerMap>>}
 */
export const ISLAND_CONTENT = Object.freeze({
  [BASES_ISLAND.id]: BASES_ISLAND,
  [FRONTEND_ISLAND.id]: FRONTEND_ISLAND,
  [BACKEND_PHP_ISLAND.id]: BACKEND_PHP_ISLAND,
  [BACKEND_PYTHON_ISLAND.id]: BACKEND_PYTHON_ISLAND,
  [POSTGRES_ISLAND.id]: POSTGRES_ISLAND,
  [ANDROID_ISLAND.id]: ANDROID_ISLAND,
  [IOS_ISLAND.id]: IOS_ISLAND,
  [DEVOPS_ISLAND.id]: DEVOPS_ISLAND,
  [AI_ENGINEER_ISLAND.id]: AI_ENGINEER_ISLAND,
  [ENGINEERING_MANAGER_ISLAND.id]: ENGINEERING_MANAGER_ISLAND,
  [SOFTWARE_ARCHITECT_ISLAND.id]: SOFTWARE_ARCHITECT_ISLAND,
  [PRODUCT_MANAGER_ISLAND.id]: PRODUCT_MANAGER_ISLAND,
  [FDE_ISLAND.id]: FDE_ISLAND,
});
