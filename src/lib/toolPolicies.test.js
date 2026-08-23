/**
 * Tests de la capa de acceso a /toolPolicies (RMR-TSK-0444). La decisión de
 * quién ve qué herramienta vive en el módulo puro `toolAccess.js`, que ya está
 * cubierto; lo que se protege aquí es lo que ese módulo RECIBE.
 *
 * Dos cosas que no fallan de forma visible: que un doc a medias llegue con
 * campos `undefined` en vez de con los objetos vacíos que el decisor espera, y
 * que guardar una política pise el resto de campos del documento.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

/** Documentos que devuelve la colección en el caso en curso. */
let docs = [];
/** Escrituras pedidas: {collectionName, id, data, options}. */
let writes = [];

vi.mock('./firebase.js', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (_db, collectionName) => ({ collectionName }),
  doc: (_db, collectionName, id) => ({ collectionName, id }),
  getDocs: async (ref) => ({ docs: docs.map((d) => ({ id: d.id, data: () => d.data })) , ...ref }),
  setDoc: async (ref, data, options) => { writes.push({ ...ref, data, options }); },
  serverTimestamp: () => 'AHORA',
}));

const { listToolPolicies, saveToolPolicy } = await import('./toolPolicies.js');

beforeEach(() => { docs = []; writes = []; });

describe('listToolPolicies — lo que recibe el decisor de acceso', () => {
  it('un documento a medias sale con objetos vacíos, nunca con undefined', async () => {
    // `toolAccess.js` lee `audience` y `managedBy`; si llegaran sin definir, la
    // decisión de acceso reventaría en vez de denegar.
    docs = [{ id: 'dora', data: {} }];
    expect(await listToolPolicies()).toEqual([
      { toolId: 'dora', label: 'dora', audience: {}, managedBy: {} },
    ]);
  });

  it('sin label usa el id de la herramienta, que siempre existe', async () => {
    docs = [{ id: 'lean', data: { audience: { everyone: true } } }];
    const [policy] = await listToolPolicies();
    expect(policy.label).toBe('lean');
    expect(policy.audience).toEqual({ everyone: true });
  });

  it('respeta los valores presentes y arrastra el id como toolId', async () => {
    docs = [{ id: 'poker', data: { label: 'Scrum Poker', audience: { roles: ['leader'] }, managedBy: { uids: ['u1'] } } }];
    expect(await listToolPolicies()).toEqual([
      { toolId: 'poker', label: 'Scrum Poker', audience: { roles: ['leader'] }, managedBy: { uids: ['u1'] } },
    ]);
  });

  it('sin políticas devuelve lista vacía, no revienta', async () => {
    expect(await listToolPolicies()).toEqual([]);
  });
});

describe('saveToolPolicy — guardar sin pisar lo que no se toca', () => {
  it('escribe con merge: cambiar la audiencia no borra el label', async () => {
    await saveToolPolicy('dora', { audience: { everyone: true } });
    expect(writes).toHaveLength(1);
    expect(writes[0].options).toEqual({ merge: true });
    expect(writes[0].data).not.toHaveProperty('label');
  });

  it('no manda claves sin definir: Firestore rechaza undefined', async () => {
    await saveToolPolicy('dora', { label: undefined, audience: { everyone: false }, managedBy: undefined });
    const { data } = writes[0];
    expect(Object.keys(data).sort()).toEqual(['audience', 'updatedAt']);
    expect(Object.values(data)).not.toContain(undefined);
  });

  it('sella la fecha en el servidor, no con la hora del navegador', async () => {
    await saveToolPolicy('lean', { label: 'LEAN' });
    expect(writes[0].data.updatedAt).toBe('AHORA');
    expect(writes[0].id).toBe('lean');
  });

  it('un valor vacío a propósito SÍ se guarda: quitar la audiencia es una acción', async () => {
    // `{}` no es lo mismo que «no lo toques»: significa «sin audiencia».
    await saveToolPolicy('dora', { audience: {} });
    expect(writes[0].data.audience).toEqual({});
  });
});
