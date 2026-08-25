/**
 * Entrar en una retro por su enlace (RMR-TSK-0454, ADR «Retros por membresía»).
 *
 * Es la pieza que sustituye a «marcar personas una a una»: se comparte el enlace
 * y quien lo abre queda dentro. Aquí se comprueba lo que de verdad importa —
 * que el enlace mete, que el id a secas no, y que abrirlo dos veces no rompe
 * nada— contra el emulador y con la función real, no con mocks.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

// Se genera en cada corrida en vez de dejar una constante con pinta de secreto:
// un literal así lo marca el escáner de credenciales, y con razón — un secreto
// de verdad escrito en el repo sería indistinguible de este.
const TOKEN = `e2e-${crypto.randomUUID()}`;
const RETRO = 'e2e-retro-link';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

/** Una retro a la que el ingeniero NO pertenece todavía. */
test.beforeEach(async () => {
  await db().doc(`retros/${RETRO}`).set({
    name: 'Retro por enlace',
    ownerLeaderUid: 'e2e-manager',
    memberUids: ['e2e-manager'],
    branchUids: [],
    joinToken: TOKEN,
    status: 'open',
    scope: { type: 'team', squadId: null, label: null },
    createdAt: new Date(),
  });
});

test.afterEach(async () => {
  await db().doc(`retros/${RETRO}`).delete().catch(() => {});
});

/** Quiénes están dentro de la retro, según Firestore. */
const dentro = async () => (await db().doc(`retros/${RETRO}`).get()).data()?.memberUids ?? [];

test('abrir el enlace mete a quien no estaba', async ({ page }) => {
  expect(await dentro()).not.toContain('e2e-engineer');

  await signInAs(page, 'engineer');
  await page.goto(`/retro?id=${RETRO}&join=${TOKEN}`);

  await expect.poll(dentro, { timeout: 15_000 }).toContain('e2e-engineer');
});

test('el id sin token no da acceso', async ({ page }) => {
  await signInAs(page, 'engineer');
  await page.goto(`/retro?id=${RETRO}`);

  // Ni entra en la lista ni ve la retro: le sale el aviso de sin acceso.
  await expect(page.locator('#retro-status')).toContainText(/acceso|no existe/i, { timeout: 15_000 });
  expect(await dentro()).not.toContain('e2e-engineer');
});

test('un token que no vale tampoco', async ({ page }) => {
  await signInAs(page, 'engineer');
  await page.goto(`/retro?id=${RETRO}&join=token-inventado`);

  await expect(page.locator('#retro-status')).toContainText(/acceso|no existe/i, { timeout: 15_000 });
  expect(await dentro()).not.toContain('e2e-engineer');
});

test('abrir el enlace dos veces no duplica a nadie', async ({ page }) => {
  await signInAs(page, 'engineer');
  await page.goto(`/retro?id=${RETRO}&join=${TOKEN}`);
  await expect.poll(dentro, { timeout: 15_000 }).toContain('e2e-engineer');

  await page.goto(`/retro?id=${RETRO}&join=${TOKEN}`);
  await page.waitForTimeout(2000);
  const miembros = await dentro();
  expect(miembros.filter((uid) => uid === 'e2e-engineer')).toHaveLength(1);
});
