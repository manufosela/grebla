/**
 * Puertos del dominio de tenants.
 *
 * @typedef {import('./types.js').Tenant} Tenant
 * @typedef {import('./types.js').Member} Member
 * @typedef {import('./types.js').TenantRole} TenantRole
 *
 * @typedef {Object} TenantRepository
 * @property {(id: string) => Promise<Tenant|null>} get
 * @property {(slug: string) => Promise<Tenant|null>} getBySlug
 * @property {(host: string) => Promise<Tenant|null>} getByDomain
 * @property {(input: Omit<Tenant,'id'>) => Promise<string>} create
 * @property {() => Promise<Tenant[]>} list
 *
 * @typedef {Object} MemberRepository
 * @property {(tenantId: string) => Promise<Member[]>} list
 * @property {(tenantId: string, uid: string) => Promise<Member|null>} get
 * @property {(tenantId: string, uid: string, role: TenantRole) => Promise<void>} set
 * @property {(tenantId: string, uid: string) => Promise<void>} remove
 *
 * @typedef {Object} TenantStore
 * @property {TenantRepository} tenants
 * @property {MemberRepository} members
 */

export {};
