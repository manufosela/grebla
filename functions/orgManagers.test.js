import { describe, it, expect } from 'vitest';
import { managerOnboardingPlan, directoryManagerPatches } from './orgManagers.js';

describe('directoryManagerPatches: managers de la rama de cada ficha (RMR-TSK-0661)', () => {
  const org = [
    { id: 'cto', uid: 'u-cto', reportsToPersonId: 'ceo' },
    { id: 'ceo', uid: null, reportsToPersonId: null },
    { id: 'em', uid: 'u-em', reportsToPersonId: 'cto' },
    { id: 'dev', uid: 'u-dev', reportsToPersonId: 'em', directoryManagerUids: ['u-em', 'u-cto'] },
    { id: 'nuevo', reportsToPersonId: 'em' },
  ];

  it('cada ficha recibe sus jefes con cuenta, del más cercano hacia arriba, y solo si cambia', () => {
    expect(directoryManagerPatches(org)).toEqual([
      { id: 'cto', uids: [] },
      { id: 'ceo', uids: [] },
      { id: 'em', uids: ['u-cto'] },
      { id: 'nuevo', uids: ['u-em', 'u-cto'] },
    ]);
  });

  it('no escribe a quien ya tiene la lista bien', () => {
    const expected = new Map(directoryManagerPatches(org).map((p) => [p.id, p.uids]));
    const settled = org.map((p) => ({ ...p, directoryManagerUids: expected.get(p.id) ?? p.directoryManagerUids }));
    expect(directoryManagerPatches(settled)).toEqual([]);
  });

  it('un ciclo en el directorio no cuelga: se corta al repetir', () => {
    const loop = [{ id: 'a', uid: 'u-a', reportsToPersonId: 'b' }, { id: 'b', uid: 'u-b', reportsToPersonId: 'a' }];
    expect(directoryManagerPatches(loop)).toEqual([{ id: 'a', uids: ['u-b'] }, { id: 'b', uids: ['u-a'] }]);
  });
});

const team = [
  { id: 'jefa', name: 'Jefa', uid: 'u-jefa', reportsToPersonId: null },
  { id: 'ana', name: 'Ana', reportsToPersonId: 'jefa', o2oManagerUids: [] },
  { id: 'luis', name: 'Luis', reportsToPersonId: 'jefa', o2oManagerUids: ['u-jefa'] },
  { id: 'eva', name: 'Eva', reportsToPersonId: 'jefa', active: false },
  { id: 'otro', name: 'Otro', reportsToPersonId: 'nadie' },
];

describe('managerOnboardingPlan: quien entra con equipo en el directorio (RMR-TSK-0660)', () => {
  it('le da el rol de líder y le añade como manager de O2O de su equipo activo', () => {
    expect(managerOnboardingPlan('jefa', 'u-jefa', team, false)).toEqual({
      leader: { uid: 'u-jefa', displayName: 'Jefa' },
      addO2OTo: ['ana'],
    });
  });

  it('si ya era líder no vuelve a crear el rol', () => {
    expect(managerOnboardingPlan('jefa', 'u-jefa', team, true).leader).toBeNull();
  });

  it('quien no tiene a nadie a su cargo no recibe nada', () => {
    expect(managerOnboardingPlan('ana', 'u-ana', team, false)).toEqual({ leader: null, addO2OTo: [] });
  });

  it('sin cuenta no hay nada que dar', () => {
    expect(managerOnboardingPlan('jefa', null, team, false)).toEqual({ leader: null, addO2OTo: [] });
  });
});
