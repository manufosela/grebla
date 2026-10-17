import { describe, it, expect } from 'vitest';
import { inMyTeam } from './teamScope.js';

/**
 * Mi equipo es el organigrama (RMR-TSK-0747): quien está en él sale a quien lo
 * tiene por encima, y a nadie más por mucho que su ficha la creara otro.
 */
describe('inMyTeam', () => {
  it('quien está en el organigrama sale a sus jefes de la rama', () => {
    const p = { reportsToPersonId: 'em', directoryManagerUids: ['em-uid', 'cto-uid'] };
    expect(inMyTeam(p, 'em-uid')).toBe(true);
    expect(inMyTeam(p, 'cto-uid')).toBe(true);
  });

  it('y no sale a quien solo es dueño de la ficha o la tiene compartida', () => {
    const p = { reportsToPersonId: 'otra', directoryManagerUids: ['otro-uid'], ownerLeaderUid: 'yo', sharedWithUids: ['yo'] };
    expect(inMyTeam(p, 'yo')).toBe(false);
  });

  it('quien no está en el organigrama sigue con su dueño o con quien se compartió', () => {
    expect(inMyTeam({ ownerLeaderUid: 'yo' }, 'yo')).toBe(true);
    expect(inMyTeam({ ownerLeaderUid: 'otro', sharedWithUids: ['yo'] }, 'yo')).toBe(true);
    expect(inMyTeam({ ownerLeaderUid: 'otro' }, 'yo')).toBe(false);
  });

  it('y con rama, la de los managers que le reportan', () => {
    expect(inMyTeam({ ownerLeaderUid: 'em-uid' }, 'head-uid', ['em-uid'])).toBe(true);
  });
});
