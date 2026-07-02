import { describe, it, expect } from 'vitest';
import { sparkline, sparklineTrend, SPARK_MIN, SPARK_MAX } from './sparkline.js';

describe('sparkline (geometría pura del line chart)', () => {
  it('reparte los puntos por el ancho útil y respeta el padding', () => {
    const geo = sparkline([{ value: 1 }, { value: 4 }, { value: 7 }], {
      width: 300,
      height: 120,
      padding: 10,
    });
    expect(geo.points).toHaveLength(3);
    // Primer punto pegado al padding izquierdo, último al derecho.
    expect(geo.points[0].x).toBe(10);
    expect(geo.points.at(-1).x).toBe(290);
    // El intermedio queda centrado horizontalmente.
    expect(geo.points[1].x).toBe(150);
  });

  it('invierte el eje Y: mayor valor → menor y', () => {
    const geo = sparkline([{ value: SPARK_MIN }, { value: SPARK_MAX }], {
      width: 300,
      height: 120,
      padding: 10,
    });
    const [low, high] = geo.points;
    // El mínimo va abajo (y grande), el máximo arriba (y pequeña).
    expect(low.y).toBe(110);
    expect(high.y).toBe(10);
    expect(high.y).toBeLessThan(low.y);
  });

  it('acota los valores fuera de rango al [min, max]', () => {
    const geo = sparkline([{ value: -5 }, { value: 99 }]);
    expect(geo.points[0].value).toBe(SPARK_MIN);
    expect(geo.points[1].value).toBe(SPARK_MAX);
  });

  it('centra un único punto sin dividir por cero', () => {
    const geo = sparkline([{ value: 4 }], { width: 200, height: 100, padding: 10 });
    expect(geo.points).toHaveLength(1);
    expect(geo.points[0].x).toBe(100); // padding + innerW/2
  });

  it('devuelve geometría vacía para series vacías o inválidas', () => {
    expect(sparkline([]).points).toEqual([]);
    expect(sparkline([]).polyline).toBe('');
    expect(sparkline(undefined).points).toEqual([]);
  });

  it('trata los valores no numéricos como el mínimo', () => {
    const geo = sparkline([{ value: 'x' }, { value: null }]);
    expect(geo.points[0].value).toBe(SPARK_MIN);
    expect(geo.points[1].value).toBe(SPARK_MIN);
  });

  it('construye la cadena polyline coherente con los puntos', () => {
    const geo = sparkline([{ value: 1 }, { value: 7 }], { width: 300, height: 120, padding: 10 });
    const expected = geo.points.map((p) => `${p.x},${p.y}`).join(' ');
    expect(geo.polyline).toBe(expected);
    expect(geo.polyline.split(' ')).toHaveLength(2);
  });

  it('propaga el ancho, alto y rango efectivos', () => {
    const geo = sparkline([{ value: 3 }], { width: 400, height: 150, min: 0, max: 10 });
    expect(geo.width).toBe(400);
    expect(geo.height).toBe(150);
    expect(geo.min).toBe(0);
    expect(geo.max).toBe(10);
  });
});

describe('sparklineTrend', () => {
  it('detecta ascenso, descenso y estabilidad', () => {
    expect(sparklineTrend([{ value: 2 }, { value: 5 }])).toBe('ascendente');
    expect(sparklineTrend([{ value: 6 }, { value: 3 }])).toBe('descendente');
    expect(sparklineTrend([{ value: 4 }, { value: 4 }])).toBe('estable');
  });

  it('es estable con menos de dos lecturas', () => {
    expect(sparklineTrend([])).toBe('estable');
    expect(sparklineTrend([{ value: 3 }])).toBe('estable');
  });
});
