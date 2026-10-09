/**
 * O2O › Registrar (RMR-TSK-0648): un O2O hecho se despliega y se lee separado
 * lo que es solo del manager de lo que ve la persona.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs, markForWhom, hangFrom } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const PERSON = 'e2e-person-o2o-resumen';
const NOMBRE = 'Persona O2O resumen E2E';
const PERIODO = 'Periodo resumen E2E';

test.afterEach(async () => {
  const leader = db().collection('leaders').doc('e2e-superadmin');
  for (const d of (await leader.collection('o2o').where('personId', '==', PERSON).get()).docs) await d.ref.delete();
  for (const d of (await leader.collection('o2oPeriods').where('name', '==', PERIODO).get()).docs) await d.ref.delete();
  await limpiar?.();
});

let limpiar;
test('un O2O se despliega con lo privado del manager y lo que ve la persona', async ({ page }) => {
  limpiar = await hangFrom(db(), PERSON, { name: NOMBRE, uid: null, ownerLeaderUid: 'e2e-superadmin', active: true }, 'e2e-superadmin');
  await signInAs(page, 'superadmin');
  await page.goto('/tools/o2o');
  await page.locator('o2o-app input[type="text"]').fill(PERIODO);
  await page.locator('o2o-app button', { hasText: 'Crear O2O' }).click();

  const leader = db().collection('leaders').doc('e2e-superadmin');
  await expect.poll(async () => (await leader.collection('o2oPeriods').where('name', '==', PERIODO).get()).size).toBe(1);
  const periodId = (await leader.collection('o2oPeriods').where('name', '==', PERIODO).get()).docs[0].id;
  await leader.collection('o2o').add({
    personId: PERSON, periodId, date: '2026-10-07', guideVersion: 2, answers: [], transcript: '',
    privateNotes: 'Le cuesta delegar', summary: 'Buen mes, ojo al tono', sharedSummary: 'Gracias por el roadmap', sharedWithPerson: true,
    createdAt: new Date(),
  });

  await markForWhom(page, NOMBRE);
  await page.locator('o2o-app').getByRole('tab', { name: /Registrar O2O/ }).click();
  await page.locator('o2o-register select').first().selectOption({ label: NOMBRE });
  await page.locator('o2o-register').getByRole('button', { name: 'Ver' }).click();

  const vista = page.locator('o2o-session-view');
  await expect(vista.getByText('Solo tú')).toBeVisible();
  await expect(vista.getByText('Le cuesta delegar')).toBeVisible();
  await expect(vista.getByText('Buen mes, ojo al tono')).toBeVisible();
  await expect(vista.getByText(`Lo que ve ${NOMBRE}`)).toBeVisible();
  await expect(vista.getByText('Gracias por el roadmap')).toBeVisible();
});
