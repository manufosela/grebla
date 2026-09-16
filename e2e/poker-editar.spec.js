/**
 * Editar una sesión creada (RMR-TSK-0526): nombre, escala, si vota el
 * organizador y las tareas, desde la lista o desde la mesa. Lo guardado llega
 * a todos sin recargar: la lista y la mesa están suscritas.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const NOMBRE = 'Sesión editable E2E';
const RENOMBRADA = 'Sesión editada E2E';

async function sesion(extra = {}) {
  return db().collection('pokerSessions').add({
    name: NOMBRE, ownerLeaderUid: 'e2e-head', ownerVotes: true, mode: 'simple', scale: 'fibonacci',
    deck: ['1', '2', '3', '5', '8', '13', 'partir'],
    tasks: [{ id: 'a', title: 'Tarea A', value: '5' }, { id: 'b', title: 'Tarea B', value: null }],
    currentTaskId: 'b', revealed: false, round: 1, status: 'open', createdAt: new Date(), closedAt: null, ...extra,
  });
}

test.afterEach(async () => {
  for (const name of [NOMBRE, RENOMBRADA]) {
    const snap = await db().collection('pokerSessions').where('name', '==', name).get();
    for (const d of snap.docs) {
      const hijos = await d.ref.collection('players').get();
      await Promise.all(hijos.docs.map((h) => h.ref.delete()));
      await d.ref.delete();
    }
  }
});

const fila = (page, nombre) => page.getByRole('row', { name: new RegExp(nombre) });
const editor = (page) => page.locator('poker-app poker-session-editor');

test('el organizador edita desde la lista: nombre, tareas y si vota; la estimada no se quita', async ({ page }) => {
  const ref = await sesion();
  await signInAs(page, 'head');
  await page.goto('/poker');

  await fila(page, NOMBRE).getByRole('button', { name: 'Editar' }).click();
  const ed = editor(page);
  await ed.getByLabel('Nombre').fill(RENOMBRADA);
  await ed.getByRole('checkbox', { name: 'Yo también voto' }).uncheck();
  // La tarea ya estimada no se puede quitar; la pendiente se renombra y se añade otra.
  await expect(ed.getByRole('button', { name: 'Quitar Tarea A' })).toBeDisabled();
  await ed.getByLabel('Tarea 2').fill('Tarea B bis');
  await ed.getByLabel('Tarea 2').press('Tab');
  await ed.getByLabel('Nueva tarea').fill('Tarea C');
  await ed.getByRole('button', { name: 'Añadir', exact: true }).click();
  await ed.getByRole('button', { name: 'Subir Tarea C' }).click();
  await ed.getByRole('button', { name: 'Guardar cambios' }).click();

  await expect.poll(async () => (await ref.get()).data().name, { timeout: 15_000 }).toBe(RENOMBRADA);
  const s = (await ref.get()).data();
  expect(s.ownerVotes).toBe(false);
  expect(s.tasks.map((t) => [t.title, t.value])).toEqual([['Tarea A', '5'], ['Tarea C', null], ['Tarea B bis', null]]);
  // La actual sigue siendo B (sigue pendiente), aunque haya cambiado de sitio.
  expect(s.currentTaskId).toBe('b');
  // La lista lo refleja sin recargar.
  await expect(fila(page, RENOMBRADA)).toBeVisible();
  await expect(fila(page, NOMBRE)).toHaveCount(0);
});

test('quien mira la lista o la mesa ve el cambio del organizador al momento', async ({ page }) => {
  const ref = await sesion();
  await signInAs(page, 'engineer');
  await page.goto(`/poker?s=${ref.id}`);
  await expect(page.locator('poker-table').getByText('Estimando:')).toContainText('Tarea B');

  // Cambia el organizador (por detrás): tarea actual renombrada y escala a tallas.
  await ref.update({
    tasks: [{ id: 'a', title: 'Tarea A', value: '5' }, { id: 'b', title: 'Tarea B revisada', value: null }],
    scale: 'tallas', deck: ['XS', 'S', 'M', 'L', 'XL', 'partir'],
  });
  await expect(page.locator('poker-table').getByText('Estimando:')).toContainText('Tarea B revisada');
  await page.locator('poker-table').getByRole('tab', { name: 'Carta directa' }).click();
  await expect(page.locator('poker-table').getByRole('button', { name: 'XL', exact: true })).toBeVisible();

  await page.locator('poker-app').getByRole('button', { name: '← Volver a las sesiones' }).click();
  await ref.update({ name: RENOMBRADA });
  await expect(fila(page, RENOMBRADA)).toBeVisible();
});

test('desde la mesa, el organizador también tiene Editar sesión', async ({ page }) => {
  const ref = await sesion();
  await signInAs(page, 'head');
  await page.goto(`/poker?s=${ref.id}`);

  await page.locator('poker-app').getByRole('button', { name: /Editar sesión/ }).click();
  await expect(editor(page).getByLabel('Nombre')).toHaveValue(NOMBRE);
  await editor(page).getByRole('button', { name: 'Cancelar' }).click();
  await expect(editor(page)).toHaveCount(0);
});
