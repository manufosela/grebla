import { describe, it, expect } from 'vitest';
import {
  PLANO_VIEW,
  PLANO_MARGIN,
  ISLAND_R_MIN,
  ISLAND_R_MAX,
  islandCircles,
  themeSpots,
  routePolyline,
  prefixIslandIndex,
  islandZoom,
} from './planoLayout.js';

/** Índice de archipiélago mínimo de pruebas (posiciones 0..100 del mar). */
const ISLANDS = [
  { id: 'island', name: 'Bases de software', discipline: 'bases', x: 50, y: 76, citiesTotal: 25 },
  { id: 'frontend', name: 'Isla Frontend', discipline: 'frontend', x: 28, y: 54, citiesTotal: 24 },
  { id: 'devops', name: 'Isla DevOps', discipline: 'devops', x: 88, y: 48, citiesTotal: 24 },
  { id: 'ios', name: 'Isla iOS', discipline: 'ios', x: 70, y: 16, citiesTotal: 22 },
];

const dist = (a, b) => Math.hypot(a.cx - b.cx, a.cy - b.cy);

describe('islandCircles', () => {
  it('devuelve un círculo por isla, en el orden de entrada y con su nombre', () => {
    const circles = islandCircles(ISLANDS);
    expect(circles.map((c) => c.id)).toEqual(['island', 'frontend', 'devops', 'ios']);
    expect(circles[0].name).toBe('Bases de software');
  });

  it('normaliza las posiciones dentro del viewBox con margen (ningún círculo se sale)', () => {
    const circles = islandCircles(ISLANDS);
    for (const c of circles) {
      expect(c.cx - c.r).toBeGreaterThanOrEqual(0);
      expect(c.cy - c.r).toBeGreaterThanOrEqual(0);
      expect(c.cx + c.r).toBeLessThanOrEqual(PLANO_VIEW);
      expect(c.cy + c.r).toBeLessThanOrEqual(PLANO_VIEW);
    }
  });

  it('acota el radio: islas enormes al máximo y vacías al mínimo', () => {
    const circles = islandCircles([
      { id: 'a', name: 'A', x: 10, y: 10, citiesTotal: 9999 },
      { id: 'b', name: 'B', x: 90, y: 90, citiesTotal: 0 },
    ]);
    expect(circles[0].r).toBe(ISLAND_R_MAX);
    expect(circles[1].r).toBe(ISLAND_R_MIN);
  });

  it('el radio crece con sqrt(citiesTotal) dentro de las cotas', () => {
    const [small, big] = islandCircles([
      { id: 'a', name: 'A', x: 10, y: 10, citiesTotal: 12 },
      { id: 'b', name: 'B', x: 90, y: 90, citiesTotal: 24 },
    ]);
    expect(big.r).toBeGreaterThan(small.r);
    expect(big.r / small.r).toBeCloseTo(Math.sqrt(2), 1);
  });

  it('separa islas solapadas (incluida la coincidencia exacta) sin aleatoriedad', () => {
    const overlapping = [
      { id: 'a', name: 'A', x: 50, y: 50, citiesTotal: 25 },
      { id: 'b', name: 'B', x: 50, y: 50, citiesTotal: 25 },
      { id: 'c', name: 'C', x: 52, y: 50, citiesTotal: 25 },
    ];
    const circles = islandCircles(overlapping);
    for (let i = 0; i < circles.length; i += 1) {
      for (let j = i + 1; j < circles.length; j += 1) {
        expect(dist(circles[i], circles[j])).toBeGreaterThanOrEqual(
          circles[i].r + circles[j].r - 0.01,
        );
      }
    }
    // Determinista: dos llamadas con la misma entrada dan el mismo layout.
    expect(islandCircles(overlapping)).toEqual(circles);
  });

  it('una sola isla queda centrada (rango de posiciones cero)', () => {
    const [only] = islandCircles([{ id: 'a', name: 'A', x: 33, y: 77, citiesTotal: 10 }]);
    expect(only.cx).toBeCloseTo(PLANO_VIEW / 2);
    expect(only.cy).toBeCloseTo(PLANO_VIEW / 2);
  });

  it('sin islas devuelve lista vacía', () => {
    expect(islandCircles([])).toEqual([]);
    expect(islandCircles(null)).toEqual([]);
  });
});

