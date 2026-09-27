/**
 * Smoke test de EVALUACIÓN de módulos — guard anti-TDZ/ciclos (RMR-BUG-0015).
 *
 * Importa CADA módulo de componente y falla si no evalúa: TDZ (usar una `const`
 * antes de su declaración), dependencias circulares que dejan un binding sin
 * inicializar, o cualquier error en el cuerpo top-level del módulo.
 *
 * Por qué existe: `astro check` solo valida TIPOS (un TDZ compila sin quejarse)
 * y los tests de dominio prueban `src/tools/**` sin importar nunca estos
 * componentes pesados (Lit + Three). Resultado: RMR-BUG-0015 (una const que
 * usaba `CITY_COLLIDER_RADIUS` antes de declararlo) llegó a producción y tumbó
 * el mapa de carrera con «Cannot access 'Ae' before initialization», sin que
 * ningún check local lo detectara. Este test reproduce el eval de módulo que
 * hace el navegador al cargar el chunk, así el error salta en local/CI.
 *
 * No monta los componentes (no hay DOM real, solo un shim de customElements en
 * test/smoke-setup.js): basta con evaluar el módulo para cazar esta clase de bug.
 */
import { describe, it, expect } from 'vitest';

// import.meta.glob (Vite): mapa ruta→loader perezoso de todos los componentes.
const modules = import.meta.glob('./**/*.js');
const paths = Object.keys(modules)
  .filter((path) => !path.endsWith('.test.js'))
  .sort();

describe('componentes: cada módulo evalúa sin error de inicialización', () => {
  it('hay componentes que verificar (el glob no está vacío)', () => {
    expect(paths.length).toBeGreaterThan(0);
  });

  // El timeout es generoso A PROPÓSITO (RMR-BUG-0134). Lo que se comprueba aquí
  // es que el módulo EVALÚA, no lo rápido que Vite lo transforma: en frío —sin
  // caché de transform— `career-app.js` arrastra el juego entero (Lit + Three) y
  // pasa de los 5 s por defecto en cuanto la máquina tiene algo más entre manos.
  // Se ponía rojo la primera vez y verde la segunda, que es la peor forma de
  // fallar: un rojo que no significa nada enseña a ignorar los rojos.
  it.each(paths)('evalúa %s', async (path) => {
    await expect(modules[path]()).resolves.toBeDefined();
  }, 60_000);
});
