import { describe, it, expect } from 'vitest';
import { contributionGroups } from './belbin.js';

/**
 * El Mapa pintaba un chip por rol: con los 9 roles marcados, la fila de esa
 * persona ocupaba media pantalla (RMR-TSK-0755). Se agrupan en dos líneas.
 */
describe('contributionGroups', () => {
  it('separa primarios y secundarios en el orden del catálogo', () => {
    const roles = { CF: 'secondary', SH: 'primary', PL: 'primary', RI: 'secondary', ME: 'primary' };
    expect(contributionGroups(roles)).toEqual({ primary: ['PL', 'ME', 'SH'], secondary: ['RI', 'CF'] });
  });

  it('sin roles, nada; y lo que no es del catálogo no se cuela', () => {
    expect(contributionGroups(null)).toEqual({ primary: [], secondary: [] });
    expect(contributionGroups({ XX: 'primary', CO: 'otro' })).toEqual({ primary: [], secondary: [] });
  });
});
