/**
 * Guardar una lectura no saca de donde se está (RMR-TSK-0769): registrar
 * Seniority devolvía la ficha a «Datos», a mitad de rellenar las dimensiones.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const PERSON = 'people/e2e-person-sin-saltar';
const NOMBRE = 'Persona sin saltar E2E';

test('al registrar Seniority, la ficha se queda en Dimensiones › Seniority', async ({ page }) => {
  await db().doc(PERSON).set({ name: NOMBRE, uid: null, ownerLeaderUid: 'e2e-head', active: true });
  try {
    await signInAs(page, 'head');
    await page.goto('/tools/team');
    await page.getByRole('button', { name: `Abrir Seniority de ${NOMBRE}` }).click();
    const ficha = page.locator('team-person-detail');
    await expect(ficha.getByRole('tab', { name: 'Seniority', selected: true })).toBeVisible();

    await ficha.getByText('➕ Añadir lectura').click();
    await ficha.locator('team-level-input button').nth(2).click();
    await ficha.getByRole('button', { name: 'Registrar lectura' }).click();

    await expect(ficha.locator('.actual .tag')).toHaveText('Actual');
    // Sin recargar la ficha: el esqueleto de carga no vuelve a salir.
    await expect(ficha.locator('.skeleton, app-skeleton')).toHaveCount(0);
    await expect(ficha.getByRole('tab', { name: 'Dimensiones', selected: true })).toBeVisible();
    await expect(ficha.getByRole('tab', { name: 'Seniority', selected: true })).toBeVisible();
  } finally {
    for (const r of (await db().collection(`${PERSON}/seniority`).get()).docs) await r.ref.delete();
    await db().doc(PERSON).delete();
  }
});
