/**
 * Avance hacia el nivel siguiente (RMR-PCS-0044 · F3): el EM marca en la ficha
 * qué expectativas de L2 cubre ya la persona, y de ahí sale el L1-2 — no del
 * avance en el mapa de carrera, que cuenta otra historia.
 *
 * Siembra su propia persona y su propio framework: qué ve el head depende de lo
 * que dejen otros specs, y una prueba que pasa sola y falla en la suite no es
 * una prueba.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const PERSON = 'people/e2e-person-avance';
const NOMBRE = 'Persona del avance E2E';

/** L1 y L2 con pesos distintos: tech vale 3 y es imprescindible; product, 1. */
const FRAMEWORK = {
  tracks: [{ id: 'ic', name: 'IC', order: 1, description: '' }],
  levels: [
    { id: 'av-l1', code: 'L1', title: 'Engineer', trackId: 'ic', order: 1, description: '', typicalProfile: '' },
    { id: 'av-l2', code: 'L2', title: 'Engineer II', trackId: 'ic', order: 2, description: '', typicalProfile: '' },
  ],
  dimensions: [
    { id: 'av-tech', name: 'Técnica', order: 1 },
    { id: 'av-product', name: 'Producto', order: 2 },
  ],
  disciplines: [],
  expectations: [
    { levelId: 'av-l1', dimensionId: 'av-tech', text: 'Escribe código que otros leen' },
    { levelId: 'av-l2', dimensionId: 'av-tech', text: 'Diseña un servicio entero', weight: 3, core: true },
    { levelId: 'av-l2', dimensionId: 'av-product', text: 'Discute el alcance con producto', weight: 1 },
  ],
  addendums: [],
};

async function conPersonaEnL1(fn) {
  const previo = (await db().doc('careerFramework/engineering').get()).data() ?? null;
  await db().doc('careerFramework/engineering').set(FRAMEWORK);
  await db().doc(PERSON).set({ name: NOMBRE, uid: null, ownerLeaderUid: 'e2e-head', active: true, levelId: 'av-l1' });
  try { await fn(); } finally {
    await db().doc(`${PERSON}/careerAssessments/av-l2`).delete();
    await db().doc(`${PERSON}/career/assessment`).delete();
    await db().doc(PERSON).delete();
    if (previo) await db().doc('careerFramework/engineering').set(previo);
    else await db().doc('careerFramework/engineering').delete();
  }
}

const ficha = (page) => page.locator('team-person-detail');

async function abrirCarrera(page) {
  await signInAs(page, 'head');
  await page.goto('/tools/team');
  await page.getByRole('button', { name: `Abrir Carrera de ${NOMBRE}` }).click();
  await expect(ficha(page)).toBeVisible();
  // El avance vive junto a la valoración del nivel, en la sub-pestaña «Nivel».
  await ficha(page).getByRole('tab', { name: 'Nivel' }).click();
}

test('sin valorar nada, el avance hacia L2 es 0 %: el nivel siguiente se gana, no se presupone', async ({ page }) => {
  await conPersonaEnL1(async () => {
    await abrirCarrera(page);
    await expect(ficha(page)).toContainText('Avance hacia L2');
    await expect(ficha(page)).toContainText('L1-1');
    await expect(ficha(page)).toContainText('0 % (0 de 4 puntos)');
    await expect(ficha(page)).toContainText('peso 3 · imprescindible');
  });
});

test('marcar la expectativa que pesa 3 sube al L1-3, que queda pendiente de sostener, y se guarda por nivel', async ({ page }) => {
  await conPersonaEnL1(async () => {
    await abrirCarrera(page);
    const tech = ficha(page).locator('.assess-row', { hasText: 'Técnica' }).last();
    await tech.getByRole('button', { name: 'Cumple' }).click();
    // 3 de 4 puntos = 75 %: consolida, pero todavía no está a las puertas.
    await expect(ficha(page)).toContainText('75 % (3 de 4 puntos)');
    await expect(ficha(page)).toContainText('L1-2');

    await ficha(page).getByRole('button', { name: 'Cerrar valoración' }).click();
    await expect(ficha(page)).toContainText('Avance guardado.');
    await expect.poll(async () => {
      const d = (await db().doc(`${PERSON}/careerAssessments/av-l2`).get()).data();
      return [d?.byDimension?.['av-tech']?.meets, d?.closures?.length, d?.closures?.[0]?.pct];
    }).toEqual([true, 1, 75]);
  });
});

test('el badge de Equipo › Carrera sale de lo VALORADO, no del avance en el mapa', async ({ page }) => {
  await conPersonaEnL1(async () => {
    // 3 de 4 puntos valorados. En el mapa de carrera no ha certificado ni una casa:
    // el nivel no se mueve por formarse, y el badge lo demuestra.
    await db().doc(`${PERSON}/careerAssessments/av-l2`).set({
      levelId: 'av-l2', byDimension: { 'av-tech': { meets: true } }, closures: [],
    });
    await signInAs(page, 'head');
    await page.goto('/tools/team#career');
    const fila = page.locator('team-career tr', { hasText: NOMBRE });
    await expect(fila.locator('.lvl.sub')).toHaveText('L1-2');
    await expect(fila.locator('.lvl.sub')).toHaveAttribute('title', /3 de 4 puntos valorados/);
  });
});

test('con el 100 % de los puntos se plantea la subida de nivel', async ({ page }) => {
  await conPersonaEnL1(async () => {
    await abrirCarrera(page);
    for (const dim of ['Técnica', 'Producto']) {
      await ficha(page).locator('.assess-row', { hasText: dim }).last().getByRole('button', { name: 'Cumple' }).click();
    }
    await expect(ficha(page)).toContainText('100 % (4 de 4 puntos)');
    await expect(ficha(page)).toContainText('toca plantear la subida de nivel');
  });
});
