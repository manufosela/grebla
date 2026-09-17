import { describe, it, expect } from 'vitest';
import { projectDirectory } from './orgDirectory.js';

const doc = (id, data) => ({ id, data });

describe('projectDirectory', () => {
  it('deja salir solo los campos del organigrama, ordenados por nombre', () => {
    const out = projectDirectory([
      doc('b', { name: 'Bea', orgRole: 'em', orgBranch: 'engineering', reportsToPersonId: 'a', uid: 'u1', email: 'bea@x.io', career: { level: 'L3' }, notes: 'privado' }),
      doc('a', { name: 'Ana', active: true }),
    ]);
    expect(out).toEqual([
      { personId: 'a', name: 'Ana', orgRole: null, orgBranch: null, reportsToPersonId: null, notion: null },
      { personId: 'b', name: 'Bea', orgRole: 'em', orgBranch: 'engineering', reportsToPersonId: 'a', notion: null },
    ]);
    expect(JSON.stringify(out)).not.toMatch(/uid|email|career|privado/);
  });

  it('las bajas y las fichas sin nombre no entran', () => {
    expect(projectDirectory([doc('x', { name: 'Baja', active: false }), doc('y', { name: '  ' }), doc('z', {})])).toEqual([]);
  });

  it('del bloque notion salen solo puesto, nivel, departamento, equipo, tipo y estado', () => {
    const [p] = projectDirectory([doc('a', { name: 'Ana', notion: { role: 'CTO', level: 'C-level', department: 'Product', team: 'Core', type: 'Employee', status: 'Active', slackId: 'U1', id: 'n1' } })]);
    expect(p.notion).toEqual({ role: 'CTO', level: 'C-level', department: 'Product', team: 'Core', type: 'Employee', status: 'Active' });
    expect(projectDirectory([doc('b', { name: 'Bea', notion: { slackId: 'U2' } })])[0].notion).toBeNull();
  });
});
