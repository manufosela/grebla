/**
 * Encuestas (RMR-TSK-0630/0631): cada encuesta se prepara en un asistente por
 * pasos. El padrón es toda la empresa y la encuesta va a quien se marca: por
 * defecto nadie; se marca un departamento entero y se quita a una persona.
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
  await db().doc(`surveys/${SURVEY}`).set({
    title: 'Encuesta E2E del padrón', threshold: 5, status: 'draft', createdAt: new Date(),
    questions: [{ id: 'q1', type: 'scale', label: '¿Qué tal el equipo?', min: 1, max: 5 }],
  });
});

/** Abre el asistente de la encuesta sembrada y llega a Destinatarios guardando las preguntas. */
async function openRecipients(page) {
  await signInAs(page, 'superadmin');
  await page.goto('/tools/encuestas');
  const admin = page.locator('survey-admin');
  await admin.getByRole('row', { name: /Encuesta E2E del padrón/ }).getByRole('button', { name: 'Gestionar' }).click();
  await admin.getByRole('button', { name: 'Guardar y seguir →' }).click();
  await expect(admin.getByRole('tab', { name: '2. Destinatarios' })).toHaveAttribute('aria-selected', 'true');
  return admin;
}

test.afterEach(async () => {
  for (const id of Object.keys(PADRON)) await db().doc(`padron/${id}`).delete();
  for (const t of (await db().collection(`surveys/${SURVEY}/tokens`).get()).docs) await t.ref.delete();
  await db().doc(`surveys/${SURVEY}`).delete();
});

test('asistente: se marca un departamento, se quita a una persona, se generan sus enlaces y se llega al envío', async ({ page }) => {
  const admin = await openRecipients(page);
  const siguiente = admin.getByRole('button', { name: 'Siguiente: Enlaces →' });
  await expect(admin.getByText('Marcadas: 0')).toBeVisible(); // por defecto, nadie
  await expect(siguiente).toBeDisabled();

  await admin.getByRole('button', { name: 'Todos', exact: true }).click();
  await expect(admin.getByText('Marcadas: 3')).toBeVisible();
  await admin.getByRole('button', { name: 'Ninguno', exact: true }).click();

  await admin.getByLabel('E2E Tech', { exact: true }).check();
  await admin.getByRole('checkbox', { name: /Bea Padrón/ }).uncheck();
  await expect(admin.getByText('Marcadas: 1')).toBeVisible();
  // El departamento queda a medias: ni marcado ni vacío.
  await expect(admin.getByLabel('E2E Tech', { exact: true })).toHaveJSProperty('indeterminate', true);

  // Al avanzar, la selección queda guardada en la encuesta.
  await siguiente.click();
  await expect.poll(async () => (await db().doc(`surveys/${SURVEY}`).get()).data().recipients).toEqual(['ana.e2e@example.com']);

  // Solo se generan enlaces para las marcadas: Ana, y ni Bea ni Carla.
  await admin.getByRole('button', { name: 'Generar enlaces (1)' }).click();
  const emails = async () => (await db().collection(`surveys/${SURVEY}/tokens`).get()).docs.map((d) => d.data().email);
  await expect.poll(emails).toEqual(['ana.e2e@example.com']);
  await expect(admin.getByRole('button', { name: 'Generar enlaces (0)' })).toBeDisabled();

  await admin.getByRole('button', { name: 'Siguiente: Envío →' }).click();
  // Primero se redacta el correo (RMR-TSK-0638): asunto y cuerpo con {{enlace}}, y se guarda.
  await admin.getByLabel('Asunto').fill('Tu opinión cuenta');
  await admin.getByRole('button', { name: 'Guardar correo' }).click();
  await expect(admin.getByText('Correo guardado.')).toBeVisible();
  await expect.poll(async () => (await db().doc(`surveys/${SURVEY}`).get()).data().email?.subject).toBe('Tu opinión cuenta');

  await admin.getByRole('tab', { name: 'Enviar' }).click();
  await expect(admin.getByRole('button', { name: 'Enviar prueba' })).toBeVisible();

  // En borrador no se envía a todos; se abre desde el mismo paso.
  await expect(admin.getByRole('button', { name: 'Enviar a todos (1)' })).toBeDisabled();
  await admin.getByRole('button', { name: 'Abrir la encuesta' }).click();
  await expect(admin.getByRole('button', { name: 'Enviar a todos (1)' })).toBeEnabled();
  await expect.poll(async () => (await db().doc(`surveys/${SURVEY}`).get()).data().status).toBe('open');
});

test('«Actualizar desde el directorio» trae a quien está en el censo y no en el padrón (RMR-TSK-0631)', async ({ page }) => {
  await db().doc('people/e2e-dir-dani').set({ name: 'Dani Directorio', email: 'dani.e2e@example.com', active: true });
  try {
    const admin = await openRecipients(page);
    // Se ve al instante lo que ya hay: no se espera a ninguna sincronización.
    await expect(admin.getByRole('checkbox', { name: /Ana Padrón/ })).toBeVisible();
    await expect(admin.getByRole('checkbox', { name: /Dani Directorio/ })).toHaveCount(0);

    await admin.getByRole('button', { name: 'Actualizar desde el directorio' }).click();
    await expect(admin.getByRole('checkbox', { name: /Dani Directorio/ })).toBeVisible();
    await expect(admin.getByText(/Actualizado con el directorio el/)).toBeVisible();
  } finally {
    await db().doc('people/e2e-dir-dani').delete();
    for (const d of (await db().collection('padron').where('email', '==', 'dani.e2e@example.com').get()).docs) await d.ref.delete();
    await db().doc('padron/_sync').delete();
  }
});
