import { describe, it, expect } from 'vitest';
import { o2oLeadersOf, sharedSessions, canReadPersonO2O, periodsForPerson } from './o2oProjection.js';

describe('o2oLeadersOf: de quién son los O2O de una persona (RMR-TSK-0727)', () => {
  it('su dueño, los compartidos y su directorio, sin repetir ni huecos', () => {
    const person = { ownerLeaderUid: 'em', sharedWithUids: ['otro', null], directoryManagerUids: ['em', 'head'] };
    expect(o2oLeadersOf(person)).toEqual(['em', 'otro', 'head']);
  });
  it('sin nadie, ninguno', () => {
    expect(o2oLeadersOf({})).toEqual([]);
  });
});

describe('sharedSessions: solo lo que el manager compartió', () => {
  it('fecha, resumen compartido y de quién; nunca notas ni resumen privado; recientes primero', () => {
    const byLeader = [
      { leaderUid: 'em', sessions: [
        { date: '2026-09-01', sharedWithPerson: true, sharedSummary: 'Vamos bien', privateSummary: 'SECRETO', notes: 'SECRETO' },
        { date: '2026-10-01', sharedWithPerson: false, sharedSummary: 'No compartido' },
      ] },
      { leaderUid: 'head', sessions: [{ date: '2026-09-20', sharedWithPerson: true, sharedSummary: 'Skip-level' }] },
    ];
    const out = sharedSessions(byLeader);
    expect(out).toEqual([
      { date: '2026-09-20', sharedSummary: 'Skip-level', leaderUid: 'head' },
      { date: '2026-09-01', sharedSummary: 'Vamos bien', leaderUid: 'em' },
    ]);
    expect(JSON.stringify(out)).not.toContain('SECRETO');
  });
  it('compartida pero sin resumen no se enseña', () => {
    expect(sharedSessions([{ leaderUid: 'em', sessions: [{ date: '2026-09-01', sharedWithPerson: true, sharedSummary: '' }] }])).toEqual([]);
  });
});

describe('periodsForPerson: solo los periodos en los que la persona está en «Para quién»', () => {
  it('con lista, si está en ella; sin lista (periodos viejos), si el líder es su dueño', () => {
    const periods = [{ id: 'a', personIds: ['dev'] }, { id: 'b', personIds: ['otra'] }, { id: 'c' }];
    expect(periodsForPerson(periods, { personId: 'dev', person: { ownerLeaderUid: 'em' }, leaderUid: 'em' }).map((p) => p.id)).toEqual(['a', 'c']);
    expect(periodsForPerson(periods, { personId: 'dev', person: { ownerLeaderUid: 'em' }, leaderUid: 'head' }).map((p) => p.id)).toEqual(['a']);
  });
});

describe('canReadPersonO2O: quién pide el O2O de otra persona', () => {
  const person = { uid: 'dev', directoryManagerUids: ['em', 'head'] };
  it('sus managers del directorio y el superadmin sí', () => {
    expect(canReadPersonO2O({ callerUid: 'head', person, isSuperAdmin: false })).toBe(true);
    expect(canReadPersonO2O({ callerUid: 'x', person, isSuperAdmin: true })).toBe(true);
  });
  it('cualquier otro, y sin sesión, no', () => {
    expect(canReadPersonO2O({ callerUid: 'otro-em', person, isSuperAdmin: false })).toBe(false);
    expect(canReadPersonO2O({ callerUid: null, person, isSuperAdmin: false })).toBe(false);
    expect(canReadPersonO2O({ callerUid: 'em', person: null, isSuperAdmin: false })).toBe(false);
  });
});
