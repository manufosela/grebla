/**
 * Ningún custom element puede quedarse sin definir (RMR-BUG-0101).
 *
 * Escribir `<tool-nav>` en una página y olvidar el `import` de su módulo no da
 * error: el navegador trata la etiqueta como un elemento desconocido, no pinta
 * nada y no se queja. Así estuvo `/organigrama` sin su enlace «Volver».
 *
 * Se comprueba en el navegador y no con análisis estático a propósito: la cadena
 * de imports pasa por el layout, por `src/client/*.js` y por los propios
 * componentes, y un detector estático daba 28 candidatos de los que 27 eran
 * falsos positivos. Aquí se pregunta a quien tiene la respuesta —
 * `customElements.get()`— recorriendo también los shadow roots.
 */
import { test, expect, signInAs } from './fixtures.js';

/** Rutas con contenido propio; se recorren como superadmin, que las ve todas. */
const PAGINAS = [
  '/', '/organigrama', '/kudos', '/marea', '/poker', '/retros', '/biblioteca',
  '/mi-espacio', '/admin', '/tools/team', '/tools/dora', '/tools/lean', '/tools/o2o',
  '/tools/career-map', '/tools/encuestas', '/tools/role-mirror', '/tools/motivators/moving',
];

test('ninguna página usa un componente que no llega a definirse', async ({ page }) => {
  await signInAs(page, 'superadmin');
  const rotos = [];
  for (const path of PAGINAS) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200); // margen para que carguen los módulos de la página
    const sinDefinir = await page.evaluate(() => {
      const tags = new Set();
      const walk = (root) => {
        for (const el of root.querySelectorAll('*')) {
          if (el.tagName.includes('-')) tags.add(el.tagName.toLowerCase());
          if (el.shadowRoot) walk(el.shadowRoot);
        }
      };
      walk(document);
      return [...tags].filter((tag) => !customElements.get(tag));
    });
    if (sinDefinir.length) rotos.push(`${path} → falta importar: ${sinDefinir.join(', ')}`);
  }
  expect(rotos).toEqual([]);
});
