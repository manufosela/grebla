/**
 * Camino de niveles de una persona: las pestañas de «Expectativas» (RMR-TSK-0702).
 * Dominio PURO.
 *
 * Se ve SU camino, no la escalera entera: un IC, todos los niveles IC; un Tech
 * Lead o un EM, los niveles del track del que ramifica su rama hasta antes del
 * punto de ramificación, y después los de su propio track. Cada paso dice si
 * está por debajo del nivel actual (se da por superado), es el actual o está
 * por encima (se gana marcando lo que se cumple).
 *
 * @typedef {'below'|'current'|'above'} StepState
 * @typedef {{ level: import('../data/framework.js').Level, state: StepState }} PathStep
 */

const byOrder = (a, b) => a.order - b.order;

/**
 * @param {import('../data/framework.js').CareerFramework|null|undefined} framework
 * @param {string|null|undefined} levelId
 * @returns {PathStep[]}
 */
export function levelPath(framework, levelId) {
  const levels = framework?.levels ?? [];
  const current = levels.find((l) => l.id === levelId);
  if (!current) return [];
  const own = levels.filter((l) => l.trackId === current.trackId).toSorted(byOrder);
  const branchPoint = levels.find((l) => l.id === own[0].branchesFrom);
  const before = branchPoint
    ? levels.filter((l) => l.trackId === branchPoint.trackId && l.order < branchPoint.order).toSorted(byOrder)
    : [];
  const steps = [...before, ...own];
  const at = steps.indexOf(current);
  /** @returns {StepState} */
  const stateOf = (i) => {
    if (i < at) return 'below';
    return i === at ? 'current' : 'above';
  };
  return steps.map((level, i) => ({ level, state: stateOf(i) }));
}

/**
 * Pestaña que se abre: el nivel siguiente, que es donde se trabaja; si ya está
 * en el último, el actual (RMR-TSK-0706).
 * @param {PathStep[]} steps
 * @returns {string|null}
 */
export function defaultLevelTab(steps) {
  const step = steps.find((s) => s.state === 'above') ?? steps.find((s) => s.state === 'current');
  return step?.level.id ?? null;
}
