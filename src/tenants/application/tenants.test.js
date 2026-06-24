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

  it('resuelve por path, subdominio (slug) y dominio propio (/tenantDomains)', async () => {
    await createTenant(store, { slug: 'demo', name: 'Demo' });
    const tribbuId = await createTenant(store, { slug: 'tribbu', name: 'TRIBBU', domains: ['app.tribbu.com'] });
    await createTenant(store, { slug: 'manufosela', name: 'manufosela' });

    // PATH tiene prioridad (tenant en directorio)
    expect((await resolveTenant(store, { hostname: 'grebla-app.web.app', pathname: '/manufosela/tools/team' }))?.slug).toBe('manufosela');
    // sin tenant en el path → host (subdominio)
    expect((await resolveTenant(store, { hostname: 'tribbu.grebla.app', pathname: '/' }))?.slug).toBe('tribbu');
    // raíz de plataforma (web.app/base) sin /{tenant} → no resuelve ningún tenant
    expect(await resolveTenant(store, { hostname: 'grebla-app.web.app', pathname: '/' })).toBeNull();
    const byDomain = await resolveTenant(store, { hostname: 'app.tribbu.com', pathname: '/' });
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
