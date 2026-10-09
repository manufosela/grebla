/**
 * <zoom-port> (RMR-TSK-0671): el zoom no se sale de sus topes y «Ver todo»
 * encaja el lienzo en el visor. Métodos del prototipo sobre un `this` mínimo.
 */
import { describe, it, expect } from 'vitest';
import { ZoomPort } from './zoom-port.js';

const { zoomBy, fit, reset, _onPanStart, _onPanMove } = ZoomPort.prototype;

describe('<zoom-port>: un clic no es un arrastre (RMR-TSK-0673)', () => {
  const pointer = (x, y) => {
    const captured = [];
    const port = { setPointerCapture: (id) => captured.push(id), classList: { add: () => {} } };
    return { e: { button: 0, clientX: x, clientY: y, pointerId: 7, currentTarget: port }, captured };
  };

  it('pulsar no captura el puntero, así el clic llega a la tarjeta; moverse unos píxeles sí arrastra', () => {
    const ctx = { _pan: { x: 0, y: 0 } };
    const down = pointer(100, 100);
    _onPanStart.call(ctx, down.e);
    _onPanMove.call(ctx, { ...down.e, clientX: 102, clientY: 101 });
    expect(down.captured).toEqual([]);
    expect(ctx._pan).toEqual({ x: 0, y: 0 });
    _onPanMove.call(ctx, { ...down.e, clientX: 130, clientY: 110 });
    expect(down.captured).toEqual([7]);
    expect(ctx._pan).toEqual({ x: 30, y: 10 });
  });
});

describe('<zoom-port>', () => {
  it('el zoom se queda entre 0,15 y 2,5', () => {
    const ctx = { _zoom: 2 };
    zoomBy.call(ctx, 10);
    expect(ctx._zoom).toBe(2.5);
    zoomBy.call(ctx, 0.001);
    expect(ctx._zoom).toBe(0.15);
  });

  it('«Ver todo» reduce un lienzo ancho hasta que cabe y lo centra; «100 %» vuelve al tamaño real', () => {
    globalThis.innerHeight = 1000;
    const port = { clientWidth: 1024, clientHeight: 600 };
    const ctx = { width: 2000, height: 400, _fullscreen: false, renderRoot: { querySelector: () => port } };
    fit.call(ctx);
    expect(ctx._zoom).toBe(0.5);
    expect(ctx._pan).toEqual({ x: 12, y: 12 });
    reset.call(ctx);
    expect([ctx._zoom, ctx._pan]).toEqual([1, { x: 12, y: 12 }]);
  });
});
