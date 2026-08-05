import { describe, it, expect } from 'vitest';
import { ownerUidFor, subtreeOf } from './orgOwnership.js';

const P = (id, { reportsTo = null, uid = null, self = false } = {}) => ({
  id, reportsToPersonId: reportsTo, uid, self,
});

const people = [
  P('ceo', { uid: 'u-ceo' }),
  P('head', { reportsTo: 'ceo', uid: 'u-head' }),
  P('manager', { reportsTo: 'head', uid: 'u-mgr' }),
  P('eng1', { reportsTo: 'manager' }),
  P('eng2', { reportsTo: 'manager', uid: 'u-eng2' }),
  P('pending-boss', { reportsTo: 'sin-cuenta' }),
  P('sin-cuenta', { reportsTo: 'head' }), // jefe sin uid todavía
  P('selfie', { reportsTo: 'head', uid: 'u-self', self: true }),
];

describe('ownerUidFor — el dueño de la ficha sale del organigrama (RMR-PCS-0035)', () => {
  const byId = new Map(people.map((p) => [p.id, p]));

  it('el dueño es el uid de la persona a la que reporta', () => {
    expect(ownerUidFor(byId.get('eng1'), byId)).toEqual({ ownerUid: 'u-mgr', reason: 'org' });
    expect(ownerUidFor(byId.get('manager'), byId)).toEqual({ ownerUid: 'u-head', reason: 'org' });
  });

  it('sin reportsTo → dueño null (solo superadmin), decisión explícita', () => {
    expect(ownerUidFor(byId.get('ceo'), byId)).toEqual({ ownerUid: null, reason: 'sin-superior' });
  });

  it('jefe SIN cuenta vinculada → sin cambio (se conserva el owner actual)', () => {
    expect(ownerUidFor(byId.get('pending-boss'), byId)).toEqual({ ownerUid: undefined, reason: 'jefe-sin-cuenta' });
  });

  it('jefe inexistente → sin cambio (dato roto visible, no se inventa)', () => {
    const orphan = P('x', { reportsTo: 'no-existe' });
    expect(ownerUidFor(orphan, byId)).toEqual({ ownerUid: undefined, reason: 'jefe-desconocido' });
  });

  it('las self-fichas se conservan (su dueño es su titular): sin cambio', () => {
    expect(ownerUidFor(byId.get('selfie'), byId)).toEqual({ ownerUid: undefined, reason: 'self' });
  });
});

describe('subtreeOf — cierre transitivo del organigrama (pirámide invertida)', () => {
  it('devuelve todo lo que cuelga, a cualquier profundidad, sin incluir a la propia persona', () => {
    const ids = subtreeOf(people, 'head').map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['manager', 'eng1', 'eng2', 'sin-cuenta', 'pending-boss', 'selfie']));
    expect(ids).not.toContain('head');
    expect(ids).not.toContain('ceo');
  });

  it('hoja → vacío; ciclos accidentales no cuelgan', () => {
    expect(subtreeOf(people, 'eng1')).toEqual([]);
    const cyclic = [P('a', { reportsTo: 'b' }), P('b', { reportsTo: 'a' })];
    expect(subtreeOf(cyclic, 'a').map((p) => p.id)).toEqual(['b']);
  });
});
