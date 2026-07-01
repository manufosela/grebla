import { describe, it, expect } from 'vitest';
import { mergeAccessUsers } from './accessRoles.js';

describe('mergeAccessUsers', () => {
  it('fusiona las tres colecciones etiquetando el rol de cada usuario', () => {
    const result = mergeAccessUsers({
      superadmin: [{ id: 'u1', displayName: 'Ana', email: 'ana@x.com' }],
      viewer: [{ id: 'u2', displayName: 'Beto', email: 'beto@x.com' }],
      leader: [{ id: 'u3', displayName: 'Cris', email: 'cris@x.com' }],
    });
    expect(result).toEqual([
      { uid: 'u1', displayName: 'Ana', email: 'ana@x.com', role: 'superadmin' },
      { uid: 'u2', displayName: 'Beto', email: 'beto@x.com', role: 'viewer' },
      { uid: 'u3', displayName: 'Cris', email: 'cris@x.com', role: 'leader' },
    ]);
  });

  it('ordena por displayName (o email si no hay nombre)', () => {
    const result = mergeAccessUsers({
      superadmin: [{ id: 'u1', displayName: 'Zoe', email: 'zoe@x.com' }],
      viewer: [{ id: 'u2', displayName: null, email: 'ana@x.com' }],
      leader: [],
    });
    expect(result.map((u) => u.uid)).toEqual(['u2', 'u1']);
  });

  it('prioriza superadmin > viewer > leader si un uid está en varias colecciones', () => {
    const dup = { id: 'u1', displayName: 'Dup', email: 'dup@x.com' };
    const result = mergeAccessUsers({
      superadmin: [dup],
      viewer: [dup],
      leader: [dup],
    });
    expect(result).toEqual([{ uid: 'u1', displayName: 'Dup', email: 'dup@x.com', role: 'superadmin' }]);
  });

  it('viewer gana a leader si no hay superadmin en el conflicto', () => {
    const dup = { id: 'u1', displayName: 'Dup', email: 'dup@x.com' };
    const result = mergeAccessUsers({
      superadmin: [],
      viewer: [dup],
      leader: [dup],
    });
    expect(result[0].role).toBe('viewer');
  });

  it('colecciones vacías o ausentes devuelven lista vacía', () => {
    expect(mergeAccessUsers({ superadmin: [], viewer: [], leader: [] })).toEqual([]);
  });
});
