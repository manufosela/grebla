import { describe, expect, it } from 'vitest';
import { withoutDepartment } from './withoutDepartment.js';

const branches = [{ id: 'engineering' }, { id: 'product' }, { id: 'generico' }];

describe('withoutDepartment (RMR-TSK-0615)', () => {
  it('falta el departamento a quien está en genérico, sin rama o en una rama que ya no existe', () => {
    const people = [
      { id: 'a', orgBranch: 'engineering' },
      { id: 'b', orgBranch: 'generico' },
      { id: 'c' },
      { id: 'd', orgBranch: 'data' },
      { id: 'e', orgBranch: 'product', guilds: [] },
    ];
    expect(withoutDepartment(people, branches).map((p) => p.id)).toEqual(['b', 'c', 'd']);
  });

  it('no tener gremio no es que falte nada: el gremio es solo de Tech', () => {
    expect(withoutDepartment([{ id: 'x', orgBranch: 'product', guilds: [] }], branches)).toEqual([]);
  });
});
