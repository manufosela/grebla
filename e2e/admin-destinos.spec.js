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

test('Flujo (LEAN) abre en las unidades que se miden', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/tools/lean#teams');
  await expect.poll(() => activa(page, 'lean-app')).toContain('Equipos');
});

test('DORA abre en los repos medidos', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/tools/dora#repos');
  await expect.poll(() => activa(page, 'dora-app')).toContain('Repos');
});

test('y el ancla manda de verdad: #metrics no abre la pestaña por defecto', async ({ page }) => {
  // «Equipos» es la primera de LEAN, así que acertar con #teams no demuestra
  // nada. Con #metrics sí: si el ancla no se leyera, abriría en Equipos.
  await signInAs(page, 'superadmin');
  await page.goto('/tools/lean#metrics');
  await expect.poll(() => activa(page, 'lean-app')).toContain('Métricas');
});

test('Motivadores abre en Rondas, que es lo que se administra', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/tools/motivators/moving#rounds');
  await expect.poll(() => activa(page, 'motivators-app')).toContain('Rondas');
});

test('sin ancla se entra como siempre', async ({ page }) => {
  // Quien viene a USAR la herramienta no debe notar nada de esto.
  await signInAs(page, 'superadmin');
  await page.goto('/tools/dora');
  await expect.poll(() => activa(page, 'dora-app')).toContain('Repos');
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
