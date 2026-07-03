import { describe, it, expect } from 'vitest';
import {
  WALK_SPEED,
  RUN_MULTIPLIER,
  TURN_SPEED,
  EYE_HEIGHT,
  PROXIMITY_RADIUS,
  WALK_EDGE_MARGIN,
  TERRAIN,
  coastFactor,
  groundHeightAt,
  walkableRadius,
  stepPosition,
  turnYaw,
  nearestCityWithin,
} from './walk.js';

/** Radio de isla de pruebas (del orden del que produce islandRadius). */
const R = 50;
const ISLAND = { radius: R };

describe('constantes de marcha', () => {
  it('son valores sanos (escala humana, correr más rápido que andar)', () => {
    expect(WALK_SPEED).toBeGreaterThan(0);
    expect(RUN_MULTIPLIER).toBeGreaterThan(1);
    expect(EYE_HEIGHT).toBeCloseTo(1.7);
    expect(PROXIMITY_RADIUS).toBeGreaterThan(0);
    expect(WALK_EDGE_MARGIN).toBeGreaterThan(0);
  });
});

describe('coastFactor', () => {
  it('es determinista y está acotado en ±1.6·amount', () => {
    for (let i = 0; i < 64; i += 1) {
      const angle = (i / 64) * Math.PI * 2 - Math.PI;
      const k = coastFactor(angle, 0.05);
      expect(k).toBe(coastFactor(angle, 0.05)); // sin RNG
      expect(k).toBeGreaterThanOrEqual(1 - 1.6 * 0.05);
      expect(k).toBeLessThanOrEqual(1 + 1.6 * 0.05);
    }
  });

  it('con amount 0 la costa es un círculo perfecto', () => {
    expect(coastFactor(1.23, 0)).toBe(1);
  });
});

describe('groundHeightAt', () => {
  const GRASS_TOP = TERRAIN.baseY + TERRAIN.grass.height / 2; // 2.2
  const BEACH_TOP = TERRAIN.baseY + TERRAIN.beach.height / 2; // 2.0

  it('el centro de la isla es la meseta de hierba (y=2.2)', () => {
    expect(groundHeightAt(0, 0, ISLAND)).toBe(GRASS_TOP);
    expect(groundHeightAt(R * 0.5, 0, ISLAND)).toBe(GRASS_TOP);
  });

  it('el llano de arena queda a y=2.0 entre el talud de hierba y el borde de playa', () => {
    // A R+3.5 unidades ya no hay hierba (su falda muere en ~R+3) pero sí playa llana.
    // Ángulos en (-π, π]: el rango de atan2, el mismo que usa la geometría de costa.
    for (let i = 0; i < 16; i += 1) {
      const angle = ((i + 0.5) / 16) * Math.PI * 2 - Math.PI;
      // Escala el radio con el factor de costa para quedar SIEMPRE en la franja llana.
      const r = (R + 3.5) * coastFactor(angle, TERRAIN.beach.amount);
      const h = groundHeightAt(Math.cos(angle) * r, Math.sin(angle) * r, ISLAND);
      expect(h).toBeCloseTo(BEACH_TOP, 5);
    }
  });

  it('más allá de la playa devuelve el nivel del agua', () => {
    expect(groundHeightAt(R + 20, 0, ISLAND)).toBe(TERRAIN.waterY);
  });

  it('a lo largo de un rayo la altura nunca sube al alejarse del centro', () => {
    const angle = 0.7;
    let prev = Infinity;
    for (let r = 0; r <= R + 12; r += 0.25) {
      const h = groundHeightAt(Math.cos(angle) * r, Math.sin(angle) * r, ISLAND);
      const floor = Math.max(h, TERRAIN.waterY); // el agua tapa el fondo de la falda
      expect(floor).toBeLessThanOrEqual(prev + 1e-9);
      prev = floor;
    }
  });

  it('la misma fórmula de costa mueve el borde: donde la costa se expande sigue habiendo hierba', () => {
    // Busca un ángulo donde la costa se expanda (k > 1): justo pasado R sigue siendo meseta.
    const angle = [...Array(64).keys()]
      .map((i) => (i / 64) * Math.PI * 2 - Math.PI) // rango de atan2
      .find((a) => coastFactor(a, TERRAIN.grass.amount) > 1.02);
    expect(angle).toBeDefined();
    const r = R * 1.01; // fuera del círculo perfecto, dentro de la costa expandida
    expect(groundHeightAt(Math.cos(angle) * r, Math.sin(angle) * r, ISLAND)).toBe(GRASS_TOP);
  });

  it('falla en alto con un radio de isla inválido (sin fallbacks silenciosos)', () => {
    expect(() => groundHeightAt(0, 0, { radius: 0 })).toThrow();
    expect(() => groundHeightAt(0, 0, { radius: Number.NaN })).toThrow();
    expect(() => groundHeightAt(0, 0, undefined)).toThrow();
  });
});

