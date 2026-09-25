/**
 * Aspecto de las tarjetas (RMR-TSK-0573): destacar y color de la paleta.
 *
 * El color se elige de una paleta cerrada y solo tiñe el fondo; el texto no se
 * toca. Así nadie puede dejar una tarjeta ilegible, ni en claro ni en oscuro.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

/** Deja el documento como estaba: otros tests pueden contar con él. */
async function conLayout(layout, fn) {
  const previa = (await db().doc('config/cardLayout').get()).data() ?? null;
  await db().doc('config/cardLayout').set(layout);
  try { await fn(); } finally {
    if (previa) await db().doc('config/cardLayout').set(previa);
    else await db().doc('config/cardLayout').delete();
  }
}

test('el estilo guardado se ve en el panel', async ({ page }) => {
  await conLayout({ styles: { admin: { o2o: { style: 'aviso', featured: true } } } }, async () => {
    await signInAs(page, 'superadmin');
    await page.goto('/admin');

    const tarjeta = page.locator('[data-admin-id="o2o"]');
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta).toHaveClass(/cs-aviso/);
    await expect(tarjeta).toHaveClass(/cs-featured/);

    // Y a las demás no les pone nada: el estilo es de quien lo tiene.
    await expect(page.locator('[data-admin-id="organizacion"]')).not.toHaveClass(/cs-/);
  });
});

test('el estilo guardado se ve en el inicio', async ({ page }) => {
  await conLayout({ styles: { home: { '/kudos': { style: 'acento', featured: false } } } }, async () => {
    await signInAs(page, 'superadmin');
    await page.goto('/');
    await expect(page.locator('#tenant-tools')).toBeVisible();

    const tarjeta = page.locator('#tenant-tools .tool-card[href="/kudos"]');
    await expect(tarjeta).toHaveClass(/cs-acento/);
    await expect(tarjeta).not.toHaveClass(/cs-featured/);
  });
});

test('un estilo que no existe deja la tarjeta como siempre', async ({ page }) => {
  // Un valor viejo o escrito a mano no puede dejar una tarjeta con una clase que
  // ningún CSS define: invisible o ilegible, y sin nadie a quien preguntar.
  await conLayout({ styles: { admin: { o2o: { style: 'fucsia-fosforito' } } } }, async () => {
    await signInAs(page, 'superadmin');
    await page.goto('/admin');

    const tarjeta = page.locator('[data-admin-id="o2o"]');
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta).not.toHaveClass(/cs-/);
  });
});

test('el superadmin destaca una tarjeta y elige su color desde el editor', async ({ page }) => {
  const previa = (await db().doc('config/cardLayout').get()).data() ?? null;
  try {
    await signInAs(page, 'superadmin');
    await page.goto('/admin/tarjetas');

    const panel = page.locator('card-layout-editor section').nth(1);
    await expect(panel).toBeVisible();
    const fila = panel.locator('li').first();

    await fila.getByRole('button', { name: /^Destacar/ }).click();
    await expect(fila.getByRole('button', { name: /^Destacar/ })).toHaveAttribute('aria-pressed', 'true');
    await fila.locator('select').selectOption('aviso');

    await page.getByRole('button', { name: 'Guardar orden' }).click();
    await expect(page.locator('card-layout-editor')).toContainText('Guardado');

    const guardado = (await db().doc('config/cardLayout').get()).data();
    const primera = guardado.admin[0];
    expect(guardado.styles.admin[primera]).toEqual({ style: 'aviso', featured: true });
  } finally {
    if (previa) await db().doc('config/cardLayout').set(previa);
    else await db().doc('config/cardLayout').delete();
  }
});
