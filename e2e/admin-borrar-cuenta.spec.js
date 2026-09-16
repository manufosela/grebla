/**
 * Borrar una cuenta sin ficha desde el panel (RMR-TSK-0520).
 *
 * Quien no debería estar en la instancia deja de existir: se borra su login
 * (/users) y su usuario de Firebase Auth, por Cloud Function y solo tras
 * confirmar. La CF rechaza cuentas con ficha o rol: eso se quita por su camino.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { test, expect, signInAs } from './fixtures.js';

function init() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return { db: getFirestore(), auth: getAuth() };
}

const UID = 'e2e-condenada';
const NOMBRE = 'Cuenta Condenada';

test.beforeEach(async () => {
  const { db, auth } = init();
  try { await auth.createUser({ uid: UID, email: 'condenada@e2e.test' }); }
  catch (e) { if (e.code !== 'auth/uid-already-exists') throw e; }
  await db.doc(`users/${UID}`).set({ displayName: NOMBRE, email: 'condenada@e2e.test', lastLogin: new Date() });
});

test.afterEach(async () => {
  const { db, auth } = init();
  await db.doc(`users/${UID}`).delete();
  try { await auth.deleteUser(UID); } catch { /* ya borrada por el test */ }
});

const fila = (page, nombre) => page.locator('superadmin-panel tr', { hasText: nombre });

test('el superadmin borra una cuenta sin ficha: desaparece de la lista, de /users y de Auth', async ({ page }) => {
  const { db, auth } = init();
  await signInAs(page, 'superadmin');
  await page.goto('/admin#users');

  const f = fila(page, NOMBRE);
  await expect(f).toBeVisible();
  await f.getByRole('button', { name: 'Borrar cuenta' }).click();
  // Confirmación antes de tocar nada.
  await expect(f).toContainText('¿Borrar la cuenta?');
  await f.getByRole('button', { name: 'No' }).click();
  expect((await db.doc(`users/${UID}`).get()).exists).toBe(true);

  await f.getByRole('button', { name: 'Borrar cuenta' }).click();
  await f.getByRole('button', { name: 'Sí, borrar' }).click();
  await expect(fila(page, NOMBRE)).toHaveCount(0);
  await expect(page.locator('superadmin-panel')).toContainText('Cuenta borrada.');

  await expect.poll(async () => (await db.doc(`users/${UID}`).get()).exists, { timeout: 15_000 }).toBe(false);
  await expect(auth.getUser(UID)).rejects.toMatchObject({ code: 'auth/user-not-found' });
});
