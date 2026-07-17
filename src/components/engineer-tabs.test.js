import { describe, it, expect } from 'vitest';
import { visibleTabsFor, effectiveTabFor } from './engineer-tabs.js';

describe('engineer-space: pestañas por tipo de persona', () => {
  it('un externo ve ficha + motivadores + o2o + marea + retros', () => {
    expect(visibleTabsFor({ external: true })).toEqual(['ficha', 'motivadores', 'o2o', 'marea', 'retros']);
  });

  it('un interno ve ficha primera + carrera/rolemirror/mapa/motivadores/o2o + marea + retros', () => {
    const internal = ['ficha', 'carrera', 'rolemirror', 'mapa', 'motivadores', 'o2o', 'marea', 'retros'];
    expect(visibleTabsFor({ external: false })).toEqual(internal);
    expect(visibleTabsFor({})).toEqual(internal);
    expect(visibleTabsFor(null)).toEqual(internal);
  });

  it('la primera pestaña de todos es «ficha»', () => {
    expect(visibleTabsFor({ external: true })[0]).toBe('ficha');
    expect(visibleTabsFor({})[0]).toBe('ficha');
  });

  it('effectiveTabFor reubica una pestaña oculta a la primera visible', () => {
    // Externo con el hash apuntando a #carrera → cae en «ficha» (primera visible).
    expect(effectiveTabFor('carrera', { external: true })).toBe('ficha');
    expect(effectiveTabFor('mapa', { external: true })).toBe('ficha');
  });

  it('effectiveTabFor respeta una pestaña que sí es visible', () => {
    expect(effectiveTabFor('o2o', { external: true })).toBe('o2o');
    expect(effectiveTabFor('mapa', { external: false })).toBe('mapa');
    expect(effectiveTabFor('motivadores', { external: true })).toBe('motivadores');
  });
});
