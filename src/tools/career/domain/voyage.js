/**
 * Lógica PURA del viaje en barco por el mapa del mar (MC-19, ruta pirata
 * JG-17): trayecto, duración y pose (posición + rumbo + escora) del barco que
 * navega de puerto a puerto en el overlay del archipiélago, sin DOM ni
 * timers — testeable en Vitest.
 *
 * Sistema de coordenadas: el del ÍNDICE del archipiélago (x/y en 0..100, % del
 * contenedor .sea-map; +x derecha, +y ABAJO, como la pantalla). El contenedor
 * es 16/10, así que la distancia en unidades de mapa es un proxy razonable
 * (no exacto) de la distancia visual: sobra para modular duración y comba.
 *
 * El trayecto (JG-17, rumbo quebrado) es una POLILÍNEA determinista por PAR de
 * islas: la semilla es hashId("from→to") con mulberry32 (el mismo patrón que
 * islandShape/islandLayout). En vez de una curva suave, son 2–4 TRAMOS RECTOS
 * cuyos waypoints interiores zigzaguean a lado y lado de la recta (como quien
 * navega a vela virando), con amplitud 5–10 % de la distancia. Si un tramo
 * pasa rozando otra isla, el zigzag arranca hacia el lado contrario y crece
 * para RODEARLA — esquiva heurística sobre el obstáculo más centrado, NO
 * pathfinding (dos islas flanqueando el rumbo por ambos lados podrían seguir
 * quedando cerca; con el archipiélago real no pasa).
 *
 * El barco tampoco lleva velocidad constante: voyagePose aplica easeInOutCubic
 * (zarpa y atraca despacio) recorriendo la polilínea por longitud de arco, y
 * en cada waypoint VIRA suavemente (mezcla el rumbo del tramo con el del
 * vecino en una ventana VOYAGE_TURN_FRAC) con una ESCORA (lean) hacia el giro.
 * voyageBoatOrientation traduce la pose a la transformación del SPRITE
 * LATERAL: volteo horizontal + cabeceo acotado (un barco de perfil nunca rota
 * 90° aunque el rumbo sea vertical).
 *
 * @typedef {{ x: number, y: number }} SeaPoint  Punto del mapa del mar (0..100).
 * @typedef {{ id: string, x: number, y: number }} SeaIsland  Isla del índice (id + posición).
 * @typedef {{ from: SeaPoint, to: SeaPoint, points: SeaPoint[], distance: number }} VoyageCurve
 * @typedef {{ x: number, y: number, heading: number, lean: number }} VoyagePose
 */

import { hashId } from './islandLayout.js';
import { mulberry32 } from './islandShape.js';

/** Duración mínima del viaje (ms): islas vecinas, trayecto cortito. */
export const VOYAGE_MIN_MS = 3400;
/** Duración máxima del viaje (ms): punta a punta del archipiélago. */
export const VOYAGE_MAX_MS = 7200;
/** Distancia (unidades de mapa) a partir de la cual la duración ya es la máxima. */
export const VOYAGE_REF_DISTANCE = 90;
/** Distancia (unidades) que cubre cada TRAMO recto: define cuántos virajes tiene el trayecto. */
export const VOYAGE_LEG_SPAN = 16;
/** Nº mínimo/máximo de tramos rectos del zigzag (2 = un solo viraje). */
export const VOYAGE_LEGS_MIN = 2;
export const VOYAGE_LEGS_MAX = 4;
/** Amplitud del zigzag: desvío lateral de cada waypoint como fracción de la distancia. */
export const VOYAGE_ZIG_MIN = 0.05;
export const VOYAGE_ZIG_MAX = 0.1;
/** Holgura de esquiva (unidades de mapa): radio visual de una isla + margen. */
export const VOYAGE_CLEARANCE = 10;
/** Margen (unidades de mapa) al que se acotan los waypoints: el zigzag no saca el barco del mar. */
export const VOYAGE_EDGE = 3;
/** Cadencia (ms) con la que el barco va soltando puntos de estela. */
export const WAKE_INTERVAL_MS = 150;
/** Escora máxima (grados) del barco al girar. */
export const VOYAGE_LEAN_MAX_DEG = 14;
/** Cabeceo máximo (grados) del sprite lateral: el rumbo vertical no lo pone de proa al cielo. */
export const VOYAGE_PITCH_MAX_DEG = 20;
/** Fracción de cada tramo (junto a un waypoint) en la que el barco VIRA de un rumbo al siguiente. */
export const VOYAGE_TURN_FRAC = 0.16;
/** Tramo central de la recta en el que un obstáculo cuenta (los puertos no se esquivan a sí mismos). */
const AVOID_SPAN = { min: 0.12, max: 0.88 };
/** Ganancia desviación-de-rumbo→escora: durante un viraje el barco se inclina hacia el giro. */
const LEAN_GAIN = 26;

