/**
 * Paquete «listo para L3» (RMR-TSK-0430): lo que el usuario exige para pasar a
 * L3 — decidir por escrito (ADRs), proponer cambios (RFCs) y auditar la suite
 * de verdad (mutation testing). Se APPENDEA al final de los hitos veteranus y
 * magister de TODOS los roles de ingeniería IC (la convención de rutas
 * crecientes exige que lo que entra en veteranus esté también en magister).
 * La ruta del rol Software Architect no lo usa: ya integra los ADRs en su
 * itinerario propio.
 */
export const L3_READINESS_STOPS = Object.freeze([
  'bases/mutation-testing',
  'software-architect/adrs',
  'software-architect/rfcs',
]);
