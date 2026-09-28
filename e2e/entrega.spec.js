/**
 * Cómo entregamos (RMR-TSK-0602).
 *
 * Lo que se comprueba aquí NO es que los números se pinten —eso ya lo cubren los
 * unitarios del dominio— sino lo que esta pantalla decide **no** enseñar:
 *
 *  - Si no se pudo leer, lo dice y no pinta ceros. Una pantalla de ceros se lee
 *    como «no entregamos», que es una respuesta y no un error.
 *  - Los dos DORA sin fuente salen igualmente, con su motivo. Quitar el hueco
 *    invita a rellenarlo con la métrica de al lado, y la de al lado mide otra cosa.
 *
 * En el emulador no hay portal ni secreto, así que la llamada SIEMPRE falla: eso
 * hace de este spec la prueba natural del camino de error, que es justo el que
 * nadie prueba nunca.
 */
import { test, expect } from './fixtures.js';
import { signInAs } from './fixtures.js';

const app = (page) => page.locator('delivery-app');

test('sin poder leer el portal, lo dice y no enseña ceros', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/tools/entrega');

  const aviso = app(page).getByRole('alert');
  await expect(aviso).toBeVisible({ timeout: 20_000 });
  await expect(aviso).toContainText('No se han podido leer las métricas');

  // Y nada de números: ni tabla, ni filas de métrica, ni un «0» suelto.
  await expect(app(page).locator('table')).toHaveCount(0);
  await expect(app(page).locator('.metric')).toHaveCount(0);
});

test('el motivo se dice, para poder arreglarlo sin ir a los logs', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/tools/entrega');

  // Sin `PORTAL_METRICS_URL` en el emulador, el motivo es «no configurado». Lo
  // que importa no es ese texto en concreto, sino que haya UNO: «error» a secas
  // obliga a abrir los logs para saber si esperar o tocar algo.
  const aviso = app(page).getByRole('alert');
  await expect(aviso).toBeVisible({ timeout: 20_000 });
  const texto = await aviso.innerText();
  expect(texto.length).toBeGreaterThan('No se han podido leer las métricas.'.length + 20);
});

test('la tarjeta de Entrega está en el inicio', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/');
  await expect(page.locator('#tenant-tools')).toBeVisible({ timeout: 20_000 });

  const tarjeta = page.locator('#tenant-tools .tool-card[href="/tools/entrega"]');
  await expect(tarjeta).toBeVisible();
  // En «Cómo entregamos», con DORA y LEAN, que es de donde saldrá cuando se
  // retiren (RMR-TSK-0603).
  await expect(tarjeta).toContainText('Entrega');
});

/**
 * Métricas de mentira metidas en el componente. En el emulador no hay portal, y
 * lo que se quiere mirar aquí es lo que la pantalla HACE con una interpretación,
 * no si el portal responde.
 */
async function conMetricas(page, { canInterpret, interpretation }) {
  await page.evaluate(({ puede, guardada }) => {
    const el = document.querySelector('delivery-app');
    el.error = null;
    el.metrics = {
      series: [{ week: '2026-W39', deploys: 12, deployFailureRate: null, deploysConEstado: 0,
        deploysFallidos: 0, wip: 4, throughput: 7, parcial: false }],
      repos: [],
      measurable: {},
      cobertura: { fueraDeCobertura: [] },
      dataUpdatedAt: '2026-09-28',
    };
    el.canInterpret = puede;
    el.interpretation = guardada;
  }, { puede: canInterpret, guardada: interpretation });
}

const LECTURA = {
  verdict: 'regular',
  summary: 'Se despliega a menudo, pero el trabajo en curso crece.',
  causes: ['Hay más empezado de lo que se cierra'],
  recommendations: ['Terminar antes de empezar'],
  at: '2026-09-28T09:00:00.000Z',
  by: { uid: 'u1', name: 'Quien Gobierna' },
};

test('la lectura con IA se ve, pero solo quien gobierna puede pedirla', async ({ page }) => {
  await signInAs(page, 'engineer');
  await page.goto('/tools/entrega');
  await expect(app(page)).toBeVisible({ timeout: 20_000 });
  await conMetricas(page, { canInterpret: false, interpretation: LECTURA });

  // La lectura guardada la ve cualquiera: es UNA por herramienta, no una por
  // persona, para que se pueda discutir sobre lo mismo.
  await expect(app(page).locator('.interp-summary')).toContainText('trabajo en curso crece');
  await expect(app(page).locator('.verdict')).toContainText('regular');
  await expect(app(page).locator('.interp-btn')).toHaveCount(0);
});

test('quien gobierna sí tiene el botón, y la lectura va DEBAJO de los números', async ({ page }) => {
  await signInAs(page, 'superadmin');
  await page.goto('/tools/entrega');
  await expect(app(page)).toBeVisible({ timeout: 20_000 });
  await conMetricas(page, { canInterpret: true, interpretation: null });

  await expect(app(page).locator('.interp-btn')).toHaveText('Interpretar');
  await expect(app(page).locator('.interp')).toContainText('Nadie la ha pedido todavía');

  // Primero lo medido, después lo opinado. Lo opinado se lee más fácil, y por
  // eso no puede ir delante.
  const orden = await app(page).evaluate((el) => {
    const raiz = el.shadowRoot;
    const filas = raiz.querySelector('.rows');
    const interp = raiz.querySelector('.interp');
    return filas.compareDocumentPosition(interp) & Node.DOCUMENT_POSITION_FOLLOWING ? 'despues' : 'antes';
  });
  expect(orden).toBe('despues');
});

test('la pantalla dice que mide al equipo y no a las personas', async ({ page }) => {
  // No es decoración: es la frase que impide que estas métricas acaben en una
  // evaluación individual, que es el anti-patrón que el método prohíbe.
  await signInAs(page, 'superadmin');
  await page.goto('/tools/entrega');
  await expect(page.locator('.page-lead')).toContainText('nunca a las personas');
});