/** Valida que un punto del mapa tenga coordenadas finitas. @param {SeaPoint} point @param {string} label */
function assertSeaPoint(point, label) {
  if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) {
    throw new Error(`Punto inválido para el viaje (${label}): (${point?.x}, ${point?.y})`);
  }
}

/** Valida que una isla del índice traiga id y coordenadas. @param {SeaIsland} island @param {string} label */
function assertSeaIsland(island, label) {
  assertSeaPoint(island, label);
  if (typeof island.id !== 'string' || island.id.length === 0) {
    throw new Error(`Isla sin id para el viaje (${label}): "${island?.id}"`);
  }
}

/** Acota una coordenada del punto de control al mar visible. @param {number} n */
function clampToSea(n) {
  return Math.min(Math.max(n, VOYAGE_EDGE), 100 - VOYAGE_EDGE);
}

/** Acota un valor a ±limit. @param {number} value @param {number} limit */
function clampAbs(value, limit) {
  return Math.min(Math.max(value, -limit), limit);
}

/**
 * Islas del índice que pueden estorbar el trayecto: todas menos el origen, el
 * destino y las entradas sin id o sin situar (una isla que no está pintada en
 * el mar no puede estorbar — no es un dato roto, es que aún no tiene sitio).
 *
 * @param {SeaIsland} from
 * @param {SeaIsland} to
 * @param {SeaIsland[]} islands Islas del índice (puede incluir origen y destino).
 * @returns {SeaIsland[]}
 */
function seaObstacles(from, to, islands) {
  return islands.filter(
    (island) =>
      typeof island?.id === 'string' &&
      island.id.length > 0 &&
      Number.isFinite(island.x) &&
      Number.isFinite(island.y) &&
      island.id !== from.id &&
      island.id !== to.id,
  );
}

/**
 * Obstáculo MÁS centrado sobre la recta origen→destino: isla cuya distancia
 * lateral a la recta baja de VOYAGE_CLEARANCE dentro del tramo central del
 * trayecto.
 *
 * @param {SeaIsland} from
 * @param {SeaIsland[]} obstacles Islas candidatas (las de seaObstacles).
 * @param {{ ux: number, uy: number, px: number, py: number, distance: number }} frame
 *   Marco de la recta: unitario de la marcha (u), perpendicular izquierda (p) y longitud.
 * @returns {{ lateral: number }|null} Desvío lateral firmado (+ = izquierda de la marcha) o null.
 */
function worstBlocker(from, obstacles, frame) {
  let worst = null;
  for (const island of obstacles) {
    const relX = island.x - from.x;
    const relY = island.y - from.y;
    const along = (relX * frame.ux + relY * frame.uy) / frame.distance;
    if (along < AVOID_SPAN.min || along > AVOID_SPAN.max) continue;
    const lateral = relX * frame.px + relY * frame.py;
    if (Math.abs(lateral) >= VOYAGE_CLEARANCE) continue;
    if (!worst || Math.abs(lateral) < Math.abs(worst.lateral)) worst = { lateral };
  }
  return worst;
}

/** Muestras por tramo con las que se puntúa el agua libre de un candidato. */
const GAP_SAMPLES_PER_LEG = 10;

/**
 * Agua libre de un candidato: mínima distancia entre la POLILÍNEA muestreada
 * (cada tramo recto interpolado) y cualquier isla que estorbe. Sin obstáculos,
 * Infinity (cualquier lado vale).
 *
 * @param {SeaPoint[]} points Waypoints del candidato (origen … destino).
 * @param {SeaIsland[]} obstacles Islas de seaObstacles.
 * @returns {number}
 */
