/**
 * La historia de Linear en la mesa (RMR-TSK-0518, RMR-TSK-0524).
 *
 * La decide el organizador: si el título de la tarea lleva referencia, tiene
 * el botón para cargarla; al cargarla se abre en un modal en todas las
 * pantallas. Él la cierra para todos; cada participante puede cerrar la suya.
 * Aquí no se llama a Linear (el emulador no tiene clave): la ficha se siembra
 * como la deja la Cloud Function. El módulo que habla con Linear tiene sus
 * tests en functions/linearIssue.test.js.
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
  identifier: 'BB-1234', title: 'Migrar el login a OAuth',
  description: '## Criterios\nPrimera línea.\nSegunda línea.\n\n- [x] **Botón** de login\n- Cuenta [vinculada](https://ejemplo.test/doc)\n\n<img src=x onerror=alert(1)> y [nada](javascript:alert(1))',
  url: 'https://linear.app/tribbu/issue/BB-1234/migrar', estimate: 5, priority: 'High',
  state: 'Backlog', assignee: 'Ana', labels: ['Squad A'], project: 'Login',
};
const TAREA = { id: 'a', title: 'BB-1234 - Migrar el login a OAuth', value: null };

async function sesion(extra = {}) {
  return db().collection('pokerSessions').add({
    name: NOMBRE, ownerLeaderUid: 'e2e-head', ownerVotes: true, mode: 'simple', scale: 'fibonacci',
    deck: ['1', '2', '3', '5', '8', '13', 'partir'],
    tasks: [TAREA], currentTaskId: 'a',
    revealed: false, round: 1, status: 'open', createdAt: new Date(), closedAt: null,
    voteTitle: '', voteRef: null, voteIssue: null, issueOpen: false, ...extra,
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
const modal = (page) => mesa(page).locator('app-modal');

test('con la historia abierta por el organizador, quien estima la ve en un modal y puede cerrar la suya', async ({ page }) => {
  const ref = await sesion({ voteRef: 'BB-1234', voteIssue: FICHA, issueOpen: true });
  await signInAs(page, 'engineer');
  await page.goto(`/poker?s=${ref.id}`);

  const m = modal(page);
  await expect(m.locator('.issue')).toBeVisible();
  await expect(m).toContainText('Segunda línea.');
  // El Markdown se ve con formato (RMR-TSK-0527)…
  const md = m.locator('markdown-view');
  await expect(md.getByRole('heading', { name: 'Criterios' })).toBeVisible();
  await expect(md.locator('strong')).toHaveText('Botón');
  await expect(md.getByRole('link', { name: 'vinculada' })).toHaveAttribute('href', 'https://ejemplo.test/doc');
  await expect(md.locator('li')).toHaveCount(2);
  // …y lo peligroso se queda en texto: ni imagen inyectada ni enlace javascript.
  await expect(md.locator('img')).toHaveCount(0);
  await expect(md).toContainText('<img src=x onerror=alert(1)>');
  await expect(md.getByRole('link', { name: 'nada' })).toHaveCount(0);
  await expect(m).toContainText('Backlog · estimación 5 · High · Ana · Login');
  await expect(m.getByRole('link', { name: /Abrir en Linear/ })).toHaveAttribute('href', FICHA.url);
  // Quien estima no la cierra para los demás.
  await expect(m.getByRole('button', { name: 'Cerrar para todos' })).toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(m).toHaveCount(0);
  expect((await ref.get()).data().issueOpen).toBe(true);
});

test('el organizador tiene el botón solo si el título lleva referencia, y cierra para todos', async ({ page }) => {
  const ref = await sesion({ voteRef: 'BB-1234', voteIssue: FICHA, issueOpen: true });
  await signInAs(page, 'head');
  await page.goto(`/poker?s=${ref.id}`);

  await modal(page).getByRole('button', { name: 'Cerrar para todos' }).click();
  await expect.poll(async () => (await ref.get()).data().issueOpen, { timeout: 15_000 }).toBe(false);
  await expect(modal(page)).toHaveCount(0);
  // Ya cargada: se puede volver a mostrar.
  await expect(mesa(page).getByRole('button', { name: 'Mostrar historia BB-1234' })).toBeVisible();
  await mesa(page).getByRole('button', { name: 'Mostrar historia BB-1234' }).click();
  await expect.poll(async () => (await ref.get()).data().issueOpen, { timeout: 15_000 }).toBe(true);

  // Sin referencia en el título no hay nada que cargar.
  await ref.update({ tasks: [{ id: 'a', title: 'Migrar el login a OAuth', value: null }], issueOpen: false });
  await expect(mesa(page).getByRole('button', { name: /historia/ })).toHaveCount(0);
});

test('sin cargar todavía, el organizador ve «Cargar historia» con la referencia del título', async ({ page }) => {
  const ref = await sesion();
  await signInAs(page, 'head');
  await page.goto(`/poker?s=${ref.id}`);

  await expect(mesa(page).getByRole('button', { name: 'Cargar historia BB-1234' })).toBeVisible();
  await expect(modal(page)).toHaveCount(0);
});

test('cerrada para todos, quien vota puede reabrir la historia en local para releerla (RMR-TSK-0536)', async ({ page }) => {
  const ref = await sesion({ voteRef: 'BB-1234', voteIssue: FICHA, issueOpen: false });
  await signInAs(page, 'engineer');
  await page.goto(`/poker?s=${ref.id}`);

  await expect(modal(page)).toHaveCount(0);
  await mesa(page).getByRole('button', { name: 'Ver historia BB-1234' }).click();
  await expect(modal(page).locator('.issue')).toBeVisible();
  await expect(modal(page)).toContainText('Segunda línea.');
  // Solo en su pantalla: la sesión sigue cerrada para todos.
  expect((await ref.get()).data().issueOpen).toBe(false);
  await page.keyboard.press('Escape');
  await expect(modal(page)).toHaveCount(0);
  await expect(mesa(page).getByRole('button', { name: 'Ver historia BB-1234' })).toBeVisible();
});
