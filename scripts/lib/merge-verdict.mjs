/**
 * Decisión de «¿se puede mergear?» a partir del estado que devuelve la API de
 * GitHub (RMR-TSK-0445). Función PURA: sin red, sin `gh`, sin reloj — para que
 * la parte que decide se pueda probar, que es justo la que falló en la PR #647.
 */

/** Conclusiones que NO son un aprobado: si aparece alguna, no se mergea. */
export const BAD_CONCLUSIONS = new Set([
  'FAILURE', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED', 'STARTUP_FAILURE', 'STALE', 'ERROR',
]);

/**
 * Normaliza el `statusCheckRollup` de `gh pr view`, que mezcla dos formas: los
 * checks de Actions traen `status`/`conclusion` y los commit statuses, `state`.
 * @param {Array<Record<string, unknown>>} rollup
 * @returns {Array<{ name: string, pending: boolean, conclusion: string }>}
 */
export function normalizeChecks(rollup = []) {
  return rollup.map((c) => ({
    name: c.name ?? c.context ?? '(sin nombre)',
    pending: c.status ? c.status !== 'COMPLETED' : c.state === 'PENDING',
    conclusion: String(c.conclusion ?? c.state ?? '').toUpperCase(),
  }));
}

/**
 * @param {{ statusCheckRollup?: Array<Record<string, unknown>>, state?: string, mergeable?: string,
 *   isDraft?: boolean }} pr  tal cual lo devuelve `gh pr view --json`
 * @returns {{ action: 'merge'|'wait'|'abort', reason: string, checks: ReturnType<typeof normalizeChecks> }}
 */
export function mergeVerdict(pr) {
  const checks = normalizeChecks(pr?.statusCheckRollup ?? []);

  // Primero lo TERMINAL: si ya sabemos que la PR no se puede mergear, esperar a
  // lo que quede corriendo no cambia el desenlace, solo retrasa el aviso.
  if (pr?.state && pr.state !== 'OPEN') {
    return { action: 'abort', reason: `la PR no está abierta (estado: ${pr.state})`, checks };
  }
  // Un borrador no se mergea aunque todo esté verde: GitHub no lo permite, y
  // además está en borrador por algo.
  if (pr?.isDraft) {
    return { action: 'abort', reason: 'la PR está en borrador; márcala como lista antes de mergear', checks };
  }
  const failed = checks.filter((c) => BAD_CONCLUSIONS.has(c.conclusion));
  if (failed.length > 0) {
    return { action: 'abort', reason: failed.map((c) => `${c.name} (${c.conclusion})`).join(', '), checks };
  }
  if (pr?.mergeable === 'CONFLICTING') {
    return { action: 'abort', reason: 'hay conflictos con la rama base', checks };
  }

  // Después lo INDETERMINADO: aún no se puede decidir, hay que volver a mirar.
  const pending = checks.filter((c) => c.pending);
  if (pending.length > 0) {
    return { action: 'wait', reason: `${pending.length} check(s) en marcha: ${pending.map((c) => c.name).join(', ')}`, checks };
  }
  // `UNKNOWN` no es «sin conflictos»: GitHub todavía está calculando si la rama
  // se puede mergear. Esperar a que se pronuncie, no dar por hecho que sí.
  if (pr?.mergeable === 'UNKNOWN') {
    return { action: 'wait', reason: 'GitHub aún está calculando si la rama se puede mergear', checks };
  }

  // Sin checks NO es lo mismo que checks en verde: puede que el CI ni se haya
  // disparado. Ante la duda, no se mergea.
  if (checks.length === 0) {
    return { action: 'abort', reason: 'la PR no tiene ningún check; comprueba que el CI se ha disparado', checks };
  }
  return { action: 'merge', reason: `${checks.length} checks en verde`, checks };
}
