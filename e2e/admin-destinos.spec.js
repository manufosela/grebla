/**
 * Cada tarjeta de Administración deja donde dice (RMR-TSK-0499).
 *
 * La tarjeta prometía «Administrar» y soltaba en la portada de la herramienta,
 * con la pestaña de gestión a dos clics: es lo que hace creer que la
 * administración no existe. Y el ancla que la lleva hasta allí ORIENTA, no da
 * permiso — lo que se comprueba al final.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const activa = (page, host) => page.locator(host).evaluate(
  (el) => el.shadowRoot?.querySelector('.tab.active, .tab.on, [aria-selected="true"]')?.textContent?.trim() ?? '',
);

// DORA y LEAN se retiraron (RMR-TSK-0603) y con ellas los casos que las usaban.
// Lo que probaban NO era DORA ni LEAN: era que el ancla de una tarjeta de
// administración manda sobre la pestaña por defecto. Eso sigue siendo verdad, y
// «Equipo › admin» tiene la misma forma — dos pestañas y un ancla a la segunda.

test('Equipo abre en las bajas, que es lo que se administra', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/tools/team/admin#departures');
  await expect.poll(() => activa(page, 'team-admin')).toContain('Bajas');
});

test('y el ancla manda de verdad: #settings no abre la pestaña por defecto', async ({ page }) => {
  // «Bajas» es la primera, así que acertar con #departures no demuestra nada.
  // Con #settings sí: si el ancla no se leyera, abriría en Bajas.
  await signInAs(page, 'superadmin');
  await page.goto('/tools/team/admin#settings');
  await expect.poll(() => activa(page, 'team-admin')).toContain('Avisos');
});

test('Motivadores abre en Rondas, que es lo que se administra', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/tools/motivators/moving#rounds');
  await expect.poll(() => activa(page, 'motivators-app')).toContain('Rondas');
});

test('sin ancla se entra como siempre', async ({ page }) => {
  // Quien viene a USAR la herramienta no debe notar nada de esto.
  await signInAs(page, 'superadmin');
  await page.goto('/tools/team/admin');
  await expect.poll(() => activa(page, 'team-admin')).toContain('Bajas');
});

test('y desde la herramienta se vuelve a Administración, no al hub de herramientas', async ({ page }) => {
  // Administrar suele ser varias herramientas seguidas: volver al hub de
  // herramientas obligaba a rehacer el camino a mano cada vez (RMR-BUG-0115).
  await signInAs(page, 'superadmin');
  await page.goto('/admin');
  await page.locator('[data-admin-id="surveys"]').click();

  const volver = page.locator('tool-nav').first();
  await expect(volver).toBeVisible();
  const destino = await volver.evaluate((el) => el.shadowRoot?.querySelector('a.back')?.getAttribute('href'));
  expect(destino).toBe('/admin');
  const texto = await volver.evaluate((el) => el.shadowRoot?.querySelector('a.back')?.textContent?.trim());
  expect(texto).toContain('Administración');
});

test('quien entra por el hub de herramientas sigue volviendo al hub', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/tools/encuestas');

  const destino = await page.locator('tool-nav').first()
    .evaluate((el) => el.shadowRoot?.querySelector('a.back')?.getAttribute('href'));
  expect(destino).toBe('/');
});

test('el ancla NO da permiso: una pestaña que no te toca no se abre', async ({ page }) => {
  const previa = (await db().doc('toolPolicies/motivators').get()).data() ?? null;
  await db().doc('toolPolicies/motivators').set({
    label: 'Motivadores', audience: { everyone: true }, managedBy: { roles: ['manager'] },
  });
  try {
    await signInAs(page, 'engineer');
    await page.goto('/tools/motivators/moving#rounds');

    // Ni se abre Rondas ni existe la pestaña para quien no gestiona la herramienta.
    await expect.poll(() => activa(page, 'motivators-app')).not.toContain('Rondas');
    const pestanas = await page.locator('motivators-app')
      .evaluate((el) => [...(el.shadowRoot?.querySelectorAll('.tab') ?? [])].map((t) => t.textContent.trim()));
    expect(pestanas).not.toContain('Rondas');
  } finally {
    if (previa) await db().doc('toolPolicies/motivators').set(previa);
    else await db().doc('toolPolicies/motivators').delete();
  }
});
