import { describe, it, expect } from 'vitest';
import { managerOnboardingPlan } from './orgManagers.js';

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
