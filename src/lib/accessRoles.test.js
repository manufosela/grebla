import { describe, it, expect } from 'vitest';
import { ROLE_COLLECTION, leadersReportingTo, mergeAccessUsers, unlinkedUsers, viewsForRole } from './accessRoles.js';

describe('ROLE_COLLECTION', () => {
  it('incluye la colección del supermanager, para que el panel pueda concederlo', () => {
    // RMR-TSK-0295: setUserRole se guía por este mapa; sin la entrada, el rol
    // solo se podía dar creando /supermanagers/{uid} a mano en Firestore.
    expect(ROLE_COLLECTION.supermanager).toBe('supermanagers');
  });

  it('mantiene las colecciones de los roles anteriores', () => {
    expect(ROLE_COLLECTION.superadmin).toBe('admins');
    expect(ROLE_COLLECTION.viewer).toBe('viewers');
    expect(ROLE_COLLECTION.leader).toBe('leaders');
  });
});

describe('viewsForRole', () => {
  it('el superadmin recibe SIEMPRE las tres vistas (gestión, herramientas, ingeniero)', () => {
    // Regresión RMR-BUG-0050: antes solo veía «manager» (herramientas) si además
    // era líder de un equipo; ahora las tiene siempre (viewAll en cada tool).
    expect(viewsForRole('superadmin')).toEqual(['gestion', 'manager', 'engineer']);
  });

  it('el líder conmuta entre manager (herramientas) e ingeniero', () => {
    expect(viewsForRole('leader')).toEqual(['manager', 'engineer']);
  });

  it('el supermanager (Head of X) ve las herramientas de su rama y el preview de ingeniero, sin gestión', () => {
    // RMR-TSK-0291: opera su rama de EMs (como un líder ampliado), pero NO
    // administra la organización → mismas vistas que el líder, sin «gestion».
    expect(viewsForRole('supermanager')).toEqual(['manager', 'engineer']);
  });

  it('el viewer solo tiene gestión (sin conmutador)', () => {
    expect(viewsForRole('viewer')).toEqual(['gestion']);
  });

  it('el ingeniero solo tiene su propio espacio', () => {
    expect(viewsForRole('engineer')).toEqual(['engineer']);
  });

  it('sin rol no hay ninguna vista', () => {
    expect(viewsForRole(null)).toEqual([]);
    expect(viewsForRole(undefined)).toEqual([]);
  });
});

