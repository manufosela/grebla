import { describe, it, expect } from 'vitest';
import { SURFACES, normalizeLayout, orderedKeys, moveKey } from './cardLayout.js';

describe('las superficies que se pueden ordenar', () => {
  it('son el inicio y el panel, y nada más', () => {
    expect(SURFACES).toEqual(['home', 'admin']);
  });
});

describe('el orden guardado', () => {
  it('se lee tal cual cuando está bien', () => {
    expect(normalizeLayout({ home: ['a', 'b'], admin: ['x'] }))
      .toEqual({ home: ['a', 'b'], admin: ['x'], styles: { home: {}, admin: {} } });
  });

  it('sin documento no hay orden, y eso no es un error: manda el del código', () => {
    expect(normalizeLayout(null)).toEqual({ home: [], admin: [], styles: { home: {}, admin: {} } });
    expect(normalizeLayout({})).toEqual({ home: [], admin: [], styles: { home: {}, admin: {} } });
  });

  it('descarta la basura sin tumbar la pantalla: una config rota no deja a nadie sin tarjetas', () => {
    expect(normalizeLayout({ home: 'a,b', admin: [1, null, 'x', '', '  y  '] }))
      .toEqual({ home: [], admin: ['x', 'y'], styles: { home: {}, admin: {} } });
  });

  it('no se cree claves repetidas: una tarjeta está en un sitio, no en dos', () => {
    expect(normalizeLayout({ home: ['a', 'b', 'a'] }).home).toEqual(['a', 'b']);
  });

  it('ignora superficies que no existen', () => {
    expect(normalizeLayout({ home: ['a'], inventada: ['z'] }))
      .toEqual({ home: ['a'], admin: [], styles: { home: {}, admin: {} } });
  });
});

describe('el aspecto entra por la misma puerta', () => {
  it('se sanea junto al orden: una sola puerta, no media', () => {
    const layout = normalizeLayout({
      home: ['a'],
      styles: { home: { a: { style: 'aviso', featured: true }, b: { style: 'inventado' } } },
    });
    expect(layout.styles.home).toEqual({ a: { style: 'aviso', featured: true } });
  });

  it('sin estilos guardados, ninguno', () => {
    expect(normalizeLayout({ home: ['a'] }).styles).toEqual({ home: {}, admin: {} });
  });
});

describe('aplicar el orden a lo que hay', () => {
  it('coloca las tarjetas como dice el orden', () => {
    expect(orderedKeys(['a', 'b', 'c'], ['c', 'a', 'b'])).toEqual(['c', 'a', 'b']);
  });

  it('una tarjeta NUEVA del código aparece igual, al final: nunca desaparecida', () => {
    // Esto es lo que impide que añadir una herramienta la deje invisible hasta
    // que alguien se acuerde de reordenar.
    expect(orderedKeys(['a', 'b', 'nueva'], ['b', 'a'])).toEqual(['b', 'a', 'nueva']);
  });

  it('las nuevas mantienen entre ellas el orden del código', () => {
    expect(orderedKeys(['a', 'n1', 'n2'], ['a'])).toEqual(['a', 'n1', 'n2']);
  });

  it('una clave guardada que ya no existe se ignora, sin hueco ni error', () => {
    expect(orderedKeys(['a', 'b'], ['fantasma', 'b', 'a'])).toEqual(['b', 'a']);
  });

  it('sin orden guardado se respeta el del código', () => {
    expect(orderedKeys(['a', 'b'], [])).toEqual(['a', 'b']);
    expect(orderedKeys(['a', 'b'], null)).toEqual(['a', 'b']);
  });

  it('no toca la lista que recibe', () => {
    const presentes = ['a', 'b'];
    orderedKeys(presentes, ['b', 'a']);
    expect(presentes).toEqual(['a', 'b']);
  });
});

describe('mover una tarjeta', () => {
  it('la sube una posición', () => {
    expect(moveKey(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
  });

  it('la baja una posición', () => {
    expect(moveKey(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b']);
  });

  it('en los bordes no se cae ni da la vuelta', () => {
    expect(moveKey(['a', 'b'], 'a', -1)).toEqual(['a', 'b']);
    expect(moveKey(['a', 'b'], 'b', 1)).toEqual(['a', 'b']);
  });

  it('una clave que no está deja el orden como estaba', () => {
    expect(moveKey(['a', 'b'], 'z', 1)).toEqual(['a', 'b']);
  });

  it('devuelve una lista nueva', () => {
    const orden = ['a', 'b'];
    expect(moveKey(orden, 'a', 1)).not.toBe(orden);
    expect(orden).toEqual(['a', 'b']);
  });
});
