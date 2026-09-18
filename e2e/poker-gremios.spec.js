/**
 * Poker por gremios · F1 (RMR-PCS-0043): cada tarea lleva sus gremios. El PM los
 * marca al convocar (QA va por defecto), los cambia sobre la tarea actual en la
 * mesa y todos lo ven. Sin ninguno, la tarea es general y se avisa.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const NOMBRE = 'Sesión por gremios E2E';
const GREMIOS = { 'e2e-g-qa': 'QA', 'e2e-g-php': 'PHP', 'e2e-g-ios': 'iOS', 'e2e-g-mio': 'Personal' };

test.beforeEach(async () => {
  for (const [id, name] of Object.entries(GREMIOS)) {
    await db().doc(`guilds/${id}`).set(name === 'Personal' ? { name, ownerLeaderUid: 'e2e-head' } : { name });
  }
});

test.afterEach(async () => {
  for (const id of Object.keys(GREMIOS)) await db().doc(`guilds/${id}`).delete();
  const snap = await db().collection('pokerSessions').where('name', '==', NOMBRE).get();
  for (const d of snap.docs) {
    for (const sub of ['players', 'votes']) {
      const hijos = await d.ref.collection(sub).get();
      await Promise.all(hijos.docs.map((h) => h.ref.delete()));
    }
    await d.ref.delete();
  }
});

const fila = (page, titulo) => page.locator('poker-app guild-picker', { has: page.locator(`[aria-label="Gremios de ${titulo}"]`) });

test('al convocar, cada tarea lleva sus gremios: QA por defecto, editable, y sin ninguno es general', async ({ page }) => {
  await signInAs(page, 'head');
  await page.goto('/poker');
  await page.getByRole('tab', { name: 'Convocar' }).click();
  await page.getByPlaceholder(/Nombre de la sesión/).fill(NOMBRE);
  await page.getByRole('textbox', { name: /Tareas a estimar/ }).fill('BB-1 - Pago con Bizum\nBB-2 - Nota de prensa');

  const pago = fila(page, 'BB-1 - Pago con Bizum');
  const prensa = fila(page, 'BB-2 - Nota de prensa');
  await expect(pago.getByRole('checkbox', { name: 'QA' })).toBeChecked();
  await expect(pago.getByRole('checkbox', { name: 'Personal' })).toHaveCount(0); // los gremios personales no son de la organización
  await pago.getByRole('checkbox', { name: 'PHP' }).check();
  await prensa.getByRole('checkbox', { name: 'QA' }).uncheck();
  await expect(prensa).toContainText('tarea general');
  await page.getByRole('button', { name: 'Crear sesión' }).click();

  await expect.poll(async () => {
    const snap = await db().collection('pokerSessions').where('name', '==', NOMBRE).get();
    return snap.docs[0]?.data().tasks.map((t) => t.guilds);
  }).toEqual([['PHP', 'QA'], []]);
});

test('en la mesa, el organizador cambia los gremios de la tarea actual y quien vota los ve', async ({ page, browser }) => {
  const ref = await db().collection('pokerSessions').add({
    name: NOMBRE, ownerLeaderUid: 'e2e-head', ownerVotes: true, mode: 'simple', scale: 'fibonacci',
    deck: ['1', '2', '3', '5', '8', '13', 'partir'],
    tasks: [{ id: 't1', title: 'BB-1 - Pago con Bizum', value: null, guilds: ['QA'] }],
    currentTaskId: 't1', revealed: false, round: 1, status: 'open', createdAt: new Date(), closedAt: null,
  });
  await signInAs(page, 'head');
  await page.goto(`/poker?s=${ref.id}`);
  const mesa = page.locator('poker-table');
  const casillas = mesa.locator('guild-picker');
  await expect(casillas.getByRole('checkbox', { name: 'QA' })).toBeChecked();
  await casillas.getByRole('checkbox', { name: 'iOS' }).check();
  await expect.poll(async () => (await ref.get()).data().tasks[0].guilds).toEqual(['iOS', 'QA']);

  // Quien vota lo ve como chips, sin poder tocarlo.
  const ctx = await browser.newContext();
  const otra = await ctx.newPage();
  await signInAs(otra, 'engineer');
  await otra.goto(`/poker?s=${ref.id}`);
  const vista = otra.locator('poker-table guild-picker');
  await expect(vista).toContainText('iOS');
  await expect(vista).toContainText('QA');
  await expect(vista.getByRole('checkbox')).toHaveCount(0);
  await ctx.close();
});
