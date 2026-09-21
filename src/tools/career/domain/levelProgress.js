/**
 * Progresión DENTRO del nivel por cumplimiento de expectativas
 * (RMR-PCS-0044 · F1). Dominio PURO: sin Firebase y sin UI.
 *
 * Las reglas, tal cual las fijó Mánu:
 * - Al alcanzar un nivel se está en Lx-1: cumple TODO lo de Lx.
 * - Lx-2 al cumplir el 50 % o más de los puntos del nivel SIGUIENTE.
 * - Lx-3 al cumplir el 80 % o más, de manera SOSTENIDA (dos valoraciones
 *   seguidas); con una sola, se queda en Lx-2 y se dice que está pendiente.
 * - Al 100 % se propone L(x+1)-1 y vuelta a empezar. Se PROPONE: el cambio de
 *   nivel lo firma el manager y queda en `levelHistory`.
 *
 * Dos cosas que NO se negocian aquí:
 * 1. El PESO de cada expectativa lo fija el framework (una skill que vale 2,
 *    vale 2) y la valoración es BINARIA: cumple o no cumple. Lo que se discute
 *    es si está cubierta, nunca cuánto vale.
 * 2. La FORMACIÓN no entra: el mapa de carrera, sus rutas y sus casas
 *    certificadas cuentan otra historia (lo que alguien está aprendiendo) y no
 *    mueven el nivel. Se puede recorrer un camino entero sin cambiar de nivel,
 *    y cumplir las expectativas sin haber certificado una sola casa.
 *
 * @typedef {import('../data/framework.js').CareerFramework} CareerFramework
 *
 * @typedef {Object} MissingExpectation
 * @property {string} id      id de la dimensión
 * @property {string} name    nombre de la dimensión
 * @property {string} text    texto de la expectativa
 * @property {number} weight  peso en el framework
 * @property {boolean} core   imprescindible para subir de nivel
 *
 * @typedef {Object} LevelCompletion
 * @property {number} earned  suma de pesos cumplidos
 * @property {number} total   suma de pesos del nivel
 * @property {number} pct     porcentaje redondeado (solo para mostrar)
 * @property {MissingExpectation[]} missing
 * @property {string[]} coreMissing  ids de dimensión imprescindibles sin cubrir
 */
import { expectationsForLevel, getLevel } from '../data/framework.js';
import { nextLevelFor } from './subLevel.js';

/** Cortes de la progresión, en porcentaje de pesos cumplidos. */
export const PROGRESS_THRESHOLDS = Object.freeze({ consolidating: 50, atTheGates: 80 });

/**
 * Peso de una expectativa: entero de 1 para arriba. El framework de hoy no
 * lleva pesos, así que sin él vale 1 — y un peso inválido también, antes que
 * inventarse una ponderación que nadie ha decidido.
 * @param {{ weight?: unknown }|null|undefined} expectation
 * @returns {number}
 */
export function expectationWeight(expectation) {
  const raw = expectation?.weight;
  return Number.isInteger(raw) && raw >= 1 ? raw : 1;
}

/** ¿Es imprescindible para subir de nivel? */
export function isCoreExpectation(expectation) {
  return expectation?.core === true;
}

/**
 * Cumplimiento ponderado de un nivel. `marks` es la valoración binaria por
 * dimensión: lo que no está marcado como cumplido NO cumple — el nivel
 * siguiente se gana, no se presupone (al revés que `assessmentRows`, que mira
 * el nivel que YA se tiene).
 * @param {CareerFramework|null|undefined} framework
 * @param {string|null|undefined} levelId
 * @param {Record<string, boolean>|null|undefined} marks
 * @returns {LevelCompletion|null}  null si ese nivel no tiene expectativas escritas
 */
export function levelCompletion(framework, levelId, marks) {
  const cells = (framework?.expectations ?? []).filter((e) => e.levelId === levelId && String(e.text ?? '').trim() !== '');
  if (cells.length === 0) return null;
  const names = new Map(expectationsForLevel(framework, levelId).map((r) => [r.dimension.id, r.dimension.name]));
  const done = marks ?? {};
  let earned = 0;
  let total = 0;
  const missing = [];
  for (const cell of cells) {
    const weight = expectationWeight(cell);
    total += weight;
    if (done[cell.dimensionId] === true) earned += weight;
    else {
      missing.push({
        id: cell.dimensionId,
        name: names.get(cell.dimensionId) ?? cell.dimensionId,
        text: String(cell.text).trim(),
        weight,
        core: isCoreExpectation(cell),
      });
    }
  }
  return {
    earned,
    total,
    pct: Math.round((earned * 100) / total),
    missing,
    coreMissing: missing.filter((m) => m.core).map((m) => m.id),
  };
}

