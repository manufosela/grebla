/**
 * E2E de la pertenencia por DOMINIO (ADR de dominios, F4 · RMR-TSK-0479).
 *
 * El squad mezclaba dónde ocurre el trabajo con quién pertenece a él. Con
 * equipos fluidos —hoy en Trust, mañana en Matcher— la persona pertenece a su
 * PRODUCTO y se mueve libre por sus subdominios.
 *
 * Lo que más importa fijar: en «Mi espacio» NO se deja de mostrar nada. Seguir
 * viendo a qué perteneces era un requisito explícito.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const CLAVES = { domains: ['e2e-tribbu-app', 'e2e-plataforma'] };

async function conDominios(fn, { domainKeys = ['e2e-tribbu-app'] } = {}) {
  await db().doc('domains/e2e-d1').set({ key: 'e2e-tribbu-app', name: 'E2E TRIBBU-APP' });
  await db().doc('domains/e2e-d2').set({ key: 'e2e-plataforma', name: 'E2E Plataforma' });
  const antes = (await db().doc('people/e2e-person-eng').get()).data();
  await db().doc('people/e2e-person-eng').set({ ...antes, domainKeys });
  try { await fn(); } finally {
    await db().doc('people/e2e-person-eng').set(antes);
    for (const [col, claves] of Object.entries(CLAVES)) {
      const snap = await db().collection(col).where('key', 'in', claves).get();
      for (const d of snap.docs) await d.ref.delete();
    }
  }
}

test('«Mi espacio» sigue diciendo a qué perteneces: ahora tu dominio', async ({ page }) => {
  await conDominios(async () => {
    await signInAs(page, 'engineer');
    await page.goto('/mi-espacio#datos');

    await expect(page.locator('engineer-space')).toContainText('Dominio');
    await expect(page.locator('engineer-space')).toContainText('E2E TRIBBU-APP');
  });
});

test('y ya no habla de squads: la transición terminó (F5)', async ({ page }) => {
  // Mientras convivieron, la ficha enseñaba las dos cosas y el squad tiraba del
  // catálogo viejo. Dejar el rótulo sería seguir invitando a pensar en equipos
  // fijos justo después de haber cambiado el modelo para lo contrario.
  await conDominios(async () => {
    await signInAs(page, 'engineer');
    await page.goto('/mi-espacio#datos');

    await expect(page.locator('engineer-space')).toContainText('Dominio');
    await expect(page.locator('engineer-space')).not.toContainText('Squad');
  });
});

test('quien no tiene dominio lo ve DICHO, no en blanco', async ({ page }) => {
  // Un hueco parece un olvido de la aplicación; «Sin dominio» es información y
  // se puede actuar sobre ella.
  await conDominios(async () => {
    await signInAs(page, 'engineer');
    await page.goto('/mi-espacio#datos');
    await expect(page.locator('engineer-space')).toContainText('Sin dominio');
  }, { domainKeys: [] });
});

test('la tabla de equipo lista el DOMINIO de cada persona, no su squad', async ({ page }) => {
  // La columna decía «Squads» y tiraba del catálogo viejo: quien mira el equipo
  // veía una agrupación que ya no es a la que pertenece la gente.
  await conDominios(async () => {
    await signInAs(page, 'superadmin');
    await page.goto('/tools/team#people');

    const tabla = page.locator('team-people');
    await expect(tabla.locator('th', { hasText: 'Dominios' })).toBeVisible();
    await expect(tabla.locator('th', { hasText: 'Squads' })).toHaveCount(0);
  });
});

test('en la ficha se elige DOMINIO, y se guarda por su clave', async ({ page }) => {
  // La prueba SIEMBRA su propia persona en vez de editar una de las fixtures:
  // qué gente ve el head depende de lo que hayan dejado otros specs, y antes
  // esto pasaba en solitario y fallaba con la suite entera.
  const suya = db().doc('people/e2e-person-dominio');
  await suya.set({ name: 'Persona de dominios E2E', uid: null, ownerLeaderUid: 'e2e-head', active: true });
  try {
  await conDominios(async () => {
    await signInAs(page, 'head');
    await page.goto('/tools/team');
    await page.getByRole('button', { name: 'Personas' }).first().click();
    await page.getByRole('row', { name: /Persona de dominios E2E/ }).getByRole('button', { name: 'Editar' }).click();
    await page.getByRole('tab', { name: 'Organización' }).click();
    await page.getByRole('tab', { name: 'Dominios' }).click();

    await page.getByRole('checkbox', { name: 'E2E Plataforma' }).check();
    await page.getByRole('button', { name: /Guardar/ }).first().click();

    // Se guarda la CLAVE, no el id ni el nombre: así renombrar el dominio no
    // obliga a tocar la ficha de nadie.
    await expect.poll(async () => {
      return (await suya.get()).data()?.domainKeys ?? [];
    }, { timeout: 15_000 }).toContain('e2e-plataforma');
  });
  } finally {
    await suya.delete();
  }
});