describe('themeSpots', () => {
  const CIRCLE = { id: 'island', name: 'Bases', cx: 50, cy: 50, r: 10 };

  it('proyecta las x,y lógicas (0..100) al interior del círculo', () => {
    const spots = themeSpots(CIRCLE, [
      { id: 'bases/centro', x: 50, y: 50 },
      { id: 'bases/este', x: 100, y: 50 },
    ]);
    expect(spots[0].x).toBeCloseTo(50);
    expect(spots[0].y).toBeCloseTo(50);
    expect(spots[1].x).toBeGreaterThan(50);
    expect(spots[1].y).toBeCloseTo(50);
  });

  it('ningún tema se sale de su círculo (clamp radial de las esquinas)', () => {
    const corners = [
      { id: 'bases/no', x: 0, y: 0 },
      { id: 'bases/ne', x: 100, y: 0 },
      { id: 'bases/so', x: 0, y: 100 },
      { id: 'bases/se', x: 100, y: 100 },
    ];
    for (const spot of themeSpots(CIRCLE, corners)) {
      expect(Math.hypot(spot.x - CIRCLE.cx, spot.y - CIRCLE.cy)).toBeLessThanOrEqual(CIRCLE.r);
    }
  });

  it('conserva los ids con "/" y el orden de entrada', () => {
    const spots = themeSpots(CIRCLE, [
      { id: 'bases/git', x: 20, y: 20 },
      { id: 'bases/leer-codigo', x: 80, y: 80 },
    ]);
    expect(spots.map((s) => s.id)).toEqual(['bases/git', 'bases/leer-codigo']);
  });

  it('sin ciudades devuelve lista vacía', () => {
    expect(themeSpots(CIRCLE, [])).toEqual([]);
    expect(themeSpots(CIRCLE, null)).toEqual([]);
  });
});

describe('prefixIslandIndex', () => {
  it('indexa por id de isla Y por disciplina (bases → island)', () => {
    const index = prefixIslandIndex(ISLANDS);
    expect(index.get('bases')).toBe('island');
    expect(index.get('island')).toBe('island');
    expect(index.get('frontend')).toBe('frontend');
  });

  it('sin islas devuelve un índice vacío', () => {
    expect(prefixIslandIndex(null).size).toBe(0);
  });
});

describe('routePolyline', () => {
  const circles = islandCircles(ISLANDS);
  const circlesById = new Map(circles.map((c) => [c.id, c]));
  const spotsById = new Map([
    ['bases/git', { id: 'bases/git', x: 48, y: 80 }],
    ['frontend/react', { id: 'frontend/react', x: 30, y: 50 }],
  ]);
  const islandIdByPrefix = prefixIslandIndex(ISLANDS);

  it('une los temas resueltos en el orden de las paradas', () => {
    const { points, missing } = routePolyline(
      ['bases/git', 'frontend/react'],
      spotsById,
      circlesById,
      { islandIdByPrefix },
    );
    expect(missing).toEqual([]);
    expect(points).toEqual([
      { cityId: 'bases/git', x: 48, y: 80, resolved: true },
      { cityId: 'frontend/react', x: 30, y: 50, resolved: true },
    ]);
  });

  it('sin el mapa cargado cae al CENTRO del círculo de la isla (vía disciplina)', () => {
    const { points } = routePolyline(['bases/pendiente'], spotsById, circlesById, {
      islandIdByPrefix,
    });
    const bases = circlesById.get('island');
    expect(points).toEqual([
      { cityId: 'bases/pendiente', x: bases.cx, y: bases.cy, resolved: false },
    ]);
  });

  it('una parada de isla desconocida va a missing (nada de inventar posiciones)', () => {
    const { points, missing } = routePolyline(['fantasma/casa'], spotsById, circlesById, {
      islandIdByPrefix,
    });
    expect(points).toEqual([]);
    expect(missing).toEqual(['fantasma/casa']);
  });

  it('sin índice de prefijos, el prefijo se usa como id de isla directamente', () => {
    const { points } = routePolyline(['devops/docker'], new Map(), circlesById);
    const devops = circlesById.get('devops');
    expect(points[0]).toEqual({ cityId: 'devops/docker', x: devops.cx, y: devops.cy, resolved: false });
  });

  it('sin paradas devuelve vacío', () => {
    expect(routePolyline(null, spotsById, circlesById)).toEqual({ points: [], missing: [] });
  });
});

describe('islandZoom', () => {
  it('la escala encuadra el círculo (más padding) en el viewBox', () => {
    const zoom = islandZoom({ id: 'a', cx: 30, cy: 40, r: 10 });
    expect(zoom.scale).toBeCloseTo(PLANO_VIEW / (2 * (10 + PLANO_MARGIN)));
    expect(zoom.scale).toBeGreaterThan(1);
  });

  it('nunca reduce por debajo de 1 (islas gigantes no encogen el plano)', () => {
    const zoom = islandZoom({ id: 'a', cx: 50, cy: 50, r: 500 });
    expect(zoom.scale).toBe(1);
  });
});
