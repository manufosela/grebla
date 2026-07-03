import { describe, it, expect } from 'vitest';
import {
  WORLD_SIZE,
  AREA_PAD,
  BEACH_MARGIN,
  MIN_ISLAND_RADIUS,
  STATUS_COLORS,
  ACCENT_COLORS,
  worldFromMap,
  cityStatusColor,
  hslToHex,
  areaColor,
  areaLayout,
  islandRadius,
  CITY_FOCUS,
  AREA_FOCUS,
  cityFocusFrame,
  areaFocusFrame,
} from './islandLayout.js';

/** Mapa mínimo de pruebas: dos comarcas, una vacía, y puerto de inicio. */
const MAP = {
  id: 'isla-test',
  name: 'Isla de pruebas',
  areas: [
    { id: 'a1', name: 'Frontend' },
    { id: 'a2', name: 'Backend' },
    { id: 'vacia', name: 'Sin ciudades' },
  ],
  cities: [
    { id: 'c1', name: 'HTML', kind: 'tech', area: 'a1', x: 40, y: 50, weight: 1, prereqs: [] },
    { id: 'c2', name: 'CSS', kind: 'tech', area: 'a1', x: 60, y: 50, weight: 1, prereqs: [] },
    { id: 'c3', name: 'Node', kind: 'tech', area: 'a2', x: 80, y: 80, weight: 2, prereqs: [] },
  ],
  startPort: { x: 50, y: 95 },
};

describe('worldFromMap', () => {
  it('centra el mapa lógico en el origen del mundo', () => {
    expect(worldFromMap(50, 50)).toEqual({ wx: 0, wz: 0 });
    expect(worldFromMap(0, 0)).toEqual({ wx: -50, wz: -50 });
    expect(worldFromMap(100, 100)).toEqual({ wx: 50, wz: 50 });
    expect(worldFromMap(100, 0)).toEqual({ wx: 50, wz: -50 });
  });

  it('la y lógica del mapa se convierte en la z del mundo', () => {
    const p = worldFromMap(50, 75);
    expect(p.wx).toBe(0);
    expect(p.wz).toBe(25);
  });

  it('opts.size escala el mundo', () => {
    expect(worldFromMap(0, 100, { size: 200 })).toEqual({ wx: -100, wz: 100 });
    expect(WORLD_SIZE).toBe(100);
  });
});

describe('cityStatusColor', () => {
  it('mapea la paleta --rm-* por estado', () => {
    expect(cityStatusColor('visited')).toBe(0x2a9d8f); // --rm-accent
    expect(cityStatusColor('available')).toBe(0xf2887a); // --gr-coral
    expect(cityStatusColor('blocked')).toBe(0xd7dee2); // --rm-track
    expect(cityStatusColor('deprecated')).toBe(0xed9292); // --rm-danger atenuado
  });

  it('coincide con la tabla STATUS_COLORS y expone los acentos overlay', () => {
    expect(cityStatusColor('visited')).toBe(STATUS_COLORS.visited);
    expect(ACCENT_COLORS.route).toBe(0x1e3a5f); // --rm-navy
    expect(ACCENT_COLORS.current).toBe(0xe26d5e); // --rm-coral-600
  });

  it('falla en alto ante un estado desconocido (sin fallbacks silenciosos)', () => {
    expect(() => cityStatusColor('unknown')).toThrow(/desconocido/i);
    expect(() => cityStatusColor(undefined)).toThrow(/desconocido/i);
  });
});

describe('hslToHex / areaColor', () => {
  it('convierte colores HSL conocidos', () => {
    expect(hslToHex(0, 100, 50)).toBe(0xff0000);
    expect(hslToHex(120, 100, 50)).toBe(0x00ff00);
    expect(hslToHex(240, 100, 50)).toBe(0x0000ff);
    expect(hslToHex(0, 0, 100)).toBe(0xffffff);
    expect(hslToHex(0, 0, 0)).toBe(0x000000);
  });

  it('areaColor es determinista y reparte tonos por índice', () => {
    expect(areaColor(0, 3)).toBe(areaColor(0, 3));
    expect(areaColor(0, 3)).not.toBe(areaColor(1, 3));
    expect(areaColor(1, 3)).not.toBe(areaColor(2, 3));
  });

  it('areaColor devuelve un hex válido incluso con total 0', () => {
    const c = areaColor(0, 0);
    expect(Number.isInteger(c)).toBe(true);
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(0xffffff);
  });
});

