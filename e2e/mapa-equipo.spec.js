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

/** Framework mínimo para valorar: un nivel con dos expectativas. */
const FRAMEWORK = {
  tracks: [{ id: 'ic', name: 'IC', order: 1, description: '' }],
  levels: [{ id: 'mapa-l2', code: 'L2', title: 'Senior', trackId: 'ic', order: 2, description: '', typicalProfile: '' }],
  dimensions: [
    { id: 'mapa-d1', name: 'Autonomía', order: 1 },
    { id: 'mapa-d2', name: 'Impacto', order: 2 },
  ],
  disciplines: [],
  expectations: [
    { levelId: 'mapa-l2', dimensionId: 'mapa-d1', text: 'Resuelve sola' },
    { levelId: 'mapa-l2', dimensionId: 'mapa-d2', text: 'Impacto en el equipo' },
  ],
  addendums: [],
};

/**
 * Corre `fn` con una persona propia colgando del head. Al limpiar borra TAMBIÉN
 * su valoración: Firestore no borra las subcolecciones con el documento, y una
 * valoración olvidada haría que la persona «sin valorar» del siguiente test
 * apareciera valorada.
 */
async function conSuPersona(fn, extra = {}) {
  await db().doc(PERSON).set({
    name: NOMBRE, uid: null, ownerLeaderUid: 'e2e-head', active: true, ...extra,
  });
  try { await fn(); } finally {
    await db().doc(`${PERSON}/career/assessment`).delete();
    await db().doc(PERSON).delete();
  }
}

/**
 * Como `conSuPersona`, pero con el framework de carrera sembrado y el nivel
 * puesto. Devuelve el framework como estaba: otros specs siembran el suyo.
 */
async function conCarrera(fn, { assessment = null } = {}) {
  const previo = (await db().doc('careerFramework/engineering').get()).data() ?? null;
  await db().doc('careerFramework/engineering').set(FRAMEWORK);
  try {
    await conSuPersona(async () => {
      if (assessment) {
        await db().doc(`${PERSON}/career/assessment`).set({ byDimension: assessment });
      }
      await fn();
    }, { levelId: 'mapa-l2' });
  } finally {
    if (previo) await db().doc('careerFramework/engineering').set(previo);
    else await db().doc('careerFramework/engineering').delete();
  }
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

test('el mapa dice el nivel y que nadie ha valorado todavía', async ({ page }) => {
  await conCarrera(async () => {
    await signInAs(page, 'head');
    await page.goto('/tools/team');

    const fila = page.getByRole('row', { name: new RegExp(NOMBRE) });
    await expect(fila).toContainText('L2 · Senior');
    // Sin valorar NO puede leerse como «cumple»: nadie la ha mirado aún.
    await expect(fila).toContainText('Sin valorar');
  });
});

test('valorada, el mapa cuenta las expectativas que no llega', async ({ page }) => {
  await conCarrera(async () => {
    await signInAs(page, 'head');
    await page.goto('/tools/team');

    const fila = page.getByRole('row', { name: new RegExp(NOMBRE) });
    await expect(fila).toContainText('No llega en 1 expectativa de 2');
  }, { assessment: { 'mapa-d1': { meets: false, note: '' }, 'mapa-d2': { meets: true, note: '' } } });
});

test('la celda de carrera abre la ficha en Expectativas, lista para valorar', async ({ page }) => {
  await conCarrera(async () => {
    await signInAs(page, 'head');
    await page.goto('/tools/team');

    await page.getByRole('button', { name: `Abrir Carrera de ${NOMBRE}` }).click();
    await expect(page.getByRole('tab', { name: 'Carrera', selected: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Expectativas', selected: true })).toBeVisible();
  });
});

test('quien no tiene plan de carrera no se valora: los externos', async ({ page }) => {
  await conSuPersona(async () => {
    await signInAs(page, 'head');
    await page.goto('/tools/team');

    const fila = page.getByRole('row', { name: new RegExp(NOMBRE) });
    await expect(fila).toContainText('Sin plan (externa)');
  }, { external: true });
});
