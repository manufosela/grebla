import { describe, expect, it } from 'vitest';
import { planNotionSync } from './notionReconcile.js';

const branches = [{ id: 'engineering', label: 'Tech' }, { id: 'product', label: 'Product' }];
const entry = (over = {}) => ({
  id: 'n1', name: 'Ana Pérez', email: 'ana@example.com', department: 'Tech', team: 'Backend',
  role: 'Backend Engineer', level: 'IC', type: 'Employee', status: 'Active', joinDate: '2024-01-15',
  managerId: null, ...over,
});
const person = (id, data, authEmail = null) => ({ id, data: { active: true, ...data }, authEmail });
const plan = (directory, people) => {
  let n = 0;
  return planNotionSync({ directory, people, branches, newId: () => `new${++n}`, today: '2026-10-03' });
};

describe('planNotionSync — casado y campos que manda Notion', () => {
  it('casa por el email de Auth y trae nombre, departamento, alta, externo y el bloque notion', () => {
    const { updates, errors } = plan([entry()], [person('p1', { name: 'Ana', orgBranch: 'product' }, 'ANA@example.com')]);
    expect(errors).toEqual([]);
    expect(updates).toEqual([{
      personId: 'p1', name: 'Ana Pérez',
      set: {
        name: 'Ana Pérez', orgBranch: 'engineering', startDate: '2024-01-15', external: false,
        notion: { id: 'n1', role: 'Backend Engineer', level: 'IC', department: 'Tech', team: 'Backend', type: 'Employee', status: 'Active' },
      },
    }]);
  });

  it('casa por notion.id antes que por email, y por email propio o pendiente', () => {
    const people = [
      person('p1', { name: 'Ana Pérez', notion: { id: 'n1' }, email: 'otra@example.com' }),
      person('p2', { name: 'Bea', pendingEmail: 'bea@example.com' }),
    ];
    const { updates } = plan([entry(), entry({ id: 'n2', name: 'Bea', email: 'Bea@example.com' })], people);
    expect(updates.map((u) => u.personId)).toEqual(['p1', 'p2']);
  });

  it('el manager se traduce a la ficha casada; contractor es externo', () => {
    const people = [person('p1', { name: 'Ana Pérez' }, 'ana@example.com'), person('p2', { name: 'Jefa' }, 'jefa@example.com')];
    const { updates } = plan([entry({ managerId: 'n2', type: 'Contractor' }), entry({ id: 'n2', name: 'Jefa', email: 'jefa@example.com' })], people);
    const ana = updates.find((u) => u.personId === 'p1');
    expect(ana.set.reportsToPersonId).toBe('p2');
    expect(ana.set.external).toBe(true);
  });

  it('un manager que no casa con ninguna ficha no borra el que ya hay: se reporta', () => {
    const people = [person('p1', { name: 'Ana Pérez', reportsToPersonId: 'p9' }, 'ana@example.com')];
    const { updates, skipped } = plan([entry({ managerId: 'n2' }), entry({ id: 'n2', name: 'Jefa', email: null })], people);
    expect(updates[0].set).not.toHaveProperty('reportsToPersonId');
    expect(skipped).toContainEqual({ name: 'Ana Pérez', reason: 'su manager en Notion no tiene ficha: se mantiene el actual' });
  });

  it('lo que ya coincide no se reescribe: sin cambios, sin update', () => {
    const synced = { name: 'Ana Pérez', orgBranch: 'engineering', startDate: '2024-01-15', external: false, reportsToPersonId: null,
      notion: { id: 'n1', role: 'Backend Engineer', level: 'IC', department: 'Tech', team: 'Backend', type: 'Employee', status: 'Active' } };
    expect(plan([entry()], [person('p1', synced, 'ana@example.com')]).updates).toEqual([]);
  });

  it('un departamento sin rama en el catálogo no toca orgBranch y se reporta', () => {
    const { updates, skipped } = plan([entry({ department: 'Legal' })], [person('p1', { name: 'Ana Pérez', orgBranch: 'product' }, 'ana@example.com')]);
    expect(updates[0].set).not.toHaveProperty('orgBranch');
    expect(skipped).toContainEqual({ name: 'Ana Pérez', reason: 'departamento «Legal» sin rama en el catálogo' });
  });
});

