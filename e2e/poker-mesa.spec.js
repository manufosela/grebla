/**
 * La mesa de Scrum Poker (RMR-TSK-0523): una carta boca abajo por persona que
 * vota, con su nombre debajo y borde verde cuando ha votado; sin lista de
 * personas ni «n/M han votado». «Mostrar votos» solo lo ve el organizador y
 * solo cuando han votado todos. Al revelar, verde si coinciden y rojo en la
 * más baja y la más alta. El organizador tiene pestañas Mesa y Tareas.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const NOMBRE = 'Mesa de cartas E2E';
const MAZO = ['1', '2', '3', '5', '8', '13', 'partir'];

async function sesion({ revealed = false, votos = [] } = {}) {
  const ref = await db().collection('pokerSessions').add({
    name: NOMBRE, ownerLeaderUid: 'e2e-head', ownerVotes: true, mode: 'simple', scale: 'fibonacci', deck: MAZO,
    tasks: [], currentTaskId: null, revealed, round: 1, status: 'open', createdAt: new Date(), closedAt: null,
  });
  let i = 0;
  for (const value of votos) {
    const uid = `e2e-mesa-${i}`;
    await ref.collection('players').doc(uid).set({ name: `Votante ${i}`, votedRound: value === null ? null : 1 });
    if (value !== null) await ref.collection('votes').doc(uid).set({ value, round: 1 });
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

const mesa = (page) => page.locator('poker-table');
const carta = (page, nombre) => mesa(page).locator('.seat', { hasText: nombre }).locator('.flip');

test('quien vota ve una carta boca abajo por persona, con borde verde en las que ya votaron', async ({ page }) => {
  const ref = await sesion({ votos: ['5', null] });
  await signInAs(page, 'engineer');
  await page.goto(`/poker?s=${ref.id}`);

  // Dos sentados más yo: tres cartas, ninguna girada.
  await expect(mesa(page).locator('.seat')).toHaveCount(3);
  await expect(mesa(page).locator('.flip.up')).toHaveCount(0);
  await expect(carta(page, 'Votante 0')).toHaveClass(/voted/);
  await expect(carta(page, 'Votante 1')).not.toHaveClass(/voted/);
  // Sin lista ni contador, y sin el botón del organizador.
  await expect(mesa(page).locator('.players')).toHaveCount(0);
  await expect(mesa(page).getByText(/han votado/)).toHaveCount(0);
  await expect(mesa(page).getByRole('button', { name: 'Mostrar votos' })).toHaveCount(0);
  await expect(mesa(page).getByRole('tab', { name: 'Tareas' })).toHaveCount(0);

  // Voto y mi carta se marca.
  await mesa(page).getByRole('tab', { name: 'Carta directa' }).click();
  await mesa(page).getByRole('button', { name: '8', exact: true }).click();
  await expect(carta(page, 'Ingeniero E2E')).toHaveClass(/voted/);
});

test('el organizador solo puede destapar cuando han votado todos', async ({ page }) => {
  const ref = await sesion({ votos: ['5', null] });
  await signInAs(page, 'head');
  await page.goto(`/poker?s=${ref.id}`);

  await expect(mesa(page).getByRole('tab', { name: 'Mesa' })).toHaveAttribute('aria-selected', 'true');
  await expect(mesa(page).getByRole('tab', { name: 'Tareas' })).toBeVisible();
  const mostrar = mesa(page).getByRole('button', { name: 'Mostrar votos' });
  await expect(mostrar).toBeDisabled();

  // El organizador también vota (ownerVotes): en cuanto vota él y el que faltaba, se puede destapar.
  await mesa(page).getByRole('tab', { name: 'Carta directa' }).click();
  await mesa(page).getByRole('button', { name: '5', exact: true }).click();
  await ref.collection('players').doc('e2e-mesa-1').update({ votedRound: 1 });
  await ref.collection('votes').doc('e2e-mesa-1').set({ value: '5', round: 1 });
  await expect(mostrar).toBeEnabled();
  await mostrar.click();
  await expect.poll(async () => (await ref.get()).data().revealed, { timeout: 15_000 }).toBe(true);
});

test('al revelar, verde si coinciden y rojo en la más baja y la más alta', async ({ page }) => {
  const ref = await sesion({ revealed: true, votos: ['3', '8', '5', '8'] });
  await signInAs(page, 'engineer');
  await page.goto(`/poker?s=${ref.id}`);

  // Cuatro votantes y yo, que llego tarde: cinco cartas giradas, la mía vacía.
  await expect(mesa(page).locator('.flip.up')).toHaveCount(5);
  await expect(carta(page, 'Ingeniero E2E')).toHaveClass(/tone-empty/);
  await expect(carta(page, 'Votante 0')).toHaveClass(/tone-low/);
  await expect(carta(page, 'Votante 1')).toHaveClass(/tone-high/);
  await expect(carta(page, 'Votante 2')).toHaveClass(/tone-plain/);
  await expect(carta(page, 'Votante 3')).toHaveClass(/tone-high/);
  await expect(mesa(page).locator('.verdict')).toContainText('Más baja 3 · más alta 8');
  await expect(mesa(page).locator('.verdict')).not.toContainText('Media');
  // Quien vota no decide qué pasa después.
  await expect(mesa(page).getByRole('button', { name: /Volver a votar|Nueva votación|Guardar/ })).toHaveCount(0);

  await ref.update({ revealed: false });
  await ref.collection('votes').doc('e2e-mesa-0').set({ value: '8', round: 1 });
  await ref.collection('votes').doc('e2e-mesa-2').set({ value: '8', round: 1 });
  await ref.update({ revealed: true });
  await expect(mesa(page).locator('.flip.tone-agree')).toHaveCount(4);
  await expect(mesa(page).locator('.verdict')).toContainText('Todas las cartas dicen 8');
});
