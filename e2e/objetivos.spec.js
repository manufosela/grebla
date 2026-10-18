/**
 * Expectativas y objetivos (RMR-TSK-0752): el responsable pone un objetivo
 * medible bajo una expectativa del nivel actual y lo cierra con lo medido; la
 * persona lo ve en Mi espacio, sin poder tocarlo. Siembra su propia persona y
 * su framework: lo que ve el head depende de lo que dejen otros specs.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const PERSON = 'people/e2e-person-objetivos';
const NOMBRE = 'Persona de objetivos E2E';
const ENG = 'people/e2e-person-eng';
const FRAMEWORK = {
  tracks: [{ id: 'ic', name: 'IC', order: 1, description: '' }],
  levels: [{ id: 'ob-l1', code: 'L1', title: 'Engineer', trackId: 'ic', order: 1, description: '', typicalProfile: '' }],
  dimensions: [{ id: 'ob-ia', name: 'Orquestación', order: 1 }],
  disciplines: [],
  expectations: [{ levelId: 'ob-l1', dimensionId: 'ob-ia', text: 'Dirige agentes con criterio' }],
  addendums: [],
};

async function conFramework(fn) {
  const previo = (await db().doc('careerFramework/engineering').get()).data() ?? null;
  await db().doc('careerFramework/engineering').set(FRAMEWORK);
  try { await fn(); } finally {
    if (previo) await db().doc('careerFramework/engineering').set(previo);
    else await db().doc('careerFramework/engineering').delete();
  }
}

const ficha = (page) => page.locator('team-person-detail');

test('el responsable pone un objetivo medible bajo una expectativa y lo cierra con lo medido', async ({ page }) => {
  await conFramework(async () => {
    await db().doc(PERSON).set({ name: NOMBRE, uid: null, ownerLeaderUid: 'e2e-head', active: true, levelId: 'ob-l1' });
    try {
      await signInAs(page, 'head');
      await page.goto('/tools/team');
      await page.getByRole('button', { name: `Abrir Carrera de ${NOMBRE}` }).click();
      await ficha(page).getByRole('tab', { name: 'Expectativas y objetivos' }).click();
      // Expectativas y objetivos, explicados en el mismo sitio para que no se confundan.
      await expect(ficha(page).locator('.goals')).toContainText('son lo que pide el nivel');

      const fila = ficha(page).locator('career-levels li', { hasText: 'Orquestación' }).first();
      await fila.getByRole('button', { name: 'Nuevo objetivo' }).click();
      const dialogo = ficha(page).locator('career-objective-dialog');
      await dialogo.getByLabel('Objetivo', { exact: true }).fill('Medir el impacto de la IA');
      await dialogo.getByRole('button', { name: 'Guardar' }).click();
      await expect(dialogo).toContainText('Falta cómo se mide');
      await dialogo.getByLabel(/Cómo se mide/).fill('Ahorro de esfuerzo ≥ 20 % frente a la línea base');
      await dialogo.getByRole('button', { name: 'Guardar' }).click();

      const objetivo = fila.locator('.objective', { hasText: 'Medir el impacto de la IA' });
      await expect(objetivo).toContainText('En curso');

      // Se edita en curso, con lo que ya tenía relleno (RMR-TSK-0771).
      await objetivo.getByRole('button', { name: 'Editar' }).click();
      await expect(dialogo.getByLabel(/Cómo se mide/)).toHaveValue('Ahorro de esfuerzo ≥ 20 % frente a la línea base');
      await dialogo.getByLabel(/Cómo se mide/).fill('Ahorro de esfuerzo ≥ 25 % frente a la línea base');
      await dialogo.getByRole('button', { name: 'Guardar' }).click();
      await expect(objetivo).toContainText('≥ 25 %');
      await objetivo.getByRole('button', { name: 'Cerrar objetivo' }).click();
      await dialogo.getByLabel('Cómo acabó').selectOption('achieved');
      await dialogo.getByLabel(/Nota/).fill('Medido: 23 %');
      await dialogo.getByRole('button', { name: 'Guardar' }).click();
      await expect(objetivo).toContainText('Conseguido');
      await expect(objetivo).toContainText('Medido: 23 %');
    } finally {
      for (const o of (await db().collection(`${PERSON}/careerObjectives`).get()).docs) await o.ref.delete();
      await db().doc(PERSON).delete();
    }
  });
});

test('la persona ve sus objetivos en Mi espacio, sin poder tocarlos', async ({ page }) => {
  await conFramework(async () => {
    const ficha0 = (await db().doc(ENG).get()).data();
    await db().doc(ENG).update({ levelId: 'ob-l1' });
    await db().collection(`${ENG}/careerObjectives`).doc('ob-1').set({
      title: 'Medir el impacto de la IA', measure: 'Ahorro ≥ 20 %', dueDate: '2026-12-31', levelId: null, dimensionId: null,
      status: 'open', closingNote: '', closedAt: null, by: { uid: 'e2e-head', name: 'Head' }, at: '2026-10-17T09:00:00.000Z',
    });
    try {
      await signInAs(page, 'engineer');
      await page.goto('/mi-espacio#carrera');
      const espacio = page.locator('engineer-space');
      await espacio.getByRole('tab', { name: 'Expectativas y objetivos' }).click();
      const objetivo = espacio.locator('.objective', { hasText: 'Medir el impacto de la IA' });
      await expect(objetivo).toContainText('Ahorro ≥ 20 %');
      await expect(objetivo.getByRole('button', { name: 'Cerrar objetivo' })).toHaveCount(0);
      await expect(espacio.getByRole('button', { name: 'Nuevo objetivo' })).toHaveCount(0);
    } finally {
      await db().doc(`${ENG}/careerObjectives/ob-1`).delete();
      await db().doc(ENG).set(ficha0);
    }
  });
});
