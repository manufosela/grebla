/**
 * Tramo del LECHO en las rutas de rol (RMR-TSK-0384, épica RMR-PCS-0028): los
 * arrecifes de «Orquestación y juicio» que se tejen en los tiers ALTOS de TODAS
 * las rutas por gremio — el juicio y la dirección de agentes son competencias de
 * seniority transversales, así que forman el CIERRE de Corsario y Capitán (te
 * sumerges al lecho tras el oficio de superficie).
 *
 * El lecho sigue siendo ÚNICO (no se duplica por gremio): las rutas solo
 * REFERENCIAN sus arrecifes (ids orchestration/*, /careerMap/seabed). El orden
 * interno respeta los prereqs del lecho (dar-contexto → descomponer → verificar
 * → error-sutil → decidir-incompleto; proteger-atencion es raíz; el milestone
 * vision-conjunto cierra). Los arrecifes de ampliación (RMR-TSK-0383) quedan
 * como exploración libre, fuera de las rutas.
 */

/** Tramo del lecho del hito Veteranus (Corsario): dirigir y verificar. */
export const ORCHESTRATION_VETERANUS_STOPS = Object.freeze([
  'orchestration/dar-contexto',
  'orchestration/descomponer',
  'orchestration/verificar',
]);

/** Tramo del lecho del hito Magister (Capitán): el ciclo completo del juicio,
 * coronado por el milestone «Sostener la visión del conjunto». */
export const ORCHESTRATION_MAGISTER_STOPS = Object.freeze([
  ...ORCHESTRATION_VETERANUS_STOPS,
  'orchestration/error-sutil',
  'orchestration/decidir-incompleto',
  'orchestration/proteger-atencion',
  'orchestration/vision-conjunto',
]);