function openWater(points, obstacles) {
  let gap = Infinity;
  for (let s = 0; s < points.length - 1; s += 1) {
    const a = points[s];
    const b = points[s + 1];
    for (let i = 0; i <= GAP_SAMPLES_PER_LEG; i += 1) {
      const k = i / GAP_SAMPLES_PER_LEG;
      const x = a.x + (b.x - a.x) * k;
      const y = a.y + (b.y - a.y) * k;
      for (const island of obstacles) {
        gap = Math.min(gap, Math.hypot(x - island.x, y - island.y));
      }
    }
  }
  return gap;
}

/**
 * Trayecto del viaje (JG-17): Bézier CÚBICA de `from` a `to` con los dos
 * controles sobre la recta (a 1/3 y 2/3) desviados en perpendicular una comba
 * sorteada con la semilla del par (hashId("from→to") + mulberry32): mismo par
 * de islas, misma ruta SIEMPRE; el viaje de vuelta es otro par y otra ruta.
 * Esquiva heurística en una pasada: si la recta pasa a menos de
 * VOYAGE_CLEARANCE de otra isla, la comba crece lo justo para librar la
 * holgura (la curva solo alcanza ≈CURVE_OFFSET_FACTOR del desvío de control)
 * y, entre los DOS candidatos (babor/estribor), se queda el que deja más agua
 * libre respecto a TODAS las islas muestreando la curva — con empate, el lado
 * preferido (el sorteado, o el contrario al obstáculo). NO es pathfinding:
 * con islas flanqueando ambos lados el mejor candidato puede seguir pasando
 * cerca, y los controles acotados al mar (bordes) también recortan holgura —
 * asumido, en el archipiélago real no llega a pasar.
 *
 * @param {SeaIsland} from Puerto de origen (isla actual, con su id).
 * @param {SeaIsland} to Puerto de destino (isla pulsada, con su id).
 * @param {SeaIsland[]} [islands] Islas del índice para la esquiva.
 * @returns {VoyageCurve}
 */
export function voyageCurve(from, to, islands = []) {
  assertSeaIsland(from, 'origen');
  assertSeaIsland(to, 'destino');
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1e-9) {
    throw new Error('Trayecto inválido: el origen y el destino coinciden.');
  }
  const ux = dx / distance;
  const uy = dy / distance;
  // Perpendicular IZQUIERDA de la marcha: con +y abajo, rumbo este → arriba.
  const px = uy;
  const py = -ux;
  // Tramos rectos según la distancia: los cortos, un solo viraje; los largos,
  // hasta VOYAGE_LEGS_MAX. Los waypoints interiores zigzaguean a lado y lado
  // de la recta (rumbo QUEBRADO, como quien navega a vela), con amplitud
  // sorteada por el par de islas (determinista: misma travesía, mismo trazo).
  const legs = Math.min(
    VOYAGE_LEGS_MAX,
    Math.max(VOYAGE_LEGS_MIN, Math.round(distance / VOYAGE_LEG_SPAN)),
  );
  const rand = mulberry32(hashId(`${from.id}→${to.id}`));
  let baseSide = rand() < 0.5 ? 1 : -1;
  const obstacles = seaObstacles(from, to, islands);
  const blocker = worstBlocker(from, obstacles, { ux, uy, px, py, distance });
  // Con una isla estorbando, el zigzag arranca hacia el lado contrario.
  if (blocker) baseSide = blocker.lateral > 0 ? -1 : 1;
  // Amplitud extra si hay que librar holgura sobre la isla más centrada. Con
  // obstáculo la comba va a UN SOLO lado (rodea la isla); sin él, zigzaguea a
  // lado y lado (el trazo de virada). La esquiva manda sobre la estética.
  const clearBoost = blocker ? VOYAGE_CLEARANCE - Math.abs(blocker.lateral) + distance * VOYAGE_ZIG_MIN : 0;
  const waypoints = (startSide) => {
    const pts = [{ x: from.x, y: from.y }];
    for (let i = 1; i < legs; i += 1) {
      const along = i / legs;
      const zig = VOYAGE_ZIG_MIN + rand() * (VOYAGE_ZIG_MAX - VOYAGE_ZIG_MIN);
      const altSign = i % 2 === 1 ? 1 : -1;
      const side = blocker ? startSide : startSide * altSign;
      const amp = blocker ? clearBoost : distance * zig;
      pts.push({
        x: clampToSea(from.x + ux * distance * along + px * side * amp),
        y: clampToSea(from.y + uy * distance * along + py * side * amp),
      });
    }
    pts.push({ x: to.x, y: to.y });
    return pts;
  };
  const preferred = { from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y }, points: waypoints(baseSide), distance };
  if (obstacles.length === 0) return preferred;
  const opposite = { from: preferred.from, to: preferred.to, points: waypoints(-baseSide), distance };
  return openWater(opposite.points, obstacles) > openWater(preferred.points, obstacles) ? opposite : preferred;
}

