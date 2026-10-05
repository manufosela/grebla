import { describe, expect, it } from 'vitest';
import { departmentHasGuilds } from './guildScope.js';

const branches = [
  { id: 'engineering', hasGuilds: true },
  { id: 'product' },
  { id: 'people', hasGuilds: false },
];

describe('departmentHasGuilds (RMR-TSK-0593)', () => {
  it('solo los departamentos marcados tienen gremios (hoy, Tech)', () => {
    expect(departmentHasGuilds('engineering', branches)).toBe(true);
    expect(departmentHasGuilds('product', branches)).toBe(false);
    expect(departmentHasGuilds('people', branches)).toBe(false);
  });

  it('sin departamento o con uno que no está en el catálogo, no hay gremios', () => {
    expect(departmentHasGuilds(null, branches)).toBe(false);
    expect(departmentHasGuilds('data', branches)).toBe(false);
  });
});
