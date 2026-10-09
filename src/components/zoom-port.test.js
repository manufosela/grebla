/**
 * <zoom-port> (RMR-TSK-0671): el zoom no se sale de sus topes y «Ver todo»
 * encaja el lienzo en el visor. Métodos del prototipo sobre un `this` mínimo.
 */
import { describe, it, expect } from 'vitest';
import { ZoomPort } from './zoom-port.js';

const { zoomBy, fit, reset } = ZoomPort.prototype;

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
