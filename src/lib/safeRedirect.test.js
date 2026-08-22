import { describe, it, expect } from 'vitest';
import { safeRedirect, HOME } from './safeRedirect.js';

describe('safeRedirect — el destino tras el login es entrada no confiable', () => {
  it('deja pasar rutas internas, con query y ancla', () => {
    expect(safeRedirect('/tools/team')).toBe('/tools/team');
    expect(safeRedirect('/admin?tab=users#top')).toBe('/admin?tab=users#top');
    expect(safeRedirect('/')).toBe('/');
  });

  it('rechaza javascript: y data: — ejecutarían código en nuestro origen', () => {
    expect(safeRedirect('javascript:alert(1)')).toBe(HOME);
    expect(safeRedirect('  JavaScript:alert(1)')).toBe(HOME);
    expect(safeRedirect('data:text/html,<script>alert(1)</script>')).toBe(HOME);
  });

  it('rechaza destinos fuera del sitio, incluida la forma protocol-relative', () => {
    expect(safeRedirect('https://dominio-malo.example')).toBe(HOME);
    expect(safeRedirect('//dominio-malo.example')).toBe(HOME);
    expect(safeRedirect('/\\dominio-malo.example')).toBe(HOME);
  });

  it('rechaza rutas relativas y valores que no son texto', () => {
    expect(safeRedirect('tools/team')).toBe(HOME);
    expect(safeRedirect(null)).toBe(HOME);
    expect(safeRedirect(undefined)).toBe(HOME);
    expect(safeRedirect(42)).toBe(HOME);
  });

  it('los saltos de línea se descartan al normalizar y el destino sigue siendo interno', () => {
    // No hace falta rechazarlo: la normalización estándar los elimina y lo que
    // queda es una ruta del propio sitio (como mucho, un 404).
    expect(safeRedirect('/tools\nX')).toBe('/toolsX');
    expect(safeRedirect('/tools/\tteam')).toBe('/tools/team');
  });
});
