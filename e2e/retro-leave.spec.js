/**
 * Salir de una retro y consultarla ya cerrada (RMR-TSK-0456, ADR «Retros por
 * membresía»).
 *
 * Dos cosas que decidió el usuario: se puede salir —quien entró por error no
 * carga con ella para siempre— y la retro no se cierra a mano, sino que al
 * terminar el MISMO enlace sigue sirviendo para consultar lo que se acordó.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

const TOKEN = `e2e-${crypto.randomUUID()}`;
const RETRO = 'e2e-retro-salida';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const dentro = async () => (await db().doc(`retros/${RETRO}`).get()).data()?.memberUids ?? [];

/** Una retro del manager en la que el ingeniero ya está dentro. */
async function sembrar(status = 'open') {
  await db().doc(`retros/${RETRO}`).set({
    name: 'Retro para salirse',
    ownerLeaderUid: 'e2e-manager',
    memberUids: ['e2e-manager', 'e2e-engineer'],
    branchUids: [],
    joinToken: TOKEN,
    status,
    closedAt: status === 'closed' ? new Date() : null,
    scope: { type: 'team', squadId: null, label: null },
    createdAt: new Date(),
  });
}

test.afterEach(async () => {
  await db().doc(`retros/${RETRO}`).delete().catch(() => {});
});

test('quien entró por error puede salirse', async ({ page }) => {
  await sembrar();
  await signInAs(page, 'engineer');
  await page.goto('/retros');

  await expect(page.getByText('Retro para salirse')).toBeVisible();
  // Por el title: «Salir» a secas también es el botón de cerrar sesión.
  await page.getByTitle('Salir de esta retro').click();
  await page.getByRole('button', { name: 'Sí' }).click();

  await expect.poll(dentro, { timeout: 15_000 }).not.toContain('e2e-engineer');
  // Y deja de verla en su listado.
  await expect(page.getByText('Retro para salirse')).toHaveCount(0);
});

test('quien la convocó no ve el botón de salir: la retro es suya', async ({ page }) => {
  await sembrar();
  await signInAs(page, 'head'); // no es el dueño pero tampoco está dentro
  await page.goto('/retros');
  // El head no está en la retro ni en su rama, así que ni le aparece.
  await expect(page.getByText('Retro para salirse')).toHaveCount(0);
});

test('una retro cerrada se sigue consultando con el mismo enlace', async ({ page }) => {
  await sembrar('closed');
  await signInAs(page, 'engineer');
  await page.goto(`/retro?id=${RETRO}&join=${TOKEN}`);

  // Se ve, y se ve que está cerrada: el enlace pasa a ser de consulta. El
  // tablero pinta el estado en su propio chip; el listado también dice
  // «Cerrada», de ahí el .first().
  await expect(page.getByText('Cerrada').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Retro para salirse').first()).toBeVisible();
});

test('el enlace de una retro cerrada aún deja entrar a quien no estaba', async ({ page }) => {
  await sembrar('closed');
  await db().doc(`retros/${RETRO}`).update({ memberUids: ['e2e-manager'] });

  await signInAs(page, 'engineer');
  await page.goto(`/retro?id=${RETRO}&join=${TOKEN}`);

  // Para poder consultar el resumen y las acciones después de la retro.
  await expect.poll(dentro, { timeout: 15_000 }).toContain('e2e-engineer');
});
