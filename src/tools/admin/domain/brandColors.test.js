import { describe, expect, it } from 'vitest';
import { contrastRatio, darkVariant, onAccentFor, validateBrandColors, LIGHT_SURFACE, DARK_SURFACE } from './brandColors.js';

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
