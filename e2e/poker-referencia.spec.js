/**
 * Referencia de Linear por votación (RMR-TSK-0518).
 *
 * El organizador escribe BB-1234 y la historia aparece al lado de la mesa para
 * todos. Aquí no se llama a Linear (el emulador no tiene clave): la ficha se
 * siembra en la sesión como la dejaría la Cloud Function, y lo que se defiende
 * es lo que hace la mesa con ella —y que una referencia mal escrita se rechace
 * en el navegador, sin molestar a nadie—. El módulo que habla con Linear tiene
 * sus tests en functions/linearIssue.test.js.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const NOMBRE = 'Sesión con referencia E2E';
const FICHA = {
  identifier: 'BB-1234', title: 'Migrar el login a OAuth', description: 'Primera línea.\nSegunda línea.',
  url: 'https://linear.app/tribbu/issue/BB-1234/migrar', estimate: 5, priority: 'High',
  state: 'Backlog', assignee: 'Ana', labels: ['Squad A'], project: 'Login',
};

async function sesion(extra = {}) {
  return db().collection('pokerSessions').add({
    name: NOMBRE, ownerLeaderUid: 'e2e-head', mode: 'simple', scale: 'fibonacci',
    deck: ['1', '2', '3', '5', '8', '13', 'partir'],
    revealed: false, round: 1, status: 'open', createdAt: new Date(), closedAt: null,
    voteTitle: '', voteRef: null, voteIssue: null, ...extra,
  });
}

test.afterEach(async () => {
  const snap = await db().collection('pokerSessions').where('name', '==', NOMBRE).get();
  for (const d of snap.docs) {
    const hijos = await d.ref.collection('players').get();
    await Promise.all(hijos.docs.map((h) => h.ref.delete()));
    await d.ref.delete();
  }
});

const mesa = (page) => page.locator('poker-table');

test('con ficha, la historia se ve al lado de la mesa para quien estima', async ({ page }) => {
  const ref = await sesion({ voteRef: 'BB-1234', voteIssue: FICHA });
  await signInAs(page, 'engineer');
  await page.goto(`/poker?s=${ref.id}`);

  const ficha = mesa(page).getByRole('complementary', { name: 'Historia de Linear' });
  await expect(ficha).toBeVisible();
  await expect(ficha.getByRole('link', { name: /BB-1234/ })).toHaveAttribute('href', FICHA.url);
  await expect(ficha).toContainText('Migrar el login a OAuth');
  await expect(ficha).toContainText('Backlog · estimación 5 · High · Ana · Login');
  await expect(ficha).toContainText('Segunda línea.');
  // Sin título propio, «qué se estima» es el de la historia.
  await expect(mesa(page).getByText('Estimando:')).toContainText('Migrar el login a OAuth');
  // Y quien estima no puede cambiar la referencia.
  await expect(mesa(page).getByLabel('Ref. Linear:')).toHaveCount(0);
});

test('sin referencia no hay panel, y una mal escrita se rechaza sin llamar a nadie', async ({ page }) => {
  const ref = await sesion();
  await signInAs(page, 'head');
  await page.goto(`/poker?s=${ref.id}`);

  await expect(mesa(page).getByRole('complementary')).toHaveCount(0);
  const campo = mesa(page).getByLabel('Ref. Linear:');
  await campo.fill('https://linear.app/tribbu/issue/BB-1234');
  await campo.press('Tab');
  await expect(mesa(page).getByText('La referencia debe tener la forma BB-1234.')).toBeVisible();
  expect((await ref.get()).data().voteRef).toBeNull();
});

test('quitar la referencia quita la ficha para todos', async ({ page }) => {
  const ref = await sesion({ voteRef: 'BB-1234', voteIssue: FICHA });
  await signInAs(page, 'head');
  await page.goto(`/poker?s=${ref.id}`);

  await expect(mesa(page).getByRole('complementary')).toBeVisible();
  const campo = mesa(page).getByLabel('Ref. Linear:');
  await campo.fill('');
  await campo.press('Tab');
  await expect(mesa(page).getByRole('complementary')).toHaveCount(0);
  await expect.poll(async () => (await ref.get()).data().voteIssue, { timeout: 15_000 }).toBeNull();
});
