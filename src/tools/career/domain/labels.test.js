import { describe, it, expect } from 'vitest';
import {
  LABEL_PRIORITY,
  DECLUTTER_MARGIN_PX,
  labelWorldScale,
  labelScreenPx,
  declutterLabels,
} from './labels.js';

/** Fov vertical de la cámara de la isla (45°) en radianes. */
const FOV = (45 * Math.PI) / 180;
/** Alto de viewport típico en px. */
const VIEW_H = 700;

/** Caja de pruebas: 100×20 px centrada en (x, y). */
const box = (id, x, y, extra = {}) => ({
  id,
  x,
  y,
  w: 100,
  h: 20,
  priority: LABEL_PRIORITY.city,
  ...extra,
});

describe('labelWorldScale', () => {
  it('a fov de 90° la fórmula se reduce a targetPx·2·dist/viewportH', () => {
    // tan(45°) = 1: sin trigonometría de por medio, el valor es exacto.
    expect(labelWorldScale(100, 24, Math.PI / 2, 600)).toBeCloseTo((24 * 2 * 100) / 600, 12);
  });

  it('escala proporcionalmente a la distancia (tamaño aparente constante)', () => {
    const near = labelWorldScale(50, 24, FOV, VIEW_H);
    const far = labelWorldScale(200, 24, FOV, VIEW_H);
    expect(far).toBeCloseTo(near * 4, 12);
  });

  it('es proporcional al targetPx y al inverso del alto del viewport', () => {
    expect(labelWorldScale(80, 30, FOV, VIEW_H)).toBeCloseTo(
      labelWorldScale(80, 15, FOV, VIEW_H) * 2,
      12,
    );
    expect(labelWorldScale(80, 30, FOV, VIEW_H / 2)).toBeCloseTo(
      labelWorldScale(80, 30, FOV, VIEW_H) * 2,
      12,
    );
  });

  it('el roundtrip con labelScreenPx devuelve el targetPx pedido', () => {
    const world = labelWorldScale(120, 24, FOV, VIEW_H);
    expect(labelScreenPx(world, 120, FOV, VIEW_H)).toBeCloseTo(24, 9);
  });

  it('aplica el clamp min/max de escala de mundo', () => {
    const clamp = { min: 0.5, max: 12 };
    expect(labelWorldScale(1, 24, FOV, VIEW_H, clamp)).toBe(0.5); // muy cerca
    expect(labelWorldScale(5000, 24, FOV, VIEW_H, clamp)).toBe(12); // lejísimos
    const free = labelWorldScale(120, 24, FOV, VIEW_H);
    expect(labelWorldScale(120, 24, FOV, VIEW_H, clamp)).toBeCloseTo(free, 12); // dentro
  });

  it('distancias o viewports no válidos devuelven el mínimo del clamp', () => {
    expect(labelWorldScale(0, 24, FOV, VIEW_H, { min: 0.5 })).toBe(0.5);
    expect(labelWorldScale(-3, 24, FOV, VIEW_H)).toBe(0);
    expect(labelWorldScale(100, 24, FOV, 0, { min: 0.5 })).toBe(0.5);
  });
});

describe('labelScreenPx', () => {
  it('crece al acercarse y decrece al alejarse para una escala fija', () => {
    expect(labelScreenPx(4, 50, FOV, VIEW_H)).toBeCloseTo(labelScreenPx(4, 100, FOV, VIEW_H) * 2, 9);
  });

  it('distancia no válida → 0 px (etiqueta sin proyección útil)', () => {
    expect(labelScreenPx(4, 0, FOV, VIEW_H)).toBe(0);
    expect(labelScreenPx(4, -10, FOV, VIEW_H)).toBe(0);
  });
});

describe('declutterLabels', () => {
  it('sin items devuelve un set vacío', () => {
    expect(declutterLabels([])).toEqual(new Set());
  });

  it('cajas que no se tocan: todas visibles', () => {
    const out = declutterLabels([box('a', 100, 100), box('b', 300, 100), box('c', 100, 300)]);
    expect(out).toEqual(new Set(['a', 'b', 'c']));
  });

  it('en colisión gana la de mayor prioridad', () => {
    const out = declutterLabels([
      box('ciudad', 100, 100, { priority: LABEL_PRIORITY.city }),
      box('seleccionada', 110, 105, { priority: LABEL_PRIORITY.selected }),
    ]);
    expect(out).toEqual(new Set(['seleccionada']));
  });

  it('a igual prioridad gana la más cercana a la cámara (menor dist)', () => {
    const out = declutterLabels([
      box('lejana', 100, 100, { dist: 90 }),
      box('cercana', 110, 105, { dist: 30 }),
    ]);
    expect(out).toEqual(new Set(['cercana']));
  });

  it('a igual prioridad y distancia desempata el id menor (determinista)', () => {
    const out = declutterLabels([
      box('beta', 100, 100, { dist: 50 }),
      box('alfa', 110, 105, { dist: 50 }),
    ]);
    expect(out).toEqual(new Set(['alfa']));
  });

  it('el resultado no depende del orden de llegada (orden estable)', () => {
    const items = [
      box('a', 100, 100, { priority: 3, dist: 10 }),
      box('b', 120, 105, { priority: 1, dist: 20 }),
      box('c', 400, 100, { priority: 1, dist: 5 }),
      box('d', 410, 108, { priority: 1, dist: 5 }),
    ];
    const expected = declutterLabels(items);
    expect(declutterLabels(items.toReversed())).toEqual(expected);
    expect(declutterLabels([items[2], items[0], items[3], items[1]])).toEqual(expected);
  });

  it('respeta el margen de respiro entre cajas', () => {
    // Dos cajas de 100 px de ancho a la misma altura: se tocan en |dx| < 100 + margen.
    const separated = declutterLabels([box('a', 0, 0), box('b', 100 + DECLUTTER_MARGIN_PX, 0)]);
    expect(separated).toEqual(new Set(['a', 'b'])); // justo al margen: caben
    const cramped = declutterLabels([box('a', 0, 0), box('b', 100 + DECLUTTER_MARGIN_PX - 1, 0)]);
    expect(cramped.size).toBe(1); // un px menos: colisión
  });

  it('solapadas solo en un eje no colisionan (hace falta solape en ambos)', () => {
    // Mismo x pero muy separadas en y, y viceversa.
    const out = declutterLabels([box('a', 100, 100), box('b', 100, 200), box('c', 400, 100)]);
    expect(out).toEqual(new Set(['a', 'b', 'c']));
  });

  it('una etiqueta rechazada no bloquea a las siguientes (greedy encadenado)', () => {
    // A (prioridad alta) tapa a B; C solo chocaba con B → C se ve.
    const out = declutterLabels([
      box('a', 100, 100, { priority: LABEL_PRIORITY.area }),
      box('b', 180, 100, { priority: LABEL_PRIORITY.city }),
      box('c', 260, 100, { priority: LABEL_PRIORITY.city, dist: 99 }),
    ]);
    expect(out).toEqual(new Set(['a', 'c']));
  });

  it('la jerarquía documentada mantiene el orden esperado', () => {
    const p = LABEL_PRIORITY;
    expect(p.challenge).toBeGreaterThan(p.selected); // el camino del reto siempre se lee (JG-5)
    expect(p.selected).toBeGreaterThan(p.current);
    expect(p.current).toBeGreaterThan(p.area);
    expect(p.area).toBeGreaterThan(p.available);
    expect(p.available).toBeGreaterThan(p.city);
    expect(p.teammate).toBe(p.city); // compañeros al nivel del resto de ciudades
  });
});
