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
import { createHash } from 'node:crypto';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { test, expect, hangFrom } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

// Una clave por agente, atada a su manager (RMR-TSK-0650): en /agentKeys solo
// va la huella. CLAVE es la del agente del Head; CLAVE_OTRA, la de adminmgr.
const CLAVE = 'e2e-agent-key';
const CLAVE_OTRA = 'e2e-agent-key-adminmgr';
const huella = (k) => createHash('sha256').update(k).digest('hex');
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

test.beforeAll(async () => {
  await db().doc(`agentKeys/${huella(CLAVE)}`).set({ label: 'e2e-head', managerUid: 'e2e-head', managerEmail: 'head@e2e.test', active: true });
  await db().doc(`agentKeys/${huella(CLAVE_OTRA)}`).set({ label: 'e2e-adminmgr', managerUid: 'e2e-adminmgr', managerEmail: 'adminmgr@e2e.test', active: true });
});

let limpiar;
test.beforeEach(async () => {
  // Ana cuelga del Head en el directorio (RMR-TSK-0665): es lo que la pone en su alcance.
  limpiar = await hangFrom(db(), PERSONA.split('/')[1], { name: 'Ana Ingesta E2E', email: EMAIL, active: true }, 'e2e-head');
  await db().doc(FUERA).set({ name: 'Sin Manager E2E', email: EMAIL_FUERA, ownerLeaderUid: '', active: true });
});

test.afterEach(async () => {
  for (const ruta of [PERSONA, FUERA]) {
    await Promise.all((await o2oDe(ruta)).docs.map((d) => d.ref.delete()));
  }
  await db().doc(FUERA).delete();
  await limpiar();
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

test('cada clave escribe solo en los O2O de su manager: no hay cruce (RMR-TSK-0650/0655)', async ({ request }) => {
  // La clave de adminmgr no escribe O2O de quien no está en su rama.
  const ajena = await enviar(request, nota({ source: { system: 'matias', id: 'thread-otro' } }), CLAVE_OTRA);
  expect(ajena.status()).toBe(403);
  expect((await ajena.json()).error).toBe('not_in_scope');
  // Con alguien de su rama, entra en los O2O de adminmgr, no en los del Head.
  const EMAIL_ADM = 'rama.adminmgr@e2e.test';
  const soltar = await hangFrom(db(), 'e2e-person-ingesta-adm', { name: 'Rama Adminmgr E2E', email: EMAIL_ADM, active: true }, 'e2e-adminmgr');
  try {
    const res = await enviar(request, nota({ email: EMAIL_ADM, source: { system: 'matias', id: 'thread-otro' } }), CLAVE_OTRA);
    expect(res.status()).toBe(200);
    const { id } = await res.json();
    const ref = db().doc(`leaders/e2e-adminmgr/o2o/${id}`);
    expect((await ref.get()).data()?.personId).toBe('e2e-person-ingesta-adm');
    await ref.delete();
    // Y la del Head no escribe en quien no es de su rama.
    const delHead = await enviar(request, nota({ email: EMAIL_ADM, source: { system: 'matias', id: 'thread-otro-2' } }));
    expect(delHead.status()).toBe(403);
  } finally {
    await soltar();
  }
  // Y la del Head no puede escribir a nombre de otro manager.
  const cruce = await enviar(request, nota({ managerEmail: 'adminmgr@e2e.test', source: { system: 'matias', id: 'thread-x' } }));
  expect(cruce.status()).toBe(403);
  expect((await cruce.json()).error).toBe('manager_mismatch');
});

test('llega también a quien no tiene el email en la ficha, por su cuenta vinculada', async ({ request }) => {
  // El caso normal en la instancia real: la ficha se ata por uid y el campo
  // `email` está vacío. Sin esto, la ingesta diría «no existe» a casi todos.
  const cuenta = await getAuth().createUser({ email: 'por.cuenta@e2e.test', emailVerified: true });
  const soltar = await hangFrom(db(), POR_UID.split('/')[1], { name: 'Por Cuenta E2E', uid: cuenta.uid, active: true }, 'e2e-head');
  try {
    const res = await enviar(request, nota({ email: 'por.cuenta@e2e.test', source: { system: 'matias', id: 'thread-uid' } }));
    expect(res.status()).toBe(200);
    expect((await res.json()).personId).toBe('e2e-person-ingesta-uid');
  } finally {
    await Promise.all((await o2oDe(POR_UID)).docs.map((d) => d.ref.delete()));
    await soltar();
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

test('el agente consulta el equipo de su manager: solo nombre y correo (RMR-TSK-0657)', async ({ request }) => {
  const EQUIPO = 'http://127.0.0.1:5001/demo-grebla/europe-west1/agentTeam';
  const pedir = (clave) => request.get(EQUIPO, { headers: { Authorization: `Bearer ${clave}` }, failOnStatusCode: false });

  const res = await pedir(CLAVE);
  expect(res.status()).toBe(200);
  const { people } = await res.json();
  expect(people).toContainEqual({ name: 'Ana Ingesta E2E', email: EMAIL });
  // Sin manager de O2O asignado, no sale; y nada más que nombre y correo.
  expect(people.some((p) => p.email === EMAIL_FUERA)).toBe(false);
  expect(people.every((p) => Object.keys(p).toSorted().join() === 'email,name')).toBe(true);

  // La de otro manager no ve al equipo del Head.
  const ajena = await (await pedir(CLAVE_OTRA)).json();
  expect(ajena.people.some((p) => p.email === EMAIL)).toBe(false);

  expect((await pedir('clave-que-no-es')).status()).toBe(401);
});

test('quien está por encima en el directorio, aunque no sea el directo, recibe la nota y ve a la persona (RMR-TSK-0663)', async ({ request }) => {
  // adminmgr → mando intermedio → persona: adminmgr la tiene en su rama sin ser su jefe directo.
  const MEDIO = 'people/e2e-ingesta-medio';
  const NIETA = 'people/e2e-ingesta-nieta';
  const EMAIL_NIETA = 'nieta.ingesta@e2e.test';
  await db().doc(MEDIO).set({ name: 'Mando Medio E2E', uid: 'e2e-medio-uid', active: true, reportsToPersonId: 'e2e-ficha-e2e-adminmgr' });
  await db().doc(NIETA).set({ name: 'Nieta Ingesta E2E', email: EMAIL_NIETA, active: true, reportsToPersonId: 'e2e-ingesta-medio' });
  try {
    await expect.poll(async () => (await db().doc(NIETA).get()).data()?.directoryManagerUids ?? [],
      { timeout: 20_000 }).toEqual(['e2e-medio-uid', 'e2e-adminmgr']);
    const res = await enviar(request, nota({ email: EMAIL_NIETA, source: { system: 'matias', id: 'thread-rama' } }), CLAVE_OTRA);
    expect(res.status()).toBe(200);
    const ref = db().doc(`leaders/e2e-adminmgr/o2o/${(await res.json()).id}`);
    expect((await ref.get()).data()?.personId).toBe('e2e-ingesta-nieta');
    await ref.delete();
    const equipo = await (await request.get('http://127.0.0.1:5001/demo-grebla/europe-west1/agentTeam',
      { headers: { Authorization: `Bearer ${CLAVE_OTRA}` } })).json();
    expect(equipo.people).toContainEqual({ name: 'Nieta Ingesta E2E', email: EMAIL_NIETA });
  } finally {
    // Dar cuenta al mando medio con gente a cargo le pudo hacer líder (RMR-TSK-0660).
    await Promise.all([NIETA, MEDIO, 'leaders/e2e-medio-uid'].map((p) => db().doc(p).delete()));
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
