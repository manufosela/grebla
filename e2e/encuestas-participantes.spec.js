/**
 * Encuestas › Enlaces (RMR-TSK-0630): el padrón es toda la empresa y la
 * encuesta va a quien se marca. Por defecto no va nadie; se marca un
 * departamento entero y se quita a una persona.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const PADRON = {
  'e2e-pad-ana': { email: 'ana.e2e@example.com', name: 'Ana Padrón', department: 'E2E Tech', active: true },
  'e2e-pad-bea': { email: 'bea.e2e@example.com', name: 'Bea Padrón', department: 'E2E Tech', active: true },
  'e2e-pad-carla': { email: 'carla.e2e@example.com', name: 'Carla Padrón', department: 'E2E People', active: true },
};
const SURVEY = 'e2e-survey-padron';

test.beforeEach(async () => {
  for (const [id, data] of Object.entries(PADRON)) await db().doc(`padron/${id}`).set(data);
  await db().doc(`surveys/${SURVEY}`).set({ title: 'Encuesta E2E del padrón', questions: [], threshold: 5, status: 'draft', createdAt: new Date() });
});

test.afterEach(async () => {
  for (const id of Object.keys(PADRON)) await db().doc(`padron/${id}`).delete();
  for (const t of (await db().collection(`surveys/${SURVEY}/tokens`).get()).docs) await t.ref.delete();
  await db().doc(`surveys/${SURVEY}`).delete();
});

test('se marca un departamento entero, se quita a una persona y solo cuentan las marcadas', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/tools/encuestas');
  const admin = page.locator('survey-admin');
  await admin.getByRole('row', { name: /Encuesta E2E del padrón/ }).getByRole('button', { name: 'Enlaces' }).click();

  const generar = admin.getByRole('button', { name: /Generar enlaces para las marcadas/ });
  await expect(generar).toHaveText(/\(0\)/); // por defecto, nadie
  await expect(generar).toBeDisabled();

  await admin.getByLabel('E2E Tech', { exact: true }).check();
  await expect(generar).toHaveText(/\(2\)/);

  await admin.getByRole('checkbox', { name: /Bea Padrón/ }).uncheck();
  await expect(generar).toHaveText(/\(1\)/);
  // El departamento queda a medias: ni marcado ni vacío.
  await expect(admin.getByLabel('E2E Tech', { exact: true })).toHaveJSProperty('indeterminate', true);

  // Solo se generan enlaces para las marcadas: Ana, y ni Bea ni Carla.
  await generar.click();
  const emails = async () => (await db().collection(`surveys/${SURVEY}/tokens`).get()).docs.map((d) => d.data().email);
  await expect.poll(emails).toEqual(['ana.e2e@example.com']);

  await admin.getByRole('button', { name: 'Todos', exact: true }).click();
  await expect(generar).not.toHaveText(/\(0\)|\(1\)/);
  await admin.getByRole('button', { name: 'Ninguno', exact: true }).click();
  await expect(generar).toHaveText(/\(0\)/);
});
