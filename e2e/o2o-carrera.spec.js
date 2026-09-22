/**
 * El O2O enseña en qué punto del nivel está la persona (RMR-PCS-0044 · F4).
 *
 * Hasta ahora el registro del O2O no decía NADA de carrera: el manager entraba a
 * la conversación sin tener delante lo que él mismo había valorado. Aquí es solo
 * lectura —valorar se valora en la ficha— y lo que importa es que se vea el
 * sub-nivel, cuánto lleva y qué le falta, empezando por lo que más pesa.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const PERSON = 'people/e2e-person-o2o-carrera';
const NOMBRE = 'Persona O2O carrera E2E';

const FRAMEWORK = {
  tracks: [{ id: 'ic', name: 'IC', order: 1, description: '' }],
  levels: [
    { id: 'oc-l1', code: 'L1', title: 'Engineer', trackId: 'ic', order: 1, description: '', typicalProfile: '' },
    { id: 'oc-l2', code: 'L2', title: 'Engineer II', trackId: 'ic', order: 2, description: '', typicalProfile: '' },
  ],
  dimensions: [
    { id: 'oc-tech', name: 'Técnica', order: 1 },
    { id: 'oc-product', name: 'Producto', order: 2 },
  ],
  disciplines: [],
  expectations: [
    { levelId: 'oc-l2', dimensionId: 'oc-tech', text: 'Diseña un servicio entero', weight: 3, core: true },
    { levelId: 'oc-l2', dimensionId: 'oc-product', text: 'Discute el alcance', weight: 1 },
  ],
  addendums: [],
};

/** La persona cuelga del superadmin, que es quien tiene todas las secciones del O2O. */
async function conValoracion(byDimension, fn) {
  const previo = (await db().doc('careerFramework/engineering').get()).data() ?? null;
  await db().doc('careerFramework/engineering').set(FRAMEWORK);
  await db().doc(PERSON).set({ name: NOMBRE, uid: null, ownerLeaderUid: 'e2e-superadmin', active: true, levelId: 'oc-l1' });
  await db().doc(`${PERSON}/careerAssessments/oc-l2`).set({ levelId: 'oc-l2', byDimension, closures: [] });
  try { await fn(); } finally {
    await db().doc(`${PERSON}/careerAssessments/oc-l2`).delete();
    await db().doc(PERSON).delete();
    if (previo) await db().doc('careerFramework/engineering').set(previo);
    else await db().doc('careerFramework/engineering').delete();
  }
}

async function abrirRegistro(page) {
  await signInAs(page, 'superadmin');
  await page.goto('/tools/o2o');
  await page.locator('o2o-app input[type="text"]').fill('Periodo carrera E2E');
  await page.locator('o2o-app button', { hasText: 'Crear periodo' }).click();
  await page.locator('o2o-app').getByRole('tab', { name: /Registrar O2O/ }).click();
  await page.locator('o2o-register select').first().selectOption({ label: NOMBRE });
}

test('el registro muestra el sub-nivel, cuánto lleva y qué le falta, lo que más pesa primero', async ({ page }) => {
  await conValoracion({ 'oc-product': { meets: true } }, async () => {
    await abrirRegistro(page);
    const registro = page.locator('o2o-register');
    // 1 de 4 puntos: todavía en L1-1, y lo que falta empieza por la que pesa 3.
    await expect(registro).toContainText('L1-1 · 25 % hacia L2 (1 de 4 puntos)');
    await expect(registro).toContainText('Falta: Técnica (imprescindible)');
  });
});

test('con el 80 % alcanzado avisa de que el .3 hay que sostenerlo', async ({ page }) => {
  await conValoracion({ 'oc-tech': { meets: true } }, async () => {
    await abrirRegistro(page);
    const registro = page.locator('o2o-register');
    await expect(registro).toContainText('75 % hacia L2 (3 de 4 puntos)');
    await expect(registro).toContainText('Falta: Producto');
  });
});
