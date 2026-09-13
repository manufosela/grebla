/**
 * DECISIONES del arranque del hub (RMR-BUG-0112). Puro: sin red ni DOM.
 *
 * El arranque encadenaba cinco esperas, cuatro de ellas independientes entre sí,
 * y la quinta era una Cloud Function que bloqueaba el pintado. Se encadenaban
 * porque cada decisión se tomaba con el dato recién llegado y el siguiente
 * `await` estaba escrito a continuación.
 *
 * Separando el QUÉ se decide del CUÁNDO se piden los datos, el glue puede
 * lanzar las lecturas en paralelo y decidir después — y además estas reglas, que son las
 * que gobiernan quién entra a dónde, pasan a poder probarse sin montar nada.
 *
 * @typedef {{ functionalRole?: string|null, instanceAccess?: string|null }} Access
 */
import { hasAccess } from '../lib/accessRoles.js';

/**
 * ¿Es empleado del dominio de la instancia? Con email VERIFICADO del dominio
 * configurado. Sin verificación no vale: el dominio se comprueba sobre algo que
 * cualquiera puede escribir al registrarse.
 *
 * Sin dominio configurado no lo es nadie — es el caso de la demo, donde el
 * acceso no se reparte por correo.
 *
 * @param {string} email
 * @param {boolean} emailVerified
 * @param {string} domain
 * @returns {boolean}
 */
export function isEmployeeOf(email, emailVerified, domain) {
  if (!domain || emailVerified !== true) return false;
  return String(email ?? '').toLowerCase().endsWith('@' + domain.toLowerCase());
}

/**
 * A dónde va quien acaba de entrar.
 *  - `landing`: sin rol, sin gobierno, sin gestionar ninguna herramienta y sin
 *    ser empleado del dominio. No hay nada que enseñarle.
 *  - `admin`: un viewer es observador puro y entra al panel en solo lectura.
 *  - `tools`: el hub.
 *
 * `managesAnyTool` era antes «gestiona encuestas» (RMR-TSK-0475): un caso
 * especial heredado de cuando People era un rol suelto. Quien gestiona
 * CUALQUIER herramienta sin tener otro rol tiene el mismo problema —si no
 * entrara, no podría llegar a lo suyo—, así que la regla vale para todas y
 * ninguna necesita su propia rama en el código.
 *
 * @param {{ access: Access, isEmployee: boolean, managesAnyTool?: boolean }} input
 * @returns {'landing'|'admin'|'tools'}
 */
export function hubDestination({ access, isEmployee, managesAnyTool = false }) {
  if (!hasAccess(access) && !managesAnyTool && !isEmployee) return 'landing';
  if (access?.instanceAccess === 'viewer') return 'admin';
  return 'tools';
}

/**
 * ¿Hay que pedirle a la Cloud Function que cree la ficha? SOLO si es empleado
 * del dominio y todavía no la tiene.
 *
 * Antes se llamaba en CADA entrada de cada empleado, aunque su ficha existiera
 * desde meses atrás, y esa llamada bloqueaba el pintado: una función fría son
 * segundos de pantalla en blanco para no hacer nada.
 *
 * @param {{ isEmployee: boolean, person: { id?: string }|null }} input
 * @returns {boolean}
 */
export function needsEmployeePerson({ isEmployee, person }) {
  return isEmployee === true && !person;
}

/**
 * ¿Gestiona alguna herramienta? (RMR-TSK-0475)
 *
 * Se pregunta en plural a propósito: el atajo de entrada no es de una
 * herramienta concreta —lo era, cuando People y sus encuestas eran un caso
 * aparte—, sino de cualquiera que tenga algo que administrar y ningún otro rol
 * con el que entrar.
 *
 * @param {import('../tools/team/domain/toolAccess.js').PersonRef} personRef
 * @param {ReadonlyArray<import('../tools/team/domain/toolAccess.js').ToolPolicy>} policies
 * @param {(ref: unknown, policy: unknown) => boolean} canManage  el decisor de siempre
 * @returns {boolean}
 */
export function managesSomeTool(personRef, policies = [], canManage) {
  return (policies ?? []).some((p) => canManage(personRef, p));
}
