import { describe, it, expect } from 'vitest';
import { mergeVerdict, normalizeChecks } from './merge-verdict.mjs';

const action = (name, status, conclusion) => ({ name, status, conclusion });
const commitStatus = (context, state) => ({ context, state });

describe('mergeVerdict — la decisión de mergear sale del estado, no de leer un texto', () => {
  it('mergea cuando todos los checks han terminado en verde', () => {
    const v = mergeVerdict({
      state: 'OPEN',
      statusCheckRollup: [action('Quality', 'COMPLETED', 'SUCCESS'), commitStatus('GitGuardian', 'SUCCESS')],
    });
    expect(v.action).toBe('merge');
    expect(v.reason).toContain('2 checks');
  });

  it('espera mientras quede alguno en marcha, aunque los demás estén verdes', () => {
    const v = mergeVerdict({
      state: 'OPEN',
      statusCheckRollup: [action('Quality', 'COMPLETED', 'SUCCESS'), action('E2E', 'IN_PROGRESS', null)],
    });
    expect(v.action).toBe('wait');
    expect(v.reason).toContain('E2E');
  });

  it('aborta si alguno falla — el caso de la PR #647', () => {
    const v = mergeVerdict({
      state: 'OPEN',
      statusCheckRollup: [action('Quality', 'COMPLETED', 'SUCCESS'), action('E2E', 'COMPLETED', 'FAILURE')],
    });
    expect(v.action).toBe('abort');
    expect(v.reason).toContain('E2E (FAILURE)');
  });

  it('aborta con cancelados, caducados y demás conclusiones que no son un aprobado', () => {
    for (const bad of ['CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'STARTUP_FAILURE', 'STALE', 'ERROR']) {
      expect(mergeVerdict({ state: 'OPEN', statusCheckRollup: [action('X', 'COMPLETED', bad)] }).action).toBe('abort');
    }
  });

  it('acepta neutral y omitido: no todo check verde dice SUCCESS', () => {
    const v = mergeVerdict({
      state: 'OPEN',
      statusCheckRollup: [action('Lint', 'COMPLETED', 'NEUTRAL'), action('Deploy', 'COMPLETED', 'SKIPPED')],
    });
    expect(v.action).toBe('merge');
  });

  it('sin checks NO es verde: puede que el CI ni se haya disparado', () => {
    const v = mergeVerdict({ state: 'OPEN', statusCheckRollup: [] });
    expect(v.action).toBe('abort');
    expect(v.reason).toContain('ningún check');
  });

  it('aborta si la PR ya no está abierta o si hay conflictos', () => {
    expect(mergeVerdict({ state: 'MERGED', statusCheckRollup: [] }).action).toBe('abort');
    expect(mergeVerdict({
      state: 'OPEN',
      mergeable: 'CONFLICTING',
      statusCheckRollup: [action('Quality', 'COMPLETED', 'SUCCESS')],
    }).reason).toContain('conflictos');
  });
});

describe('normalizeChecks — las dos formas que devuelve la API', () => {
  it('entiende los checks de Actions y los commit statuses', () => {
    expect(normalizeChecks([
      action('E2E', 'IN_PROGRESS', null),
      commitStatus('GitGuardian', 'PENDING'),
      commitStatus('Otro', 'SUCCESS'),
    ])).toEqual([
      { name: 'E2E', pending: true, conclusion: '' },
      { name: 'GitGuardian', pending: true, conclusion: 'PENDING' },
      { name: 'Otro', pending: false, conclusion: 'SUCCESS' },
    ]);
  });

  it('no se rompe con una entrada sin nombre', () => {
    expect(normalizeChecks([{ status: 'COMPLETED', conclusion: 'SUCCESS' }])[0].name).toBe('(sin nombre)');
  });
});