/**
 * easeInOutCubic: el barco zarpa y atraca DESPACIO y cruza el mar a buen
 * ritmo. Monótona en [0, 1] con extremos exactos (0→0, 1→1).
 * @param {number} k Progreso lineal del reloj, ya acotado a [0, 1].
 */
function easeInOutCubic(k) {
  return k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
}

/**
 * Pose del barco en el instante t (0 = zarpa, 1 = atraca): posición sobre la
 * curva con el tiempo SUAVIZADO (easeInOutCubic), rumbo tangente (radianes,
 * convención de voyageAngle) y ESCORA en grados derivada de la curvatura del
 * giro (firmada: + escora horaria en pantalla; acotada a ±VOYAGE_LEAN_MAX_DEG).
 * t se acota a [0, 1]: un frame pasado de rosca no saca el barco del mar. Si
 * la tangente degenera (controles clavados en un extremo), cae al rumbo recto
 * origen→destino con escora 0 — el viaje nunca se rompe por la parte visual.
 *
 * @param {VoyageCurve} curve Trayecto de voyageCurve.
 * @param {number} t Progreso del viaje (tiempo/duración).
 * @returns {VoyagePose}
 */
export function voyagePose(curve, t) {
  if (!Number.isFinite(t)) {
    throw new TypeError(`Progreso inválido para voyagePose: "${t}"`);
  }
  const pts = curve.points ?? [curve.from, curve.to];
  // Tramos rectos con su longitud y su rumbo (unitario). Los de longitud nula
  // (waypoints coincidentes) se descartan: no aportan rumbo.
  const segs = [];
  for (let i = 0; i < pts.length - 1; i += 1) {
    const ax = pts[i].x;
    const ay = pts[i].y;
    const dx = pts[i + 1].x - ax;
    const dy = pts[i + 1].y - ay;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) continue;
    segs.push({ ax, ay, dx, dy, len, ux: dx / len, uy: dy / len });
  }
  const e = easeInOutCubic(Math.min(Math.max(t, 0), 1));
  if (segs.length === 0) {
    return { x: curve.from.x, y: curve.from.y, heading: voyageAngle(curve.from, curve.to), lean: 0 };
  }
  const total = segs.reduce((sum, s) => sum + s.len, 0);
  let target = e * total;
  let i = 0;
  while (i < segs.length - 1 && target > segs[i].len) {
    target -= segs[i].len;
    i += 1;
  }
  const seg = segs[i];
  const f = seg.len < 1e-9 ? 0 : Math.min(target / seg.len, 1);
  const x = seg.ax + seg.dx * f;
  const y = seg.ay + seg.dy * f;

  // Rumbo QUEBRADO con viraje suave: en el tramo recto, el rumbo es el del
  // tramo; cerca de un waypoint (VOYAGE_TURN_FRAC) se mezcla con el rumbo del
  // tramo vecino promediando los unitarios, así el barco VIRA en vez de saltar.
  let vx = seg.ux;
  let vy = seg.uy;
  const turn = VOYAGE_TURN_FRAC;
  if (f > 1 - turn && i < segs.length - 1) {
    const w = 0.5 * ((f - (1 - turn)) / turn);
    vx += w * (segs[i + 1].ux - seg.ux);
    vy += w * (segs[i + 1].uy - seg.uy);
  } else if (f < turn && i > 0) {
    const w = 0.5 * ((turn - f) / turn);
    vx += w * (segs[i - 1].ux - seg.ux);
    vy += w * (segs[i - 1].uy - seg.uy);
  }
  const heading = Math.atan2(vy, vx);
  // Escora: cuánto se desvía el rumbo mezclado del rumbo recto del tramo — 0
  // en la recta, un pico hacia el giro durante el viraje.
  const drift = Math.atan2(seg.ux * vy - seg.uy * vx, seg.ux * vx + seg.uy * vy);
  return { x, y, heading, lean: clampAbs(drift * LEAN_GAIN, VOYAGE_LEAN_MAX_DEG) };
}

