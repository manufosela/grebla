/**
 * Ingesta desde un agente externo (RMR-TSK-0549): la nota de un 1-1 que MATIAS
 * encuentra en el correo acaba como O2O PRIVADO de su manager (RMR-TSK-0649),
 * no en las conversaciones de la ficha, que la persona puede leer.
 *
 * Lo que se fija aquí es el CONTRATO que pactamos con quien ingesta, porque de
 * él depende lo que haga cuando la nota no cabe aquí: 404 y 403 significan
 * «guárdala tú», y el resto, «algo va mal». Por eso se comprueban los códigos
 * uno a uno, y no solo el camino feliz.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { test, expect } from './fixtures.js';

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
const POR_UID = 'people/e2e-person-ingesta-uid';
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

/** Los O2O privados que el manager (e2e-head) tiene de una persona. */
const o2oDe = (personPath) => db().collection('leaders/e2e-head/o2o').where('personId', '==', personPath.split('/')[1]).get();

/** Envía la nota con la clave indicada (por defecto, la buena). */
const enviar = (request, cuerpo, clave = CLAVE) =>
  request.post(URL, { headers: { Authorization: `Bearer ${clave}` }, data: cuerpo, failOnStatusCode: false });

test.beforeEach(async () => {
  await db().doc(PERSONA).set({ name: 'Ana Ingesta E2E', email: EMAIL, ownerLeaderUid: 'e2e-head', active: true });
  await db().doc(FUERA).set({ name: 'Sin Manager E2E', email: EMAIL_FUERA, ownerLeaderUid: '', active: true });
});

test.afterEach(async () => {
  for (const ruta of [PERSONA, FUERA]) {
    await Promise.all((await o2oDe(ruta)).docs.map((d) => d.ref.delete()));
    await db().doc(ruta).delete();
  }
});

test('la nota entra como O2O privado de su manager, marcado como automático', async ({ request }) => {
  const res = await enviar(request, nota());
  expect(res.status()).toBe(200);
  const { id, personId, duplicate } = await res.json();
  expect([personId, duplicate]).toEqual(['e2e-person-ingesta', false]);

  const doc = (await db().doc(`leaders/e2e-head/o2o/${id}`).get()).data();
  expect(doc.personId).toBe('e2e-person-ingesta');
  expect(doc.privateNotes).toBe('Hablamos de su paso a L2');
  // Nada compartido con la persona, y se ve que lo trajo una máquina.
  expect(doc.sharedWithPerson).toBe(false);
  expect(doc.automated).toBe(true);
  expect(doc.source.id).toBe('thread-e2e-1');
  // Y nada en las conversaciones de la ficha, que la persona puede leer.
  expect((await db().collection(`${PERSONA}/conversations`).get()).size).toBe(0);
});

test('reenviar la misma nota no duplica: el relanzamiento del agente es inofensivo', async ({ request }) => {
  const primera = await enviar(request, nota());
  const segunda = await enviar(request, nota({ notes: 'texto distinto, mismo hilo' }));
  expect(segunda.status()).toBe(200);
  expect((await segunda.json()).duplicate).toBe(true);
  expect((await primera.json()).id).toBe((await segunda.json()).id);

  expect((await o2oDe(PERSONA)).size).toBe(1);
});

test('llega también a quien no tiene el email en la ficha, por su cuenta vinculada', async ({ request }) => {
  // El caso normal en la instancia real: la ficha se ata por uid y el campo
  // `email` está vacío. Sin esto, la ingesta diría «no existe» a casi todos.
  const cuenta = await getAuth().createUser({ email: 'por.cuenta@e2e.test', emailVerified: true });
  await db().doc(POR_UID).set({ name: 'Por Cuenta E2E', uid: cuenta.uid, ownerLeaderUid: 'e2e-head', active: true });
  try {
    const res = await enviar(request, nota({ email: 'por.cuenta@e2e.test', source: { system: 'matias', id: 'thread-uid' } }));
    expect(res.status()).toBe(200);
    expect((await res.json()).personId).toBe('e2e-person-ingesta-uid');
  } finally {
    await Promise.all((await o2oDe(POR_UID)).docs.map((d) => d.ref.delete()));
    await db().doc(POR_UID).delete();
    await getAuth().deleteUser(cuenta.uid);
  }
});

test('un correo SIN verificar no vale para elegir ficha', async ({ request }) => {
  // Un email sin verificar lo declara cualquiera al registrarse, y esto decide
  // en qué ficha se escribe.
  const cuenta = await getAuth().createUser({ email: 'sin.verificar@e2e.test', emailVerified: false });
  await db().doc(POR_UID).set({ name: 'Sin Verificar E2E', uid: cuenta.uid, ownerLeaderUid: 'e2e-head', active: true });
  try {
    const res = await enviar(request, nota({ email: 'sin.verificar@e2e.test' }));
    expect(res.status()).toBe(404);
  } finally {
    await db().doc(POR_UID).delete();
    await getAuth().deleteUser(cuenta.uid);
  }
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
  expect((await o2oDe(PERSONA)).size).toBe(0);
});