describe('walkableRadius', () => {
  it('queda siempre sobre suelo firme (nunca en el talud ni el agua), para cualquier ángulo', () => {
    const walkR = walkableRadius(R);
    const BEACH_TOP = TERRAIN.baseY + TERRAIN.beach.height / 2;
    for (let i = 0; i < 128; i += 1) {
      const angle = (i / 128) * Math.PI * 2 - Math.PI; // rango de atan2
      const h = groundHeightAt(Math.cos(angle) * walkR, Math.sin(angle) * walkR, ISLAND);
      expect(h).toBeGreaterThanOrEqual(BEACH_TOP - 1e-9);
    }
  });

  it('crece con la isla y valida la entrada', () => {
    expect(walkableRadius(80)).toBeGreaterThan(walkableRadius(20));
    expect(() => walkableRadius(0)).toThrow();
    expect(() => walkableRadius(Number.NaN)).toThrow();
  });
});

describe('stepPosition', () => {
  const BOUNDS = { radius: 40 };

  it('avanza velocidad×dt en la dirección normalizada', () => {
    const next = stepPosition({ x: 0, z: 0 }, { x: 3, z: 4 }, 0.5, 10, BOUNDS);
    // |dir|=5 → unitario (0.6, 0.8); 10 u/s × 0.5 s = 5 unidades.
    expect(next.x).toBeCloseTo(3);
    expect(next.z).toBeCloseTo(4);
  });

  it('una dirección diagonal sin normalizar no corre más que una axial', () => {
    const axial = stepPosition({ x: 0, z: 0 }, { x: 1, z: 0 }, 1, 8, BOUNDS);
    const diagonal = stepPosition({ x: 0, z: 0 }, { x: 1, z: 1 }, 1, 8, BOUNDS);
    expect(Math.hypot(axial.x, axial.z)).toBeCloseTo(8);
    expect(Math.hypot(diagonal.x, diagonal.z)).toBeCloseTo(8);
  });

  it('sin dirección o sin tiempo no se mueve', () => {
    expect(stepPosition({ x: 2, z: 3 }, { x: 0, z: 0 }, 0.016, 8, BOUNDS)).toEqual({ x: 2, z: 3 });
    expect(stepPosition({ x: 2, z: 3 }, { x: 1, z: 0 }, 0, 8, BOUNDS)).toEqual({ x: 2, z: 3 });
  });

  it('no puede salir del círculo caminable', () => {
    const next = stepPosition({ x: 39.5, z: 0 }, { x: 1, z: 0 }, 1, 8, BOUNDS);
    expect(Math.hypot(next.x, next.z)).toBeCloseTo(BOUNDS.radius);
  });

  it('en el borde DESLIZA tangencialmente en vez de frenar en seco', () => {
    // En el borde este (40, 0) empujando en diagonal hacia fuera y hacia +z:
    // el radio se mantiene pero la posición gira alrededor de la costa.
    const pos = { x: BOUNDS.radius, z: 0 };
    const next = stepPosition(pos, { x: 1, z: 1 }, 0.5, 8, BOUNDS);
    expect(Math.hypot(next.x, next.z)).toBeCloseTo(BOUNDS.radius);
    expect(next.z).toBeGreaterThan(1); // hubo avance tangencial real
  });

  it('empujando en perpendicular pura al borde no hay avance tangencial', () => {
    const pos = { x: BOUNDS.radius, z: 0 };
    const next = stepPosition(pos, { x: 1, z: 0 }, 0.5, 8, BOUNDS);
    expect(next.x).toBeCloseTo(BOUNDS.radius);
    expect(next.z).toBeCloseTo(0);
  });

  it('falla en alto con un límite inválido', () => {
    expect(() => stepPosition({ x: 0, z: 0 }, { x: 1, z: 0 }, 0.016, 8, { radius: 0 })).toThrow();
    expect(() => stepPosition({ x: 0, z: 0 }, { x: 1, z: 0 }, 0.016, 8, undefined)).toThrow();
  });
});