/**
 * Rumbo (radianes) de un punto a otro del mapa: atan2 en coordenadas de
 * pantalla (+y abajo), así que 0 = este, π/2 = SUR, ±π = oeste. Sin dirección
 * definida (puntos ~coincidentes) devuelve 0 — determinista, misma convención
 * que minimapHeading; solo orienta el sprite, nunca decide el trayecto.
 *
 * @param {SeaPoint} from
 * @param {SeaPoint} to
 * @returns {number} Ángulo en (-π, π].
 */
export function voyageAngle(from, to) {
  assertSeaPoint(from, 'origen del rumbo');
  assertSeaPoint(to, 'destino del rumbo');
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.hypot(dx, dy) < 1e-9) return 0;
  return Math.atan2(dy, dx);
}

/**
 * Duración del viaje (ms) proporcional a la distancia: lineal entre
 * VOYAGE_MIN_MS (distancia ~0) y VOYAGE_MAX_MS (VOYAGE_REF_DISTANCE o más).
 * Islas vecinas ≈ 1.6 s; punta a punta del archipiélago ≈ 3.2 s (con el
 * easing de voyagePose el tramo central va más rápido que la media).
 *
 * @param {number} distance Distancia en unidades de mapa (la de voyagePath).
 * @returns {number} Duración en milisegundos.
 */
export function voyageDuration(distance) {
  if (!Number.isFinite(distance) || distance < 0) {
    throw new Error(`Distancia inválida para voyageDuration: "${distance}"`);
  }
  return VOYAGE_MIN_MS + (VOYAGE_MAX_MS - VOYAGE_MIN_MS) * Math.min(distance / VOYAGE_REF_DISTANCE, 1);
}

/**
 * Orientación del SPRITE del barco a partir de la pose (JG-17). CONVENCIÓN:
 * el sprite se dibuja con la proa a la DERECHA (+x, este) — a rumbos del
 * oeste (|deg| > 90) se voltea con `mirrored` y se rota el suplementario,
 * SIN espejo base (adiós al XOR histórico del glifo ⛵, que miraba a la
 * izquierda). Es un barco LATERAL de carta náutica: el cabeceo del rumbo se
 * acota a ±VOYAGE_PITCH_MAX_DEG (nunca se pone de proa al cielo) y encima se
 * suma la escora del giro (±VOYAGE_LEAN_MAX_DEG). El componente lo traduce a
 * `rotate(rotateDeg) scaleX(-1)`: el rotate es el MÁS EXTERNO, gira en
 * pantalla, así que escora y cabeceo se suman en grados de pantalla tal cual.
 *
 * @param {VoyagePose} pose Pose de voyagePose (usa heading y lean).
 * @returns {{ rotateDeg: number, mirrored: boolean }}
 */
export function voyageBoatOrientation(pose) {
  if (!Number.isFinite(pose?.heading) || !Number.isFinite(pose?.lean)) {
    throw new TypeError(
      `Pose inválida para voyageBoatOrientation: (${pose?.heading}, ${pose?.lean})`,
    );
  }
  // Rumbo normalizado a (-180, 180]: atan2 ya lo cumple, pero un ángulo con
  // vueltas de más no debe producir rotaciones absurdas.
  const raw = ((pose.heading * 180) / Math.PI) % 360;
  let deg = raw;
  if (raw > 180) deg = raw - 360;
  else if (raw <= -180) deg = raw + 360;
  const mirrored = deg > 90 || deg < -90;
  let frame = deg;
  if (deg > 90) frame = deg - 180;
  else if (deg < -90) frame = deg + 180;
  const pitch = clampAbs(frame, VOYAGE_PITCH_MAX_DEG);
  return { rotateDeg: pitch + clampAbs(pose.lean, VOYAGE_LEAN_MAX_DEG), mirrored };
}