describe('leadersReportingTo', () => {
  it('devuelve los uids de los líderes cuyo reportsTo es ese supermanager', () => {
    const leaders = [
      { uid: 'l1', reportsTo: 'head1' },
      { uid: 'l2', reportsTo: 'head2' },
      { uid: 'l3', reportsTo: 'head1' },
      { uid: 'l4', reportsTo: null },
    ];
    expect(leadersReportingTo(leaders, 'head1')).toEqual(['l1', 'l3']);
  });

  it('acepta docs con id (además de uid) y descarta los que no tienen identificador', () => {
    const leaders = [{ id: 'l1', reportsTo: 'h' }, { reportsTo: 'h' }];
    expect(leadersReportingTo(leaders, 'h')).toEqual(['l1']);
  });

  it('sin supermanager o sin líderes devuelve lista vacía', () => {
    expect(leadersReportingTo([{ uid: 'l1', reportsTo: 'h' }], '')).toEqual([]);
    expect(leadersReportingTo(undefined, 'h')).toEqual([]);
  });

  it('incluye la rama completa a cualquier profundidad (cierre transitivo)', () => {
    // RMR-TSK-0293: una organización real encadena dirección → jefe de
    // departamento → manager. La rama de un Head son TODOS los que cuelgan de
    // él, no solo el primer salto.
    const leaders = [
      { uid: 'em1', reportsTo: 'head1' },
      { uid: 'em2', reportsTo: 'em1' },
      { uid: 'em3', reportsTo: 'em2' },
      { uid: 'ajeno', reportsTo: 'head2' },
    ];
    expect(leadersReportingTo(leaders, 'head1')).toEqual(['em1', 'em2', 'em3']);
  });

  it('no arrastra la rama de otro head que cuelga en paralelo', () => {
    const leaders = [
      { uid: 'a1', reportsTo: 'head1' },
      { uid: 'b1', reportsTo: 'head2' },
      { uid: 'b2', reportsTo: 'b1' },
    ];
    expect(leadersReportingTo(leaders, 'head1')).toEqual(['a1']);
  });

  it('no se cuelga ante un ciclo accidental en reportsTo ni se incluye a sí mismo', () => {
    // Dato corrupto: head1 → em1 → em2 → head1. Debe terminar y no devolver al
    // propio supermanager (su alcance ya incluye lo suyo por otra vía).
    const leaders = [
      { uid: 'em1', reportsTo: 'head1' },
      { uid: 'em2', reportsTo: 'em1' },
      { uid: 'head1', reportsTo: 'em2' },
    ];
    expect(leadersReportingTo(leaders, 'head1')).toEqual(['em1', 'em2']);
  });

  it('devuelve cada uid una sola vez aunque el doc esté duplicado', () => {
    const leaders = [
      { uid: 'em1', reportsTo: 'head1' },
      { uid: 'em1', reportsTo: 'head1' },
      { uid: 'em2', reportsTo: 'em1' },
    ];
    expect(leadersReportingTo(leaders, 'head1')).toEqual(['em1', 'em2']);
  });
});

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

  it('el supermanager gana al viewer y al leader, y pierde contra el superadmin', () => {
    const roleOf = (groups) => mergeAccessUsers(groups)[0].role;
    expect(roleOf({ users: [{ id: 'u1' }], supermanager: [{ id: 'u1' }], leader: [{ id: 'u1' }] })).toBe('supermanager');
    expect(roleOf({ users: [{ id: 'u1' }], supermanager: [{ id: 'u1' }], viewer: [{ id: 'u1' }] })).toBe('supermanager');
    expect(roleOf({ users: [{ id: 'u1' }], supermanager: [{ id: 'u1' }], superadmin: [{ id: 'u1' }] })).toBe('superadmin');
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

describe('unlinkedUsers', () => {
  it('excluye los usuarios cuyo uid ya está vinculado a una persona', () => {
    const users = [{ uid: 'u1' }, { uid: 'u2' }, { uid: 'u3' }];
    const result = unlinkedUsers(users, ['u2']);
    expect(result.map((u) => u.uid)).toEqual(['u1', 'u3']);
  });

  it('sin vínculos, devuelve todos los usuarios', () => {
    const users = [{ uid: 'u1' }, { uid: 'u2' }];
    expect(unlinkedUsers(users, [])).toEqual(users);
  });

  it('acepta docs de /users (campo id) además de AccessUser (uid)', () => {
    const users = [{ id: 'u1' }, { id: 'u2' }];
    expect(unlinkedUsers(users, new Set(['u1'])).map((u) => u.id)).toEqual(['u2']);
  });

  it('acepta un Set de uids vinculados', () => {
    const users = [{ uid: 'a' }, { uid: 'b' }];
    expect(unlinkedUsers(users, new Set(['b'])).map((u) => u.uid)).toEqual(['a']);
  });

  it('descarta usuarios sin uid ni id (no puede vincularse una cuenta sin identificador)', () => {
    const users = [{ uid: 'a' }, { displayName: 'anónimo' }];
    expect(unlinkedUsers(users, []).map((u) => u.uid)).toEqual(['a']);
  });

  it('lista de usuarios vacía o ausente devuelve lista vacía', () => {
    expect(unlinkedUsers([], ['x'])).toEqual([]);
    expect(unlinkedUsers(undefined, ['x'])).toEqual([]);
  });
});
