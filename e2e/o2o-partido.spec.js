/**
 * E2E de O2O partido en dos (RMR-TSK-0489, ADR «Tres capas en el hub»).
 *
 * Había una sola tarjeta que llevaba a la herramienta de GESTIÓN, y se le
 * ofrecía a cualquiera que pasara la política. Quien no lideraba pulsaba y se
 * encontraba un «esta herramienta es para managers»: una puerta cerrada con
 * cartel, que es peor que no ver la puerta.
 *
 * Ahora son dos entradas con nombre propio: «Mis O2O» —los tuyos, tengas equipo
 * o no— y «O2O de mi equipo» —prepararlos y seguirlos—. La vista personal NO se
 * duplica: la tarjeta abre la que ya existe en «Mi espacio».
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

/** La política de O2O abierta a todo el mundo, para aislar el efecto del ROL. */
async function conO2OAbierto(fn) {
  const previa = (await db().doc('toolPolicies/o2o').get()).data() ?? null;
  await db().doc('toolPolicies/o2o').set({ label: 'One-to-Ones', audience: { everyone: true }, managedBy: {} });
  try { await fn(); } finally {
    if (previa) await db().doc('toolPolicies/o2o').set(previa);
    else await db().doc('toolPolicies/o2o').delete();
  }
}

const mios = (page) => page.locator('[data-tool-id="o2o"][data-personal]');
const delEquipo = (page) => page.locator('[data-tool-id="o2o"][data-manages]');

test('un ingeniero ve los SUYOS, y no la gestión del equipo', async ({ page }) => {
  await conO2OAbierto(async () => {
    await signInAs(page, 'engineer');
    await page.goto('/');

    await expect(mios(page)).toBeVisible();
    // Aunque la política se lo permita: sin equipo no hay nada que gestionar.
    await expect(delEquipo(page)).toBeHidden();
  });
});

test('la política NO gobierna los MÍOS: son míos, los vea quien los vea', async ({ page }) => {
  // Una cosa es la herramienta para llevar los del equipo y otra el derecho a
  // mirar tus propios datos. Con la audiencia cerrada a una rama que no existe,
  // «Mis O2O» tiene que seguir ahí.
  const previa = (await db().doc('toolPolicies/o2o').get()).data() ?? null;
  await db().doc('toolPolicies/o2o').set({
    label: 'One-to-Ones', audience: { branches: ['no-existe'] }, managedBy: {},
  });
  try {
    await signInAs(page, 'engineer');
    await page.goto('/');
    await expect(mios(page)).toBeVisible();
    await expect(delEquipo(page)).toBeHidden();
  } finally {
    if (previa) await db().doc('toolPolicies/o2o').set(previa);
    else await db().doc('toolPolicies/o2o').delete();
  }
});

test('quien lidera ve las dos, cada una con su nombre', async ({ page }) => {
  await conO2OAbierto(async () => {
    await signInAs(page, 'head');
    await page.goto('/');

    await expect(mios(page)).toContainText('Mis O2O');
    await expect(delEquipo(page)).toContainText('O2O de mi equipo');
  });
});

test('«Mis O2O» abre directo en los míos, sin buscar la pestaña', async ({ page }) => {
  await conO2OAbierto(async () => {
    await signInAs(page, 'engineer');
    await page.goto('/');
    await mios(page).click();

    await expect(page).toHaveURL(/\/mi-espacio#o2o/);
    await expect(page.getByRole('heading', { name: 'Mis O2O' })).toBeVisible();
  });
});

test('las dos viven en TRIBBU: cualquier manager hace 1:1, no solo ingeniería', async ({ page }) => {
  await conO2OAbierto(async () => {
    await signInAs(page, 'head');
    await page.goto('/');

    // Cada una en su grupo, que es justo lo que las distingue: los mios son
    // mios; los del equipo son de llevar a la gente.
    await expect(mios(page).locator('xpath=ancestor::section[@data-group]')).toHaveAttribute('data-group', 'tuyo');
    await expect(delEquipo(page).locator('xpath=ancestor::section[@data-group]')).toHaveAttribute('data-group', 'equipo');
  });
});
