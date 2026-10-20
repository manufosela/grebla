import { describe, it, expect } from 'vitest';
import { managerOnboardingPlan, directoryManagerPatches, headScopeChanged } from './orgManagers.js';

describe('headScopeChanged: cuándo un cambio de ficha mueve el alcance del Head (RMR-TSK-0786)', () => {
  const dev = { orgRole: 'back-engineer', orgBranch: 'engineering', active: true };
  const head = { orgRole: 'head-of-tech', orgBranch: 'engineering', active: true };

  it('dar o quitar el rol de Head, o tocar la ficha de un Head, recalcula', () => {
    expect(headScopeChanged(dev, { ...dev, orgRole: 'head-of-tech' })).toBe(true);
    expect(headScopeChanged(head, { ...head, orgRole: 'cto' })).toBe(true);
    expect(headScopeChanged(head, { ...head, active: false })).toBe(true);
    expect(headScopeChanged(null, head)).toBe(true);
  });

  it('cambiar de departamento o darse de baja una ficha que ya existía, también', () => {
    expect(headScopeChanged(dev, { ...dev, orgBranch: 'product' })).toBe(true);
    expect(headScopeChanged(dev, { ...dev, active: false })).toBe(true);
  });

  it('crear una ficha normal o tocar otros campos, no', () => {
    expect(headScopeChanged(null, dev)).toBe(false);
    expect(headScopeChanged(dev, { ...dev, levelId: 'l2' })).toBe(false);
  });
});

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

describe('directoryManagerPatches: el Head of Tech ve a todo su departamento (RMR-TSK-0786)', () => {
  // En el organigrama oficial los EMs dependen del CTO y el Head no tiene a nadie;
  // en GREBLA Head y EM están al mismo nivel, y el Head ve a todo su departamento.
  const tech = [
    { id: 'cto', uid: 'u-cto', orgBranch: 'engineering', orgRole: 'cto', reportsToPersonId: null },
    { id: 'head', uid: 'u-head', orgBranch: 'engineering', orgRole: 'head-of-tech', reportsToPersonId: 'cto' },
    { id: 'em', uid: 'u-em', orgBranch: 'engineering', orgRole: 'engineer-manager-back', reportsToPersonId: 'cto' },
    { id: 'tl', uid: 'u-tl', orgBranch: 'engineering', orgRole: 'back-engineer', reportsToPersonId: 'em' },
    { id: 'dev', uid: 'u-dev', orgBranch: 'engineering', reportsToPersonId: 'em' },
    { id: 'baja', uid: 'u-baja', orgBranch: 'engineering', reportsToPersonId: 'em', active: false },
    { id: 'pm', uid: 'u-pm', orgBranch: 'product', reportsToPersonId: null },
  ];
  const uidsOf = (people) => new Map(directoryManagerPatches(people).map((p) => [p.id, p.uids]));

  it('se añade tras la cadena del organigrama en cada ficha activa de su departamento', () => {
    const uids = uidsOf(tech);
    expect(uids.get('em')).toEqual(['u-cto', 'u-head']);
    expect(uids.get('tl')).toEqual(['u-em', 'u-cto', 'u-head']);
    expect(uids.get('dev')).toEqual(['u-em', 'u-cto', 'u-head']);
  });

  it('ni a sí mismo, ni a las bajas, ni a otros departamentos; y los TLs no ganan a nadie', () => {
    const uids = uidsOf(tech);
    expect(uids.get('head')).toEqual(['u-cto']);
    expect(uids.get('baja')).toEqual(['u-em', 'u-cto']);
    expect(uids.get('pm')).toEqual([]);
    expect([...uids.values()].some((list) => list.includes('u-tl'))).toBe(false);
  });

  it('un Head sin cuenta, o dado de baja, no añade nada', () => {
    const sinCuenta = tech.map((p) => (p.id === 'head' ? { ...p, uid: null } : p));
    const deBaja = tech.map((p) => (p.id === 'head' ? { ...p, active: false } : p));
    expect(uidsOf(sinCuenta).get('dev')).toEqual(['u-em', 'u-cto']);
    expect(uidsOf(deBaja).get('dev')).toEqual(['u-em', 'u-cto']);
  });
});

const team = [
  { id: 'jefa', name: 'Jefa', uid: 'u-jefa', reportsToPersonId: null },
  { id: 'ana', name: 'Ana', reportsToPersonId: 'jefa' },
  { id: 'luis', name: 'Luis', reportsToPersonId: 'jefa' },
  { id: 'eva', name: 'Eva', reportsToPersonId: 'jefa', active: false },
  { id: 'otro', name: 'Otro', reportsToPersonId: 'nadie' },
];

describe('managerOnboardingPlan: quien entra con equipo en el directorio (RMR-TSK-0660)', () => {
  it('le da el rol de líder; su equipo de O2O sale de la rama (RMR-TSK-0665)', () => {
    expect(managerOnboardingPlan('jefa', 'u-jefa', team, false)).toEqual({
      leader: { uid: 'u-jefa', displayName: 'Jefa' },
    });
  });

  it('si ya era líder no vuelve a crear el rol', () => {
    expect(managerOnboardingPlan('jefa', 'u-jefa', team, true).leader).toBeNull();
  });

  it('quien no tiene a nadie a su cargo no recibe nada', () => {
    expect(managerOnboardingPlan('ana', 'u-ana', team, false)).toEqual({ leader: null });
  });

  it('sin cuenta no hay nada que dar', () => {
    expect(managerOnboardingPlan('jefa', null, team, false)).toEqual({ leader: null });
  });
});
