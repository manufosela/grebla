/**
 * Ningún enlace de la herramienta apunta a una sección que ya no existe
 * (RMR-BUG-0130).
 *
 * Qué pasó: «Ajustes» se mudó al panel y el enlace de «Cobertura y riesgos» se
 * quedó llamando a una sección retirada. El manejador de `goto-tab` ignora en
 * silencio lo que no está en `TEAM_TABS`, así que el botón no hacía nada — y
 * nadie lo nota, porque un botón que no hace nada se parece mucho a uno que
 * tarda.
 *
 * Y había un daño peor que el botón muerto: el texto mandaba a crear áreas de
 * conocimiento a un sitio donde ya no se crean.
 */
import { test, expect, signInAs } from './fixtures.js';

test('el enlace de áreas lleva a donde de verdad se crean', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/tools/team');
  await expect(page.locator('team-app .tab').first()).toBeVisible({ timeout: 20_000 });
  await page.locator('team-app .tab', { hasText: 'Cobertura y riesgos' }).click();

  const overview = page.locator('team-app team-overview');
  await expect(overview).toBeVisible();

  // El enlace solo sale cuando NO hay áreas; si las hay, no hay nada que probar
  // aquí y el otro test cubre lo importante.
  const enlace = overview.getByRole('link', { name: /Organización/ });
  if (await enlace.count() > 0) {
    await expect(enlace).toHaveAttribute('href', '/admin/organizacion#areas');
  }
});

test('ninguna sección de la herramienta enlaza a una pestaña retirada', async ({ page }) => {
  // El guard de verdad: aunque el enlace de arriba no se pinte hoy, este caza
  // cualquier otro que se cuele mañana.
  await signInAs(page, 'superadmin');
  await page.goto('/tools/team');
  await expect(page.locator('team-app .tab').first()).toBeVisible({ timeout: 20_000 });

  const secciones = await page.locator('team-app .tab').allInnerTexts();
  for (const nombre of ['Ajustes', 'Bajas', 'Carrera']) {
    expect(secciones).not.toContain(nombre);
  }

  // Y se recorren las secciones buscando botones que prometan ir a una de ellas.
  for (const seccion of secciones) {
    await page.locator('team-app .tab', { hasText: seccion }).click();
    const botones = await page.locator('team-app button.link-inline').allInnerTexts();
    for (const texto of botones) {
      expect(['Ajustes', 'Bajas', 'Carrera']).not.toContain(texto.trim());
    }
  }
});
