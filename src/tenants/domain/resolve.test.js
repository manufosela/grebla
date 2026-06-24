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
  it('base/local/web.app → null (sin tenant por defecto)', () => {
    expect(tenantSlugFromHost('grebla.app')).toBeNull();
    expect(tenantSlugFromHost('localhost')).toBeNull();
    expect(tenantSlugFromHost('grebla-app.web.app')).toBeNull();
  });
  it('dominio propio → null', () => {
    expect(tenantSlugFromHost('app.tribbu.com')).toBeNull();
  });
});