describe('turnYaw', () => {
  it('gira a velocidad angular constante (+1 izquierda, -1 derecha)', () => {
    expect(turnYaw(0, 1, 0.5, 2)).toBeCloseTo(1);
    expect(turnYaw(0, -1, 0.5, 2)).toBeCloseTo(-1);
    expect(TURN_SPEED).toBeGreaterThan(0);
  });

  it('sin dirección no gira', () => {
    expect(turnYaw(0.8, 0, 0.016, TURN_SPEED)).toBe(0.8);
  });

  it('normaliza el resultado a (-π, π] (no crece sin límite)', () => {
    // Un giro largo hacia la izquierda cruza π y reaparece por -π.
    const yaw = turnYaw(Math.PI - 0.1, 1, 0.2, 1);
    expect(yaw).toBeCloseTo(Math.PI - 0.1 + 0.2 - 2 * Math.PI);
    expect(yaw).toBeGreaterThan(-Math.PI);
    expect(yaw).toBeLessThanOrEqual(Math.PI);
    // Y lo mismo hacia la derecha cruzando -π.
    const back = turnYaw(-Math.PI + 0.1, -1, 0.2, 1);
    expect(back).toBeCloseTo(-Math.PI + 0.1 - 0.2 + 2 * Math.PI);
  });

  it('muchos pasos seguidos siguen acotados', () => {
    let yaw = 0;
    for (let i = 0; i < 1000; i += 1) yaw = turnYaw(yaw, 1, 0.016, TURN_SPEED);
    expect(yaw).toBeGreaterThan(-Math.PI);
    expect(yaw).toBeLessThanOrEqual(Math.PI);
  });

  it('falla en alto con una velocidad inválida', () => {
    expect(() => turnYaw(0, 1, 0.016, 0)).toThrow();
    expect(() => turnYaw(0, 1, 0.016, Number.NaN)).toThrow();
  });
});

describe('nearestCityWithin', () => {
  const CITIES = [
    { id: 'html', wx: 0, wz: 0 },
    { id: 'css', wx: 10, wz: 0 },
    { id: 'node', wx: 0, wz: 30 },
  ];

  it('devuelve la ciudad más cercana dentro del radio', () => {
    expect(nearestCityWithin({ x: 8, z: 0 }, CITIES, 8)?.id).toBe('css');
    expect(nearestCityWithin({ x: 1, z: 1 }, CITIES, 8)?.id).toBe('html');
  });

  it('devuelve null si ninguna ciudad está tan cerca', () => {
    expect(nearestCityWithin({ x: 50, z: 50 }, CITIES, 8)).toBeNull();
    expect(nearestCityWithin({ x: 0, z: 0 }, [], 8)).toBeNull();
  });

  it('el radio máximo es inclusivo', () => {
    expect(nearestCityWithin({ x: 18, z: 0 }, CITIES, 8)?.id).toBe('css');
  });
});
