/**
 * Ingesta desde un agente externo (RMR-TSK-0549): la nota de un 1-1 que MATIAS
 * encuentra en el correo acaba en la ficha de la persona, no en su lista de
 * tareas.
 *
 * Lo que se fija aquí es el CONTRATO que pactamos con quien ingesta, porque de
 * él depende lo que haga cuando la nota no cabe aquí: 404 y 403 significan
 * «guárdala tú», y el resto, «algo va mal». Por eso se comprueban los códigos
 * uno a uno, y no solo el camino feliz.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

// En el emulador el secreto vale lo que diga functions/.secret.local; el
// arranque de los E2E deja este valor.
const CLAVE = 'e2e-agent-key';
const URL = 'http://127.0.0.1:5001/demo-grebla/europe-west1/ingestConversation';

const PERSONA = 'people/e2e-person-ingesta';
const FUERA = 'people/e2e-person-ingesta-fuera';
const EMAIL = 'ana.ingesta@e2e.test';
const EMAIL_FUERA = 'sin.manager@e2e.test';

const nota = (extra = {}) => ({
  email: EMAIL,
  type: 'o2o',
  date: '2026-09-22',
  notes: 'Hablamos de su paso a L2',
  summary: 'Prepara el diseño del servicio',
  source: { system: 'matias', id: 'thread-e2e-1', url: 'https://mail.google.com/x/thread-e2e-1' },
  ...extra,
});

/** Envía la nota con la clave indicada (por defecto, la buena). */
const enviar = (request, cuerpo, clave = CLAVE) =>
  request.post(URL, { headers: { Authorization: `Bearer ${clave}` }, data: cuerpo, failOnStatusCode: false });

test.beforeEach(async () => {
  await db().doc(PERSONA).set({ name: 'Ana Ingesta E2E', email: EMAIL, ownerLeaderUid: 'e2e-head', active: true });
  await db().doc(FUERA).set({ name: 'Sin Manager E2E', email: EMAIL_FUERA, ownerLeaderUid: '', active: true });
});

test.afterEach(async () => {
  for (const ruta of [PERSONA, FUERA]) {
    const conv = await db().collection(`${ruta}/conversations`).get();
    await Promise.all(conv.docs.map((d) => d.ref.delete()));
    await db().doc(ruta).delete();
  }
});

test('la nota entra en la ficha de la persona, marcada como automática', async ({ request }) => {
  const res = await enviar(request, nota());
  expect(res.status()).toBe(200);
  const { id, personId, duplicate } = await res.json();
  expect([personId, duplicate]).toEqual(['e2e-person-ingesta', false]);

  const doc = (await db().doc(`${PERSONA}/conversations/${id}`).get()).data();
  expect(doc.type).toBe('o2o');
  expect(doc.notes).toBe('Hablamos de su paso a L2');
  // Es un borrador de una máquina, y se ve que lo es.
  expect(doc.automated).toBe(true);
  expect(doc.createdBy.uid).toBe('agent:matias');
  expect(doc.source.id).toBe('thread-e2e-1');
});

test('reenviar la misma nota no duplica: el relanzamiento del agente es inofensivo', async ({ request }) => {
  const primera = await enviar(request, nota());
  const segunda = await enviar(request, nota({ notes: 'texto distinto, mismo hilo' }));
  expect(segunda.status()).toBe(200);
  expect((await segunda.json()).duplicate).toBe(true);
  expect((await primera.json()).id).toBe((await segunda.json()).id);

  const conv = await db().collection(`${PERSONA}/conversations`).get();
  expect(conv.size).toBe(1);
});

test('en la ficha se ve que la nota la trajo una máquina, con su origen', async ({ page, request }) => {
  await enviar(request, nota());
  await signInAs(page, 'head');
  await page.goto('/tools/team');
  await page.getByRole('button', { name: `Abrir ficha de Ana Ingesta E2E` }).click().catch(async () => {
    // Según de dónde se entre, la ficha se abre desde el nombre de la persona.
    await page.getByText('Ana Ingesta E2E').first().click();
  });
  const ficha = page.locator('team-person-detail');
  await expect(ficha).toBeVisible();
  await ficha.getByRole('tab', { name: 'O2O' }).click();

  const fila = ficha.locator('.hist li', { hasText: 'Hablamos de su paso a L2' });
  await expect(fila.locator('.auto')).toContainText('automática');
  await expect(fila.locator('.auto')).toContainText('matias');
  await expect(fila.getByRole('link', { name: 'ver origen' })).toHaveAttribute('href', /^https:\/\/mail\.google\.com\//);
});

test('el contrato de errores: 401, 400, 404 y 403 se distinguen', async ({ request }) => {
  const mala = await enviar(request, nota(), 'clave-que-no-es');
  expect(mala.status()).toBe(401);
  expect((await mala.json()).error).toBe('unauthorized');

  const incompleta = await enviar(request, nota({ type: 'planning' }));
  expect(incompleta.status()).toBe(400);
  expect((await incompleta.json()).error).toBe('invalid_payload');

  const desconocida = await enviar(request, nota({ email: 'nadie@e2e.test' }));
  expect(desconocida.status()).toBe(404);
  expect((await desconocida.json()).error).toBe('person_not_found');

  const sinManager = await enviar(request, nota({ email: EMAIL_FUERA }));
  expect(sinManager.status()).toBe(403);
  expect((await sinManager.json()).error).toBe('not_in_scope');

  // Ninguno de los cuatro ha escrito nada.
  const conv = await db().collection(`${PERSONA}/conversations`).get();
  expect(conv.size).toBe(0);
});
