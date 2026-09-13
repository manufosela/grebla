/**
 * Qué secciones de O2O ve cada quien (RMR-TSK-0497).
 *
 * Hasta ahora la herramienta era de managers y punto: quien gestionaba O2O por
 * política —el permiso que existe justamente para poder cambiar los textos de
 * una herramienta sin ser su usuario— se encontraba la puerta cerrada, mientras
 * la tarjeta de Administración le prometía entrar.
 *
 * Abrir la puerta NO puede significar abrirla entera. Lo que se registra en un
 * O2O es de dos personas; administrar la herramienta es cambiar las PREGUNTAS,
 * no leer las respuestas. Por eso quien solo administra ve una sección y las
 * demás ni se pintan.
 */

/** Todas las secciones de un periodo, en orden. */
export const O2O_VIEWS = Object.freeze([
  Object.freeze({ id: 'preparar', label: 'Preparar O2O', ready: true }),
  Object.freeze({ id: 'registrar', label: 'Registrar O2O', ready: true }),
  Object.freeze({ id: 'resumen', label: 'Resumen', ready: true }),
  Object.freeze({ id: 'acciones', label: 'Acciones', ready: true }),
  Object.freeze({ id: 'evolucion', label: 'Evolución', ready: true }),
]);

/** Lo único que administra quien no lleva equipo: las preguntas. */
const SOLO_ADMIN = ['preparar'];

/**
 * @typedef {Object} O2OAccess
 * @property {boolean} [governs]     gobierna la instancia
 * @property {boolean} [leads]       lleva equipo
 * @property {boolean} [managesTool] gestiona la herramienta por política
 */

/**
 * Secciones visibles. Quien gobierna o lleva equipo las ve todas; quien solo
 * gestiona la herramienta, las de administración; quien no es nada, ninguna.
 * @param {O2OAccess} [access]
 * @returns {ReadonlyArray<{id: string, label: string, ready: boolean}>}
 */
export function o2oViews(access = {}) {
  if (access.governs || access.leads) return O2O_VIEWS;
  if (access.managesTool) return O2O_VIEWS.filter((v) => SOLO_ADMIN.includes(v.id));
  return [];
}

/**
 * ¿Entra en modo solo administración? Se pregunta aparte de las secciones
 * porque cambia algo más: en ese modo no se cargan personas ni registros, así
 * que el contenido ajeno no llega siquiera al navegador.
 * @param {O2OAccess} [access]
 * @returns {boolean}
 */
export function isAdminOnly(access = {}) {
  return !access.governs && !access.leads && !!access.managesTool;
}