describe('planNotionSync — guardrails', () => {
  it('nunca da de baja ni borra: quien no está en Notion solo se reporta', () => {
    const { updates, notInNotion } = plan([], [person('p1', { name: 'Solo GREBLA' }, 'solo@example.com')]);
    expect(updates).toEqual([]);
    expect(notInNotion).toEqual([{ personId: 'p1', name: 'Solo GREBLA' }]);
  });

  it('una fila de Notion sin email se ignora y se reporta', () => {
    expect(plan([entry({ email: null })], []).skipped).toContainEqual({ name: 'Ana Pérez', reason: 'sin email en Notion' });
  });

  it('dos filas de Notion con el mismo email bloquean el lote entero', () => {
    const { errors } = plan([entry(), entry({ id: 'n2', name: 'Otra', email: 'ANA@example.com' })], []);
    expect(errors).toEqual(['email repetido en Notion: ana@example.com']);
  });

  it('un notion.id repetido en dos fichas no se aplica a ninguna', () => {
    const people = [person('p1', { name: 'A', notion: { id: 'n1' } }), person('p2', { name: 'B', notion: { id: 'n1' } })];
    const { updates, skipped } = plan([entry()], people);
    expect(updates).toEqual([]);
    expect(skipped).toContainEqual({ name: 'Ana Pérez', reason: 'casa con varias fichas: p1, p2' });
  });

  it('un email que casa con dos fichas no se aplica a ninguna', () => {
    const people = [person('p1', { name: 'A', email: 'ana@example.com' }), person('p2', { name: 'B', pendingEmail: 'ana@example.com' })];
    const { updates, skipped } = plan([entry()], people);
    expect(updates).toEqual([]);
    expect(skipped).toContainEqual({ name: 'Ana Pérez', reason: 'casa con varias fichas: p1, p2' });
  });

  it('un ciclo en la cadena de mando de Notion bloquea el lote', () => {
    const { errors } = plan([entry({ managerId: 'n2' }), entry({ id: 'n2', name: 'Bea', email: 'bea@example.com', managerId: 'n1' })], []);
    expect(errors).toEqual(['ciclo de managers en Notion: Ana Pérez → Bea → Ana Pérez']);
  });
});

describe('planNotionSync — entrada', () => {
  it('sin generador de ids o sin fecha ISO falla en voz alta, antes de planear nada', () => {
    expect(() => planNotionSync({ directory: [], people: [], branches })).toThrow('newId');
    expect(() => planNotionSync({ directory: [], people: [], branches, newId: () => 'x', today: '3/10/2026' })).toThrow('today');
  });
});

describe('planNotionSync — el padrón: quien está en Notion y no en GREBLA', () => {
  it('se crea pre-invitada por su email, con el manager aunque también sea nueva', () => {
    const { creates } = plan([entry({ managerId: 'n2' }), entry({ id: 'n2', name: 'Jefa Nueva', email: 'jefa@example.com', joinDate: null })], []);
    expect(creates).toEqual([
      { personId: 'new1', name: 'Ana Pérez', data: expect.objectContaining({
        pendingEmail: 'ana@example.com', orgRole: 'generico', orgBranch: 'engineering', active: true,
        startDate: '2024-01-15', reportsToPersonId: 'new2', guilds: [], disciplines: [], labels: [] }) },
      { personId: 'new2', name: 'Jefa Nueva', data: expect.objectContaining({ startDate: '2026-10-03', reportsToPersonId: null }) },
    ]);
  });

  it('si una ficha sin casar se llama casi igual, no se crea: posible duplicado', () => {
    const people = [person('p1', { name: 'Hector Martinez', pendingEmail: 'hector.martinez@example.com' })];
    const { creates, skipped } = plan([entry({ name: 'Héctor Martínez López', email: 'hector@example.com' })], people);
    expect(creates).toEqual([]);
    expect(skipped).toContainEqual({ name: 'Héctor Martínez López', reason: 'posible duplicado de «Hector Martinez» (p1): no se crea' });
  });
});
