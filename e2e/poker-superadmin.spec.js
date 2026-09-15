/**
 * Un superadmin que NO lidera equipo puede convocar una estimación
 * (RMR-BUG-0114).
 *
 * El cliente le ofrecía el botón —el glue da `canManage` a quien gobierna la
 * instancia— pero las reglas solo dejaban crear a quien lidera o gestiona la
 * herramienta por política. Botón que promete y Firestore que deniega: el
 * desajuste clásico entre lo que la UI ofrece y lo que la regla permite.
 *
 * El superadmin de las fixtures no está en /leaders, así que es exactamente el
 * caso del bug.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const NOMBRE = 'Estimación del superadmin E2E';

test.afterEach(async () => {
  const snap = await db().collection('pokerSessions').where('name', '==', NOMBRE).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
});

test('el superadmin sin equipo convoca una sesión y queda creada', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/poker');

  await page.getByPlaceholder(/Nombre de la sesión/).fill(NOMBRE);
  await page.getByRole('button', { name: 'Crear sesión' }).click();

  // Si las reglas lo deniegan, la sesión no llega a existir.
  await expect.poll(async () => {
    const snap = await db().collection('pokerSessions').where('name', '==', NOMBRE).get();
    return snap.docs[0]?.data() ?? null;
  }, { timeout: 15_000 }).not.toBeNull();

  const snap = await db().collection('pokerSessions').where('name', '==', NOMBRE).get();
  // Queda como suya: quien convoca es el dueño, también siendo superadmin.
  expect(snap.docs[0].data().ownerLeaderUid).toBe('e2e-superadmin');
});
