/**
 * Retros: quien convoca —aunque no sea manager— guarda una acción y elige su
 * responsable entre los participantes (RMR-TSK-0640 y RMR-TSK-0642).
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

const RETRO = 'e2e-retro-responsable';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

test.beforeEach(async () => {
  await db().doc(`retros/${RETRO}`).set({
    name: 'Retro con responsable', format: 'ssc', ownerLeaderUid: 'e2e-engineer',
    memberUids: ['e2e-engineer', 'e2e-stranger'], branchUids: [], joinToken: 'x', status: 'open',
    scope: { type: 'team', squadId: null, label: null }, createdAt: new Date(),
  });
});

test.afterEach(async () => {
  for (const d of (await db().collection('retroActions').where('fromRetroId', '==', RETRO).get()).docs) await d.ref.delete();
  await db().doc(`retros/${RETRO}`).delete().catch(() => {});
});

test('quien convoca guarda la acción con un participante como responsable', async ({ page }) => {
  await signInAs(page, 'engineer');
  await page.goto('/retros');
  await page.getByRole('row', { name: /Retro con responsable/ }).getByRole('button', { name: 'Abrir' }).click();
  await page.getByRole('tab', { name: /Acciones/ }).click();

  const acciones = page.locator('retro-actions');
  await acciones.getByPlaceholder('Nueva acción…').fill('Documentar el despliegue');
  // Los candidatos son los participantes de la retro, también quien no es de su equipo.
  await acciones.getByRole('button', { name: /stranger/i }).click();
  await acciones.getByRole('button', { name: 'Añadir acción' }).click();

  await expect(acciones.getByText('Documentar el despliegue')).toBeVisible();
  const guardadas = (await db().collection('retroActions').where('fromRetroId', '==', RETRO).get()).docs.map((d) => d.data());
  expect(guardadas).toEqual([expect.objectContaining({ owners: ['e2e-stranger'], ownerLeaderUid: 'e2e-engineer' })]);
});
