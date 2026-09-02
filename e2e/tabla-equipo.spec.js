/**
 * E2E de la TABLA DE EQUIPO (RMR-BUG-0106). Se pintaba como una `<table>` suelta
 * sin contenedor de desplazamiento: con nombres, gremios o squads largos el
 * contenido se salía del panel y no había forma de llegar a él — ni cabía, ni se
 * podía arrastrar. Distinto del caso de Administración (RMR-BUG-0105), que al
 * menos ofrecía scroll.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

/** Plantilla con los datos anchos de verdad: es cuando la tabla se ensancha. */
async function conPlantillaAncha(fn) {
  const ids = [];
  for (let i = 0; i < 8; i += 1) {
    const id = `e2e-ancho-eq-${i}`;
    ids.push(id);
    await db().doc(`people/${id}`).set({
      name: `Persona de Nombre Larguísimo Número ${i}`,
      uid: null, ownerLeaderUid: 'e2e-manager', active: true,
      guilds: ['Plataforma y Observabilidad', 'Arquitectura de Datos'],
      squads: ['Squad de Onboarding y Activación'],
      startDate: '2024-03-15',
    });
  }
  try { await fn(); } finally {
    for (const id of ids) await db().doc(`people/${id}`).delete();
  }
}

test('la tabla de equipo no deja contenido fuera de alcance', async ({ page }) => {
  await conPlantillaAncha(async () => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signInAs(page, 'superadmin');
    await page.goto('/tools/team');
    await expect(page.locator('team-people table')).toBeVisible();

    // O cabe, o se puede desplazar. Lo que no vale es desbordar sin salida.
    const estado = await page.locator('team-people table').evaluate((tabla) => {
      const caja = tabla.parentElement;
      const desborde = tabla.scrollWidth - caja.clientWidth;
      const desplazable = getComputedStyle(caja).overflowX;
      return { desborde, desplazable };
    });
    const alcanzable = estado.desborde <= 1 || ['auto', 'scroll'].includes(estado.desplazable);
    expect(alcanzable, `desborda ${estado.desborde}px y su caja es overflow-x:${estado.desplazable}`).toBe(true);
  });
});

test('la última columna se alcanza sin arrastrar la tabla a un lado', async ({ page }) => {
  await conPlantillaAncha(async () => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signInAs(page, 'superadmin');
    await page.goto('/tools/team');

    const acciones = page.locator('team-people thead th').last();
    await expect(acciones).toContainText('Acciones');
    const dentro = await acciones.evaluate((th) => {
      const caja = th.closest('table').parentElement.getBoundingClientRect();
      const r = th.getBoundingClientRect();
      return r.right <= caja.right + 1;
    });
    expect(dentro, 'la columna de acciones se sale del ancho visible').toBe(true);
  });
});
