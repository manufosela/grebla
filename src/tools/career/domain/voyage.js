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
 * El trayecto (JG-17) es una Bézier CÚBICA determinista por PAR de islas: la
 * semilla es hashId("from→to") con mulberry32 (el mismo patrón que
 * islandShape/islandLayout), y decide el lado y el tamaño de la comba lateral
 * (perpendicular a la marcha, 8–18 % de la distancia). Si la recta pasa
 * rozando otra isla, la comba crece y se orienta para RODEARLA — una sola
 * pasada sobre el obstáculo más centrado: es una esquiva heurística, NO
 * pathfinding (dos islas flanqueando el rumbo por ambos lados podrían seguir
 * quedando cerca; con el archipiélago real no pasa).
 *
 * El barco tampoco lleva velocidad constante: voyagePose aplica
 * easeInOutCubic (zarpa y atraca despacio) y devuelve, además de la posición,
 * el rumbo tangente y la ESCORA (lean) derivada de la curvatura del giro.
 * voyageBoatOrientation traduce la pose a la transformación del SPRITE
 * LATERAL: volteo horizontal + cabeceo acotado (un barco de perfil nunca rota
 * 90° aunque el rumbo sea vertical).
 *
 * @typedef {{ x: number, y: number }} SeaPoint  Punto del mapa del mar (0..100).
 * @typedef {{ id: string, x: number, y: number }} SeaIsland  Isla del índice (id + posición).
 * @typedef {{ from: SeaPoint, c1: SeaPoint, c2: SeaPoint, to: SeaPoint, distance: number }} VoyageCurve
 * @typedef {{ x: number, y: number, heading: number, lean: number }} VoyagePose
 */

import { hashId } from './islandLayout.js';
import { mulberry32 } from './islandShape.js';

/** Duración mínima del viaje (ms): islas vecinas, trayecto cortito. */
export const VOYAGE_MIN_MS = 1600;
/** Duración máxima del viaje (ms): punta a punta del archipiélago. */
export const VOYAGE_MAX_MS = 3200;
/** Distancia (unidades de mapa) a partir de la cual la duración ya es la máxima. */
export const VOYAGE_REF_DISTANCE = 90;
/** Comba mínima de la curva: desvío lateral como fracción de la distancia. */
export const VOYAGE_BEND_MIN = 0.08;
/** Comba máxima de la curva (sin esquiva): el sorteo del par cae entre ambas. */
export const VOYAGE_BEND_MAX = 0.18;
/** Holgura de esquiva (unidades de mapa): radio visual de una isla + margen. */
export const VOYAGE_CLEARANCE = 10;
/** Margen (unidades de mapa) al que se acotan los controles: la comba no saca el barco del mar. */
export const VOYAGE_EDGE = 3;
/** Cadencia (ms) con la que el barco va soltando puntos de estela. */
export const WAKE_INTERVAL_MS = 110;
/** Escora máxima (grados) del barco al girar. */
export const VOYAGE_LEAN_MAX_DEG = 12;
/** Cabeceo máximo (grados) del sprite lateral: el rumbo vertical no lo pone de proa al cielo. */
export const VOYAGE_PITCH_MAX_DEG = 20;
/** Tramo central de la recta en el que un obstáculo cuenta (los puertos no se esquivan a sí mismos). */
const AVOID_SPAN = { min: 0.12, max: 0.88 };
/** Fracción conservadora del desvío de control que la curva alcanza de verdad (≈0.75 en el centro). */
const CURVE_OFFSET_FACTOR = 0.55;
/** Ganancia curvatura→escora: un giro típico del mapa (~1/60 de radio) escora ~10°. */
const LEAN_GAIN = 600;

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
 * Obstáculo MÁS centrado sobre la recta origen→destino: isla (ni origen ni
 * destino) cuya distancia lateral a la recta baja de VOYAGE_CLEARANCE dentro
 * del tramo central del trayecto. Las entradas del índice sin id o sin
 * posición no pueden estorbar (no están pintadas en el mar) y se ignoran.
 *
 * @param {SeaIsland} from
 * @param {SeaIsland} to
 * @param {SeaIsland[]} islands Islas del índice (puede incluir origen y destino).
 * @param {{ ux: number, uy: number, px: number, py: number, distance: number }} frame
 *   Marco de la recta: unitario de la marcha (u), perpendicular izquierda (p) y longitud.
 * @returns {{ lateral: number }|null} Desvío lateral firmado (+ = izquierda de la marcha) o null.
 */
