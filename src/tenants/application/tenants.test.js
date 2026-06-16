import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryTenantStore } from '../infrastructure/memory/index.js';
import {
  createTenant,
  resolveTenant,
  getTenant,
  setMember,
  getRole,
  isMember,
  listMembers,
} from './usecases.js';

describe('tenants — casos de uso', () => {
  /** @type {ReturnType<typeof createMemoryTenantStore>} */
  let store;
  beforeEach(() => {
    store = createMemoryTenantStore();
  });

  it('crea un tenant validando el slug', async () => {
    expect(() => createTenant(store, { slug: 'Con Espacios' })).toThrow();
    const id = await createTenant(store, { slug: 'tribbu', name: 'TRIBBU', domains: ['app.tribbu.com'] });
    const t = await getTenant(store, id);
    expect(t).toMatchObject({ slug: 'tribbu', name: 'TRIBBU' });
  });

  it('resuelve por subdominio (slug) y por dominio propio (/tenantDomains)', async () => {
    await createTenant(store, { slug: 'demo', name: 'Demo' });
    const tribbuId = await createTenant(store, { slug: 'tribbu', name: 'TRIBBU', domains: ['app.tribbu.com'] });

    expect((await resolveTenant(store, 'tribbu.grebla.app'))?.slug).toBe('tribbu');
    expect((await resolveTenant(store, 'grebla-app.web.app'))?.slug).toBe('demo');
    const byDomain = await resolveTenant(store, 'app.tribbu.com');
    expect(byDomain?.id).toBe(tribbuId);
  });

  it('gestiona miembros y roles', async () => {
    const id = await createTenant(store, { slug: 'tribbu' });
    expect(() => setMember(store, id, 'u1', 'jefe')).toThrow();
    await setMember(store, id, 'u1', 'admin');
    await setMember(store, id, 'u2', 'leader');
    expect(await getRole(store, id, 'u1')).toBe('admin');
    expect(await isMember(store, id, 'u3')).toBe(false);
    expect((await listMembers(store, id)).map((m) => m.uid).sort()).toEqual(['u1', 'u2']);
  });
});
