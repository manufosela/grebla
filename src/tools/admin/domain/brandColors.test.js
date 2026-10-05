import { describe, expect, it } from 'vitest';
import { contrastRatio, darkVariant, onAccentFor, validateBrandColors, brandStyleSheet, BRAND_CSS_SHAPE, LIGHT_SURFACE, DARK_SURFACE } from './brandColors.js';

describe('brandStyleSheet — los colores válidos, como tokens de los dos temas', () => {
  const colors = { brand: '#1e3a5f', accent: '#2a9d8f', affective: '#c0392b' };

  it('pinta la paleta en claro y su versión calculada en oscuro', () => {
    const css = brandStyleSheet(colors);
    // Sobre el teal, la tinta (5,6:1) gana al blanco (3,3:1).
    expect(css).toContain('html[data-theme]:root{--gr-navy:#1e3a5f;--gr-teal:#2a9d8f;--gr-coral:#c0392b;--rm-on-accent:#10141a;}');
    expect(css).toContain(`html[data-theme='dark']:root{--gr-navy:${darkVariant('#1e3a5f', 4.5)};`);
    // Base.astro solo acepta de localStorage una hoja con esta forma exacta.
    expect(BRAND_CSS_SHAPE.test(css)).toBe(true);
    expect(BRAND_CSS_SHAPE.test(`${css}body{background:url(x)}`)).toBe(false);
  });

  it('con colores que no pasan la validación no pinta nada (se queda la marca de GREBLA)', () => {
    expect(brandStyleSheet({ ...colors, accent: '#a8e6cf' })).toBe('');
    expect(brandStyleSheet(null)).toBe('');
  });
});

describe('contrastRatio (WCAG 2.x)', () => {
  it('negro sobre blanco es 21 y un color consigo mismo es 1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#2a9d8f', '#2a9d8f')).toBeCloseTo(1, 5);
  });

  it('el teal de GREBLA sobre blanco da 3,32', () => {
    expect(contrastRatio('#2a9d8f', LIGHT_SURFACE)).toBeCloseTo(3.32, 2);
  });
});

describe('darkVariant — la versión del tema oscuro sale sola del mismo color', () => {
  it('aclara un color oscuro hasta llegar al mínimo sobre la superficie oscura', () => {
    const v = darkVariant('#1e3a5f', 4.5);
    expect(contrastRatio(v, DARK_SURFACE)).toBeGreaterThanOrEqual(4.5);
  });

  it('un color que ya llega se queda como está', () => {
    expect(darkVariant('#f2887a', 3)).toBe('#f2887a');
  });

  it('la versión oscura apunta alto, no al mínimo justo: se lee como la paleta de GREBLA', () => {
    const accent = darkVariant('#965392', 3); // el rosa r-800 de tribbu
    expect(contrastRatio(accent, DARK_SURFACE)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(darkVariant('#130916', 4.5), DARK_SURFACE)).toBeGreaterThanOrEqual(7);
  });
});

describe('onAccentFor — el texto sobre el acento es el que más contrasta', () => {
  it('sobre un acento oscuro, blanco; sobre uno claro, tinta', () => {
    expect(onAccentFor('#1e3a5f')).toBe('#ffffff');
    expect(onAccentFor('#f2c94c')).toBe('#10141a');
  });
});

describe('validateBrandColors — un color por marca, AA en claro y en oscuro', () => {
  it('los colores legibles pasan', () => {
    expect(validateBrandColors({ brand: '#1e3a5f', accent: '#2a9d8f', affective: '#c0392b' })).toEqual([]);
  });

  it('un acento claro sobre blanco se rechaza y el mensaje nombra el par y el ratio', () => {
    const errors = validateBrandColors({ brand: '#1e3a5f', accent: '#a8e6cf', affective: '#c0392b' });
    expect(errors).toEqual([expect.stringMatching(/^Acento sobre fondo claro: 1,\d\d:1 \(mínimo 3:1\)$/)]);
  });

  it('la marca es texto: necesita 4,5:1 sobre fondo claro', () => {
    const errors = validateBrandColors({ brand: '#2a9d8f', accent: '#2a9d8f', affective: '#c0392b' });
    expect(errors).toEqual(['Marca (texto) sobre fondo claro: 3,32:1 (mínimo 4,5:1)']);
  });

  it('un color que no es #rrggbb no se valida: se rechaza', () => {
    expect(validateBrandColors({ brand: 'navy', accent: '#2a9d8f', affective: '#c0392b' }))
      .toEqual(['Marca: «navy» no es un color #rrggbb']);
  });
});
