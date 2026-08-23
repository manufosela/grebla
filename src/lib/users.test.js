/**
 * Tests de `setUserRole` (RMR-TSK-0444), que reasigna el ROL DE EQUIPO borrando
 * el resto de colecciones para que nadie quede en dos a la vez.
 *
 * Lo que se protege aquí es una decisión que no se ve fallar: los dos ejes son
 * ortogonales, así que cambiar el rol de equipo NO debe tocar `/admins`. Si esa
 * exclusión se rompiera, reasignar a alguien a otro equipo le quitaría el
 * superadmin en silencio — nadie recibiría un error, simplemente dejaría de
 * poder entrar donde entraba.
 *
 * Se registra qué escrituras se piden (colección y tipo), no que Firestore las
 * ejecute: lo que importa es a QUÉ colecciones se toca y a cuáles no.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

/** Escrituras pedidas en el caso en curso: {op, collectionName, uid, data}. */
let writes = [];

vi.mock('./firebase.js', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (_db, collectionName, uid) => ({ collectionName, uid }),
  deleteDoc: async (ref) => { writes.push({ op: 'delete', ...ref }); },
  setDoc: async (ref, data) => { writes.push({ op: 'set', ...ref, data }); },
  serverTimestamp: () => 'AHORA',
  collection: () => ({}),
  addDoc: async () => ({ id: 'nuevo' }),
  getDoc: async () => ({ data: () => ({}), exists: () => false }),
  getDocs: async () => ({ docs: [] }),
  query: () => ({}),
  where: () => ({}),
  limit: () => ({}),
}));

const { setUserRole } = await import('./users.js');

/** Colecciones tocadas por una operación concreta. */
const touched = (op) => writes.filter((w) => w.op === op).map((w) => w.collectionName).sort();

beforeEach(() => { writes = []; });

describe('setUserRole — los dos ejes son ortogonales', () => {
  it('NUNCA toca /admins: cambiar de equipo no quita el superadmin', async () => {
    for (const role of ['leader', 'viewer', 'supermanager', 'none']) {
      writes = [];
      await setUserRole('uid-1', role);
      expect(writes.map((w) => w.collectionName), `rol ${role}`).not.toContain('admins');
    }
  });

  it('rechaza conceder superadmin por esta vía, que se hace con setUserAdmin', async () => {
    await expect(setUserRole('uid-1', 'superadmin')).rejects.toThrow(/setUserAdmin/);
    expect(writes).toEqual([]); // y no deja el usuario a medias
  });

  it('deja al usuario en UNA sola colección: escribe la suya y borra las otras', async () => {
    // Ojo: hay UNA sola escritura. El perfil (displayName/email/addedAt) va
    // DENTRO del documento del rol, no en un documento aparte — por eso aquí se
    // espera exactamente una colección y el test del perfil, más abajo, mira
    // ese mismo write.
    await setUserRole('uid-1', 'leader');
    expect(touched('set')).toEqual(['leaders']);
    expect(touched('delete')).not.toContain('leaders');
    expect(touched('delete').length).toBeGreaterThan(0);
  });

  it('«none» borra todos los roles de equipo y no escribe ninguno', async () => {
    await setUserRole('uid-1', 'none');
    expect(touched('set')).toEqual([]);
    expect(touched('delete').length).toBeGreaterThan(0);
  });

  it('guarda el perfil con el uid correcto y sella la fecha en el servidor', async () => {
    await setUserRole('uid-7', 'viewer', { displayName: 'Ana', email: 'ana@example.com' });
    const written = writes.find((w) => w.op === 'set');
    expect(written).toMatchObject({
      uid: 'uid-7',
      data: { displayName: 'Ana', email: 'ana@example.com', addedAt: 'AHORA' },
    });
  });

  it('sin perfil escribe nulos explícitos, no undefined (Firestore lo rechazaría)', async () => {
    await setUserRole('uid-1', 'leader');
    const { data } = writes.find((w) => w.op === 'set');
    expect(data.displayName).toBeNull();
    expect(data.email).toBeNull();
  });
});
