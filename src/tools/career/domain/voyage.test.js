import { describe, it, expect } from 'vitest';
import {
  VOYAGE_MIN_MS,
  VOYAGE_MAX_MS,
  VOYAGE_REF_DISTANCE,
  VOYAGE_ZIG_MIN,
  VOYAGE_ZIG_MAX,
  VOYAGE_LEGS_MIN,
  VOYAGE_LEGS_MAX,
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

/** Trayecto construido a mano (waypoints explícitos) para tests de la pose. */
function handPath(...points) {
  const from = points.at(0);
  const to = points.at(-1);
  return { from, to, points, distance: Math.hypot(to.x - from.x, to.y - from.y) };
}

describe('voyageCurve (trayecto pirata por mar, rumbo quebrado JG-17)', () => {
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

  it('es una polilínea que empieza y acaba en los puertos', () => {
    const curve = voyageCurve(A, B);
    expect(curve.points.at(0)).toEqual({ x: A.x, y: A.y });
    expect(curve.points.at(-1)).toEqual({ x: B.x, y: B.y });
    expect(curve.points.length).toBeGreaterThanOrEqual(VOYAGE_LEGS_MIN + 1);
    expect(curve.points.length).toBeLessThanOrEqual(VOYAGE_LEGS_MAX + 1);
  });

  it('es determinista: mismo par de islas, misma ruta', () => {
    expect(voyageCurve(A, B)).toEqual(voyageCurve(A, B));
  });

  it('la semilla es el PAR de ids: otras islas en el mismo sitio, otro trazo', () => {
    const other = voyageCurve({ ...A, id: 'react' }, { ...B, id: 'vue' });
    expect(other.points).not.toEqual(voyageCurve(A, B).points);
  });

  it('los waypoints interiores zigzaguean a lado y lado de la recta', () => {
    // Rumbo este: la recta es y=50; los waypoints se separan arriba/abajo
    // ALTERNANDO, con amplitud dentro del rango sorteado.
    const curve = voyageCurve(A, B);
    const interior = curve.points.slice(1, -1);
    expect(interior.length).toBeGreaterThanOrEqual(1);
    const offsets = interior.map((p) => p.y - 50);
    for (const off of offsets) {
      expect(Math.abs(off)).toBeGreaterThanOrEqual(curve.distance * VOYAGE_ZIG_MIN - 1e-6);
      expect(Math.abs(off)).toBeLessThanOrEqual(curve.distance * VOYAGE_ZIG_MAX + 1e-6);
    }
    // Alternancia: si hay dos o más, cambian de signo.
    for (let i = 1; i < offsets.length; i += 1) {
      expect(Math.sign(offsets[i])).toBe(-Math.sign(offsets[i - 1]));
    }
  });

  it('esquiva una isla plantada en mitad de la recta', () => {
    const from = { id: 'a', x: 10, y: 50 };
    const to = { id: 'b', x: 90, y: 50 };
    const mid = { id: 'roca', x: 50, y: 50 };
    const curve = voyageCurve(from, to, [from, to, mid]);
    const gap = Math.min(...samplePoses(curve).map((p) => Math.hypot(p.x - mid.x, p.y - mid.y)));
    expect(gap).toBeGreaterThanOrEqual(VOYAGE_CLEARANCE);
  });

  it('mantiene la holgura al rodear una isla asome por donde asome', () => {
    const from = { id: 'a', x: 10, y: 50 };
    const to = { id: 'b', x: 90, y: 50 };
    const above = voyageCurve(from, to, [{ id: 'roca', x: 50, y: 47 }]);
    const below = voyageCurve(from, to, [{ id: 'roca', x: 50, y: 53 }]);
    const gapTo = (curve, isle) =>
      Math.min(...samplePoses(curve).map((p) => Math.hypot(p.x - isle.x, p.y - isle.y)));
    expect(gapTo(above, { x: 50, y: 47 })).toBeGreaterThanOrEqual(VOYAGE_CLEARANCE * 0.85);
    expect(gapTo(below, { x: 50, y: 53 })).toBeGreaterThanOrEqual(VOYAGE_CLEARANCE * 0.85);
  });

  it('entre babor y estribor elige el lado con más agua libre', () => {
    // Escenario real del archipiélago: Bases→Backend Python; esquivar Product
    // Manager por babor plantaría el barco cerca de Frontend — la puntuación de
    // agua libre debe mantener holgura con ambas.
    const from = { id: 'island', x: 50, y: 76 };
    const to = { id: 'backend-python', x: 32, y: 16 };
    const frontend = { id: 'frontend', x: 28, y: 54 };
    const pm = { id: 'product-manager', x: 40, y: 38 };
    const curve = voyageCurve(from, to, [from, to, frontend, pm]);
    const gap = Math.min(
      ...samplePoses(curve).flatMap((p) => [
        Math.hypot(p.x - frontend.x, p.y - frontend.y),
        Math.hypot(p.x - pm.x, p.y - pm.y),
      ]),
    );
    expect(gap).toBeGreaterThanOrEqual(VOYAGE_CLEARANCE * 0.7);
  });

  it('los puertos de origen/destino y las islas sin situar no estorban', () => {
    const sinMapa = { id: 'wip' }; // isla del índice aún sin x/y
    expect(voyageCurve(A, B, [A, B, sinMapa])).toEqual(voyageCurve(A, B));
  });

  it('acota los waypoints al mar visible (el zigzag no saca el barco del mapa)', () => {
    const curve = voyageCurve({ id: 'a', x: 5, y: 4 }, { id: 'b', x: 95, y: 4 });
    for (const p of curve.points) {
      expect(p.x).toBeGreaterThanOrEqual(VOYAGE_EDGE);
      expect(p.x).toBeLessThanOrEqual(100 - VOYAGE_EDGE);
      expect(p.y).toBeGreaterThanOrEqual(VOYAGE_EDGE);
      expect(p.y).toBeLessThanOrEqual(100 - VOYAGE_EDGE);
    }
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
  const dir = { ux: (90 - 10) / Math.hypot(80, -30), uy: (30 - 60) / Math.hypot(80, -30) };
  const along = (p) => (p.x - 10) * dir.ux + (p.y - 60) * dir.uy;

  it('acota t fuera de [0, 1] a los extremos del trayecto', () => {
    expect(voyagePose(curve, -0.5)).toEqual(voyagePose(curve, 0));
    expect(voyagePose(curve, 1.7)).toEqual(voyagePose(curve, 1));
  });

  it('avanza monótono hacia el destino (proyección sobre la marcha, sin recular)', () => {
    const proj = samplePoses(curve, 100).map(along);
    for (let i = 1; i < proj.length; i += 1) {
      expect(proj[i]).toBeGreaterThanOrEqual(proj[i - 1] - 1e-6);
    }
  });

  it('zarpa y atraca despacio (easing): los extremos recorren menos que el centro', () => {
    const step = (t1, t2) => {
      const p1 = voyagePose(curve, t1);
      const p2 = voyagePose(curve, t2);
      return Math.hypot(p2.x - p1.x, p2.y - p1.y);
    };
    expect(step(0, 0.1)).toBeLessThan(step(0.45, 0.55));
    expect(step(0.9, 1)).toBeLessThan(step(0.45, 0.55));
  });

  it('zarpa proa al primer waypoint y atraca llegando al último tramo', () => {
    const pts = curve.points;
    expect(voyagePose(curve, 0).heading).toBeCloseTo(voyageAngle(pts.at(0), pts.at(1)));
    expect(voyagePose(curve, 1).heading).toBeCloseTo(voyageAngle(pts.at(-2), pts.at(-1)));
  });

  it('lleva rumbo CONTINUO (vira en los waypoints, sin saltos entre frames)', () => {
    const headings = samplePoses(curve, 300).map((p) => p.heading);
    for (let i = 1; i < headings.length; i += 1) {
      expect(Math.abs(headings[i] - headings[i - 1])).toBeLessThan(0.3);
    }
  });

  it('escora acotada, nula en recta y de signo opuesto al espejar el viraje', () => {
    for (const pose of samplePoses(curve)) {
      expect(Math.abs(pose.lean)).toBeLessThanOrEqual(VOYAGE_LEAN_MAX_DEG);
    }
    const recta = handPath({ x: 0, y: 50 }, { x: 100, y: 50 });
    expect(voyagePose(recta, 0.5).lean).toBe(0);
    // V hacia arriba vs hacia abajo: el viraje en el vértice escora al revés.
    const arriba = handPath({ x: 0, y: 50 }, { x: 50, y: 38 }, { x: 100, y: 50 });
    const abajo = handPath({ x: 0, y: 50 }, { x: 50, y: 62 }, { x: 100, y: 50 });
    const leanArriba = voyagePose(arriba, 0.5).lean;
    const leanAbajo = voyagePose(abajo, 0.5).lean;
    expect(leanArriba * leanAbajo).toBeLessThan(0);
  });

  it('si no hay tramo con rumbo cae al recto origen→destino con escora 0', () => {
    const degen = { from: { x: 10, y: 10 }, to: { x: 90, y: 60 }, points: [{ x: 10, y: 10 }, { x: 10, y: 10 }], distance: Math.hypot(80, 50) };
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
