import { describe, it, expect } from 'vitest';
import { visibleTabsFor, effectiveTabFor } from './engineer-tabs.js';

describe('engineer-space: pestañas por tipo de persona', () => {
  it('un externo ve datos + o2o + marea + retros', () => {
    expect(visibleTabsFor({ external: true })).toEqual(['datos', 'o2o', 'marea', 'retros']);
  });

  it('un interno ve carrera/rolemirror/mapa/o2o + marea + retros', () => {
    expect(visibleTabsFor({ external: false })).toEqual(['carrera', 'rolemirror', 'mapa', 'o2o', 'marea', 'retros']);
    expect(visibleTabsFor({})).toEqual(['carrera', 'rolemirror', 'mapa', 'o2o', 'marea', 'retros']);
    expect(visibleTabsFor(null)).toEqual(['carrera', 'rolemirror', 'mapa', 'o2o', 'marea', 'retros']);
  });

  it('effectiveTabFor reubica una pestaña oculta a la primera visible', () => {
    // Externo con el hash apuntando a #carrera → cae en «datos».
    expect(effectiveTabFor('carrera', { external: true })).toBe('datos');
    expect(effectiveTabFor('mapa', { external: true })).toBe('datos');
  });

  it('effectiveTabFor respeta una pestaña que sí es visible', () => {
    expect(effectiveTabFor('o2o', { external: true })).toBe('o2o');
    expect(effectiveTabFor('mapa', { external: false })).toBe('mapa');
  });
});
