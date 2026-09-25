import { describe, it, expect } from 'vitest';
import { CARD_STYLES, STYLE_IDS, normalizeStyles, styleOf, cardClasses } from './cardStyle.js';

describe('la paleta', () => {
  it('es cerrada: se elige de una lista, no se escribe un color', () => {
    // Con color libre es cuestión de tiempo que alguien deje texto gris sobre
    // gris, o algo legible en claro e ilegible en oscuro.
    expect(STYLE_IDS).toEqual(['neutro', 'acento', 'aviso', 'calma']);
  });

  it('cada estilo dice su nombre y trae su clase', () => {
    for (const id of STYLE_IDS) {
      expect(CARD_STYLES[id].label).toBeTruthy();
      expect(CARD_STYLES[id].className).toBe(`cs-${id}`);
    }
  });

  it('el neutro es el de siempre: no pinta nada', () => {
    expect(CARD_STYLES.neutro.className).toBe('cs-neutro');
    expect(CARD_STYLES.neutro.isDefault).toBe(true);
  });
});

describe('los estilos guardados', () => {
  it('se leen tal cual cuando están bien', () => {
    expect(normalizeStyles({ 'a': { style: 'acento', featured: true } }))
      .toEqual({ a: { style: 'acento', featured: true } });
  });

  it('sin nada guardado no hay estilos, y eso no es un error', () => {
    expect(normalizeStyles(null)).toEqual({});
    expect(normalizeStyles('mal')).toEqual({});
  });

  it('un estilo que no existe se descarta: la tarjeta sale normal', () => {
    // Esto es lo que impide que un valor viejo o a mano deje una tarjeta con
    // una clase que ningún CSS define —invisible o ilegible.
    expect(normalizeStyles({ a: { style: 'fucsia-fosforito' } })).toEqual({});
  });

  it('destacar no depende del color: se puede destacar sin teñir', () => {
    expect(normalizeStyles({ a: { featured: true } })).toEqual({ a: { style: 'neutro', featured: true } });
  });

  it('una entrada sin nada que decir no se guarda', () => {
    expect(normalizeStyles({ a: { style: 'neutro', featured: false }, b: {} })).toEqual({});
  });

  it('descarta claves que no son claves', () => {
    expect(normalizeStyles({ '': { featured: true }, '  ': { featured: true } })).toEqual({});
  });

  it('featured solo es true si es true de verdad', () => {
    expect(normalizeStyles({ a: { featured: 'sí' } })).toEqual({});
  });
});

describe('el estilo de una tarjeta', () => {
  const styles = { a: { style: 'aviso', featured: true }, b: { style: 'acento', featured: false } };

  it('es el guardado', () => {
    expect(styleOf(styles, 'a')).toEqual({ style: 'aviso', featured: true });
  });

  it('sin guardar, es el normal y sin destacar', () => {
    expect(styleOf(styles, 'z')).toEqual({ style: 'neutro', featured: false });
    expect(styleOf(null, 'z')).toEqual({ style: 'neutro', featured: false });
  });
});

describe('las clases que se le ponen a la tarjeta', () => {
  it('la del estilo, y la de destacada si lo está', () => {
    expect(cardClasses({ style: 'aviso', featured: true })).toEqual(['cs-aviso', 'cs-featured']);
  });

  it('sin destacar, solo la del estilo', () => {
    expect(cardClasses({ style: 'acento', featured: false })).toEqual(['cs-acento']);
  });

  it('el neutro sin destacar no ensucia la tarjeta con clases vacías', () => {
    expect(cardClasses({ style: 'neutro', featured: false })).toEqual([]);
  });
});
