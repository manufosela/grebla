import { describe, it, expect } from 'vitest';
import {
  VOYAGE_MIN_MS,
  VOYAGE_MAX_MS,
  VOYAGE_REF_DISTANCE,
  VOYAGE_BEND_MIN,
  VOYAGE_BEND_MAX,
  VOYAGE_CLEARANCE,
  VOYAGE_EDGE,
  VOYAGE_LEAN_MAX_DEG,
  VOYAGE_PITCH_MAX_DEG,
  voyageCurve,
  voyagePose,
  voyageAngle,
  voyageDuration,
  voyageBoatOrientation,
} from './voyage.js';

/** Muestrea n+1 poses de la curva (t = 0..1). */
function samplePoses(curve, n = 200) {
  return Array.from({ length: n + 1 }, (_, i) => voyagePose(curve, i / n));
}

/** Curva construida a mano (controles explícitos) para tests de la pose. */
function handCurve(from, c1, c2, to) {
  return { from, c1, c2, to, distance: Math.hypot(to.x - from.x, to.y - from.y) };
}

describe('voyageCurve (trayecto pirata por mar, JG-17)', () => {
  const A = { id: 'js', x: 20, y: 50 };
  const B = { id: 'css', x: 80, y: 50 };

  it('parte del origen y llega al destino exactos', () => {
    const curve = voyageCurve({ id: 'a', x: 50, y: 76 }, { id: 'b', x: 88, y: 48 });
    const zarpa = voyagePose(curve, 0);
    const atraca = voyagePose(curve, 1);
    expect({ x: zarpa.x, y: zarpa.y }).toEqual({ x: 50, y: 76 });
    expect({ x: atraca.x, y: atraca.y }).toEqual({ x: 88, y: 48 });
  });

  it('mide la distancia en línea recta entre los puertos', () => {
    const curve = voyageCurve({ id: 'a', x: 0, y: 0 }, { id: 'b', x: 30, y: 40 });
    expect(curve.distance).toBeCloseTo(50);
  });

  it('es determinista: mismo par de islas, misma ruta', () => {
    expect(voyageCurve(A, B)).toEqual(voyageCurve(A, B));
  });

  it('la semilla es el PAR de ids: otras islas en el mismo sitio, otra comba', () => {
    const other = voyageCurve({ ...A, id: 'react' }, { ...B, id: 'vue' });
    expect(other.c1).not.toEqual(voyageCurve(A, B).c1);
  });

  it('comba perpendicular dentro del rango sorteado y hacia un solo lado', () => {
    const curve = voyageCurve(A, B);
    // Rumbo este: la comba es vertical; ambos controles al MISMO lado.
    const offA = curve.c1.y - 50;
    const offB = curve.c2.y - 50;
    expect(Math.sign(offA)).toBe(Math.sign(offB));
    expect(Math.abs(offA)).toBeGreaterThanOrEqual(curve.distance * VOYAGE_BEND_MIN);
    expect(Math.abs(offA)).toBeLessThanOrEqual(curve.distance * VOYAGE_BEND_MAX);
    expect(curve.c1.x).toBeCloseTo(40);
    expect(curve.c2.x).toBeCloseTo(60);
  });

  it('esquiva una isla plantada en mitad de la recta', () => {
    const from = { id: 'a', x: 10, y: 50 };
    const to = { id: 'b', x: 90, y: 50 };
    const mid = { id: 'roca', x: 50, y: 50 };
    const curve = voyageCurve(from, to, [from, to, mid]);
    const gap = Math.min(...samplePoses(curve).map((p) => Math.hypot(p.x - mid.x, p.y - mid.y)));
    expect(gap).toBeGreaterThanOrEqual(VOYAGE_CLEARANCE);
  });

  it('rodea por el lado CONTRARIO al que asoma el obstáculo', () => {
    const from = { id: 'a', x: 10, y: 50 };
    const to = { id: 'b', x: 90, y: 50 };
    // Isla un pelo por ENCIMA de la recta (izquierda de la marcha): se rodea por abajo.
    const above = voyageCurve(from, to, [{ id: 'roca', x: 50, y: 47 }]);
    expect(voyagePose(above, 0.5).y).toBeGreaterThan(50);
    // Y un pelo por DEBAJO: se rodea por arriba.
    const below = voyageCurve(from, to, [{ id: 'roca', x: 50, y: 53 }]);
    expect(voyagePose(below, 0.5).y).toBeLessThan(50);
  });

  it('entre babor y estribor elige el lado con más agua libre', () => {
    // Escenario real del archipiélago: Bases→Backend Python; esquivar Product
    // Manager por babor (oeste) plantaría el barco encima de Frontend — la
    // puntuación de agua libre debe llevar la comba por estribor (este).
    const from = { id: 'island', x: 50, y: 76 };
    const to = { id: 'backend-python', x: 32, y: 16 };
    const frontend = { id: 'frontend', x: 28, y: 54 };
    const pm = { id: 'product-manager', x: 40, y: 38 };
    const curve = voyageCurve(from, to, [from, to, frontend, pm]);
    expect(voyagePose(curve, 0.5).x).toBeGreaterThan(44); // comba al este de la recta
    const gap = Math.min(
      ...samplePoses(curve).flatMap((p) => [
        Math.hypot(p.x - frontend.x, p.y - frontend.y),
        Math.hypot(p.x - pm.x, p.y - pm.y),
      ]),
    );
    expect(gap).toBeGreaterThanOrEqual(VOYAGE_CLEARANCE * 0.8);
  });

  it('los puertos de origen/destino y las islas sin situar no estorban', () => {
    const sinMapa = { id: 'wip' }; // isla del índice aún sin x/y
    expect(voyageCurve(A, B, [A, B, sinMapa])).toEqual(voyageCurve(A, B));
  });

  it('acota los controles al mar visible (la comba no saca el barco del mapa)', () => {
    const curve = voyageCurve({ id: 'a', x: 5, y: 4 }, { id: 'b', x: 95, y: 4 });
    expect(curve.c1.y).toBeGreaterThanOrEqual(VOYAGE_EDGE);
    expect(curve.c2.y).toBeGreaterThanOrEqual(VOYAGE_EDGE);
  });

  it('rechaza puertos sin id, sin coordenadas finitas o coincidentes', () => {
    expect(() => voyageCurve({ x: 1, y: 1 }, B)).toThrow(/sin id/i);
    expect(() => voyageCurve({ id: 'a', x: NaN, y: 5 }, B)).toThrow(/inválido/i);
    expect(() => voyageCurve(A, undefined)).toThrow(/inválido/i);
    expect(() => voyageCurve(A, { ...A, id: 'b' })).toThrow(/coinciden/i);
  });
});

