/**
 * La lista de sesiones (RMR-BUG-0121): las abiertas de la organización las ve
 * todo el mundo, sea de quien sea; Borrar solo sale en las propias; las
 * terminadas se pueden abrir para ver lo estimado.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const ABIERTA = 'Sesión del superadmin para todos E2E';
const TERMINADA = 'Sesión terminada E2E';

async function sesion(name, extra) {
  return db().collection('pokerSessions').add({
    name, ownerLeaderUid: 'e2e-superadmin', ownerVotes: true, mode: 'simple', scale: 'fibonacci',
    deck: ['1', '2', '3', '5', '8', '13', 'partir'], tasks: [], currentTaskId: null,
    revealed: false, round: 1, status: 'open', createdAt: new Date(), closedAt: null, ...extra,
  });
}

test.afterEach(async () => {
  for (const name of [ABIERTA, TERMINADA]) {
    const snap = await db().collection('pokerSessions').where('name', '==', name).get();
    for (const d of snap.docs) {
      const hijos = await d.ref.collection('players').get();
      await Promise.all(hijos.docs.map((h) => h.ref.delete()));
      await d.ref.delete();
    }
  }
});

const fila = (page, nombre) => page.getByRole('row', { name: new RegExp(nombre) });

test('quien estima ve la sesión abierta de otro organizador, sin Borrar', async ({ page }) => {
  await sesion(ABIERTA);
  await signInAs(page, 'engineer');
  await page.goto('/poker');

  await expect(page.getByText('Sesiones abiertas de la organización')).toBeVisible();
  await expect(fila(page, ABIERTA).getByRole('button', { name: 'Abrir' })).toBeVisible();
  await expect(fila(page, ABIERTA).getByRole('button', { name: 'Borrar' })).toHaveCount(0);
});

test('otro manager también la ve, y solo puede borrar las suyas', async ({ page }) => {
  await sesion(ABIERTA);
  await signInAs(page, 'head');
  await page.goto('/poker');

  await expect(fila(page, ABIERTA).getByRole('button', { name: 'Abrir' })).toBeVisible();
  await expect(fila(page, ABIERTA).getByRole('button', { name: 'Borrar' })).toHaveCount(0);
});

test('las terminadas se listan aparte y se abren para ver lo estimado', async ({ page }) => {
  await sesion(TERMINADA, { status: 'finished', tasks: [{ id: 'a', title: 'Tarea A', value: '5' }] });
  await signInAs(page, 'engineer');
  await page.goto('/poker');

  await expect(page.getByText('Terminadas:')).toBeVisible();
  await fila(page, TERMINADA).getByRole('button', { name: 'Ver resultados' }).click();
  await expect(page.locator('poker-table .results li').first()).toContainText('Tarea A');
});
