/**
 * Logo propio de la instancia en la cabecera (RMR-TSK-0598 · F2 de la identidad).
 *
 * GREBLA se despliega una vez por organización y la cabecera es lo primero que
 * se ve: una casa que se llama de otra forma quiere su marca ahí. Lo que se fija
 * aquí es que, cuando hay logo, sustituye al de GREBLA —no se acumulan los dos—
 * y que sin logo la cabecera NUNCA se queda vacía.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

/** Un SVG mínimo de verdad, en data URI, como el que guardaría el panel. */
const SVG = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 20"><rect width="60" height="20" fill="#2a9d8f"/></svg>',
).toString('base64')}`;

async function conConfig(patch, fn) {
  const antes = (await db().doc('config/org').get()).data() ?? null;
  await db().doc('config/org').set({ ...(antes ?? {}), ...patch });
  try {
    await fn();
  } finally {
    if (antes) await db().doc('config/org').set(antes);
    else await db().doc('config/org').delete();
  }
}

test('con logo configurado, la cabecera lo muestra en lugar de la marca de GREBLA', async ({ page }) => {
  await conConfig({ logo: SVG, orgName: 'TRIBBU' }, async () => {
    await signInAs(page, 'engineer');
    await page.goto('/');

    const logo = page.locator('#brand-logo');
    await expect(logo).toBeVisible();
    // El alt nombra la casa: para quien usa lector de pantalla, «Logo de TRIBBU»
    // dice algo y un alt vacío no.
    await expect(logo).toHaveAttribute('alt', 'Logo de TRIBBU');
    // Y la marca de GREBLA se va ENTERA: son dos casas, no una con dos logos.
    await expect(page.locator('.brand-mark')).toBeHidden();
    await expect(page.locator('.brand-word')).toBeHidden();
  });
});

test('sin logo propio, la cabecera se queda con la marca de GREBLA', async ({ page }) => {
  await conConfig({ orgName: 'TRIBBU' }, async () => {
    await signInAs(page, 'engineer');
    await page.goto('/');

    await expect(page.locator('.brand-word')).toBeVisible();
    await expect(page.locator('#brand-logo')).toBeHidden();
  });
});

test('un valor que no es un SVG ni un PNG no se pinta: antes la marca que un icono roto', async ({ page }) => {
  // Alguien podría dejar una URL ajena en la configuración a mano. La cabecera
  // no la carga.
  await conConfig({ logo: 'https://ajeno.example/logo.png' }, async () => {
    await signInAs(page, 'engineer');
    await page.goto('/');

    await expect(page.locator('#brand-logo')).toBeHidden();
    await expect(page.locator('.brand-word')).toBeVisible();
  });
});
