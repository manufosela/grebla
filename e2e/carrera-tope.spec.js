/**
 * Carrera según dónde está la persona (RMR-TSK-0761): en el tope de su vía no
 * hay avance que seguir y se dice cómo se le valora; por debajo, su responsable
 * puede fijarle el objetivo de carrera desde la ficha.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const PERSON = 'people/e2e-person-tope';
const NOMBRE = 'Persona del tope E2E';
const FRAMEWORK = {
  tracks: [{ id: 'em', name: 'EM', order: 1, description: '' }],
  levels: [
    { id: 'tp-l4', code: 'L4-EM', title: 'Senior EM', trackId: 'em', order: 4, description: '', typicalProfile: '' },
    { id: 'tp-l5', code: 'L5-EM', title: 'Director', trackId: 'em', order: 5, description: '', typicalProfile: '' },
  ],
  dimensions: [{ id: 'tp-lead', name: 'Liderazgo', order: 1 }],
  disciplines: [],
  expectations: [{ levelId: 'tp-l5', dimensionId: 'tp-lead', text: 'Desarrolla managers' }],
  addendums: [],
};

async function conPersona(levelId, fn) {
  const previo = (await db().doc('careerFramework/engineering').get()).data() ?? null;
  await db().doc('careerFramework/engineering').set(FRAMEWORK);
  await db().doc(PERSON).set({ name: NOMBRE, uid: null, ownerLeaderUid: 'e2e-head', active: true, levelId });
  try { await fn(); } finally {
    await db().doc(PERSON).delete();
    if (previo) await db().doc('careerFramework/engineering').set(previo);
    else await db().doc('careerFramework/engineering').delete();
  }
}

async function abrirCarrera(page) {
  await signInAs(page, 'head');
  await page.goto('/tools/team');
  await page.getByRole('button', { name: `Abrir Carrera de ${NOMBRE}` }).click();
}

test('en el tope no hay Seguimiento ni Aspiraciones, y se dice cómo se le valora', async ({ page }) => {
  await conPersona('tp-l5', async () => {
    await abrirCarrera(page);
    const ficha = page.locator('team-person-detail');
    await expect(ficha.locator('.top-note')).toContainText('tope de su itinerario');
    await expect(ficha.getByRole('tab', { name: 'Seguimiento' })).toHaveCount(0);
    await expect(ficha.getByRole('tab', { name: 'Aspiraciones' })).toHaveCount(0);
  });
});

test('por debajo del tope, su responsable le fija el objetivo de carrera', async ({ page }) => {
  await conPersona('tp-l4', async () => {
    await abrirCarrera(page);
    const ficha = page.locator('team-person-detail');
    await ficha.getByRole('tab', { name: 'Aspiraciones' }).click();
    await ficha.getByLabel('Fijar objetivo').selectOption('tp-l5');
    await expect.poll(async () => (await db().doc(PERSON).get()).data()?.careerTargetLevelId ?? null, { timeout: 15_000 })
      .toBe('tp-l5');
  });
});
