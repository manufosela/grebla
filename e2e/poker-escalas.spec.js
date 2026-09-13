/**
 * Elegir la escala al convocar una estimación (RMR-TSK-0481).
 *
 * El mazo estaba fijo en el código: quien estima por tallas no podía, y a quien
 * no usa la mitad de las cartas le sobraban en la mesa. Lo que se comprueba es
 * que lo elegido viaja EN LA SESIÓN —no en una constante— y que las sesiones ya
 * convocadas, que no llevan mazo, siguen con el Fibonacci de siempre.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { test, expect, signInAs } from './fixtures.js';

function db() {
  if (getApps().length === 0) initializeApp({ projectId: 'demo-grebla' });
  return getFirestore();
}

const NOMBRE = 'Estimación por tallas E2E';
async function borrarSesiones() {
  const snap = await db().collection('pokerSessions').where('name', '==', NOMBRE).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

test.afterEach(borrarSesiones);

test('se convoca por tallas, y el mazo queda guardado en la sesión', async ({ page }) => {
  // Como head: convocar es de quien lidera o gestiona la herramienta.
  await signInAs(page, 'head');
  await page.goto('/poker');

  await page.getByPlaceholder(/Nombre de la sesión/).fill(NOMBRE);
  await page.getByRole('radio', { name: 'Tallas de camiseta' }).check();
  await page.getByRole('checkbox', { name: 'S', exact: true }).check();
  await page.getByRole('checkbox', { name: 'M', exact: true }).check();
  await page.getByRole('button', { name: 'Crear sesión' }).click();

  await expect.poll(async () => {
    const snap = await db().collection('pokerSessions').where('name', '==', NOMBRE).get();
    return snap.docs[0]?.data() ?? null;
  }, { timeout: 15_000 }).not.toBeNull();

  const snap = await db().collection('pokerSessions').where('name', '==', NOMBRE).get();
  const sesion = snap.docs[0].data();
  expect(sesion.scale).toBe('tallas');
  // Las marcadas, y las especiales que no se pueden quitar.
  expect(sesion.deck).toEqual(['S', 'M', '?', '☕']);
});

/*
 * Que la mesa ofrezca el mazo de SU sesión y que una sesión antigua caiga al
 * Fibonacci de siempre están cubiertos por los tests del dominio (deckOf, con
 * sus cinco casos de sesión sin mazo). Aquí no: montar la mesa exige entrar en
 * la sesión y suscribirse en vivo, y un E2E que dependa de eso prueba el
 * arranque de la mesa, no la elección de escala.
 */
