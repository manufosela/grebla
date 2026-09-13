/**
 * E2E del cuestionario de apoyo para los roles de contribución (RMR-TSK-0494).
 *
 * El manager marcaba las siglas a ojo, y ese dato alimenta la cobertura de roles
 * y el bus factor: el diagnóstico del equipo salía de una corazonada. El
 * cuestionario ayuda, pero no decide — y eso es lo que se fija aquí: propone,
 * enseña el porqué y no guarda nada hasta que el manager confirma.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

/** Abre la ficha de una persona sembrada para esta prueba, en Contribución. */
async function enContribucion(page, fn) {
  const suya = db().doc('people/e2e-person-belbin');
  await suya.set({ name: 'Persona Belbin E2E', uid: null, ownerLeaderUid: 'e2e-head', active: true });
  try {
    await signInAs(page, 'head');
    await page.goto('/tools/team');
    await page.getByRole('button', { name: 'Personas' }).first().click();
    await page.getByRole('row', { name: /Persona Belbin E2E/ }).getByRole('button', { name: 'Editar' }).click();
    // Contribución vive DENTRO de «Dimensiones», no en el primer nivel.
    await page.getByRole('tab', { name: 'Dimensiones' }).click();
    await page.getByRole('tab', { name: 'Contribución' }).click();
    await fn(suya);
  } finally {
    await suya.delete();
  }
}

// El contenido vive en el shadow DOM del componente: los selectores CSS lo
// atraviesan, pero el texto del HOST está vacío. Por eso se apunta a los nodos
// de dentro y no a <team-person-detail>.
const resultado = (page) => page.locator('.bs-result');

test('sin marcar nada no propone: no se reparte a ciegas', async ({ page }) => {
  await enContribucion(page, async () => {
    await page.getByText('Ayúdame a situarlos').click();
    await expect(page.locator('.belbin-survey')).toBeVisible();
    await expect(resultado(page)).toHaveCount(0);
  });
});

test('propone a partir de lo marcado, y dice de dónde sale', async ({ page }) => {
  await enContribucion(page, async () => {
    await page.getByText('Ayúdame a situarlos').click();

    // Dos conductas de Impulsor, muy suyas.
    await page.getByLabel('Empuja para que se decida y se avance cuando el equipo se queda dando vueltas.')
      .selectOption('2');
    await page.getByLabel('No le frena la incomodidad: dice lo que hay que oír aunque moleste.')
      .selectOption('2');

    await expect(resultado(page)).toContainText('Se proponen como primarios');
    await expect(resultado(page)).toContainText('SH · Impulsor');
    // Y el porqué, para poder discutirlo frase a frase.
    await expect(resultado(page)).toContainText('Empuja para que se decida');
  });
});

test('la propuesta NO guarda: rellena el formulario y decide el manager', async ({ page }) => {
  await enContribucion(page, async (suya) => {
    await page.getByText('Ayúdame a situarlos').click();
    await page.getByLabel('Detecta los cabos sueltos que a los demás se les pasan antes de dar algo por hecho.')
      .selectOption('2');
    await page.getByLabel('Revisa lo suyo —y lo del equipo— antes de que salga por la puerta.')
      .selectOption('2');
    await page.getByRole('button', { name: 'Llevar al formulario' }).click();

    // Nada registrado todavía: la propuesta solo ha rellenado el formulario.
    expect((await suya.collection('contribution').get()).docs).toHaveLength(0);

    // Y al registrar de verdad, queda lo que el manager tenía delante.
    await page.getByText('➕ Registrar contribución').click();
    await page.getByRole('button', { name: 'Registrar contribución' }).click();
    // Las lecturas cuelgan de la persona, una subcolección por dimensión:
    // people/{id}/contribution/{readingId}.
    await expect.poll(async () => {
      const snap = await suya.collection('contribution').get().catch(() => ({ docs: [] }));
      return snap.docs.map((d) => d.data().roles ?? {});
    }, { timeout: 15_000 }).toContainEqual({ CF: 'primary' });
  });
});