function worstBlocker(from, to, islands, frame) {
  let worst = null;
  for (const island of islands) {
    const placed =
      typeof island?.id === 'string' &&
      island.id.length > 0 &&
      Number.isFinite(island.x) &&
      Number.isFinite(island.y);
    if (!placed || island.id === from.id || island.id === to.id) continue;
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

/**
 * Trayecto del viaje (JG-17): Bézier CÚBICA de `from` a `to` con los dos
 * controles sobre la recta (a 1/3 y 2/3) desviados en perpendicular una comba
 * sorteada con la semilla del par (hashId("from→to") + mulberry32): mismo par
 * de islas, misma ruta SIEMPRE; el viaje de vuelta es otro par y otra ruta.
 * Esquiva heurística: si la recta pasa a menos de VOYAGE_CLEARANCE de otra
 * isla, la comba se orienta hacia el lado CONTRARIO al que asoma el obstáculo
 * más centrado y crece lo justo para librar la holgura (una sola pasada, no
 * es pathfinding). Los controles se acotan al mar visible: pegado al borde la
 * holgura efectiva puede quedar algo por debajo — asumido.
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
  // Sorteo determinista del par: lado de la comba y tamaño de cada control.
  const rand = mulberry32(hashId(`${from.id}→${to.id}`));
  let side = rand() < 0.5 ? 1 : -1;
  let bendA = distance * (VOYAGE_BEND_MIN + rand() * (VOYAGE_BEND_MAX - VOYAGE_BEND_MIN));
  let bendB = distance * (VOYAGE_BEND_MIN + rand() * (VOYAGE_BEND_MAX - VOYAGE_BEND_MIN));
  const blocker = worstBlocker(from, to, islands, { ux, uy, px, py, distance });
  if (blocker) {
    // Rodear por el lado contrario al que asoma la isla (en la propia recta
    // se rodea por la izquierda); la comba crece hasta que la curva — que
    // solo alcanza ≈CURVE_OFFSET_FACTOR del desvío de control — libra la holgura.
    side = blocker.lateral > 0 ? -1 : 1;
    const needed = (VOYAGE_CLEARANCE - Math.abs(blocker.lateral)) / CURVE_OFFSET_FACTOR;
    bendA = Math.max(bendA, needed);
    bendB = Math.max(bendB, needed);
  }
  const c1 = {
    x: clampToSea(from.x + ux * (distance / 3) + px * side * bendA),
    y: clampToSea(from.y + uy * (distance / 3) + py * side * bendA),
  };
  const c2 = {
    x: clampToSea(from.x + ux * ((2 * distance) / 3) + px * side * bendB),
    y: clampToSea(from.y + uy * ((2 * distance) / 3) + py * side * bendB),
  };
  return { from: { x: from.x, y: from.y }, c1, c2, to: { x: to.x, y: to.y }, distance };
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
    throw new Error(`Progreso inválido para voyagePose: "${t}"`);
  }
  const k = Math.min(Math.max(t, 0), 1);
  const e = easeInOutCubic(k);
  const u = 1 - e;
  const { from, c1, c2, to } = curve;
  const x = u ** 3 * from.x + 3 * u * u * e * c1.x + 3 * u * e * e * c2.x + e ** 3 * to.x;
  const y = u ** 3 * from.y + 3 * u * u * e * c1.y + 3 * u * e * e * c2.y + e ** 3 * to.y;
  // Derivada B'(e): la tangente que orienta la proa.
  const dX = 3 * u * u * (c1.x - from.x) + 6 * u * e * (c2.x - c1.x) + 3 * e * e * (to.x - c2.x);
  const dY = 3 * u * u * (c1.y - from.y) + 6 * u * e * (c2.y - c1.y) + 3 * e * e * (to.y - c2.y);
  const speed = Math.hypot(dX, dY);
  if (speed < 1e-9) {
    return { x, y, heading: voyageAngle(curve.from, curve.to), lean: 0 };
  }
  // Segunda derivada B''(e) → curvatura firmada → escora del giro.
  const sX = 6 * u * (c2.x - 2 * c1.x + from.x) + 6 * e * (to.x - 2 * c2.x + c1.x);
  const sY = 6 * u * (c2.y - 2 * c1.y + from.y) + 6 * e * (to.y - 2 * c2.y + c1.y);
  const curvature = (dX * sY - dY * sX) / speed ** 3;
  return {
    x,
    y,
    heading: Math.atan2(dY, dX),
    lean: clampAbs(curvature * LEAN_GAIN, VOYAGE_LEAN_MAX_DEG),
  };
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
    throw new Error(`Pose inválida para voyageBoatOrientation: (${pose?.heading}, ${pose?.lean})`);
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
