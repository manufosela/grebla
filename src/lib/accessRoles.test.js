import { describe, it, expect } from 'vitest';
import { ROLE_COLLECTION, accessAxes, accessLabel, branchScopeFor, canGovern, hasAccess, leaderChainsFrom, leadsTeam, leadersReportingTo, mergeAccessUsers, unlinkedUsers, viewAll, viewsFor } from './accessRoles.js';

describe('viewsFor (RMR-TSK-0304: vistas desde los dos ejes)', () => {
  it('un admin que además es líder conserva las tres vistas', () => {
    expect(viewsFor({ instanceAccess: 'admin', functionalRole: 'leader' })).toEqual(['gestion', 'manager', 'engineer']);
  });

  it('un admin puro (sin rol funcional) también tiene las tres', () => {
    expect(viewsFor({ instanceAccess: 'admin', functionalRole: null })).toEqual(['gestion', 'manager', 'engineer']);
  });

  it('un viewer puro solo ve el panel', () => {
    expect(viewsFor({ instanceAccess: 'viewer', functionalRole: null })).toEqual(['gestion']);
  });

  it('el viewer solo tiene el panel: «un viewer es viewer», sin faceta funcional', () => {
    // La combinación viewer+líder no existe: accessAxes la anula en origen.
    expect(viewsFor(accessAxes({ viewer: true, leader: true }))).toEqual(['gestion']);
  });

  it('un líder o head: herramientas + su espacio, sin gestión', () => {
    expect(viewsFor({ instanceAccess: null, functionalRole: 'leader' })).toEqual(['manager', 'engineer']);
    expect(viewsFor({ instanceAccess: null, functionalRole: 'supermanager' })).toEqual(['manager', 'engineer']);
  });

  it('un ingeniero: solo su espacio; sin nada: ninguna', () => {
    expect(viewsFor({ instanceAccess: null, functionalRole: 'engineer' })).toEqual(['engineer']);
    expect(viewsFor({ instanceAccess: null, functionalRole: null })).toEqual([]);
  });
});

describe('viewAll y canGovern', () => {
  it('viewAll cuando hay gobierno (admin o viewer ven todo)', () => {
    expect(viewAll({ instanceAccess: 'admin' })).toBe(true);
    expect(viewAll({ instanceAccess: 'viewer' })).toBe(true);
    expect(viewAll({ instanceAccess: null })).toBe(false);
  });

  it('canGovern solo el admin (escribe/gestiona la instancia)', () => {
    expect(canGovern({ instanceAccess: 'admin' })).toBe(true);
    expect(canGovern({ instanceAccess: 'viewer' })).toBe(false);
    expect(canGovern({ instanceAccess: null })).toBe(false);
  });
});