describe('voyagePose (posición + rumbo + escora con easing)', () => {
  const curve = voyageCurve({ id: 'a', x: 10, y: 60 }, { id: 'b', x: 90, y: 30 });

  it('acota t fuera de [0, 1] a los extremos del trayecto', () => {
    expect(voyagePose(curve, -0.5)).toEqual(voyagePose(curve, 0));
    expect(voyagePose(curve, 1.7)).toEqual(voyagePose(curve, 1));
  });

  it('avanza monótono hacia el destino (sin recular)', () => {
    const poses = samplePoses(curve, 100);
    // Proyección sobre la marcha: con los controles a 1/3 y 2/3 nunca decrece.
    for (let i = 1; i < poses.length; i += 1) {
      expect(poses[i].x).toBeGreaterThanOrEqual(poses[i - 1].x);
    }
  });

  it('zarpa y atraca despacio (easing): los extremos recorren menos que el centro', () => {
    const dist = (t1, t2) => {
      const p1 = voyagePose(curve, t1);
      const p2 = voyagePose(curve, t2);
      return Math.hypot(p2.x - p1.x, p2.y - p1.y);
    };
    expect(dist(0, 0.1)).toBeLessThan(dist(0.45, 0.55));
    expect(dist(0.9, 1)).toBeLessThan(dist(0.45, 0.55));
  });

  it('zarpa proa al primer control y atraca llegando desde el segundo', () => {
    expect(voyagePose(curve, 0).heading).toBeCloseTo(voyageAngle(curve.from, curve.c1));
    expect(voyagePose(curve, 1).heading).toBeCloseTo(voyageAngle(curve.c2, curve.to));
  });

  it('lleva rumbo tangente CONTINUO (sin bandazos entre frames)', () => {
    const headings = samplePoses(curve).map((p) => p.heading);
    for (let i = 1; i < headings.length; i += 1) {
      expect(Math.abs(headings[i] - headings[i - 1])).toBeLessThan(0.15);
    }
  });

  it('escora acotada, nula en recta y de signo opuesto al espejar la comba', () => {
    for (const pose of samplePoses(curve)) {
      expect(Math.abs(pose.lean)).toBeLessThanOrEqual(VOYAGE_LEAN_MAX_DEG);
    }
    const recta = handCurve({ x: 0, y: 50 }, { x: 33, y: 50 }, { x: 66, y: 50 }, { x: 100, y: 50 });
    expect(voyagePose(recta, 0.5).lean).toBe(0);
    const arriba = handCurve({ x: 0, y: 50 }, { x: 33, y: 40 }, { x: 66, y: 40 }, { x: 100, y: 50 });
    const abajo = handCurve({ x: 0, y: 50 }, { x: 33, y: 60 }, { x: 66, y: 60 }, { x: 100, y: 50 });
    expect(voyagePose(arriba, 0.5).lean).toBeGreaterThan(0);
    expect(voyagePose(abajo, 0.5).lean).toBeLessThan(0);
  });

  it('si la tangente degenera cae al rumbo recto con escora 0 (el viaje no se rompe)', () => {
    const degen = handCurve({ x: 10, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 10 }, { x: 90, y: 60 });
    const pose = voyagePose(degen, 0);
    expect(pose.heading).toBeCloseTo(voyageAngle({ x: 10, y: 10 }, { x: 90, y: 60 }));
    expect(pose.lean).toBe(0);
  });

  it('rechaza un progreso no finito', () => {
    expect(() => voyagePose(curve, NaN)).toThrow(/inválido/i);
  });
});

