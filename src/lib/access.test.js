/**
 * Tests de `resolveAccess`, que es QUIEN DECIDE qué es cada usuario en la
 * instancia (RMR-TSK-0444). Se cubre aquí porque un fallo no se ve: nadie recibe
 * un error, simplemente alguien ve de más o de menos. Y porque tiene un paso con
 * EFECTO —`sealInvite`, una Cloud Function— que debe dispararse en un caso muy
 * concreto y en ninguno más.
 *
 * La IO de Firestore va con mocks de módulo: lo que se prueba es la decisión, no
 * que la query funcione. `doc()` devuelve un identificador de la colección pedida
 * y `getDoc()` responde según la pertenencia del caso, así que se puede describir
 * cada situación como «está en estas colecciones».
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

/** Colecciones en las que está el usuario del caso en curso. */
let membership = new Set();
/** Persona vinculada que devuelve getMyPerson, o null. */
let person = null;

const getMyPerson = vi.fn(async () => person);
const sealInvite = vi.fn(async () => false);

vi.mock('./firebase.js', () => ({ db: {}, app: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (_db, collectionName) => ({ collectionName }),
  getDoc: async (ref) => ({ exists: () => membership.has(ref.collectionName) }),
}));
vi.mock('./engineer.js', () => ({
  getMyPerson: (uid) => getMyPerson(uid),
  sealInvite: () => sealInvite(),
}));

const { resolveAccess, resolveViews } = await import('./access.js');

const user = { uid: 'uid-1' };

beforeEach(() => {
  membership = new Set();
  person = null;
  getMyPerson.mockClear();
  sealInvite.mockClear();
});

describe('resolveAccess — los dos ejes', () => {
  it('sin usuario no resuelve nada y NO toca la Cloud Function', async () => {
    expect(await resolveAccess(null)).toEqual({ uid: null, functionalRole: null, instanceAccess: null });
    expect(sealInvite).not.toHaveBeenCalled();
  });

  it('un superadmin tiene gobierno de instancia', async () => {
    membership = new Set(['admins']);
    const access = await resolveAccess(user);
    expect(access.instanceAccess).toBe('admin');
  });

  it('un líder con ficha lleva su personId además del rol funcional', async () => {
    membership = new Set(['leaders']);
    person = { id: 'person-7' };
    const access = await resolveAccess(user);
    expect(access).toMatchObject({ uid: 'uid-1', functionalRole: 'leader', personId: 'person-7' });
  });

  it('el supermanager manda sobre el líder cuando está en las dos colecciones', async () => {
    membership = new Set(['supermanagers', 'leaders']);
    expect((await resolveAccess(user)).functionalRole).toBe('supermanager');
  });

  it('un viewer es viewer: no arrastra faceta funcional aunque esté en /leaders', async () => {
    // Regla de negocio explícita: «Un viewer no puede ser nunca líder. Un viewer
    // es viewer, alguien a quien se le permite ver» (2026-08-18). Sin este test,
    // devolverle el rol de líder a un viewer no rompería nada visible: le daría
    // acceso de gestión a quien solo debía mirar.
    membership = new Set(['viewers', 'leaders']);
    const access = await resolveAccess(user);
    expect(access.instanceAccess).toBe('viewer');
    expect(access.functionalRole).toBeNull();
  });

  it('el gobierno y el rol funcional son ortogonales: un admin conserva su faceta de líder', async () => {
    membership = new Set(['admins', 'leaders']);
    const access = await resolveAccess(user);
    expect(access).toMatchObject({ instanceAccess: 'admin', functionalRole: 'leader' });
  });
});

describe('resolveAccess — el paso con efecto (sellar la invitación)', () => {
  it('sin ningún acceso lo intenta, y si sella queda como ingeniero con su ficha', async () => {
    sealInvite.mockResolvedValueOnce(true);
    getMyPerson.mockResolvedValueOnce(null);            // aún no vinculada
    getMyPerson.mockResolvedValueOnce({ id: 'person-9' }); // ya sellada
    const access = await resolveAccess(user);
    expect(sealInvite).toHaveBeenCalledTimes(1);
    expect(access).toMatchObject({ functionalRole: 'engineer', personId: 'person-9' });
  });

  it('si no había invitación que sellar, se queda sin acceso y no inventa persona', async () => {
    const access = await resolveAccess(user);
    expect(sealInvite).toHaveBeenCalledTimes(1);
    expect(access).toMatchObject({ functionalRole: null, instanceAccess: null });
    expect(access.personId).toBeUndefined();
  });

  it('quien YA tiene acceso no dispara la Cloud Function', async () => {
    // El caso que más importa: `sealInvite` es el único paso con efecto de toda
    // la resolución. Si un día la condición se relaja, se llamaría en cada login
    // de cada usuario sin que nada fallara a la vista.
    for (const collectionName of ['admins', 'viewers', 'supermanagers', 'leaders']) {
      sealInvite.mockClear();
      membership = new Set([collectionName]);
      await resolveAccess(user);
      expect(sealInvite, `no debe sellar para ${collectionName}`).not.toHaveBeenCalled();
    }
    // Y tampoco quien solo tiene ficha de persona.
    sealInvite.mockClear();
    membership = new Set();
    person = { id: 'person-3' };
    await resolveAccess(user);
    expect(sealInvite).not.toHaveBeenCalled();
  });
});

describe('resolveViews', () => {
  it('ofrece las vistas de los dos ejes: el admin que lidera conserva la de manager', async () => {
    // El gobierno no debe tapar la faceta funcional: por eso «gestion» y
    // «manager» conviven en el conmutador de vistas.
    membership = new Set(['admins', 'leaders']);
    const { views } = await resolveViews(user);
    expect(views).toEqual(['gestion', 'manager', 'engineer']);
  });

  it('un líder sin gobierno no ve la vista de gestión', async () => {
    membership = new Set(['leaders']);
    expect((await resolveViews(user)).views).toEqual(['manager', 'engineer']);
  });

  it('sin usuario no ofrece ninguna vista', async () => {
    expect((await resolveViews(null)).views).toEqual([]);
  });
});
