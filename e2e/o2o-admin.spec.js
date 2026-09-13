/**
 * E2E del modo administración de O2O (RMR-TSK-0497).
 *
 * La tarjeta de Administración prometía entrar a cambiar la guía de temas, y la
 * herramienta contestaba «esto es para managers». Ahora entra quien la gestiona
 * — pero solo a las preguntas: lo que se habló en un O2O es de dos personas, y
 * administrar no puede ser la forma de leerlo.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const tabs = (page) => page.locator('o2o-app').locator('button.tab');

/** Deja a quien no lidera como gestor de O2O mientras dure la prueba. */
async function comoGestorDeO2O(fn) {
  const previa = (await db().doc('toolPolicies/o2o').get()).data() ?? null;
  await db().doc('toolPolicies/o2o').set({
    label: 'O2O', audience: { everyone: true }, managedBy: { everyone: true },
  });
  try {
    await fn();
  } finally {
    if (previa) await db().doc('toolPolicies/o2o').set(previa);
    else await db().doc('toolPolicies/o2o').delete();
  }
}

test('quien gestiona la herramienta entra, aunque no lleve equipo', async ({ page }) => {
  await comoGestorDeO2O(async () => {
    await signInAs(page, 'engineer');
    await page.goto('/tools/o2o');

    await expect(page.locator('o2o-app')).toBeVisible();
    await expect(page.locator('o2o-app')).not.toContainText('es para managers');
  });
});

test('administrar O2O es cambiar las preguntas, no leer las respuestas', async ({ page }) => {
  await comoGestorDeO2O(async () => {
    await signInAs(page, 'engineer');
    await page.goto('/tools/o2o');
    // Un periodo donde entrar; el nombre da igual, lo que importa son las pestañas.
    await page.locator('o2o-app input[type="text"]').fill('Periodo de prueba');
    await page.locator('o2o-app button', { hasText: 'Crear periodo' }).click();

    await expect(tabs(page).filter({ hasText: 'Preparar O2O' })).toBeVisible();
    for (const prohibida of ['Registrar O2O', 'Resumen', 'Acciones', 'Evolución']) {
      await expect(tabs(page).filter({ hasText: prohibida })).toHaveCount(0);
    }
  });
});

test('el manager no pierde ninguna sección', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/tools/o2o');
  await page.locator('o2o-app input[type="text"]').fill('Periodo del manager');
  await page.locator('o2o-app button', { hasText: 'Crear periodo' }).click();

  for (const seccion of ['Preparar O2O', 'Registrar O2O', 'Resumen', 'Acciones', 'Evolución']) {
    await expect(tabs(page).filter({ hasText: seccion })).toBeVisible();
  }
});
