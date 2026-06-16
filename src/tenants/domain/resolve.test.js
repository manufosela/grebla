import { describe, it, expect } from 'vitest';
import { resolveTenantSlug } from './resolve.js';

describe('resolveTenantSlug', () => {
  it('subdominio → slug', () => {
    expect(resolveTenantSlug('tribbu.grebla.app')).toBe('tribbu');
    expect(resolveTenantSlug('TRIBBU.grebla.app')).toBe('tribbu');
    expect(resolveTenantSlug('tribbu.grebla.app:443')).toBe('tribbu');
  });

  it('dominio base, www, local y *.web.app → demo', () => {
    expect(resolveTenantSlug('grebla.app')).toBe('demo');
    expect(resolveTenantSlug('www.grebla.app')).toBe('demo');
    expect(resolveTenantSlug('localhost')).toBe('demo');
    expect(resolveTenantSlug('grebla-app.web.app')).toBe('demo');
    expect(resolveTenantSlug('grebla-app.firebaseapp.com')).toBe('demo');
  });

  it('dominio propio → null (se resuelve por /tenantDomains)', () => {
    expect(resolveTenantSlug('app.tribbu.com')).toBeNull();
  });

  it('respeta baseDomain y defaultSlug configurables', () => {
    expect(resolveTenantSlug('acme.ejemplo.io', { baseDomain: 'ejemplo.io', defaultSlug: 'main' })).toBe('acme');
    expect(resolveTenantSlug('ejemplo.io', { baseDomain: 'ejemplo.io', defaultSlug: 'main' })).toBe('main');
  });
});