describe('accessAxes (RMR-TSK-0303: dos ejes ortogonales)', () => {
  it('separa gobierno (instanceAccess) del rol funcional (functionalRole)', () => {
    // Un admin que además es líder: gobierna Y tiene su equipo, sin que ninguna
    // faceta aplaste a la otra (el rol derivado se retiró en RMR-TSK-0310).
    expect(accessAxes({ admin: true, leader: true })).toEqual({
      instanceAccess: 'admin', functionalRole: 'leader',
    });
  });

  it('un líder normal: solo eje funcional', () => {
    expect(accessAxes({ leader: true })).toEqual({
      instanceAccess: null, functionalRole: 'leader',
    });
  });

  it('un admin con ficha de ingeniero conserva su faceta funcional', () => {
    expect(accessAxes({ admin: true, engineer: true })).toEqual({
      instanceAccess: 'admin', functionalRole: 'engineer',
    });
  });

  it('el rol funcional prioriza supermanager > leader > engineer', () => {
    expect(accessAxes({ supermanager: true, leader: true, engineer: true }).functionalRole).toBe('supermanager');
    expect(accessAxes({ leader: true, engineer: true }).functionalRole).toBe('leader');
    expect(accessAxes({ engineer: true }).functionalRole).toBe('engineer');
  });

  it('«un viewer es viewer»: anula cualquier faceta funcional (regla 2026-08-18)', () => {
    expect(accessAxes({ viewer: true, leader: true })).toEqual({ instanceAccess: 'viewer', functionalRole: null });
    expect(accessAxes({ viewer: true, supermanager: true })).toEqual({ instanceAccess: 'viewer', functionalRole: null });
    expect(accessAxes({ viewer: true, engineer: true })).toEqual({ instanceAccess: 'viewer', functionalRole: null });
    // El admin NO es viewer: conserva su faceta funcional aunque esté en /viewers.
    expect(accessAxes({ admin: true, viewer: true, leader: true }).functionalRole).toBe('leader');
  });

  it('admin gana a viewer en el eje de gobierno', () => {
    expect(accessAxes({ admin: true, viewer: true }).instanceAccess).toBe('admin');
    expect(accessAxes({ viewer: true }).instanceAccess).toBe('viewer');
  });

  it('sin ninguna pertenencia, ambos ejes son null', () => {
    expect(accessAxes({})).toEqual({ instanceAccess: null, functionalRole: null });
  });
});

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
    expect(result).toEqual([{
      uid: 'seed', displayName: 'Seed', email: 'seed@x.com', lastLogin: null,
      role: 'leader', teamRole: 'leader', isAdmin: false, isSurveyAdmin: false,
    }]);
  });

  it('expone el gestor de encuestas (isSurveyAdmin) como eje ortogonal', () => {
    const [u] = mergeAccessUsers({
      users: [{ id: 'p', displayName: 'P', email: 'p@x.com' }],
      surveyAdmin: [{ id: 'p' }],
    });
    expect(u.isSurveyAdmin).toBe(true);
    expect(u.isAdmin).toBe(false);
    expect(u.teamRole).toBe('none');
  });

  it('expone los dos ejes por separado: isAdmin (gobierno) y teamRole (equipo)', () => {
    // RMR-TSK-0313: un admin que además es manager conserva su rol de equipo en
    // teamRole, y el gobierno en isAdmin — independientes; role queda derivado.
    const [adminLeader] = mergeAccessUsers({ users: [{ id: 'u1', lastLogin: 5 }], superadmin: [{ id: 'u1' }], leader: [{ id: 'u1' }] });
    expect(adminLeader).toMatchObject({ role: 'superadmin', teamRole: 'leader', isAdmin: true });
    const [pureAdmin] = mergeAccessUsers({ users: [{ id: 'u2', lastLogin: 5 }], superadmin: [{ id: 'u2' }] });
    expect(pureAdmin).toMatchObject({ role: 'superadmin', teamRole: 'none', isAdmin: true });
    const [pureLeader] = mergeAccessUsers({ users: [{ id: 'u3', lastLogin: 5 }], leader: [{ id: 'u3' }] });
    expect(pureLeader).toMatchObject({ role: 'leader', teamRole: 'leader', isAdmin: false });
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

describe('leaderChainsFrom — cadenas de ancestros para las reglas (RMR-TSK-0421)', () => {
  it('cada líder lleva TODOS sus ancestros, del más cercano al más lejano', () => {
    const leaders = [
      { uid: 'head', reportsTo: null },
      { uid: 'em1', reportsTo: 'head' },
      { uid: 'em2', reportsTo: 'em1' },
    ];
    const chains = leaderChainsFrom(leaders);
    expect(chains.get('head')).toEqual([]);
    expect(chains.get('em1')).toEqual(['head']);
    expect(chains.get('em2')).toEqual(['em1', 'head']);
  });

  it('un ciclo accidental en los datos termina sin colgarse ni duplicar', () => {
    const leaders = [
      { uid: 'a', reportsTo: 'b' },
      { uid: 'b', reportsTo: 'a' },
    ];
    const chains = leaderChainsFrom(leaders);
    expect(chains.get('a')).toEqual(['b']);
    expect(chains.get('b')).toEqual(['a']);
  });

  it('un reportsTo hacia alguien que no es líder corta la cadena ahí (pero se incluye)', () => {
    // El jefe puede ser un uid sin doc en /leaders (p. ej. un CPO): entra en la
    // cadena (él autoriza), pero no se puede seguir subiendo desde él.
    const chains = leaderChainsFrom([{ uid: 'em', reportsTo: 'cpo-uid' }]);
    expect(chains.get('em')).toEqual(['cpo-uid']);
  });

  it('docs con id (además de uid), sin identificador, o lista vacía', () => {
    const chains = leaderChainsFrom([{ id: 'l1', reportsTo: 'h' }, { reportsTo: 'h' }]);
    expect(chains.get('l1')).toEqual(['h']);
    expect(chains.size).toBe(1);
    expect(leaderChainsFrom(undefined).size).toBe(0);
  });
});

describe('branchScopeFor — alcance de rama generalizado (RMR-TSK-0421)', () => {
  const leaders = [
    { uid: 'em1', reportsTo: 'lead' },
    { uid: 'em2', reportsTo: 'em1' },
    { uid: 'ajeno', reportsTo: 'otro' },
  ];

  it('líder con subárbol → [él, ...su rama transitiva]', () => {
    expect(branchScopeFor({ functionalRole: 'leader' }, leaders, 'lead')).toEqual(['lead', 'em1', 'em2']);
    expect(branchScopeFor({ functionalRole: 'supermanager' }, leaders, 'lead')).toEqual(['lead', 'em1', 'em2']);
  });

  it('líder sin nadie que le reporte → null (ámbito simple de siempre)', () => {
    expect(branchScopeFor({ functionalRole: 'leader' }, leaders, 'em2')).toBe(null);
  });

  it('sin rol de liderazgo → null', () => {
    expect(branchScopeFor({ functionalRole: 'engineer' }, leaders, 'lead')).toBe(null);
    expect(branchScopeFor(null, leaders, 'lead')).toBe(null);
  });
});

describe('predicados de ejes (RMR-TSK-0310) — adiós al role derivado', () => {
  it('leadsTeam: lidera equipo quien es leader o supermanager, gobierne o no', () => {
    expect(leadsTeam({ functionalRole: 'leader' })).toBe(true);
    expect(leadsTeam({ functionalRole: 'supermanager', instanceAccess: 'admin' })).toBe(true);
    expect(leadsTeam({ functionalRole: 'engineer' })).toBe(false);
    expect(leadsTeam({ instanceAccess: 'admin' })).toBe(false);
    expect(leadsTeam(null)).toBe(false);
  });

  it('hasAccess: cualquiera de los dos ejes da acceso; sin ninguno, no', () => {
    expect(hasAccess({ instanceAccess: 'viewer', functionalRole: null })).toBe(true);
    expect(hasAccess({ instanceAccess: null, functionalRole: 'engineer' })).toBe(true);
    expect(hasAccess({ instanceAccess: null, functionalRole: null })).toBe(false);
    expect(hasAccess(null)).toBe(false);
  });

  it('accessLabel: etiqueta legible desde los ejes (gobierno primero, luego el funcional)', () => {
    expect(accessLabel({ instanceAccess: 'admin', functionalRole: null })).toBe('Superadmin');
    expect(accessLabel({ instanceAccess: 'admin', functionalRole: 'leader' })).toBe('Superadmin · Manager');
    expect(accessLabel({ instanceAccess: 'viewer', functionalRole: null })).toBe('Viewer');
    expect(accessLabel({ instanceAccess: null, functionalRole: 'supermanager' })).toBe('Head');
    expect(accessLabel({ instanceAccess: null, functionalRole: 'leader' })).toBe('Manager');
    expect(accessLabel({ instanceAccess: null, functionalRole: 'engineer' })).toBe('Ingeniero/a');
    expect(accessLabel({ instanceAccess: null, functionalRole: null })).toBe(null);
  });
});
