import { describe, it, expect } from 'vitest';
import { seniorityRank, canBeO2OManager, sortO2OManagers } from './o2oManagers.js';

const roles = [
  { id: 'cto', label: 'CTO', layer: 0 },
  { id: 'em', label: 'EM', layer: 1 },
  { id: 'eng', label: 'Engineer', layer: 2 },
];
const p = (id, extra = {}) => ({ id, name: id, uid: `u-${id}`, ...extra });

describe('seniorityRank: menor es más senior (la base de la pirámide)', () => {
  it('con Notion manda su Level', () => {
    expect(seniorityRank(p('a', { notion: { level: 'C-level' } }), roles)).toBe(0);
    expect(seniorityRank(p('b', { notion: { level: 'IC' } }), roles)).toBe(5);
  });
  it('sin Level de Notion, la capa de su rol', () => {
    expect(seniorityRank(p('a', { orgRole: 'em' }), roles)).toBe(1);
  });
  it('sin ninguno de los dos, null', () => {
    expect(seniorityRank(p('a'), roles)).toBeNull();
  });
});

describe('canBeO2OManager: solo alguien con cuenta y por debajo en la pirámide', () => {
  const ic = p('ic', { notion: { level: 'IC' } });
  it('un Manager puede llevar a un IC', () => {
    expect(canBeO2OManager(p('m', { notion: { level: 'Manager' } }), ic, roles)).toBe(true);
  });
  it('un par no puede, ni alguien por encima, ni uno mismo', () => {
    expect(canBeO2OManager(p('o', { notion: { level: 'IC' } }), ic, roles)).toBe(false);
    expect(canBeO2OManager(ic, p('m', { notion: { level: 'Manager' } }), roles)).toBe(false);
    expect(canBeO2OManager(ic, ic, roles)).toBe(false);
  });
  it('sin cuenta no hay O2O que registrar', () => {
    expect(canBeO2OManager(p('m', { uid: null, notion: { level: 'Manager' } }), ic, roles)).toBe(false);
  });
  it('si no se sabe dónde está alguno de los dos, no se ofrece', () => {
    expect(canBeO2OManager(p('m'), ic, roles)).toBe(false);
    expect(canBeO2OManager(p('m', { notion: { level: 'Manager' } }), p('x'), roles)).toBe(false);
  });
});

describe('sortO2OManagers: en el orden de la pirámide, de la base hacia arriba', () => {
  it('ordena por rango y, a igual rango, por nombre', () => {
    const list = [
      p('zeta', { notion: { level: 'Manager' } }),
      p('ceo', { notion: { level: 'C-level' } }),
      p('alfa', { notion: { level: 'Manager' } }),
      p('nadie'),
    ];
    expect(sortO2OManagers(list, roles).map((x) => x.id)).toEqual(['ceo', 'alfa', 'zeta', 'nadie']);
  });
});
