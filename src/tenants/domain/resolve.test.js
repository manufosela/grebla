import { describe, it, expect } from 'vitest';
import { tenantSlugFromPath, tenantSlugFromHost } from './resolve.js';

describe('tenantSlugFromPath', () => {
  it('primer segmento = tenant', () => {
    expect(tenantSlugFromPath('/manufosela')).toBe('manufosela');
    expect(tenantSlugFromPath('/manufosela/tools/team')).toBe('manufosela');
    expect(tenantSlugFromPath('/Manufosela/tools/dora')).toBe('manufosela');
  });
  it('rutas reservadas de plataforma → null', () => {
    expect(tenantSlugFromPath('/')).toBeNull();
    expect(tenantSlugFromPath('/login')).toBeNull();
    expect(tenantSlugFromPath('/guia')).toBeNull();
    expect(tenantSlugFromPath('/tools/team')).toBeNull();
    expect(tenantSlugFromPath('/_astro/x.js')).toBeNull();
  });
});

describe('tenantSlugFromHost', () => {
  it('subdominio → slug', () => {
    expect(tenantSlugFromHost('tribbu.grebla.app')).toBe('tribbu');
  });
  it('base/local/web.app → demo', () => {
    expect(tenantSlugFromHost('grebla.app')).toBe('demo');
    expect(tenantSlugFromHost('localhost')).toBe('demo');
    expect(tenantSlugFromHost('grebla-app.web.app')).toBe('demo');
  });
  it('dominio propio → null', () => {
    expect(tenantSlugFromHost('app.tribbu.com')).toBeNull();
  });
});