describe('areaLayout', () => {
  it('calcula centroide y radio (envolvente + AREA_PAD) por comarca', () => {
    const layout = areaLayout(MAP);
    const a1 = layout.find((l) => l.area.id === 'a1');
    // c1 (40,50) y c2 (60,50) → mundo (-10,0) y (10,0): centroide (0,0), spread 10.
    expect(a1.center).toEqual({ wx: 0, wz: 0 });
    expect(a1.radius).toBe(10 + AREA_PAD);
  });

  it('una comarca con una sola ciudad tiene radio AREA_PAD centrado en ella', () => {
    const a2 = areaLayout(MAP).find((l) => l.area.id === 'a2');
    expect(a2.center).toEqual({ wx: 30, wz: 30 });
    expect(a2.radius).toBe(AREA_PAD);
  });

  it('omite las comarcas sin ciudades', () => {
    const layout = areaLayout(MAP);
    expect(layout.map((l) => l.area.id)).toEqual(['a1', 'a2']);
  });

  it('el color de comarca es determinista por índice en map.areas', () => {
    const layout = areaLayout(MAP);
    expect(layout[0].color).toBe(areaColor(0, 3));
    expect(layout[1].color).toBe(areaColor(1, 3));
  });

  it('tolera mapa nulo o vacío', () => {
    expect(areaLayout(null)).toEqual([]);
    expect(areaLayout({ areas: [], cities: [] })).toEqual([]);
  });
});

describe('cityFocusFrame', () => {
  it('apunta a la posición de mundo de la ciudad con distancia y elevación fijas', () => {
    // c3 (80,80) → mundo (30,30).
    const frame = cityFocusFrame(MAP, 'c3');
    expect(frame).toEqual({
      wx: 30,
      wz: 30,
      distance: CITY_FOCUS.distance,
      elevation: CITY_FOCUS.elevation,
    });
  });

  it('respeta opts.size en la proyección', () => {
    const frame = cityFocusFrame(MAP, 'c3', { size: 200 });
    expect(frame.wx).toBe(60);
    expect(frame.wz).toBe(60);
  });

  it('devuelve null para ciudades desconocidas o mapa nulo', () => {
    expect(cityFocusFrame(MAP, 'no-existe')).toBeNull();
    expect(cityFocusFrame(null, 'c1')).toBeNull();
  });
});

describe('areaFocusFrame', () => {
  it('apunta al centroide de la comarca con distancia proporcional a su radio', () => {
    // a1: centroide (0,0), radio 10 + AREA_PAD = 18 → distancia 18 * factor.
    const frame = areaFocusFrame(MAP, 'a1');
    expect(frame.wx).toBe(0);
    expect(frame.wz).toBe(0);
    expect(frame.distance).toBeCloseTo((10 + AREA_PAD) * AREA_FOCUS.factor, 5);
    expect(frame.elevation).toBe(AREA_FOCUS.elevation);
  });

  it('aplica la distancia mínima en comarcas pequeñas (una sola ciudad)', () => {
    // a2: radio AREA_PAD (8) → 8 * 2.4 = 19.2 < minDistance.
    const frame = areaFocusFrame(MAP, 'a2');
    expect(frame.distance).toBe(AREA_FOCUS.minDistance);
  });

  it('devuelve null para comarcas sin ciudades o inexistentes', () => {
    expect(areaFocusFrame(MAP, 'vacia')).toBeNull();
    expect(areaFocusFrame(MAP, 'no-existe')).toBeNull();
    expect(areaFocusFrame(null, 'a1')).toBeNull();
  });
});

describe('islandRadius', () => {
  it('envuelve ciudades y puerto desde el origen más el margen de playa', () => {
    // El punto más lejano del origen es el puerto (50,95) → (0,45): 45 unidades.
    expect(islandRadius(MAP)).toBe(45 + BEACH_MARGIN);
  });

  it('sin puerto usa la ciudad más lejana', () => {
    const map = { ...MAP, startPort: undefined };
    // c3 (80,80) → (30,30): hipotenusa ~42.43.
    expect(islandRadius(map)).toBeCloseTo(Math.hypot(30, 30) + BEACH_MARGIN, 5);
  });

  it('nunca es menor que MIN_ISLAND_RADIUS (mapa vacío)', () => {
    expect(islandRadius({ areas: [], cities: [] })).toBe(MIN_ISLAND_RADIUS);
    expect(islandRadius(null)).toBe(MIN_ISLAND_RADIUS);
  });
});
