/**
 * Casos de uso de tenants sobre el TenantStore. Incluye la resolución del tenant
 * a partir del hostname (primero por dominio propio en /tenantDomains, luego por
 * slug de subdominio).
 *
 * @typedef {import('../domain/ports.js').TenantStore} TenantStore
 * @typedef {import('../domain/types.js').Tenant} Tenant
 */
import { tenantSlugFromPath, tenantSlugFromHost } from '../domain/resolve.js';
import { isValidTenantRole } from '../domain/types.js';

/**
 * Resuelve el tenant activo a partir de la ubicación. Prioridad: path (tenant en
 * directorio) → dominio propio (/tenantDomains) → host (subdominio/defecto).
 * @param {TenantStore} store
 * @param {{ hostname?: string, pathname?: string }} location
 * @param {{ baseDomain?: string }} [opts]
 * @returns {Promise<Tenant|null>}
 */
export async function resolveTenant(store, location = {}, opts = {}) {
  const { hostname = '', pathname = '/' } = location;
  const pathSlug = tenantSlugFromPath(pathname);
  if (pathSlug) {
    const byPath = await store.tenants.getBySlug(pathSlug);
    if (byPath) return byPath;
  }
  const host = String(hostname).toLowerCase().split(':')[0].trim();
  const byDomain = await store.tenants.getByDomain(host);
  if (byDomain) return byDomain;
  const hostSlug = tenantSlugFromHost(hostname, opts);
  return hostSlug ? store.tenants.getBySlug(hostSlug) : null;
}

/** @param {TenantStore} store @param {string} id */
export function getTenant(store, id) {
  return store.tenants.get(id);
}

/**
 * @param {TenantStore} store
 * @param {{ slug: string, name?: string, domains?: string[] }} input
 * @returns {Promise<string>}
 */
export function createTenant(store, input) {
  const slug = String(input?.slug ?? '').trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('El slug del tenant debe ser [a-z0-9-]');
  return store.tenants.create({
    slug,
    name: input.name?.trim() || slug,
    domains: Array.isArray(input.domains) ? input.domains : [],
    createdAt: new Date().toISOString(),
  });
}

/** @param {TenantStore} store @param {string} tenantId */
export function listMembers(store, tenantId) {
  return store.members.list(tenantId);
}

/**
 * @param {TenantStore} store @param {string} tenantId @param {string} uid
 * @returns {Promise<import('../domain/types.js').TenantRole|null>}
 */
export async function getRole(store, tenantId, uid) {
  const member = await store.members.get(tenantId, uid);
  return member ? member.role : null;
}

/** @param {TenantStore} store @param {string} tenantId @param {string} uid */
export async function isMember(store, tenantId, uid) {
  return (await store.members.get(tenantId, uid)) != null;
}

/**
 * @param {TenantStore} store @param {string} tenantId @param {string} uid
 * @param {import('../domain/types.js').TenantRole} role
 */
export function setMember(store, tenantId, uid, role) {
  if (!isValidTenantRole(role)) throw new Error(`Rol de tenant inválido: ${role}`);
  return store.members.set(tenantId, uid, role);
}
