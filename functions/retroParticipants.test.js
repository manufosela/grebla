import { describe, expect, it } from 'vitest';
import { canSeeRetro, participantRows } from './retroParticipants.js';

describe('participantes de una retro (RMR-TSK-0642)', () => {
  const retro = { memberUids: ['u1', 'u2', 'u3'], branchUids: ['head'] };

  it('la ve quien está dentro, su cadena de managers y quien ve todas; nadie más', () => {
    expect(canSeeRetro(retro, 'u2', false)).toBe(true);
    expect(canSeeRetro(retro, 'head', false)).toBe(true);
    expect(canSeeRetro(retro, 'otra', true)).toBe(true);
    expect(canSeeRetro(retro, 'otra', false)).toBe(false);
    expect(canSeeRetro({}, 'u1', false)).toBe(false);
  });

  it('el nombre sale de la ficha, si no de la cuenta y si no del email; por orden alfabético', () => {
    const rows = participantRows(retro, {
      fichaByUid: new Map([['u1', 'Zoe Ficha']]),
      accounts: new Map([['u2', { displayName: 'Ana Cuenta', email: 'ana@example.com' }], ['u3', { displayName: null, email: 'bea.sin@example.com' }]]),
    });
    expect(rows).toEqual([
      { uid: 'u2', name: 'Ana Cuenta' }, { uid: 'u3', name: 'bea.sin' }, { uid: 'u1', name: 'Zoe Ficha' },
    ]);
  });

  it('un participante sin ficha ni cuenta no se inventa: sale como «Participante»', () => {
    expect(participantRows({ memberUids: ['u9'] }, { fichaByUid: new Map(), accounts: new Map() }))
      .toEqual([{ uid: 'u9', name: 'Participante' }]);
  });
});
