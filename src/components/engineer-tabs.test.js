import { describe, it, expect } from 'vitest';
import { visibleTabsFor, effectiveTabFor } from './engineer-tabs.js';

describe('engineer-space: pestañas por tipo de persona', () => {
  it('un externo ve solo lo suyo: ficha, O2O y datos', () => {
    expect(visibleTabsFor({ external: true })).toEqual(['ficha', 'o2o', 'datos']);
  });

  it('un interno añade su carrera y su Role Mirror', () => {
    const internal = ['ficha', 'carrera', 'rolemirror', 'o2o', 'datos'];
    expect(visibleTabsFor({ external: false })).toEqual(internal);
    expect(visibleTabsFor({})).toEqual(internal);
    expect(visibleTabsFor(null)).toEqual(internal);
  });

  it('aquí NO están las herramientas que tienen su card en el hub', () => {
    // Marea, Retros, Kudos y Motivadores se abren desde su card. Tenerlas
    // también aquí daba dos puertas a lo mismo (RMR-TSK-0459).
    for (const persona of [{ external: true }, {}]) {
      const tabs = visibleTabsFor(persona);
      for (const fuera of ['marea', 'retros', 'kudos', 'motivadores']) {
        expect(tabs, `«${fuera}» no debe estar en Mi espacio`).not.toContain(fuera);
      }
    }
  });

  it('quien llegue con un enlace viejo a esas pestañas cae en la primera, no en un vacío', () => {
    // Los hash antiguos (#marea, #kudos) siguen circulando por ahí.
    expect(effectiveTabFor('marea', {})).toBe('ficha');
    expect(effectiveTabFor('kudos', { external: true })).toBe('ficha');
  });

  it('«mapa» ya no es una pestaña de primer nivel (RMR-TSK-0262)', () => {
    expect(visibleTabsFor({})).not.toContain('mapa');
    expect(effectiveTabFor('mapa', {})).toBe('ficha');
  });

  it('la primera pestaña de todos es «ficha»', () => {
    expect(visibleTabsFor({ external: true })[0]).toBe('ficha');
    expect(visibleTabsFor({})[0]).toBe('ficha');
  });

  it('un externo no tiene carrera: ese hash cae en la primera visible', () => {
    expect(effectiveTabFor('carrera', { external: true })).toBe('ficha');
  });

  it('effectiveTabFor respeta una pestaña que sí es visible', () => {
    expect(effectiveTabFor('o2o', { external: true })).toBe('o2o');
    expect(effectiveTabFor('carrera', { external: false })).toBe('carrera');
    expect(effectiveTabFor('datos', { external: true })).toBe('datos');
  });
});
