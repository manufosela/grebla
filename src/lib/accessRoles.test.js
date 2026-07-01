import { describe, it, expect } from 'vitest';
import { mergeAccessUsers } from './accessRoles.js';

describe('mergeAccessUsers', () => {
  it('fusiona el directorio /users con los roles y ordena por última conexión', () => {
    const result = mergeAccessUsers({
      users: [
        { id: 'u1', displayName: 'Ana', email: 'ana@x.com', lastLogin: 300 },
        { id: 'u2', displayName: 'Beto', email: 'beto@x.com', lastLogin: 100 },
        { id: 'u3', displayName: 'Cris', email: 'cris@x.com', lastLogin: 200 },
      ],
      superadmin: [{ id: 'u1' }],
      viewer: [{ id: 'u2' }],
      leader: [],
    });
    expect(result.map((u) => [u.uid, u.role])).toEqual([
      ['u1', 'superadmin'],
      ['u3', 'none'],
      ['u2', 'viewer'],
    ]);
  });

  it('un usuario registrado sin rol aparece como "none"', () => {
    const result = mergeAccessUsers({
      users: [{ id: 'u1', displayName: 'Sola', email: 's@x.com', lastLogin: 1 }],
    });
    expect(result[0].role).toBe('none');
  });

  it('incluye usuarios con rol aunque no estén en /users (p. ej. sembrados)', () => {
    const result = mergeAccessUsers({
      users: [],
      leader: [{ id: 'seed', displayName: 'Seed', email: 'seed@x.com' }],
    });
    expect(result).toEqual([{ uid: 'seed', displayName: 'Seed', email: 'seed@x.com', lastLogin: null, role: 'leader' }]);
  });

  it('prioriza superadmin > viewer > leader si un uid está en varias colecciones', () => {
    const result = mergeAccessUsers({
      users: [{ id: 'u1', displayName: 'Dup', email: 'dup@x.com', lastLogin: 5 }],
      superadmin: [{ id: 'u1' }],
      viewer: [{ id: 'u1' }],
      leader: [{ id: 'u1' }],
    });
    expect(result[0].role).toBe('superadmin');
  });

  it('soporta lastLogin como Firestore Timestamp (toMillis)', () => {
    const ts = (ms) => ({ toMillis: () => ms });
    const result = mergeAccessUsers({
      users: [
        { id: 'a', lastLogin: ts(10) },
        { id: 'b', lastLogin: ts(50) },
      ],
    });
    expect(result.map((u) => u.uid)).toEqual(['b', 'a']);
  });

  it('grupos vacíos o ausentes devuelven lista vacía', () => {
    expect(mergeAccessUsers({})).toEqual([]);
  });
});
