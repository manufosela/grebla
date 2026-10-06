/**
 * Encuestas › Resultados › Por departamento (RMR-TSK-0632): se ven todas las
 * preguntas de un departamento solo si llega al mínimo de anonimato; los
 * pequeños se cuentan como ocultos sin nombrarlos.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const SURVEY = 'e2e-survey-por-dpto';
const ANSWERS = [
  ...[4, 4, 5, 5, 2].map((v) => ({ department: 'E2E Tech', v })),
  ...[1, 1].map((v) => ({ department: 'E2E Ventas', v })),
];

test.beforeEach(async () => {
  await db().doc(`surveys/${SURVEY}`).set({
    title: 'Encuesta E2E por departamento', threshold: 5, status: 'closed', createdAt: new Date(),
    questions: [{ id: 'q1', type: 'scale', label: '¿Qué tal el equipo?', min: 1, max: 5 }],
  });
  for (const [i, a] of ANSWERS.entries()) {
    await db().doc(`surveys/${SURVEY}/answers/a${i}`).set({ answers: { q1: a.v }, metadata: { department: a.department } });
  }
});

test.afterEach(async () => {
  for (const d of (await db().collection(`surveys/${SURVEY}/answers`).get()).docs) await d.ref.delete();
  await db().doc(`surveys/${SURVEY}`).delete();
});

test('un departamento con respuestas suficientes se ve entero y el pequeño queda oculto', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/tools/encuestas');
  const admin = page.locator('survey-admin');
  await admin.getByRole('row', { name: /Encuesta E2E por departamento/ }).getByRole('button', { name: 'Resultados' }).click();
  await admin.getByRole('tab', { name: 'Por departamento' }).click();

  const picker = admin.getByLabel('Departamento:');
  await expect(picker.locator('option')).toHaveText(['E2E Tech (5 respuestas)']);
  await expect(admin.getByText('1 departamento con menos de 5 respuestas no se muestra')).toBeVisible();
  // Solo las de Tech: media 4.0 de 5, sin mezclar las de Ventas.
  await expect(admin.getByText('media 4.0 · n=5')).toBeVisible();});
