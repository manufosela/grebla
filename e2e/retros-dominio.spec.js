/**
 * El ámbito de una retro pasa a ser el DOMINIO (RMR-TSK-0498, F5 del ADR).
 *
 * Se elegía «Squad» de un catálogo que ya no es a lo que pertenece la gente.
 * Ahora se elige dominio — y lo que NO puede pasar es que las retros ya
 * convocadas con el ámbito viejo desaparezcan o se rotulen con un nombre que
 * nadie eligió: una retro es un acta de algo que pasó.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const NOMBRE = 'Retro de dominio E2E';
const ANTIGUA = 'Retro antigua por squad E2E';

test.afterEach(async () => {
  for (const nombre of [NOMBRE, ANTIGUA]) {
    const snap = await db().collection('retros').where('name', '==', nombre).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
  await db().doc('domains/e2e-retro-dom').delete();
});

test('se convoca por dominio, y se guarda por su clave', async ({ page }) => {
  await db().doc('domains/e2e-retro-dom').set({ key: 'e2e-retro-dominio', name: 'E2E Dominio de retro' });

  await signInAs(page, 'engineer');
  await page.goto('/retros');
  await page.getByRole('tab', { name: 'Nueva retro' }).click();
  await page.getByPlaceholder('p. ej. Retro Sprint 29').fill(NOMBRE);
  await page.getByRole('radio', { name: 'Dominio', exact: true }).check();
  await page.getByRole('combobox').last().selectOption('e2e-retro-dominio');
  await page.getByRole('button', { name: 'Crear retro' }).click();

  await expect.poll(async () => {
    const snap = await db().collection('retros').where('name', '==', NOMBRE).get();
    return snap.docs[0]?.data()?.scope ?? null;
  }, { timeout: 15_000 }).toMatchObject({ type: 'domain', domainKey: 'e2e-retro-dominio' });
});

test('ya no se puede elegir «Squad»', async ({ page }) => {
  await signInAs(page, 'engineer');
  await page.goto('/retros');
  await page.getByRole('tab', { name: 'Nueva retro' }).click();

  // Los dos ámbitos posibles, leídos del propio bloque: ni uno más ni el viejo.
  const ambito = await page.locator('retro-manager')
    .evaluate((el) => el.shadowRoot?.querySelector('.scope')?.textContent ?? '');
  expect(ambito).toContain('Equipo');
  expect(ambito).toContain('Dominio');
  expect(ambito).not.toContain('Squad');
});

test('una retro de cuando había squads se sigue viendo, y dice de qué squad fue', async ({ page }) => {
  await db().collection('retros').add({
    name: ANTIGUA, format: 'ssc', status: 'open', ownerLeaderUid: 'e2e-engineer',
    memberUids: ['e2e-engineer'], chain: [], createdAt: new Date(),
    scope: { type: 'squad', squadId: 'sq-viejo', label: 'Pagos' },
  });

  await signInAs(page, 'engineer');
  await page.goto('/retros');

  await expect(page.getByText(ANTIGUA)).toBeVisible();
  await expect(page.getByText('Squad · Pagos')).toBeVisible();
});
