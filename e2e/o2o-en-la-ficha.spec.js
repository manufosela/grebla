/**
 * Equipo › ficha › O2O › «O2O hechos» (RMR-TSK-0649): los O2O registrados en la
 * herramienta O2O se ven en la ficha de la persona, los mismos datos, con lo que
 * es solo del manager separado de lo que ve la persona.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs, hangFrom } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const PERSONA = 'e2e-person-o2o-ficha';
const NOMBRE = 'Bea O2O Ficha E2E';
const SESION = 'leaders/e2e-head/o2o/e2e-sesion-ficha';
// De otro manager con quien se comparte la persona (RMR-TSK-0728): el head solo ve lo compartido.
const SESION_OTRO = 'leaders/e2e-otro-em/o2o/e2e-sesion-otro';
const SESION_NO_COMPARTIDA = 'leaders/e2e-otro-em/o2o/e2e-sesion-otro-privada';
const PERIODO = 'leaders/e2e-head/o2oPeriods/e2e-periodo-ficha';
let limpiar;

test.beforeEach(async () => {
  limpiar = await hangFrom(db(), PERSONA, { name: NOMBRE, ownerLeaderUid: 'e2e-head', active: true, sharedWithUids: ['e2e-otro-em'] }, 'e2e-head');
  await db().doc(SESION_OTRO).set({ personId: PERSONA, date: '2026-09-15', privateNotes: 'NOTA PRIVADA DEL OTRO',
    summary: 'RESUMEN PRIVADO DEL OTRO', sharedSummary: 'Skip-level tranquilo', sharedWithPerson: true, createdAt: new Date() });
  await db().doc(SESION_NO_COMPARTIDA).set({ personId: PERSONA, date: '2026-09-30', sharedSummary: 'NO COMPARTIDO',
    sharedWithPerson: false, createdAt: new Date() });
  await db().doc(PERIODO).set({ name: 'Periodo otoño E2E', personIds: [PERSONA], createdAt: '2026-10-10T00:00:00.000Z',
    guide: { blocks: [] }, form: { intro: '', sections: [{ id: 's1', title: 'Tu trabajo', questions: [{ id: 'q1', text: '¿Qué te frena?' }] }] } });
  await db().doc(SESION).set({
    personId: PERSONA, periodId: 'x', date: '2026-10-07', guideVersion: 2, answers: [], transcript: '',
    privateNotes: 'Preparar el roadmap juntos', summary: 'Buen arranque', sharedSummary: 'Gracias por el esfuerzo', sharedWithPerson: true,
    createdAt: new Date(),
  });
});

test.afterEach(async () => {
  await db().doc(SESION).delete();
  await db().doc(SESION_OTRO).delete();
  await db().doc(SESION_NO_COMPARTIDA).delete();
  await db().doc(PERIODO).delete();
  for (const a of (await db().collection(`people/${PERSONA}/o2oActions`).get()).docs) await a.ref.delete();
  await limpiar();
});

test('el O2O registrado se ve en la ficha, con lo privado y lo que ve la persona', async ({ page }) => {
  await signInAs(page, 'head');
  await page.goto('/tools/team');
  await page.getByRole('button', { name: `Abrir ficha de ${NOMBRE}` }).click().catch(async () => {
    await page.getByText(NOMBRE).first().click();
  });
  const ficha = page.locator('team-person-detail');
  await ficha.getByRole('tab', { name: 'O2O', exact: true }).click();
  const panel = ficha.locator('person-o2o-panel');

  // Próximo: el periodo con ella en «Para quién» y los temas que verá.
  await expect(panel.getByText('Periodo otoño E2E')).toBeVisible();
  await expect(panel.getByText('¿Qué te frena?')).toBeVisible();

  await panel.getByRole('tab', { name: 'Hechos' }).click();
  const o2o = panel.locator('person-o2o');
  await expect(o2o.getByText('2026-10-07')).toBeVisible();
  await expect(o2o.getByText('Preparar el roadmap juntos')).toBeVisible();
  await expect(o2o.getByText('Gracias por el esfuerzo')).toBeVisible();
  await expect(o2o.getByRole('link', { name: 'Registrar un O2O' })).toHaveAttribute('href', '/tools/o2o');
  // Del otro manager, solo lo compartido.
  await expect(panel.getByText('Skip-level tranquilo')).toBeVisible();
  await expect(panel).not.toContainText('NOTA PRIVADA DEL OTRO');
  await expect(panel).not.toContainText('RESUMEN PRIVADO DEL OTRO');
  await expect(panel).not.toContainText('NO COMPARTIDO');
  // Acciones: se gestionan aquí mismo.
  await panel.getByRole('tab', { name: 'Acciones' }).click();
  await panel.getByRole('textbox', { name: 'Nueva acción' }).fill('Leer el ADR de pagos');
  await panel.getByRole('button', { name: 'Añadir' }).click();
  await expect(panel.getByText('Leer el ADR de pagos')).toBeVisible();
});
