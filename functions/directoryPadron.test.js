import { describe, expect, it } from 'vitest';
import { directoryPadronRows } from './directoryPadron.js';

const branches = new Map([['engineering', 'Tech'], ['people', 'PeopOps']]);
const person = (id, data, authEmail = null) => ({ id, data: { active: true, ...data }, authEmail });

describe('directoryPadronRows (RMR-TSK-0629) — el padrón de encuestas desde el censo', () => {
  it('una fila por persona activa, con su departamento por nombre y su fecha de alta', () => {
    const rows = directoryPadronRows([
      person('p1', { name: 'Ana', email: 'Ana@Example.com', orgBranch: 'engineering', startDate: '2024-01-15' }),
    ], branches);
    expect(rows).toEqual([{ email: 'ana@example.com', name: 'Ana', department: 'Tech', hireDate: '2024-01-15' }]);
  });

  it('el email sale de la ficha, de la invitación o de su cuenta, por ese orden', () => {
    const rows = directoryPadronRows([
      person('p1', { name: 'Bea', pendingEmail: 'bea@example.com' }),
      person('p2', { name: 'Carla', uid: 'u2' }, 'carla@example.com'),
    ], branches);
    expect(rows.map((r) => r.email)).toEqual(['bea@example.com', 'carla@example.com']);
  });

  it('las bajas y quien no tiene ningún email no entran; tampoco el mismo email dos veces', () => {
    const rows = directoryPadronRows([
      person('p1', { name: 'Baja', email: 'baja@example.com', active: false }),
      person('p2', { name: 'Sin email' }),
      person('p3', { name: 'Dani', email: 'dani@example.com' }),
      person('p4', { name: 'Dani bis', pendingEmail: 'DANI@example.com' }),
    ], branches);
    expect(rows.map((r) => r.name)).toEqual(['Dani']);
  });

  it('un departamento fuera del catálogo se queda sin nombre, no con su id', () => {
    const [row] = directoryPadronRows([person('p1', { name: 'Eva', email: 'eva@example.com', orgBranch: 'data' })], branches);
    expect(row.department).toBeNull();
  });
});
