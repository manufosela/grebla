/**
 * El nivel de carrera con su sub-nivel, en Mi Role Mirror (RMR-TSK-0605).
 *
 * Quien mira su Role Mirror quiere saber también dónde está en la escalera, sin
 * irse a otra pantalla a por el dato. Y el número tiene que ser EL MISMO que ve
 * su manager en el Seguimiento del plan: sale de las expectativas cumplidas del
 * nivel siguiente, no del avance en el mapa de carrera.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const PERSON = 'people/e2e-person-eng';

/** L1 y L2; lo de L2 pesa 4 en total y «tech» se lleva 3. */
const FRAMEWORK = {
  tracks: [{ id: 'ic', name: 'IC', order: 1, description: '' }],
  levels: [
    { id: 'rm-l1', code: 'L1', title: 'Engineer', trackId: 'ic', order: 1, description: '', typicalProfile: '' },
    { id: 'rm-l2', code: 'L2', title: 'Engineer II', trackId: 'ic', order: 2, description: '', typicalProfile: '' },
  ],
  dimensions: [
    { id: 'rm-tech', name: 'Técnica', order: 1 },
    { id: 'rm-product', name: 'Producto', order: 2 },
  ],
  disciplines: [],
  expectations: [
    { levelId: 'rm-l1', dimensionId: 'rm-tech', text: 'Escribe código que otros leen' },
    { levelId: 'rm-l2', dimensionId: 'rm-tech', text: 'Diseña un servicio entero', weight: 3 },
    { levelId: 'rm-l2', dimensionId: 'rm-product', text: 'Discute el alcance', weight: 1 },
  ],
  addendums: [],
};

/** La política de la herramienta: la ve toda ingeniería. */
async function conPoliticaYNivel(fn, { levelId = 'rm-l1', assessment = null, person = {} } = {}) {
  const politica = (await db().doc('toolPolicies/rolemirror').get()).data() ?? null;
  const marco = (await db().doc('careerFramework/engineering').get()).data() ?? null;
  const antes = (await db().doc(PERSON).get()).data();
  await db().doc('toolPolicies/rolemirror').set({
    label: 'Role Mirror',
    audience: { branches: ['engineering'] },
    managedBy: { branches: ['engineering-manager'] },
  });
  await db().doc('careerFramework/engineering').set(FRAMEWORK);
  await db().doc(PERSON).set({ ...antes, levelId, ...person });
  if (assessment) await db().doc(`${PERSON}/careerAssessments/rm-l2`).set(assessment);
  try {
    await fn();
  } finally {
    await db().doc(`${PERSON}/careerAssessments/rm-l2`).delete();
    await db().doc(PERSON).set(antes);
    if (marco) await db().doc('careerFramework/engineering').set(marco);
    else await db().doc('careerFramework/engineering').delete();
    if (politica) await db().doc('toolPolicies/rolemirror').set(politica);
    else await db().doc('toolPolicies/rolemirror').delete();
  }
}

test('un ingeniero con nivel y valoración ve su L1-2 y cuánto lleva cumplido', async ({ page }) => {
  await conPoliticaYNivel(async () => {
    await signInAs(page, 'engineer');
    await page.goto('/tools/role-mirror');

    // 3 de 4 puntos = 75 %: consolida el nivel, todavía no está a las puertas.
    await expect(page.locator('#rm-level-badge')).toHaveText('L1-2');
    await expect(page.locator('#rm-level-text'))
      .toHaveText('75% del nivel siguiente cumplido (3 de 4 puntos valorados)');
  }, { assessment: { levelId: 'rm-l2', byDimension: { 'rm-tech': { meets: true } }, closures: [] } });
});

test('sin valoración no se inventa badge: el bloque no aparece', async ({ page }) => {
  await conPoliticaYNivel(async () => {
    await signInAs(page, 'engineer');
    await page.goto('/tools/role-mirror');

    // El cuestionario sí está: lo que falta es el dato de la escalera, no la página.
    await expect(page.locator('role-questionnaire')).toBeVisible();
    await expect(page.locator('#rm-level')).toBeHidden();
  });
});

test('el ajuste del manager se distingue del cálculo, y lleva su nota', async ({ page }) => {
  await conPoliticaYNivel(async () => {
    await signInAs(page, 'engineer');
    await page.goto('/tools/role-mirror');

    await expect(page.locator('#rm-level-badge')).toHaveText('L1-3');
    await expect(page.locator('#rm-level-text')).toContainText('ajustado por tu manager');
    await expect(page.locator('#rm-level-text')).toContainText('lidera de facto');
    // El cálculo no se esconde: se ve debajo lo que dicen las expectativas.
    await expect(page.locator('#rm-level-text')).toContainText('75% del nivel siguiente cumplido');
  }, {
    assessment: { levelId: 'rm-l2', byDimension: { 'rm-tech': { meets: true } }, closures: [] },
    person: { subLevelOverride: { value: 3, note: 'lidera de facto' } },
  });
});