describe('voyageAngle (rumbo entre dos puntos, +y abajo)', () => {
  it('apunta a los cuatro rumbos cardinales', () => {
    expect(voyageAngle({ x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(0); // este
    expect(voyageAngle({ x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(Math.PI / 2); // sur
    expect(voyageAngle({ x: 0, y: 0 }, { x: -1, y: 0 })).toBeCloseTo(Math.PI); // oeste
    expect(voyageAngle({ x: 0, y: 0 }, { x: 0, y: -1 })).toBeCloseTo(-Math.PI / 2); // norte
  });

  it('sin dirección definida devuelve 0 (determinista, como minimapHeading)', () => {
    expect(voyageAngle({ x: 4, y: 4 }, { x: 4, y: 4 })).toBe(0);
  });

  it('rechaza puntos sin coordenadas finitas', () => {
    expect(() => voyageAngle({ x: 0, y: 0 }, { x: Infinity, y: 0 })).toThrow(/inválido/i);
  });
});

describe('voyageDuration (proporcional a la distancia, con topes)', () => {
  it('nunca baja del mínimo ni pasa del máximo', () => {
    expect(voyageDuration(0)).toBe(VOYAGE_MIN_MS);
    expect(voyageDuration(VOYAGE_REF_DISTANCE)).toBe(VOYAGE_MAX_MS);
    expect(voyageDuration(500)).toBe(VOYAGE_MAX_MS);
  });

  it('crece de forma monótona con la distancia', () => {
    expect(voyageDuration(20)).toBeGreaterThan(voyageDuration(10));
    expect(voyageDuration(45)).toBeCloseTo((VOYAGE_MIN_MS + VOYAGE_MAX_MS) / 2);
  });

  it('rechaza distancias negativas o no finitas', () => {
    expect(() => voyageDuration(-1)).toThrow(/inválida/i);
    expect(() => voyageDuration(NaN)).toThrow(/inválida/i);
  });
});

describe('voyageBoatOrientation (sprite lateral proa a la DERECHA, JG-17)', () => {
  const pose = (headingDeg, lean = 0) => ({ heading: (headingDeg * Math.PI) / 180, lean });

  it('hacia el este rota sin espejar', () => {
    expect(voyageBoatOrientation(pose(0))).toEqual({ rotateDeg: 0, mirrored: false });
    expect(voyageBoatOrientation(pose(12)).rotateDeg).toBeCloseTo(12);
    expect(voyageBoatOrientation(pose(12)).mirrored).toBe(false);
  });

  it('hacia el oeste espeja (sin XOR: el sprite nuevo ya mira al este) y rota el suplementario', () => {
    expect(voyageBoatOrientation(pose(180))).toEqual({ rotateDeg: 0, mirrored: true });
    const o = voyageBoatOrientation(pose(168)); // arriba-izquierda suave
    expect(o.mirrored).toBe(true);
    expect(o.rotateDeg).toBeCloseTo(-12);
  });

  it('acota el cabeceo: un barco de perfil nunca rota 90° con rumbo vertical', () => {
    expect(voyageBoatOrientation(pose(90)).rotateDeg).toBe(VOYAGE_PITCH_MAX_DEG);
    expect(voyageBoatOrientation(pose(90)).mirrored).toBe(false);
    expect(voyageBoatOrientation(pose(-45)).rotateDeg).toBe(-VOYAGE_PITCH_MAX_DEG);
    expect(voyageBoatOrientation(pose(135)).rotateDeg).toBe(-VOYAGE_PITCH_MAX_DEG);
  });

  it('suma la escora en grados de pantalla y la acota', () => {
    expect(voyageBoatOrientation(pose(0, 5)).rotateDeg).toBeCloseTo(5);
    expect(voyageBoatOrientation(pose(0, 50)).rotateDeg).toBe(VOYAGE_LEAN_MAX_DEG);
    expect(voyageBoatOrientation(pose(180, -50)).rotateDeg).toBe(-VOYAGE_LEAN_MAX_DEG);
  });

  it('normaliza rumbos con vueltas de más', () => {
    expect(voyageBoatOrientation(pose(360)).rotateDeg).toBeCloseTo(0);
    expect(voyageBoatOrientation(pose(360)).mirrored).toBe(false);
  });

  it('rechaza poses sin rumbo o escora finitos', () => {
    expect(() => voyageBoatOrientation({ heading: NaN, lean: 0 })).toThrow(/inválida/i);
    expect(() => voyageBoatOrientation({ heading: 0, lean: NaN })).toThrow(/inválida/i);
  });
});
