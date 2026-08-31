/**
 * E2E de los CALLABLES contra el emulador (RMR-BUG-0102).
 *
 * Los callables se pedían con `getFunctions(app, 'europe-west1')`, que apunta
 * siempre a producción: con los emuladores levantados la llamada salía hacia el
 * proyecto real y no llegaba nunca. `sealInvite` lo hacía además en silencio
 * —se traga la excepción y devuelve false—, así que nadie se enteró en meses.
 *
 * Aquí se comprueba de verdad, de punta a punta: alguien invitado por email
 * entra por primera vez y su ficha queda sellada con su uid. Si el callable no
 * llegara al emulador, la ficha se quedaría con su pendingEmail.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect } from './fixtures.js';

function admin() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return { db: getFirestore(), auth: getAuth() };
}

const UID = 'e2e-invitado';
const EMAIL = 'invitado@e2e.test';

test('a quien entra por primera vez se le sella la invitación', async ({ page }) => {
  const { db, auth } = admin();
  try { await auth.createUser({ uid: UID, email: EMAIL }); }
  catch (e) { if (e.code !== 'auth/uid-already-exists') throw e; }
  // Sin rol ninguno: es la única situación en la que se intenta sellar.
  await db.doc('people/e2e-invitado-persona').set({
    name: 'Invitada E2E', uid: null, pendingEmail: EMAIL, ownerLeaderUid: 'e2e-manager', active: true,
  });

  try {
    const token = await auth.createCustomToken(UID);
    await page.goto('/login');
    await page.waitForFunction(() => typeof (window).__e2eSignIn === 'function');
    await page.evaluate((t) => (window).__e2eSignIn(t), token);
    await page.waitForFunction((u) => (window).__e2eUid?.() === u, UID, { timeout: 15_000 });
    // Sin rol ninguno la home no deja rastro en pantalla (landing pública), así
    // que la señal de que entró es el efecto en su ficha, no lo que se pinte.
    await page.goto('/');

    await expect.poll(async () => {
      const d = (await db.doc('people/e2e-invitado-persona').get()).data();
      return { uid: d?.uid ?? null, pendiente: d?.pendingEmail ?? null };
    }, { timeout: 20_000 }).toEqual({ uid: UID, pendiente: null });
  } finally {
    await db.doc('people/e2e-invitado-persona').delete();
    await auth.deleteUser(UID).catch(() => {});
  }
});
