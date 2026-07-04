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
  hashId,
  cityVariant,
  facadeYawToward,
  journeyPathPoints,
  ribbonStrip,
  CITY_FOCUS,
  AREA_FOCUS,
  cityFocusFrame,
  areaFocusFrame,
  TEAMMATE_ARC,
  TEAMMATE_HUE,
  teammateOffsets,
  teammateTint,
  WIZARD_SPOT,
  wizardSpot,
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

describe('hashId / cityVariant', () => {
  it('hashId es determinista y distingue ids distintos', () => {
    expect(hashId('react')).toBe(hashId('react'));
    expect(hashId('react')).not.toBe(hashId('vue'));
    expect(hashId('a')).not.toBe(hashId('b'));
    expect(Number.isInteger(hashId('react'))).toBe(true);
    expect(hashId('react')).toBeGreaterThanOrEqual(0);
  });

  it('hashId falla en alto con un id inválido', () => {
    expect(() => hashId('')).toThrow(/inválido/i);
    expect(() => hashId(undefined)).toThrow(/inválido/i);
  });

  it('cityVariant es determinista por id (misma ciudad → misma casa)', () => {
    expect(cityVariant('node')).toEqual(cityVariant('node'));
  });

  it('cityVariant produce valores acotados a los rangos documentados', () => {
    for (const id of ['html', 'css', 'js', 'node', 'react', 'docker', 'k8s', 'sql']) {
      const v = cityVariant(id);
      expect(v.height).toBeGreaterThanOrEqual(0.9);
      expect(v.height).toBeLessThanOrEqual(1.2);
      expect(v.rotation).toBeGreaterThanOrEqual(-0.3);
      expect(v.rotation).toBeLessThanOrEqual(0.3);
      expect(v.tone).toBeGreaterThanOrEqual(0.92);
      expect(v.tone).toBeLessThanOrEqual(1.08);
    }
  });

  it('el tono está cuantizado en 5 pasos (caché de materiales pequeña)', () => {
    const tones = new Set(
      ['html', 'css', 'js', 'node', 'react', 'docker', 'k8s', 'sql', 'aws', 'git'].map(
        (id) => cityVariant(id).tone,
      ),
    );
    expect(tones.size).toBeLessThanOrEqual(5);
  });

  it('ciudades distintas varían de verdad (no todas la misma casa)', () => {
    const ids = ['html', 'css', 'js', 'node', 'react', 'docker'];
    expect(new Set(ids.map((id) => cityVariant(id).height)).size).toBeGreaterThan(1);
    expect(new Set(ids.map((id) => cityVariant(id).rotation)).size).toBeGreaterThan(1);
  });
});

describe('journeyPathPoints', () => {
  it('proyecta las ciudades EN ORDEN al mundo', () => {
    expect(journeyPathPoints(MAP, ['c1', 'c3', 'c2'])).toEqual([
      { wx: -10, wz: 0 },
      { wx: 30, wz: 30 },
      { wx: 10, wz: 0 },
    ]);
  });

  it('omite ids que ya no existen en el mapa (journeys antiguos)', () => {
    expect(journeyPathPoints(MAP, ['c1', 'retirada', 'c2'])).toEqual([
      { wx: -10, wz: 0 },
      { wx: 10, wz: 0 },
    ]);
  });

  it('tolera listas vacías y mapa nulo', () => {
    expect(journeyPathPoints(MAP, [])).toEqual([]);
    expect(journeyPathPoints(MAP, undefined)).toEqual([]);
    expect(journeyPathPoints(null, ['c1'])).toEqual([]);
  });
});

