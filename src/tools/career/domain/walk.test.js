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
  yawToward,
  nearestCityWithin,
  collideWithCities,
  CITY_ENTER_ALIGNMENT,
  hashUnit,
  scatterPositions,
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

describe('yawToward', () => {
  it('gira hacia el objetivo por el arco más corto', () => {
    // De 0 a +1 rad: gira en positivo; de 0 a -1 rad: en negativo.
    expect(yawToward(0, 1, 0.1, 2)).toBeCloseTo(0.2);
    expect(yawToward(0, -1, 0.1, 2)).toBeCloseTo(-0.2);
    // Cruzando ±π: de 3 rad a -3 rad el arco corto pasa por π (sube), no por 0.
    const next = yawToward(3, -3, 0.05, 2);
    expect(next).toBeCloseTo(3.1);
  });

  it('no se pasa del objetivo: si el paso llega, se clava en él', () => {
    expect(yawToward(0.5, 0.6, 1, 2)).toBeCloseTo(0.6);
    expect(yawToward(0.5, 0.5, 0.016, 2)).toBeCloseTo(0.5);
  });

  it('el resultado queda normalizado a (-π, π]', () => {
    // Girando desde cerca de π hacia un objetivo pasado π reaparece por -π.
    const yaw = yawToward(Math.PI - 0.05, -(Math.PI - 0.05), 0.1, 2);
    expect(yaw).toBeGreaterThan(-Math.PI);
    expect(yaw).toBeLessThanOrEqual(Math.PI);
    // Muchos pasos convergen exactamente al objetivo normalizado.
    let y = -2.5;
    for (let i = 0; i < 200; i += 1) y = yawToward(y, 2.5, 0.016, 3);
    expect(y).toBeCloseTo(2.5);
  });

  it('falla en alto con una velocidad inválida', () => {
    expect(() => yawToward(0, 1, 0.016, 0)).toThrow();
    expect(() => yawToward(0, 1, 0.016, Number.NaN)).toThrow();
  });
});

