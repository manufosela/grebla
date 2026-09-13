/**
 * Tests del destino del «← Volver» (RMR-BUG-0115).
 *
 * Lo que se defiende: que la procedencia la marque QUIEN ENLAZA, y que
 * cualquier otra cosa —un `from` inventado, una URL a mano— caiga en el destino
 * de siempre en vez de mandar a nadie a una página que no le toca.
 */
import { describe, it, expect } from 'vitest';
import { backTarget } from './backTarget.js';

describe('backTarget', () => {
  it('quien viene de Administración vuelve a Administración, y se le dice', () => {
    expect(backTarget('?from=admin')).toEqual({ href: '/admin', label: 'Volver a Administración' });
    expect(backTarget('from=admin')).toEqual({ href: '/admin', label: 'Volver a Administración' });
  });

  it('quien entra por el hub de herramientas vuelve al hub', () => {
    expect(backTarget('')).toEqual({ href: '/', label: 'Volver' });
    expect(backTarget(null)).toEqual({ href: '/', label: 'Volver' });
  });

  it('respeta el destino propio de una página que ya lo tenía', () => {
    // La biblioteca vuelve a su mapa de carrera, no a la portada.
    expect(backTarget('', '/tools/career-map').href).toBe('/tools/career-map');
  });

  it('un origen inventado no manda a ningún sitio raro', () => {
    expect(backTarget('?from=javascript:alert(1)').href).toBe('/');
    expect(backTarget('?from=//otro-sitio.example').href).toBe('/');
    expect(backTarget('?from=ADMIN').href).toBe('/');
  });

  it('el origen de admin gana aunque vengan más parámetros', () => {
    expect(backTarget('?foo=1&from=admin&bar=2').href).toBe('/admin');
  });
});