describe('ribbonStrip', () => {
  it('en un tramo recto desplaza media anchura en la perpendicular', () => {
    const pts = [
      { wx: 0, wz: 0 },
      { wx: 10, wz: 0 },
      { wx: 20, wz: 0 },
    ];
    const strip = ribbonStrip(pts, 2);
    // Dirección (1,0) → perpendicular (0,1): izquierda a z+1, derecha a z-1.
    expect(strip).toHaveLength(3);
    for (const [i, p] of pts.entries()) {
      expect(strip[i].lx).toBeCloseTo(p.wx);
      expect(strip[i].lz).toBeCloseTo(p.wz + 1);
      expect(strip[i].rx).toBeCloseTo(p.wx);
      expect(strip[i].rz).toBeCloseTo(p.wz - 1);
    }
  });

  it('en las esquinas usa la media de los segmentos adyacentes (no se pellizca)', () => {
    // Codo a 90°: en el vértice la dirección media es la diagonal.
    const strip = ribbonStrip(
      [
        { wx: 0, wz: 0 },
        { wx: 10, wz: 0 },
        { wx: 10, wz: 10 },
      ],
      2,
    );
    const corner = strip[1];
    const diag = Math.SQRT1_2; // dirección media (1,1)/√2
    expect(corner.lx).toBeCloseTo(10 - diag);
    expect(corner.lz).toBeCloseTo(0 + diag);
    expect(corner.rx).toBeCloseTo(10 + diag);
    expect(corner.rz).toBeCloseTo(0 - diag);
  });

  it('con menos de 2 puntos no hay cinta', () => {
    expect(ribbonStrip([], 2)).toEqual([]);
    expect(ribbonStrip([{ wx: 0, wz: 0 }], 2)).toEqual([]);
  });

  it('puntos coincidentes no rompen la cinta (dirección estable)', () => {
    const strip = ribbonStrip(
      [
        { wx: 5, wz: 5 },
        { wx: 5, wz: 5 },
      ],
      2,
    );
    expect(strip).toHaveLength(2);
    for (const p of strip) {
      expect(Number.isFinite(p.lx)).toBe(true);
      expect(Number.isFinite(p.rz)).toBe(true);
    }
  });

  it('falla en alto con una anchura inválida', () => {
    expect(() => ribbonStrip([{ wx: 0, wz: 0 }, { wx: 1, wz: 0 }], 0)).toThrow();
    expect(() => ribbonStrip([{ wx: 0, wz: 0 }, { wx: 1, wz: 0 }], Number.NaN)).toThrow();
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

describe('facadeYawToward', () => {
  /**
   * Dirección de mundo a la que apunta la fachada (+z local) con un yaw dado:
   * (sin(yaw), cos(yaw)) — la convención de rotation.y de <career-island-3d>.
   * @param {number} yaw
   */
  const facadeDir = (yaw) => ({ x: Math.sin(yaw), z: Math.cos(yaw) });

  it('la fachada apunta exactamente hacia el puerto', () => {
    const house = { wx: 10, wz: -5 };
    const port = { wx: -20, wz: 25 };
    const yaw = facadeYawToward(house, port);
    const dir = facadeDir(yaw);
    const toPort = { x: port.wx - house.wx, z: port.wz - house.wz };
    const len = Math.hypot(toPort.x, toPort.z);
    expect(dir.x).toBeCloseTo(toPort.x / len);
    expect(dir.z).toBeCloseTo(toPort.z / len);
  });

  it('casos cardinales: puerto al este → π/2, al norte (+z) → 0, al oeste → -π/2, al sur → π', () => {
    const house = { wx: 0, wz: 0 };
    expect(facadeYawToward(house, { wx: 10, wz: 0 })).toBeCloseTo(Math.PI / 2);
    expect(facadeYawToward(house, { wx: 0, wz: 10 })).toBeCloseTo(0);
    expect(facadeYawToward(house, { wx: -10, wz: 0 })).toBeCloseTo(-Math.PI / 2);
    expect(Math.abs(facadeYawToward(house, { wx: 0, wz: -10 }))).toBeCloseTo(Math.PI);
  });

  it('es determinista y simétrico respecto a trasladar ambos puntos', () => {
    const a = facadeYawToward({ wx: 3, wz: 4 }, { wx: -7, wz: 9 });
    expect(facadeYawToward({ wx: 3, wz: 4 }, { wx: -7, wz: 9 })).toBe(a);
    expect(facadeYawToward({ wx: 13, wz: 14 }, { wx: 3, wz: 19 })).toBeCloseTo(a);
  });

  it('casa sobre el puerto: sin dirección definida devuelve 0 (determinista)', () => {
    expect(facadeYawToward({ wx: 5, wz: 5 }, { wx: 5, wz: 5 })).toBe(0);
  });

  it('falla en alto con posiciones inválidas (sin fallbacks silenciosos)', () => {
    expect(() => facadeYawToward({ wx: 0, wz: 0 }, undefined)).toThrow();
    expect(() => facadeYawToward(undefined, { wx: 0, wz: 0 })).toThrow();
    expect(() => facadeYawToward({ wx: Number.NaN, wz: 0 }, { wx: 1, wz: 1 })).toThrow();
  });
});

describe('teammateOffsets (MC-12)', () => {
  it('0 compañeros → sin offsets; 1 → centrado frente a la puerta', () => {
    expect(teammateOffsets(0)).toEqual([]);
    const [only] = teammateOffsets(1);
    expect(only.lx).toBeCloseTo(0);
    expect(only.lz).toBeCloseTo(TEAMMATE_ARC.radius);
    expect(only.yaw).toBe(0);
  });

  it('n compañeros: todos a radio constante, dentro del arco y sin solaparse', () => {
    for (const n of [2, 3, 5, 8]) {
      const offsets = teammateOffsets(n);
      expect(offsets).toHaveLength(n);
      for (const o of offsets) {
        expect(Math.hypot(o.lx, o.lz)).toBeCloseTo(TEAMMATE_ARC.radius);
        expect(Math.abs(o.yaw)).toBeLessThanOrEqual(TEAMMATE_ARC.span / 2 + 1e-9);
      }
      // Ángulos estrictamente crecientes: posiciones distintas, sin solape.
      for (let i = 1; i < n; i += 1) {
        expect(offsets[i].yaw).toBeGreaterThan(offsets[i - 1].yaw);
      }
    }
  });

  it('el arco es simétrico respecto al eje de la fachada', () => {
    const offsets = teammateOffsets(3);
    expect(offsets[0].yaw).toBeCloseTo(-offsets[2].yaw);
    expect(offsets[1].yaw).toBeCloseTo(0);
    expect(offsets[0].lx).toBeCloseTo(-offsets[2].lx);
    expect(offsets[0].lz).toBeCloseTo(offsets[2].lz);
  });

  it('es determinista y acepta radio/arco propios', () => {
    expect(teammateOffsets(4)).toEqual(teammateOffsets(4));
    const custom = teammateOffsets(2, { radius: 10, span: Math.PI });
    expect(Math.hypot(custom[0].lx, custom[0].lz)).toBeCloseTo(10);
    expect(custom[0].yaw).toBeCloseTo(-Math.PI / 2);
    expect(custom[1].yaw).toBeCloseTo(Math.PI / 2);
  });

  it('falla en alto con parámetros inválidos (sin fallbacks silenciosos)', () => {
    expect(() => teammateOffsets(-1)).toThrow();
    expect(() => teammateOffsets(1.5)).toThrow();
    expect(() => teammateOffsets(2, { radius: 0 })).toThrow();
    expect(() => teammateOffsets(2, { span: 0 })).toThrow();
    expect(() => teammateOffsets(2, { span: Math.PI * 3 })).toThrow();
  });
});

describe('teammateTint (MC-12)', () => {
  /** Tono HSL (grados 0..360) de un color hex numérico 0xRRGGBB. */
  const hueOf = (hex) => {
    const r = ((hex >> 16) & 0xff) / 255;
    const g = ((hex >> 8) & 0xff) / 255;
    const b = (hex & 0xff) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max === min) return 0;
    const d = max - min;
    let h;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  };

  it('es determinista: mismo personId → mismos colores', () => {
    expect(teammateTint('p-001')).toEqual(teammateTint('p-001'));
  });

  it('personas distintas suelen vestir distinto', () => {
    const a = teammateTint('persona-a');
    const b = teammateTint('persona-b');
    expect(a.body === b.body && a.cap === b.cap).toBe(false);
  });

  it('camiseta y gorra caen SIEMPRE fuera de la franja coral del avatar propio', () => {
    // La gorra coral (#e26d5e, tono ~8°) es exclusiva del avatar propio: los
    // tonos de compañero viven en [TEAMMATE_HUE.min, TEAMMATE_HUE.max).
    for (let i = 0; i < 200; i += 1) {
      const tint = teammateTint(`persona-${i}`);
      for (const color of [tint.body, tint.cap]) {
        expect(color).not.toBe(0xe26d5e);
        const hue = hueOf(color);
        expect(hue).toBeGreaterThanOrEqual(TEAMMATE_HUE.min - 1);
        expect(hue).toBeLessThanOrEqual(TEAMMATE_HUE.max + 1);
      }
    }
  });

  it('devuelve colores hex de 24 bits', () => {
    const tint = teammateTint('p-hex');
    for (const color of [tint.body, tint.cap]) {
      expect(Number.isInteger(color)).toBe(true);
      expect(color).toBeGreaterThanOrEqual(0);
      expect(color).toBeLessThanOrEqual(0xffffff);
    }
  });

  it('falla en alto con un personId inválido', () => {
    expect(() => teammateTint('')).toThrow();
    expect(() => teammateTint(undefined)).toThrow();
  });
});

describe('wizardSpot (MC-22)', () => {
  it('es determinista y respeta la holgura con todas las casas', () => {
    const a = wizardSpot(MAP);
    const b = wizardSpot(MAP);
    expect(a).toEqual(b);
    for (const city of MAP.cities) {
      const { wx, wz } = worldFromMap(city.x, city.y);
      expect(Math.hypot(wx - a.wx, wz - a.wz)).toBeGreaterThanOrEqual(WIZARD_SPOT.clearance);
    }
    // Dentro de la isla (nunca en el agua).
    expect(Math.hypot(a.wx, a.wz)).toBeLessThanOrEqual(islandRadius(MAP));
  });

  it('queda cerca del puerto: retranqueada WIZARD_SPOT.inland hacia el interior', () => {
    const spot = wizardSpot(MAP);
    const port = worldFromMap(MAP.startPort.x, MAP.startPort.y);
    const portDist = Math.hypot(port.wx, port.wz);
    // Misma anilla radial que el puerto menos el retranqueo.
    expect(Math.hypot(spot.wx, spot.wz)).toBeCloseTo(portDist - WIZARD_SPOT.inland, 6);
  });

  it('barre candidatos cuando una casa ocupa el sitio preferido', () => {
    const port = worldFromMap(MAP.startPort.x, MAP.startPort.y);
    const portDist = Math.hypot(port.wx, port.wz);
    const angle = Math.atan2(port.wz, port.wx);
    const ring = portDist - WIZARD_SPOT.inland;
    // Una casa plantada exactamente en el candidato 0 fuerza el barrido.
    const scale = WORLD_SIZE / 100;
    const blocker = {
      id: 'blocker',
      name: 'Bloqueadora',
      kind: 'tech',
      area: 'a1',
      x: (Math.cos(angle) * ring) / scale + 50,
      y: (Math.sin(angle) * ring) / scale + 50,
      weight: 1,
      prereqs: [],
    };
    const blocked = { ...MAP, cities: [...MAP.cities, blocker] };
    const spot = wizardSpot(blocked);
    const b = worldFromMap(blocker.x, blocker.y);
    expect(Math.hypot(b.wx - spot.wx, b.wz - spot.wz)).toBeGreaterThanOrEqual(
      WIZARD_SPOT.clearance,
    );
  });

  it('un mapa sin puerto ancla la cabaña al sur y acota con maxRadius', () => {
    const noPort = { ...MAP, startPort: undefined };
    const spot = wizardSpot(noPort);
    expect(spot.wz).toBeGreaterThan(0); // sur = +z
    const capped = wizardSpot(noPort, { maxRadius: 5 });
    expect(Math.hypot(capped.wx, capped.wz)).toBeLessThanOrEqual(5 + 1e-9);
  });
});
