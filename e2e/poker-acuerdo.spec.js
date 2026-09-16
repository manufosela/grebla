/**
 * El acuerdo de una estimación (RMR-TSK-0482).
 *
 * Dos cosas que la mesa daba por buenas y no lo eran: cantaba «consenso» cuando
 * todo el equipo votaba «?» —coincidir en no saber no es estar de acuerdo—, y
 * no dejaba rastro de qué se había estimado. Ahora la votación tiene título, el
 * acuerdo se guarda con su ronda, y sin unanimidad no se ofrece cerrar.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const NOMBRE = 'Sesión de acuerdo E2E';

/** Sesión abierta del head, con un voto ya emitido por otra persona. */
async function sesionCon(votos) {
  const ref = await db().collection('pokerSessions').add({
    name: NOMBRE, ownerLeaderUid: 'e2e-head', mode: 'simple',
    scale: 'fibonacci', deck: ['1', '2', '3', '5', '8', '13', 'partir'],
    tasks: [], currentTaskId: null, votingActive: true, results: {},
    revealed: true, round: 1, status: 'open', createdAt: new Date(), closedAt: null, squad: null,
  });
  let i = 0;
  for (const valor of votos) {
    const uid = `e2e-votante-${i}`;
    await ref.collection('players').doc(uid).set({ name: `Votante ${i}`, votedRound: 1 });
    await ref.collection('votes').doc(uid).set({ value: valor, round: 1 });
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

const resumen = (page) => page.locator('poker-table').evaluate(
  (el) => el.shadowRoot?.querySelector('.summary')?.textContent?.trim() ?? '',
);

test('todo el equipo votando «partir» SÍ es acuerdo: hay que partirla', async ({ page }) => {
  // Coincidir en que es demasiado grande es una decisión, no una duda
  // (RMR-TSK-0521). Lo que nunca fue acuerdo, coincidir en «?», ya no está en
  // el mazo: se pregunta antes de votar.
  const ref = await sesionCon(['partir', 'partir']);
  await signInAs(page, 'head');
  await page.goto('/poker');
  await page.getByRole('row', { name: new RegExp(NOMBRE) }).getByRole('button', { name: 'Abrir' }).click();
  await page.locator('poker-table').waitFor();

  await expect.poll(() => resumen(page)).toContain('Todas las cartas dicen partir');
  await ref.delete();
});

test('sin unanimidad no se ofrece cerrar por mayoría ni por la media', async ({ page }) => {
  const ref = await sesionCon(['3', '8']);
  await signInAs(page, 'head');
  await page.goto('/poker');
  await page.getByRole('row', { name: new RegExp(NOMBRE) }).getByRole('button', { name: 'Abrir' }).click();
  await page.locator('poker-table').waitFor();

  await expect.poll(() => resumen(page)).toContain('Más baja 3 · más alta 8');
  expect(await resumen(page)).not.toMatch(/Media/);
  const botones = await page.locator('poker-table').evaluate(
    (el) => [...(el.shadowRoot?.querySelectorAll('.summary button') ?? [])].map((b) => b.textContent.trim()),
  );
  expect(botones).toEqual([]);
  await ref.delete();
});

test('con unanimidad se guarda el acuerdo, con su título y su ronda', async ({ page }) => {
  const ref = await sesionCon(['5', '5']);
  await ref.update({ voteTitle: 'Migrar el login' });
  await signInAs(page, 'head');
  await page.goto('/poker');
  await page.getByRole('row', { name: new RegExp(NOMBRE) }).getByRole('button', { name: 'Abrir' }).click();
  await page.locator('poker-table').waitFor();

  await expect.poll(() => resumen(page)).toContain('Todas las cartas dicen 5');
  await page.locator('poker-table').evaluate(
    (el) => el.shadowRoot?.querySelector('.summary button')?.click(),
  );

  await expect.poll(async () => (await ref.get()).data()?.agreements ?? [], { timeout: 15_000 })
    .toMatchObject([{ value: '5', title: 'Migrar el login', round: 1 }]);
});
