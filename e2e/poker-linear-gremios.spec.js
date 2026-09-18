/**
 * Poker por gremios · F5 (RMR-PCS-0043): enviar a Linear las estimaciones por
 * gremio de una tarea cerrada. Aquí no se llama a Linear (el emulador no tiene
 * clave): se fija que el botón sale solo al organizador con tarea cerrada por
 * gremios y referencia (sin pulsarlo: escribiría en Linear real), y que con envío hecho se ven
 * los enlaces.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const NOMBRE = 'Sesión linear gremios E2E';

async function sesion(tasks) {
  return db().collection('pokerSessions').add({
    name: NOMBRE, ownerLeaderUid: 'e2e-head', ownerVotes: true, mode: 'simple', scale: 'fibonacci',
    deck: ['1', '2', '3', '5', '8', '13', 'partir'], tasks, currentTaskId: null,
    revealed: false, round: 3, status: 'finished', createdAt: new Date(), closedAt: null,
  });
}

test.afterEach(async () => {
  const snap = await db().collection('pokerSessions').where('name', '==', NOMBRE).get();
  for (const d of snap.docs) await d.ref.delete();
});

const mesa = (page) => page.locator('poker-table');

test('el organizador ve el botón solo en la tarea cerrada por gremios con referencia; quien no organiza, no', async ({ page, browser }) => {
  const ref = await sesion([
    { id: 't1', title: 'BB-1 - Pago con Bizum', value: '8', values: { 'Backend PHP': '3', QA: '8' }, guilds: ['Backend PHP', 'QA'] },
    { id: 't2', title: 'Sin referencia', value: '5', values: { QA: '5' }, guilds: ['QA'] },
  ]);
  await signInAs(page, 'head');
  await page.goto(`/poker?s=${ref.id}`);
  const fila1 = mesa(page).locator('.results li', { hasText: 'BB-1' });
  const fila2 = mesa(page).locator('.results li', { hasText: 'Sin referencia' });
  await expect(fila1.getByRole('button', { name: 'Sub-issues en Linear' })).toBeVisible();
  await expect(fila2.getByRole('button', { name: 'Sub-issues en Linear' })).toHaveCount(0);
  // NO se pulsa: si el emulador tiene una clave de Linear en local, escribiría
  // sub-issues REALES. El camino de envío y sus errores lo cubren los tests
  // unitarios de functions/linearIssue.js con fetch falso.
  await expect(fila1.getByRole('button', { name: 'Sub-issues en Linear' })).toBeEnabled();

  // Quien no organiza no tiene botón.
  const ctx = await browser.newContext();
  const otra = await ctx.newPage();
  await signInAs(otra, 'engineer');
  await otra.goto(`/poker?s=${ref.id}`);
  await expect(mesa(otra).locator('.results li', { hasText: 'BB-1' })).toContainText('Backend PHP 3');
  await expect(mesa(otra).getByRole('button', { name: 'Sub-issues en Linear' })).toHaveCount(0);
  await ctx.close();
});

test('con el envío hecho, todos ven los enlaces a las sub-issues', async ({ page }) => {
  const ref = await sesion([{
    id: 't1', title: 'BB-1 - Pago con Bizum', value: '8', values: { 'Backend PHP': '3', QA: '8' }, guilds: ['Backend PHP', 'QA'],
    linear: { parent: { identifier: 'BB-1', url: 'https://linear.app/t/issue/BB-1' }, at: '2026-09-18T12:00:00Z', subIssues: [
      { guild: 'Backend PHP', identifier: 'BB-2', url: 'https://linear.app/t/issue/BB-2' },
      { guild: 'QA', identifier: 'BB-3', url: 'https://linear.app/t/issue/BB-3' },
    ] },
  }]);
  await signInAs(page, 'engineer');
  await page.goto(`/poker?s=${ref.id}`);
  const fila = mesa(page).locator('.results li', { hasText: 'BB-1' });
  await expect(fila.getByRole('link', { name: /QA BB-3/ })).toHaveAttribute('href', 'https://linear.app/t/issue/BB-3');
  await expect(fila.getByRole('link', { name: /Backend PHP BB-2/ })).toBeVisible();
  await expect(fila.getByRole('button', { name: 'Sub-issues en Linear' })).toHaveCount(0);
});