describe('hashUnit', () => {
  it('es determinista y queda en [0, 1)', () => {
    for (let i = 0; i < 100; i += 1) {
      const v = hashUnit(1234, i);
      expect(v).toBe(hashUnit(1234, i)); // sin RNG
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('semillas o índices distintos producen valores distintos (no constante)', () => {
    const values = new Set([...Array(50).keys()].map((i) => hashUnit(7, i)));
    expect(values.size).toBeGreaterThan(45);
    expect(hashUnit(1, 3)).not.toBe(hashUnit(2, 3));
  });
});

describe('scatterPositions', () => {
  const SEED = 305419896; // entero arbitrario fijo (determinista en el test)

  it('es determinista: misma semilla → mismo scatter, otra semilla → otro', () => {
    const a = scatterPositions(30, 40, [], SEED);
    const b = scatterPositions(30, 40, [], SEED);
    expect(a).toEqual(b);
    const c = scatterPositions(30, 40, [], SEED + 1);
    expect(c).not.toEqual(a);
  });

  it('devuelve count posiciones dentro del radio cuando no hay exclusiones', () => {
    const pts = scatterPositions(40, 35, [], SEED);
    expect(pts).toHaveLength(40);
    for (const p of pts) {
      expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(35 + 1e-9);
    }
  });

  it('ninguna posición cae dentro de una exclusión (casas, puerto, senda)', () => {
    const exclusions = [
      { x: 0, z: 0, r: 12 },
      { x: 20, z: 10, r: 6 },
      { x: -15, z: -18, r: 8 },
    ];
    const pts = scatterPositions(50, 40, exclusions, SEED);
    expect(pts.length).toBeGreaterThan(0);
    for (const p of pts) {
      for (const ex of exclusions) {
        expect(Math.hypot(p.x - ex.x, p.z - ex.z)).toBeGreaterThanOrEqual(ex.r);
      }
    }
  });

  it('si las exclusiones se comen la isla devuelve menos posiciones, sin error', () => {
    const pts = scatterPositions(20, 30, [{ x: 0, z: 0, r: 100 }], SEED);
    expect(pts).toEqual([]);
  });

  it('reparte de verdad: sin puntos duplicados y usando el disco entero', () => {
    const pts = scatterPositions(40, 40, [], SEED);
    const keys = new Set(pts.map((p) => `${p.x.toFixed(6)},${p.z.toFixed(6)}`));
    expect(keys.size).toBe(pts.length);
    const radii = pts.map((p) => Math.hypot(p.x, p.z));
    expect(Math.min(...radii)).toBeLessThan(15); // hay puntos interiores
    expect(Math.max(...radii)).toBeGreaterThan(30); // y puntos periféricos
  });

  it('count 0 devuelve vacío y valida sus entradas', () => {
    expect(scatterPositions(0, 40, [], SEED)).toEqual([]);
    expect(() => scatterPositions(-1, 40, [], SEED)).toThrow();
    expect(() => scatterPositions(2.5, 40, [], SEED)).toThrow();
    expect(() => scatterPositions(10, 0, [], SEED)).toThrow();
    expect(() => scatterPositions(10, 40, [], Number.NaN)).toThrow();
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

describe('collideWithCities', () => {
  /** Casa única en el origen; radio de colisión de pruebas. */
  const HOUSES = [{ id: 'html', wx: 0, wz: 0 }];
  const RADIUS = 2.5;

  it('sin casas cerca, el paso pasa intacto y sin hit', () => {
    const out = collideWithCities({ x: 10, z: 10 }, { x: 9, z: 9 }, HOUSES, RADIUS);
    expect(out).toEqual({ x: 9, z: 9, hitCityId: null });
    const empty = collideWithCities({ x: 0, z: -3 }, { x: 0, z: -1 }, [], RADIUS);
    expect(empty).toEqual({ x: 0, z: -1, hitCityId: null });
  });

  it('empuje frontal: detiene en el borde (la puerta) y devuelve hitCityId', () => {
    // Avanza en línea recta hacia el centro de la casa desde -z.
    const out = collideWithCities({ x: 0, z: -5 }, { x: 0, z: -2 }, HOUSES, RADIUS);
    expect(out.x).toBeCloseTo(0);
    expect(out.z).toBeCloseTo(-RADIUS); // proyectado al borde, no dentro
    expect(out.hitCityId).toBe('html');
  });

  it('roce tangencial: desliza por el borde SIN hit (no se entra sin querer)', () => {
    // Camina paralelo a la pared invadiendo un poco el círculo: la posición se
    // proyecta al borde (conservando el avance tangencial) pero el empuje es
    // casi paralelo a la pared → no se «entra».
    const out = collideWithCities({ x: -3, z: -2.3 }, { x: -0.5, z: -2.3 }, HOUSES, RADIUS);
    expect(Math.hypot(out.x, out.z)).toBeCloseTo(RADIUS); // sobre el borde
    expect(out.x).toBeGreaterThan(-0.7); // la componente tangencial avanza de verdad
    expect(out.z).toBeLessThan(0); // sigue en el lado por el que caminaba
    expect(out.hitCityId).toBeNull();
  });

  it('el deslizamiento nunca deja la posición dentro del círculo', () => {
    // Barrido determinista de aproximaciones oblicuas.
    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * 2 * Math.PI;
      const pos = { x: Math.cos(angle) * 4, z: Math.sin(angle) * 4 };
      const next = { x: pos.x * 0.3, z: pos.z * 0.3 + 0.4 };
      const out = collideWithCities(pos, next, HOUSES, RADIUS);
      expect(Math.hypot(out.x, out.z)).toBeGreaterThanOrEqual(RADIUS - 1e-9);
    }
  });

  it('retroceder desde la puerta se aleja sin colisión (salir de la casa)', () => {
    // Parado en el borde (la puerta), un paso hacia atrás sale limpio.
    const out = collideWithCities({ x: 0, z: -RADIUS }, { x: 0, z: -RADIUS - 3 }, HOUSES, RADIUS);
    expect(out).toEqual({ x: 0, z: -RADIUS - 3, hitCityId: null });
  });

  it('umbral de frontalidad: un contacto a ~55° de la normal corrige sin hit', () => {
    expect(CITY_ENTER_ALIGNMENT).toBeGreaterThan(0.5);
    expect(CITY_ENTER_ALIGNMENT).toBeLessThan(1);
    // Avance +x que toca la pared en un punto oblicuo (normal a ~55° del
    // movimiento, coseno ≈ 0.57 < 0.75): desliza sin «entrar».
    const out = collideWithCities({ x: -4, z: -2 }, { x: -1.4, z: -2 }, HOUSES, RADIUS);
    expect(out.hitCityId).toBeNull();
    expect(Math.hypot(out.x, out.z)).toBeCloseTo(RADIUS);
  });

  it('empuje oblicuo pero contra la pared sí es hit (frontal respecto a la cara)', () => {
    // Avance +x que acaba clavado en la cara oeste de la casa: la normal del
    // contacto es casi opuesta al movimiento → se entra.
    const out = collideWithCities({ x: -4, z: -0.5 }, { x: -2, z: -0.5 }, HOUSES, RADIUS);
    expect(out.hitCityId).toBe('html');
    expect(Math.hypot(out.x, out.z)).toBeCloseTo(RADIUS);
  });

  it('caso degenerado: sobre el eje de la casa se expulsa al borde, determinista', () => {
    // nextPos exactamente en el centro: se expulsa hacia la posición previa, y
    // atravesar el centro es el empuje más frontal posible → hit.
    const back = collideWithCities({ x: 0, z: -4 }, { x: 0, z: 0 }, HOUSES, RADIUS);
    expect(back.x).toBeCloseTo(0);
    expect(back.z).toBeCloseTo(-RADIUS);
    expect(back.hitCityId).toBe('html');
    // pos y nextPos ambos en el centro: expulsión estable hacia +x.
    const stuck = collideWithCities({ x: 0, z: 0 }, { x: 0, z: 0 }, HOUSES, RADIUS);
    expect(stuck.x).toBeCloseTo(RADIUS);
    expect(stuck.z).toBeCloseTo(0);
    expect(stuck.hitCityId).toBeNull(); // sin movimiento no hay empuje
  });

  it('con varias casas corrige contra la que se invade', () => {
    const houses = [
      { id: 'html', wx: 0, wz: 0 },
      { id: 'css', wx: 20, wz: 0 },
    ];
    const out = collideWithCities({ x: 20, z: -5 }, { x: 20, z: -1 }, houses, RADIUS);
    expect(out.hitCityId).toBe('css');
    expect(out.x).toBeCloseTo(20);
    expect(out.z).toBeCloseTo(-RADIUS);
  });

  it('falla en alto con un radio inválido', () => {
    expect(() => collideWithCities({ x: 0, z: 0 }, { x: 1, z: 0 }, HOUSES, 0)).toThrow();
    expect(() => collideWithCities({ x: 0, z: 0 }, { x: 1, z: 0 }, HOUSES, Number.NaN)).toThrow();
  });
});
