/**
 * Convocar una retro sin ser manager (RMR-TSK-0455, ADR «Retros por membresía»).
 *
 * Antes solo podían crearlas líderes, superadmin o quien tuviera el permiso en
 * la política. Con el listado por membresía eso deja de hacer falta: que mucha
 * gente convoque no molesta a nadie, porque cada uno solo ve las suyas y
 * aquellas en las que entra.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const NOMBRE = 'Retro convocada por un ingeniero';

test.afterEach(async () => {
  const snap = await db().collection('retros').where('name', '==', NOMBRE).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
});

test('un ingeniero convoca su retro y queda dentro', async ({ page }) => {
  await signInAs(page, 'engineer');
  await page.goto('/retros');

  await page.getByPlaceholder('p. ej. Retro Sprint 29').fill(NOMBRE);
  await page.getByRole('button', { name: 'Crear retro' }).click();

  await expect.poll(async () => {
    const snap = await db().collection('retros').where('name', '==', NOMBRE).get();
    return snap.docs[0]?.data() ?? null;
  }, { timeout: 15_000 }).not.toBeNull();

  const snap = await db().collection('retros').where('name', '==', NOMBRE).get();
  const retro = snap.docs[0].data();
  // Quien convoca entra dentro y la retro nace con su secreto para compartir.
  expect(retro.memberUids).toContain('e2e-engineer');
  expect(retro.joinToken).toBeTruthy();
});

test('la pantalla dice quién más puede ver las retros', async ({ page }) => {
  await signInAs(page, 'engineer');
  await page.goto('/retros');
  // Por rol y sin nombres propios: es lo que hace creíble la promesa.
  await expect(page.getByText(/quienes entran por su enlace/i)).toBeVisible();
  await expect(page.getByText(/la administración/i)).toBeVisible();
});
