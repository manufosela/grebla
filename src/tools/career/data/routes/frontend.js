/**
 * Itinerario del rol Frontend (JG-15): de la maqueta con criterio a la UI en
 * producción de la era IA. Convención de rutas: cabecera de ./backend-php.js.
 */

/** Paradas del hito Peritus (14): construir interfaces reales con autonomía. */
const PERITUS_STOPS = Object.freeze([
  'bases/logica-descomposicion',
  'bases/git',
  'bases/http-apis',
  'bases/pensar-con-ia',
  'bases/verificar-salida-ia',
  'bases/testing',
  'frontend/html-semantico',
  'frontend/css-moderno',
  'frontend/javascript-moderno',
  'frontend/responsive',
  'frontend/componentes',
  'frontend/react',
  'frontend/datos-remotos',
  'frontend/testing-frontend',
]);

/** Paradas del hito Veteranus (25): calidad de producción (a11y, vitals,
 * seguridad), TypeScript, estado, UI generada con IA y CI. */
const VETERANUS_STOPS = Object.freeze([
  'bases/logica-descomposicion',
  'bases/git',
  'bases/http-apis',
  'bases/pensar-con-ia',
  'bases/verificar-salida-ia',
  'bases/testing',
  'bases/code-review',
  'bases/seguridad-basica',
  'frontend/html-semantico',
  'frontend/css-moderno',
  'frontend/javascript-moderno',
  'frontend/typescript',
  'frontend/dom-web-apis',
  'frontend/responsive',
  'frontend/componentes',
  'frontend/react',
  'frontend/gestion-estado',
  'frontend/datos-remotos',
  'frontend/accesibilidad',
  'frontend/core-web-vitals',
  'frontend/testing-frontend',
  'frontend/seguridad-frontend',
  'frontend/interfaz-produccion',
  'frontend/generar-ui-con-ia',
  'devops/ci',
]);

/** Paradas del hito Magister (36): tooling y design systems, el ciclo completo
 * de UI generada con IA, y cruces de producto, DevEx y APIs de modelos. */
const MAGISTER_STOPS = Object.freeze([
  'bases/logica-descomposicion',
  'bases/git',
  'bases/http-apis',
  'bases/pensar-con-ia',
  'bases/verificar-salida-ia',
  'bases/testing',
  'bases/code-review',
  'bases/seguridad-basica',
  'bases/profesional-ia',
  'frontend/html-semantico',
  'frontend/css-moderno',
  'frontend/javascript-moderno',
  'frontend/typescript',
  'frontend/dom-web-apis',
  'frontend/responsive',
  'frontend/componentes',
  'frontend/react',
  'frontend/gestion-estado',
  'frontend/datos-remotos',
  'frontend/accesibilidad',
  'frontend/core-web-vitals',
  'frontend/testing-frontend',
  'frontend/seguridad-frontend',
  'frontend/interfaz-produccion',
  'frontend/vite-bundlers',
  'frontend/npm-dependencias',
  'frontend/design-systems',
  'frontend/generar-ui-con-ia',
  'frontend/prototipado-ia',
  'frontend/css-generado-revision',
  'frontend/mantener-ui-ia',
  'frontend/frontend-era-ia',
  'devops/ci',
  'ai-engineer/apis-modelos',
  'software-architect/devex',
  'product-manager/metricas-activacion-retencion',
]);

/** @type {import('./index.js').RouteTiers} */
export const ROUTE_TIERS = Object.freeze({
  discipline: 'frontend',
  roleName: 'Frontend',
  tiers: {
    peritus: {
      name: 'Frontend · Peritus',
      description:
        'Ejecuta con autonomía: HTML semántico, CSS moderno y responsive, JavaScript ' +
        'actual, componentes con React, datos remotos y tests de lo que construyes.',
      stops: PERITUS_STOPS,
    },
    veteranus: {
      name: 'Frontend · Veteranus',
      description:
        'Decide y anticipa: TypeScript, estado y Web APIs, accesibilidad, Core Web ' +
        'Vitals y seguridad del navegador para llevar la interfaz a producción, UI ' +
        'generada con IA bajo control y pipeline de CI.',
      stops: VETERANUS_STOPS,
    },
    magister: {
      name: 'Frontend · Magister',
      description:
        'Transforma: build, dependencias y design systems, el ciclo completo de UI ' +
        'generada y mantenida con IA, y criterio de producto, DevEx y APIs de ' +
        'modelos para diseñar el frontend que viene.',
      stops: MAGISTER_STOPS,
    },
  },
});
