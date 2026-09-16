/**
 * Votar por complejidad × esfuerzo (RMR-TSK-0516).
 *
 * El cuadro del taller «Estimar en magnitud» da la carta a partir de dos ejes
 * del 1 al 5. Lo que se defiende aquí: que la mesa ofrezca las dos pestañas,
 * que la casilla se calcule como en el cuadro (3×3 = 8; 5×4 = partir), que el
 * voto guarde los ejes, y que al revelar se vean junto a la carta, porque el
 * debate empieza por descomponer el número.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const NOMBRE = 'Sesión por ejes E2E';
const MAZO = ['1', '2', '3', '5', '8', '13', 'partir'];

async function sesion({ revealed = false, votos = [] } = {}) {
  const ref = await db().collection('pokerSessions').add({
    name: NOMBRE, ownerLeaderUid: 'e2e-head', mode: 'simple',
    scale: 'fibonacci', deck: MAZO,
    tasks: [], currentTaskId: null, votingActive: true, results: {},
    revealed, round: 1, status: 'open', createdAt: new Date(), closedAt: null, squad: null,
  });
  let i = 0;
  for (const voto of votos) {
    const uid = `e2e-ejes-${i}`;
    await ref.collection('players').doc(uid).set({ name: `Votante ${i}`, votedRound: 1 });
    await ref.collection('votes').doc(uid).set({ round: 1, ...voto });
    i += 1;
  }
  return ref;
}

test.afterEach(async () => {
  const snap = await db().collection('pokerSessions').where('name', '==', NOMBRE).get();
  for (const d of snap.docs) {
    for (const sub of ['players', 'votes']) {
      const hijos = await d.ref.collection(sub).get();
      await Promise.all(hijos.docs.map((h) => h.ref.delete()));
    }
    await d.ref.delete();
  }
});

const eje = (page, nombre) => page.getByRole('group', { name: nombre });
const nivel = (page, nombreEje, n) => eje(page, nombreEje).getByRole('button', { name: String(n), exact: true });

test('los dos ejes dan la carta del cuadro, y el voto guarda los ejes', async ({ page }) => {
  const ref = await sesion();
  await signInAs(page, 'engineer');
  await page.goto(`/poker?s=${ref.id}`);

  await expect(page.getByRole('tab', { name: 'Complejidad y esfuerzo' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Carta directa' })).toBeVisible();
  await expect(page.getByText('Marca los dos ejes para ver tu carta.')).toBeVisible();

  await nivel(page, 'Complejidad', 3).click();
  await nivel(page, 'Esfuerzo', 3).click();
  await expect(page.getByText('Tu carta es 8.')).toBeVisible();

  // La diagonal dispara el número: 5×4 ya no se estima, se parte.
  await nivel(page, 'Complejidad', 5).click();
  await nivel(page, 'Esfuerzo', 4).click();
  await expect(page.getByText(/hay que partirla/)).toBeVisible();

  await nivel(page, 'Complejidad', 5).click();
  await nivel(page, 'Esfuerzo', 1).click();
  await expect(page.getByText('Tu carta es 8.')).toBeVisible();
  await page.getByRole('button', { name: 'Votar 8' }).click();
  await expect(page.getByRole('button', { name: /Votado 8/ })).toBeDisabled();

  await expect.poll(async () => {
    const snap = await ref.collection('votes').doc('e2e-engineer').get();
    return snap.exists ? snap.data() : null;
  }, { timeout: 15_000 }).toEqual({ value: '8', round: 1, axes: { complexity: 5, effort: 1 } });
});

test('la carta directa sigue ahí, en su pestaña', async ({ page }) => {
  const ref = await sesion();
  await signInAs(page, 'engineer');
  await page.goto(`/poker?s=${ref.id}`);

  await page.getByRole('tab', { name: 'Carta directa' }).click();
  await expect(eje(page, 'Complejidad')).toHaveCount(0);
  await page.getByRole('button', { name: '13', exact: true }).click();

  await expect.poll(async () => {
    const snap = await ref.collection('votes').doc('e2e-engineer').get();
    return snap.exists ? snap.data() : null;
  }, { timeout: 15_000 }).toEqual({ value: '13', round: 1 });
});

test('al revelar, quien votó por ejes enseña su C·E junto a la carta', async ({ page }) => {
  const ref = await sesion({
    revealed: true,
    votos: [{ value: '8', axes: { complexity: 5, effort: 1 } }, { value: '8' }],
  });
  await signInAs(page, 'engineer');
  await page.goto(`/poker?s=${ref.id}`);

  const jugadores = page.locator('poker-table').locator('.seat');
  await expect(jugadores.filter({ hasText: 'Votante 0' })).toContainText('C5·E1');
  await expect(jugadores.filter({ hasText: 'Votante 1' })).not.toContainText('C');
});
