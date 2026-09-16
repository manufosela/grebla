/**
 * Borrar una sesión de Scrum Poker (RMR-BUG-0119).
 *
 * Fallaba con «sin permisos» en cuanto alguien había votado: borrar en cascada
 * listaba /votes, y esa lectura está prohibida mientras la sesión no se revela
 * —también al dueño—, porque la ocultación del voto es real. Ahora borrar es
 * cerrar: la sesión desaparece de la lista sin tocar los votos de nadie. Y el
 * botón solo sale en las sesiones propias: las de otro líder de la rama las
 * reglas no las dejan tocar, y ofrecer un botón que va a fallar es engañar.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const NOMBRE = 'Sesión a borrar E2E';

async function sesion(name, ownerLeaderUid) {
  const ref = await db().collection('pokerSessions').add({
    name, ownerLeaderUid, mode: 'simple', scale: 'fibonacci',
    deck: ['1', '2', '3', '5', '8', '13', 'partir'],
    tasks: [], currentTaskId: null, votingActive: true, results: {},
    revealed: false, round: 1, status: 'open', createdAt: new Date(), closedAt: null, squad: null,
  });
  // Un voto OCULTO de otra persona: es lo que hacía fallar el borrado.
  await ref.collection('players').doc('e2e-otro').set({ name: 'Otro', votedRound: 1 });
  await ref.collection('votes').doc('e2e-otro').set({ value: '5', round: 1 });
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

test('el dueño borra su sesión aunque haya votos ocultos, y desaparece de la lista', async ({ page }) => {
  const ref = await sesion(NOMBRE, 'e2e-head');
  await signInAs(page, 'head');
  await page.goto('/poker');

  const fila = page.getByRole('row', { name: new RegExp(NOMBRE) });
  await expect(fila).toBeVisible();
  await fila.getByRole('button', { name: 'Borrar' }).click();
  // Pide confirmación (RMR-BUG-0120): un clic no borra nada. El texto y los
  // botones son hijos de <app-modal> (slot), no de su panel interno.
  const modal = page.locator('poker-app app-modal');
  // El host del modal mide 0 (su capa es fixed): lo visible es el texto.
  await expect(modal.locator('.modal-text')).toBeVisible();
  await expect(modal).toContainText(NOMBRE);
  await modal.getByRole('button', { name: 'Cancelar' }).click();
  await expect(fila).toBeVisible();
  expect((await ref.get()).data().status).toBe('open');

  await fila.getByRole('button', { name: 'Borrar' }).click();
  await modal.getByRole('button', { name: 'Sí, borrar' }).click();
  await expect(fila).toHaveCount(0);
  await expect(page.locator('poker-app').locator('.error')).toHaveCount(0);

  await expect.poll(async () => (await ref.get()).data()?.status, { timeout: 15_000 }).toBe('closed');
  // Los votos siguen siendo de quien los emitió: no se ha tocado ninguno.
  expect((await ref.collection('votes').doc('e2e-otro').get()).exists).toBe(true);
});
