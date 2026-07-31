/**
 * Motor de permisos de HERRAMIENTAS (RMR-PCS-0027 · F3). Lógica pura, sin
 * Firestore ni Lit.
 *
 * Cada herramienta tiene una política (`/toolPolicies/{toolId}`) con dos grants:
 *  - `audience`: quién la VE/usa.
 *  - `managedBy`: quién la ADMINISTRA (además del superadmin, que siempre puede).
 *
 * Un grant es una UNIÓN de reglas combinables: `everyone`, por `branches`, por
 * `roleIds` o por `personIds` explícitos. Si cualquiera aplica, hay acceso — así
 * el superadmin puede, p.ej., dar a un PM (rama product) acceso puntual a una
 * herramienta de ingeniería añadiéndolo por personId o por su rol.
 *
 * @typedef {Object} Grant
 * @property {boolean} [everyone]      todos los empleados logados
 * @property {string[]} [branches]     ramas con acceso (engineering, product, ...)
 * @property {string[]} [roleIds]      roles concretos del organigrama
 * @property {string[]} [personIds]    personas concretas (por personId)
 *
 * @typedef {Object} ToolPolicy
 * @property {string} toolId
 * @property {string} [label]
 * @property {Grant} [audience]
 * @property {Grant} [managedBy]
 *
 * @typedef {Object} PersonRef  Persona ya resuelta para evaluar acceso.
 * @property {string|null} personId
 * @property {string|null} [branch]    rama (derivada de su rol)
 * @property {string|null} [roleId]    su rol del organigrama
 */

/**
 * ¿La persona encaja en un grant? Unión de las reglas del grant.
 * @param {Grant|undefined|null} grant
 * @param {PersonRef} person
 * @returns {boolean}
 */
export function matchesGrant(grant, person) {
  if (!grant) return false;
  if (grant.everyone) return true;
  const p = person ?? {};
  if (p.branch && (grant.branches ?? []).includes(p.branch)) return true;
  if (p.roleId && (grant.roleIds ?? []).includes(p.roleId)) return true;
  if (p.personId && (grant.personIds ?? []).includes(p.personId)) return true;
  return false;
}

/**
 * ¿Puede la persona VER/usar la herramienta? El superadmin siempre puede.
 * @param {PersonRef} person
 * @param {ToolPolicy|undefined|null} policy
 * @param {{ isSuperadmin?: boolean }} [ctx]
 * @returns {boolean}
 */
export function canUseTool(person, policy, { isSuperadmin = false } = {}) {
  if (isSuperadmin) return true;
  return matchesGrant(policy?.audience, person);
}

/**
 * ¿Puede la persona ADMINISTRAR la herramienta? El superadmin siempre puede;
 * el resto solo si encaja en `managedBy`.
 * @param {PersonRef} person
 * @param {ToolPolicy|undefined|null} policy
 * @param {{ isSuperadmin?: boolean }} [ctx]
 * @returns {boolean}
 */
export function canManageTool(person, policy, { isSuperadmin = false } = {}) {
  if (isSuperadmin) return true;
  return matchesGrant(policy?.managedBy, person);
}

/**
 * Ids de herramientas que una persona puede VER (para pintar su menú de tools).
 * @param {PersonRef} person
 * @param {ToolPolicy[]} policies
 * @param {{ isSuperadmin?: boolean }} [ctx]
 * @returns {string[]}
 */
export function visibleToolIds(person, policies, ctx = {}) {
  return (policies ?? []).filter((p) => canUseTool(person, p, ctx)).map((p) => p.toolId);
}
