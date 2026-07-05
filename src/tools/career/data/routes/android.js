/**
 * Itinerario del rol Android (JG-15): de Kotlin y Compose a la app publicada
 * y mantenida. Convención de rutas: cabecera de ./backend-php.js.
 */

/** Paradas del hito Peritus (14): construir una app funcional con autonomía. */
const PERITUS_STOPS = Object.freeze([
  'bases/logica-descomposicion',
  'bases/git',
  'bases/http-apis',
  'bases/pensar-con-ia',
  'bases/verificar-salida-ia',
  'bases/testing',
  'android/kotlin',
  'android/android-studio',
  'android/corrutinas-flow',
  'android/ciclo-vida',
  'android/compose',
  'android/estado-compose',
  'android/navegacion',
  'android/red',
]);

/** Paradas del hito Veteranus (25): arquitectura MVVM, testing, persistencia,
 * firma y publicación en Play, con code review, seguridad y CI. */
const VETERANUS_STOPS = Object.freeze([
  'bases/logica-descomposicion',
  'bases/git',
  'bases/http-apis',
  'bases/pensar-con-ia',
  'bases/verificar-salida-ia',
  'bases/testing',
  'bases/code-review',
  'bases/seguridad-basica',
  'android/kotlin',
  'android/android-studio',
  'android/gradle',
  'android/corrutinas-flow',
  'android/ciclo-vida',
  'android/compose',
  'android/estado-compose',
  'android/navegacion',
  'android/material',
  'android/accesibilidad',
  'android/mvvm',
  'android/testing',
  'android/red',
  'android/persistencia',
  'android/segundo-plano',
  'android/firmas-play',
  'devops/ci',
]);

/** Paradas del hito Magister (36): la isla completa (DI, modularización,
 * rendimiento, observabilidad, IA en el flujo y on-device) más contratos de
 * API, APIs de modelos y lanzamientos de producto. */
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
  'android/kotlin',
  'android/android-studio',
  'android/gradle',
  'android/corrutinas-flow',
  'android/ciclo-vida',
  'android/compose',
  'android/estado-compose',
  'android/navegacion',
  'android/material',
  'android/accesibilidad',
  'android/mvvm',
  'android/inyeccion-dependencias',
  'android/modularizacion',
  'android/testing',
  'android/red',
  'android/persistencia',
  'android/segundo-plano',
  'android/rendimiento',
  'android/firmas-play',
  'android/crash-observabilidad',
  'android/app-publicada',
  'android/ia-flujo-trabajo',
  'android/ml-on-device',
  'devops/ci',
  'software-architect/apis-y-contratos',
  'ai-engineer/apis-modelos',
  'product-manager/lanzamientos',
]);

/** @type {import('./index.js').RouteTiers} */
export const ROUTE_TIERS = Object.freeze({
  discipline: 'android',
  roleName: 'Android',
  tiers: {
    peritus: {
      name: 'Android · Peritus',
      description:
        'Ejecuta con autonomía: Kotlin idiomático, corrutinas y ciclo de vida, UI con ' +
        'Compose y su estado, navegación y consumo de APIs desde la app.',
      stops: PERITUS_STOPS,
    },
    veteranus: {
      name: 'Android · Veteranus',
      description:
        'Decide y anticipa: MVVM con testing, Material y accesibilidad, persistencia ' +
        'y trabajo en segundo plano, Gradle, firma y publicación en Play Console con ' +
        'CI, code review y seguridad.',
      stops: VETERANUS_STOPS,
    },
    magister: {
      name: 'Android · Magister',
      description:
        'Transforma: inyección de dependencias, modularización, rendimiento y ' +
        'observabilidad de una app publicada y mantenida, IA en el flujo de trabajo ' +
        'y on-device, más contratos de API y lanzamientos con mirada de producto.',
      stops: MAGISTER_STOPS,
    },
  },
});
