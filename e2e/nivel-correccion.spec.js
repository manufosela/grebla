/**
 * Corregir un nivel no es promocionar (RMR-TSK-0766): quien se incorpora o lo
 * tenía mal puesto no estrena un histórico de cambios que nunca pasaron.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const PERSON = 'people/e2e-person-correccion';
const NOMBRE = 'Persona de la corrección E2E';
const FRAMEWORK = {
  tracks: [{ id: 'm', name: 'Management', order: 1, description: '' }],
  levels: [
    { id: 'co-l4', code: 'L4-M', title: 'Manager', trackId: 'm', order: 4, description: '', typicalProfile: '' },
    { id: 'co-l5', code: 'L5-M', title: 'Head', trackId: 'm', order: 5, description: '', typicalProfile: '' },
  ],
  dimensions: [], disciplines: [], expectations: [], addendums: [],
};

test('marcada como corrección, cambiar el nivel no deja histórico', async ({ page }) => {
  const previo = (await db().doc('careerFramework/engineering').get()).data() ?? null;
  await db().doc('careerFramework/engineering').set(FRAMEWORK);
  await db().doc(PERSON).set({ name: NOMBRE, uid: null, ownerLeaderUid: 'e2e-head', active: true, levelId: 'co-l4' });
  try {
    await signInAs(page, 'head');
    await page.goto('/tools/team');
    await page.getByRole('button', { name: `Abrir Carrera de ${NOMBRE}` }).click();
    const ficha = page.locator('team-person-detail');
    await ficha.getByRole('tab', { name: 'Nivel' }).click();
    await ficha.locator('.career-editor select').first().selectOption('co-l5');
    await ficha.getByLabel(/Es una corrección/).check();
    await ficha.getByRole('button', { name: 'Guardar carrera' }).click();
    await expect.poll(async () => (await db().doc(PERSON).get()).data()?.levelId ?? null, { timeout: 15_000 }).toBe('co-l5');
    expect((await db().doc(PERSON).get()).data()?.levelHistory ?? []).toEqual([]);
  } finally {
    await db().doc(PERSON).delete();
    if (previo) await db().doc('careerFramework/engineering').set(previo);
    else await db().doc('careerFramework/engineering').delete();
  }
});