/** ¿Hay cumplimiento medible en esta entrada (la actual o una del histórico)? */
function reachable(entry) {
  if (!entry) return false;
  const { earned, total, pct } = entry;
  return (Number.isFinite(earned) && Number.isFinite(total) && total > 0) || Number.isFinite(pct);
}

/**
 * ¿Llega esta entrada al umbral? Se compara con los PESOS, no con el porcentaje
 * redondeado: 99 de 200 es 49,5 % y no alcanza el 50 %, aunque se muestre «50».
 * Una entrada antigua que solo guardó `pct` se compara con lo que tiene.
 */
function reaches(entry, threshold) {
  if (!reachable(entry)) return false;
  const { earned, total, pct } = entry;
  if (Number.isFinite(earned) && Number.isFinite(total) && total > 0) return earned * 100 >= threshold * total;
  return pct >= threshold;
}

/**
 * Sub-nivel a partir del cumplimiento actual y del histórico de valoraciones
 * CERRADAS (la más reciente primero, sin incluir la actual). El 80 % da el .3
 * solo si la valoración anterior también llegaba: una racha de dos, no un buen
 * día. Y no es un trinquete: si el cumplimiento baja, el sub-nivel baja.
 * @param {{ pct: number }|null|undefined} completion
 * @param {ReadonlyArray<{ pct?: number }>|null|undefined} history
 * @returns {{ sub: 1|2|3, sustained: boolean, pendingSub: 3|null }|null}
 */
export function subLevelFromCompletion(completion, history) {
  if (!reachable(completion)) return null;
  if (!reaches(completion, PROGRESS_THRESHOLDS.consolidating)) return { sub: 1, sustained: false, pendingSub: null };
  if (!reaches(completion, PROGRESS_THRESHOLDS.atTheGates)) return { sub: 2, sustained: false, pendingSub: null };
  const sustained = reaches((history ?? []).at(0), PROGRESS_THRESHOLDS.atTheGates);
  return sustained ? { sub: 3, sustained: true, pendingSub: null } : { sub: 2, sustained: false, pendingSub: 3 };
}

/**
 * Etiqueta de la progresión con la notación de Mánu: `L1-2`.
 * @param {string|null|undefined} code @param {1|2|3} sub
 * @returns {string|null}
 */
export function levelProgressLabel(code, sub) {
  const limpio = String(code ?? '').trim();
  return limpio ? `${limpio}-${sub}` : null;
}

/**
 * Todo junto para una persona: su nivel, contra qué nivel se mide, cuánto lleva
 * cumplido, qué le falta y si procede proponer la subida. Devuelve null cuando
 * no hay nada que decir (sin nivel, sin nivel siguiente en su escalera, o el
 * nivel siguiente no tiene expectativas escritas): antes eso que un badge
 * inventado.
 * @param {{ person: { levelId?: string }|null, framework: CareerFramework|null,
 *   marks?: Record<string, boolean>|null, history?: ReadonlyArray<{ pct?: number }>|null }} input
 */
export function levelProgressFor({ person, framework, marks = null, history = null }) {
  const current = getLevel(framework, person?.levelId);
  if (!current) return null;
  const next = nextLevelFor(framework?.levels ?? [], current.id);
  if (!next) return null;
  const completion = levelCompletion(framework, next.id, marks);
  if (!completion) return null;
  const { sub, sustained, pendingSub } = subLevelFromCompletion(completion, history);
  return {
    levelId: current.id,
    levelCode: current.code ?? null,
    nextLevelId: next.id,
    nextLevelCode: next.code ?? null,
    sub,
    label: levelProgressLabel(current.code, sub),
    pct: completion.pct,
    earned: completion.earned,
    total: completion.total,
    missing: completion.missing,
    coreMissing: completion.coreMissing,
    sustained,
    pendingSub,
    // El 100 % propone la subida sin esperar a la segunda valoración: la racha
    // es lo que separa el .2 del .3, no lo que abre la puerta del nivel. Y el
    // 100 % es cumplirlo TODO, no un 99,5 % que se muestra redondeado.
    readyToPromote: completion.earned === completion.total && completion.coreMissing.length === 0,
  };
}
