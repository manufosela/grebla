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
 * @typedef {Object} ToolOverride  Excepción por persona para una herramienta.
 * @property {boolean} [use]      fuerza (true) o niega (false) VER/usar; ausente = hereda del rol
 * @property {boolean} [manage]   fuerza (true) o niega (false) GESTIONAR; ausente = hereda del rol
 *
 * @typedef {Object} PersonRef  Persona ya resuelta para evaluar acceso.
 * @property {string|null} personId
 * @property {string|null} [branch]    rama (derivada de su rol)
 * @property {string|null} [roleId]    su rol del organigrama
 * @property {Record<string, ToolOverride>} [toolOverrides]  excepciones por herramienta que ANULAN el default del rol
 */

/** Lee un override booleano de una persona para una herramienta y dimensión (use|manage). */
function overrideOf(person, toolId, dim) {
  const v = person?.toolOverrides?.[toolId]?.[dim];
  return v === true || v === false ? v : undefined;
}

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
 * ¿Puede la persona VER/usar la herramienta? El superadmin siempre puede. Un
 * override en la ficha (`toolOverrides[toolId].use`) ANULA el default del rol —
 * así un manager puede, p.ej., desactivar Marea a un recién llegado un mes.
 * @param {PersonRef} person
 * @param {ToolPolicy|undefined|null} policy
 * @param {{ isSuperadmin?: boolean }} [ctx]
 * @returns {boolean}
 */
export function canUseTool(person, policy, { isSuperadmin = false } = {}) {
  if (isSuperadmin) return true;
  const ov = overrideOf(person, policy?.toolId, 'use');
  if (ov !== undefined) return ov;
  return matchesGrant(policy?.audience, person);
}

/**
 * ¿Puede la persona ADMINISTRAR la herramienta? El superadmin siempre puede; el
 * resto por `managedBy`, salvo override individual (`toolOverrides[toolId].manage`).
 * @param {PersonRef} person
 * @param {ToolPolicy|undefined|null} policy
 * @param {{ isSuperadmin?: boolean }} [ctx]
 * @returns {boolean}
 */
export function canManageTool(person, policy, { isSuperadmin = false } = {}) {
  if (isSuperadmin) return true;
  const ov = overrideOf(person, policy?.toolId, 'manage');
  if (ov !== undefined) return ov;
  return matchesGrant(policy?.managedBy, person);
}

/**
 * Estado EFECTIVO de acceso de una persona a una herramienta, con el ORIGEN de
 * cada decisión — para pintar la matriz de permisos (heredado del rol vs override).
 * @param {PersonRef} person
 * @param {ToolPolicy|undefined|null} policy
 * @param {{ isSuperadmin?: boolean }} [ctx]
 * @returns {{ use: { value: boolean, source: 'superadmin'|'override'|'role' },
 *   manage: { value: boolean, source: 'superadmin'|'override'|'role' } }}
 */
export function effectiveToolAccess(person, policy, { isSuperadmin = false } = {}) {
  const dim = (name, grant) => {
    if (isSuperadmin) return { value: true, source: /** @type {const} */ ('superadmin') };
    const ov = overrideOf(person, policy?.toolId, name);
    if (ov !== undefined) return { value: ov, source: /** @type {const} */ ('override') };
    return { value: matchesGrant(grant, person), source: /** @type {const} */ ('role') };
  };
  return { use: dim('use', policy?.audience), manage: dim('manage', policy?.managedBy) };
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

/**
 * Aplica una excepción de permiso sobre el mapa de overrides de una persona.
 *
 * «Heredar» BORRA la entrada en vez de escribir un `false`: si se dejara escrito
 * un «no», la persona seguiría con la puerta cerrada aunque su rol le diera
 * acceso más adelante, y nadie sabría de dónde salía ese «no». Y una herramienta
 * sin ninguna dimensión forzada desaparece del mapa, para que `toolOverrides`
 * liste solo lo que de verdad es una excepción.
 *
 * Es pura: devuelve un mapa nuevo y no toca el que recibe.
 *
 * @param {Record<string, ToolOverride>} overrides mapa actual (puede ser null/undefined)
 * @param {string} toolId
 * @param {'use'|'manage'} dim
 * @param {'yes'|'no'|'inherit'} mode
 * @returns {Record<string, ToolOverride>} mapa nuevo
 */
export function applyOverride(overrides, toolId, dim, mode) {
  const next = structuredClone(overrides ?? {});
  const entry = { ...(next[toolId] ?? {}) };
  if (mode === 'yes') entry[dim] = true;
  else if (mode === 'no') entry[dim] = false;
  else delete entry[dim];
  if (Object.keys(entry).length === 0) delete next[toolId];
  else next[toolId] = entry;
  return next;
}

/**
 * Modo (yes/no/inherit) que muestra el selector para una dimensión.
 * @param {Record<string, ToolOverride>} overrides
 * @param {string} toolId
 * @param {'use'|'manage'} dim
 * @returns {'yes'|'no'|'inherit'}
 */
export function overrideMode(overrides, toolId, dim) {
  const v = overrides?.[toolId]?.[dim];
  if (v === true) return 'yes';
  if (v === false) return 'no';
  return 'inherit';
}
