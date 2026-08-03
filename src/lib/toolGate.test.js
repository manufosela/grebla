import { describe, it, expect } from 'vitest';
import { buildPersonRef } from './toolGate.js';

describe('toolGate — buildPersonRef (RMR-TSK-0387)', () => {
  it('mapea la ficha a un PersonRef con toolOverrides incluidos', () => {
    const person = {
      id: 'p1',
      orgBranch: 'engineering',
      orgRole: 'em',
      toolOverrides: { dora: { use: false } },
    };
    expect(buildPersonRef(person)).toEqual({
      personId: 'p1',
      branch: 'engineering',
      roleId: 'em',
      toolOverrides: { dora: { use: false } },
    });
  });

  it('sin ficha (o campos ausentes) cae a genérico sin rol ni overrides', () => {
    expect(buildPersonRef(null)).toEqual({ personId: null, branch: 'generico', roleId: null, toolOverrides: {} });
    expect(buildPersonRef({ id: 'p2' })).toEqual({ personId: 'p2', branch: 'generico', roleId: null, toolOverrides: {} });
  });
});
