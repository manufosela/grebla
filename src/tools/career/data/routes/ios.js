/**
 * Itinerario del rol iOS (JG-15): de Swift y SwiftUI a la app en la App
 * Store. Convención de rutas: cabecera de ./backend-php.js.
 */

/** Paradas del hito Peritus (14): construir una app funcional con autonomía. */
const PERITUS_STOPS = Object.freeze([
  'bases/logica-descomposicion',
  'bases/git',
  'bases/http-apis',
  'bases/pensar-con-ia',
  'bases/verificar-salida-ia',
  'bases/testing',
  'ios/swift',
  'ios/xcode',
  'ios/concurrencia',
  'ios/ciclo-vida-app',
  'ios/swiftui',
  'ios/estado-swiftui',
  'ios/navegacion',
  'ios/redes',
]);

/** Paradas del hito Veteranus (24): MVVM con testing, persistencia, UIKit
 * cuando toca, firma y TestFlight, con code review, seguridad y CI. */
const VETERANUS_STOPS = Object.freeze([
  'bases/logica-descomposicion',
  'bases/git',
  'bases/http-apis',
  'bases/pensar-con-ia',
  'bases/verificar-salida-ia',
  'bases/testing',
  'bases/code-review',
  'bases/seguridad-basica',
  'ios/swift',
  'ios/xcode',
  'ios/concurrencia',
  'ios/ciclo-vida-app',
  'ios/swiftui',
  'ios/estado-swiftui',
  'ios/navegacion',
  'ios/uikit-interop',
  'ios/accesibilidad',
  'ios/arquitectura-mvvm',
  'ios/testing',
  'ios/redes',
  'ios/swiftdata',
  'ios/firmas-certificados',
  'ios/testflight',
  'devops/ci',
]);

/** Paradas del hito Magister (35): la isla completa (SPM, modularización,
 * Instruments, observabilidad, IA en el flujo y on-device) más contratos de
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
  'ios/swift',
  'ios/xcode',
  'ios/spm',
  'ios/concurrencia',
  'ios/ciclo-vida-app',
  'ios/swiftui',
  'ios/estado-swiftui',
  'ios/navegacion',
  'ios/uikit-interop',
  'ios/accesibilidad',
  'ios/arquitectura-mvvm',
  'ios/testing',
  'ios/modularizacion',
  'ios/redes',
  'ios/swiftdata',
  'ios/instruments',
  'ios/firmas-certificados',
  'ios/testflight',
  'ios/crash-observabilidad',
  'ios/app-en-store',
  'ios/ia-flujo-trabajo',
  'ios/ml-on-device',
  'devops/ci',
  'software-architect/apis-y-contratos',
  'ai-engineer/apis-modelos',
  'product-manager/lanzamientos',
]);

/** @type {import('./index.js').RouteTiers} */
export const ROUTE_TIERS = Object.freeze({
  discipline: 'ios',
  roleName: 'iOS',
  tiers: {
    peritus: {
      name: 'iOS · Grumete',
      description:
        'Ejecuta con autonomía: Swift con async/await, ciclo de vida de la app, UI ' +
        'con SwiftUI y su estado, navegación y consumo de APIs desde la app.',
      stops: PERITUS_STOPS,
    },
    veteranus: {
      name: 'iOS · Corsario',
      description:
        'Decide y anticipa: MVVM con testing, accesibilidad e interoperabilidad con ' +
        'UIKit, SwiftData, firma y distribución por TestFlight con CI, code review ' +
        'y seguridad.',
      stops: VETERANUS_STOPS,
    },
    magister: {
      name: 'iOS · Capitán',
      description:
        'Transforma: SPM y modularización, Instruments y observabilidad de una app ' +
        'en la App Store, IA en el flujo de trabajo y on-device, más contratos de ' +
        'API y lanzamientos con mirada de producto.',
      stops: MAGISTER_STOPS,
    },
  },
});
