/**
 * Modelo de tenant (organización) para el SaaS multi-tenant de GREBLA. Cada
 * tenant aísla sus datos bajo /tenants/{id}. Dentro hay varios miembros con rol.
 * El rol de plataforma (super-admin) NO es un rol de tenant: vive en /admins.
 *
 * @typedef {Object} Tenant
 * @property {string} id
 * @property {string} slug      Subdominio: {slug}.grebla.app
 * @property {string} name
 * @property {string[]} domains Hostnames asociados (subdominio + dominios propios)
 * @property {string} [createdAt]
 *
 * @typedef {'admin'|'leader'|'member'} TenantRole
 * @typedef {Object} Member
 * @property {string} uid
 * @property {TenantRole} role
 */

/** Roles dentro de un tenant (de mayor a menor capacidad). */
export const TENANT_ROLES = Object.freeze(['admin', 'leader', 'member']);

/** @param {unknown} role */
export function isValidTenantRole(role) {
  return typeof role === 'string' && TENANT_ROLES.includes(role);
}

export {};
