/**
 * E2E de la administración de Marea (RMR-TSK-0496).
 *
 * Marea es la herramienta donde más pesa quién ve qué: su promesa es que nadie
 * mira la marea de una persona. Lo que se comprueba aquí es que administrar no
 * abre esa puerta —solo hay umbral y recuentos— y que la pestaña aparece por el
 * permiso de gestión, no por ser superadmin ni por teclear el ancla.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const tabs = (page) => page.locator('marea-app').locator('button[role="tab"]');

test('quien gobierna ve la pestaña de administrar y el umbral vigente', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/marea');

  await expect(tabs(page).filter({ hasText: 'Administrar' })).toBeVisible();
  await tabs(page).filter({ hasText: 'Administrar' }).click();
  await expect(page.locator('marea-admin #min')).toHaveValue(/\d+/);
});

test('el enlace del hub de administración abre directamente esa pestaña', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/marea#admin');

  await expect(page.locator('marea-admin #min')).toBeVisible();
});

test('la administración no enseña ni una marea individual', async ({ page }) => {
  // Lo que se administra es el umbral y el recuento; si algún día aparece aquí
  // una persona, es que se rompió la promesa de la herramienta.
  await signInAs(page, 'superadmin');
  await page.goto('/marea#admin');

  // Esperar a que termine de cargar: leer antes devuelve el esqueleto vacío.
  await expect(page.locator('marea-admin #min')).toBeVisible();
  // El contenido vive en el shadow DOM: innerText sobre el host viene vacío.
  const texto = await page.locator('marea-admin')
    .evaluate((el) => el.shadowRoot?.textContent ?? '');
  expect(texto).toContain('Umbral de anonimato');
  expect(texto).toContain('Participación');
  expect(texto).not.toContain('@');
});

test('por encima del suelo el umbral se puede bajar, y se dice lo que implica', async ({ page }) => {
  // Subir por error y no poder deshacerlo sería una trampa; lo que no se puede
  // es cruzar el suelo. Al bajar se avisa de que vuelven a publicarse grupos.
  const previo = (await db().doc('toolSettings/marea').get()).data() ?? null;
  try {
    await signInAs(page, 'superadmin');
    await page.goto('/marea#admin');

    const campo = page.locator('marea-admin #min');
    const guardar = page.locator('marea-admin button', { hasText: 'Guardar umbral' });
    await campo.fill('6');
    await guardar.click();
    await expect(page.locator('marea-admin .msg.ok')).toContainText('recalculando');

    await campo.fill('4');
    await guardar.click();
    await expect(page.locator('marea-admin .msg.ok')).toContainText('volverán a publicar');
    expect((await db().doc('toolSettings/marea').get()).data()?.minCount).toBe(4);
  } finally {
    // Este test es el único que escribe el ajuste: se deja como estaba, aunque
    // falle a mitad, para no cambiarle el umbral a los demás.
    if (previo) await db().doc('toolSettings/marea').set(previo);
    else await db().doc('toolSettings/marea').delete();
  }
});

test('el suelo de 3 no se puede guardar desde el formulario', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/marea#admin');

  await page.locator('marea-admin #min').fill('2');
  await page.locator('marea-admin button', { hasText: 'Guardar umbral' }).click();

  await expect(page.locator('marea-admin .msg.err')).toContainText('no puede bajar de 3');
  const guardado = (await db().doc('toolSettings/marea').get()).data()?.minCount;
  expect(guardado === undefined || guardado >= 3).toBe(true);
});

test('quien no gestiona Marea no ve la pestaña, ni aunque teclee el ancla', async ({ page }) => {
  const previa = (await db().doc('toolPolicies/marea').get()).data() ?? null;
  await db().doc('toolPolicies/marea').set({
    label: 'Marea', audience: { everyone: true }, managedBy: { roles: ['manager'] },
  });
  try {
    await signInAs(page, 'engineer');
    await page.goto('/marea#admin');

    await expect(page.locator('marea-app')).toBeVisible();
    await expect(tabs(page).filter({ hasText: 'Administrar' })).toHaveCount(0);
    await expect(page.locator('marea-admin')).toHaveCount(0);
  } finally {
    if (previa) await db().doc('toolPolicies/marea').set(previa);
    else await db().doc('toolPolicies/marea').delete();
  }
});
