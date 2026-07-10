/**
 * Casos de uso LEAN: alta/baja/listado de unidades de flujo (equipos = label del
 * grupo Squad de Linear; gremios = grupo Chapter) y el resumen de flujo separado
 * por tipo. La UI nunca toca el repo directamente.
 *
 * @typedef {import('../domain/ports.js').LeanPersistence} LeanPersistence
 * @typedef {import('../domain/types.js').LeanUnit} LeanUnit
 * @typedef {import('../domain/types.js').LeanUnitKind} LeanUnitKind
 */
import { aggregateFlow } from '../domain/aggregate.js';

const KINDS = new Set(['squad', 'chapter']);

/**
 * Da de alta una unidad de flujo (un label de Linear).
 * @param {LeanPersistence} persistence
 * @param {{ linearLabel: string, kind: LeanUnitKind, name?: string }} input
 * @returns {Promise<string>}
 */
export function addUnit(persistence, input) {
  const linearLabel = String(input.linearLabel ?? '').trim();
  if (!linearLabel) throw new Error('El label de Linear es obligatorio');
  const kind = KINDS.has(input.kind) ? input.kind : 'squad';
  const name = String(input.name ?? '').trim() || linearLabel;
  return persistence.units.add({ linearLabel, kind, name, createdAt: new Date().toISOString() });
}

/** @param {LeanPersistence} persistence */
export function listUnits(persistence) {
  return persistence.units.list();
}

/** @param {LeanPersistence} persistence @param {string} id */
export function removeUnit(persistence, id) {
  return persistence.units.remove(id);
}

/**
 * Resumen de flujo separado por tipo: equipos (squad) y gremios (chapter), cada
 * grupo con sus unidades y su agregado global.
 * @param {LeanPersistence} persistence
 * @returns {Promise<{ squads: { units: LeanUnit[], global: ReturnType<typeof aggregateFlow> }, chapters: { units: LeanUnit[], global: ReturnType<typeof aggregateFlow> } }>}
 */
export async function getFlowSummary(persistence) {
  const all = await persistence.units.list();
  const squads = all.filter((u) => u.kind === 'squad');
  const chapters = all.filter((u) => u.kind === 'chapter');
  return {
    squads: { units: squads, global: aggregateFlow(squads) },
    chapters: { units: chapters, global: aggregateFlow(chapters) },
  };
}
