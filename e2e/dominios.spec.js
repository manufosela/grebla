/**
 * E2E del catálogo de DOMINIOS (ADR «De squads a dominios y subdominios»).
 *
 * Lo que esta pantalla tiene que dejar claro es la diferencia entre la CLAVE y
 * el NOMBRE: la clave es la identidad para el resto de sistemas y no cambia; el
 * nombre es un rótulo editable. Confundirlos es lo que hoy parte las series
 * históricas al renombrar, así que eso es lo que más se comprueba aquí.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

/**
 * Claves que este spec crea, una por una. La limpieza borra EXACTAMENTE estas y
 * ninguna más: barrer por prefijo («todo lo que empiece por e2e-») se llevaría
 * por delante las semillas de cualquier otro spec que use el mismo prefijo, y el
 * que se rompiera sería el otro, en otra ejecución y sin pista de por qué.
 */
const CLAVES = {
  domains: ['e2e-tribbu', 'e2e-plataforma'],
  subdomains: ['e2e-trust', 'e2e-plataforma-core'],
};

async function conCatalogo(fn) {
  await db().doc('domains/e2e-dom').set({ key: 'e2e-tribbu', name: 'E2E TRIBBU' });
  await db().doc('subdomains/e2e-sub').set({ key: 'e2e-trust', name: 'E2E Trust', domainKey: 'e2e-tribbu' });
  try { await fn(); } finally {
    for (const [coleccion, claves] of Object.entries(CLAVES)) {
      // `in` acepta hasta 30 valores y aquí son cuatro: si el spec creciera,
      // partir la consulta antes que volver a barrer por prefijo.
      const snap = await db().collection(coleccion).where('key', 'in', claves).get();
      for (const d of snap.docs) await d.ref.delete();
    }
  }
}

const panel = (page) => page.locator('domains-manager');

test('el catálogo enseña cada dominio con sus subdominios y sus claves', async ({ page }) => {
  await conCatalogo(async () => {
    await signInAs(page, 'superadmin');
    await page.goto('/admin#dominios');

    const dominio = panel(page).locator('.domain', { hasText: 'E2E TRIBBU' });
    await expect(dominio).toBeVisible();
    // La clave se enseña SIEMPRE: es la identidad para el resto de sistemas.
    await expect(dominio.locator('.key').first()).toHaveText('e2e-tribbu');
    await expect(dominio.locator('.subs li', { hasText: 'E2E Trust' })).toContainText('e2e-trust');
  });
});

test('renombrar cambia el rótulo y NO la clave', async ({ page }) => {
  await conCatalogo(async () => {
    await signInAs(page, 'superadmin');
    await page.goto('/admin#dominios');

    const dominio = panel(page).locator('.domain', { hasText: 'E2E TRIBBU' });
    await dominio.getByRole('button', { name: 'Renombrar' }).first().click();
    // Al entrar en edición el nombre deja de ser texto, así que el filtro por
    // texto del bloque ya no casa: se busca el campo en todo el panel.
    const campo = panel(page).getByLabel('Nombre de E2E TRIBBU');
    await campo.fill('E2E Renombrado');
    await campo.press('Enter');

    // Esto es lo que arregla el bug de fondo: el nombre cambia, la clave no.
    await expect.poll(async () => {
      const d = (await db().doc('domains/e2e-dom').get()).data();
      return { name: d?.name, key: d?.key };
    }, { timeout: 15_000 }).toEqual({ name: 'E2E Renombrado', key: 'e2e-tribbu' });
  });
});

test('un dominio nuevo nace con su Core: las métricas cuelgan de un subdominio', async ({ page }) => {
  await conCatalogo(async () => {
    await signInAs(page, 'superadmin');
    await page.goto('/admin#dominios');

    await panel(page).getByPlaceholder('Nuevo dominio').fill('E2E Plataforma');
    await panel(page).getByRole('button', { name: 'Añadir dominio' }).click();

    await expect.poll(async () => {
      const subs = (await db().collection('subdomains').where('domainKey', '==', 'e2e-plataforma').get()).docs;
      return subs.map((d) => d.data().key);
    }, { timeout: 15_000 }).toEqual(['e2e-plataforma-core']);
  });
});

test('un enlace guardado con #squads aterriza en Dominios', async ({ page }) => {
  await conCatalogo(async () => {
    await signInAs(page, 'superadmin');
    await page.goto('/admin#squads');
    await expect(page.getByRole('button', { name: 'Dominios' })).toHaveClass(/active/);
  });
});

test('una clave ya usada por un subdominio no cuela como dominio', async ({ page }) => {
  await conCatalogo(async () => {
    await signInAs(page, 'superadmin');
    await page.goto('/admin#dominios');

    // «e2e-trust» ya es la clave de un subdominio. Dos entidades con la misma
    // clave son indistinguibles para el portal, así que se corta al escribirla,
    // no al publicar las métricas.
    await panel(page).getByPlaceholder('Nuevo dominio').fill('E2E Trust');
    await panel(page).getByRole('button', { name: 'Añadir dominio' }).click();

    await expect(panel(page).locator('.error')).toContainText('ya está en uso');
    expect((await db().collection('domains').where('key', '==', 'e2e-trust').get()).empty).toBe(true);
  });
});
