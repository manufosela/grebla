/**
 * El Mapa es la puerta de la herramienta de Equipo (RMR-TSK-0505).
 *
 * La foto del equipo vivía en la tercera pestaña, detrás de Personas y Carrera:
 * había que saber que estaba ahí. Ahora es lo primero, y desde cada celda se
 * entra a la ficha en esa dimensión (RMR-BUG-0117: ese salto no funcionaba, y
 * ninguna prueba lo cubría) — y se vuelve a donde se estaba, no a otra sección.
 *
 * Siembra SU PROPIA persona en vez de usar las fixtures compartidas: qué gente
 * ve el head depende de lo que dejen otros specs, y una prueba que pasa sola y
 * falla en la suite no es una prueba.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const PERSON = 'people/e2e-person-mapa';
const NOMBRE = 'Persona del mapa E2E';

/** Corre `fn` con una persona propia colgando del head. */
async function conSuPersona(fn) {
  await db().doc(PERSON).set({ name: NOMBRE, uid: null, ownerLeaderUid: 'e2e-head', active: true });
  try { await fn(); } finally { await db().doc(PERSON).delete(); }
}

test('al entrar en Equipo lo primero es el mapa', async ({ page }) => {
  await conSuPersona(async () => {
    await signInAs(page, 'head');
    await page.goto('/tools/team');

    await expect(page.getByRole('heading', { name: 'Mapa del equipo' })).toBeVisible();
    // La persona de su rama está en la foto, sin haber pulsado nada.
    await expect(page.getByText(NOMBRE)).toBeVisible();
  });
});

test('desde una dimensión del mapa se entra a la ficha y se vuelve al mapa', async ({ page }) => {
  await conSuPersona(async () => {
    await signInAs(page, 'head');
    await page.goto('/tools/team');

    await page.getByRole('button', { name: `Abrir Seniority de ${NOMBRE}` }).click();
    // La ficha se abre en la dimensión pulsada, no en un sitio cualquiera.
    await expect(page.locator('team-person-detail')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Seniority', selected: true })).toBeVisible();

    // Y la vuelta lleva de donde se vino: al mapa.
    await page.getByRole('button', { name: 'Volver al mapa' }).click();
    await expect(page.getByRole('heading', { name: 'Mapa del equipo' })).toBeVisible();
  });
});

test('quien entra por la lista de personas vuelve a la lista', async ({ page }) => {
  await conSuPersona(async () => {
    await signInAs(page, 'head');
    await page.goto('/tools/team#people');

    await page.getByRole('row', { name: new RegExp(NOMBRE) }).getByRole('button', { name: 'Editar' }).click();
    await expect(page.locator('team-person-detail')).toBeVisible();

    await page.getByRole('button', { name: 'Volver a personas' }).click();
    await expect(page.locator('team-people table')).toBeVisible();
  });
});
