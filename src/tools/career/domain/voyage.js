/**
 * Lógica PURA del viaje en barco por el mapa del mar (MC-19): trayecto,
 * duración y orientación del barquito que navega de puerto a puerto en el
 * overlay del archipiélago, sin DOM ni timers — testeable en Vitest.
 *
 * Sistema de coordenadas: el del ÍNDICE del archipiélago (x/y en 0..100, % del
 * contenedor .sea-map; +x derecha, +y ABAJO, como la pantalla). El contenedor
 * es 16/10, así que la distancia en unidades de mapa es un proxy razonable
 * (no exacto) de la distancia visual: sobra para modular la duración.
 *
 * El trayecto es una Bézier CUADRÁTICA: recta origen→destino con el punto de
 * control desviado hacia la IZQUIERDA de la marcha (una comba suave y
 * determinista, siempre hacia el mismo lado del rumbo). El componente muestrea
 * la curva con voyagePointAt/voyageTangentAngle en cada frame; aquí no vive
 * ningún estado.
 *
 * @typedef {{ x: number, y: number }} SeaPoint  Punto del mapa del mar (0..100).
 * @typedef {{ from: SeaPoint, control: SeaPoint, to: SeaPoint, distance: number }} VoyagePath
 */

/** Duración mínima del viaje (ms): islas vecinas, trayecto cortito. */
export const VOYAGE_MIN_MS = 1200;
/** Duración máxima del viaje (ms): punta a punta del archipiélago. */
export const VOYAGE_MAX_MS = 2500;
/** Distancia (unidades de mapa) a partir de la cual la duración ya es la máxima. */
export const VOYAGE_REF_DISTANCE = 90;
/** Comba de la curva: desvío del punto de control como fracción de la distancia. */
export const VOYAGE_BEND = 0.18;
/** Margen (unidades de mapa) al que se acota el punto de control: la comba no saca el barco del mar. */
export const VOYAGE_EDGE = 3;
/** Cadencia (ms) con la que el barco va soltando puntos de estela. */
export const WAKE_INTERVAL_MS = 110;

/** Valida que un punto del mapa tenga coordenadas finitas. @param {SeaPoint} point @param {string} label */
function assertSeaPoint(point, label) {
  if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) {
    throw new Error(`Punto inválido para el viaje (${label}): (${point?.x}, ${point?.y})`);
  }
}

/** Acota una coordenada del punto de control al mar visible. @param {number} n */
function clampToSea(n) {
  return Math.min(Math.max(n, VOYAGE_EDGE), 100 - VOYAGE_EDGE);
}

/**
 * Trayecto del viaje: Bézier cuadrática de `from` a `to` con el control en el
 * punto medio desviado VOYAGE_BEND·distancia hacia la izquierda de la marcha
 * (perpendicular (dy, -dx): con +y hacia abajo, un rumbo al este comba hacia
 * ARRIBA de la pantalla). El control se acota al mar visible para que la comba
 * nunca saque el barco del mapa. Determinista: mismo par de islas, misma ruta.
 *
 * @param {SeaPoint} from Puerto de origen (isla actual).
 * @param {SeaPoint} to Puerto de destino (isla pulsada).
 * @returns {VoyagePath}
 */
export function voyagePath(from, to) {
  assertSeaPoint(from, 'origen');
  assertSeaPoint(to, 'destino');
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1e-9) {
    throw new Error('Trayecto inválido: el origen y el destino coinciden.');
  }
  const bend = distance * VOYAGE_BEND;
  const control = {
    x: clampToSea(from.x + dx / 2 + (dy / distance) * bend),
    y: clampToSea(from.y + dy / 2 - (dx / distance) * bend),
  };
  return { from: { x: from.x, y: from.y }, control, to: { x: to.x, y: to.y }, distance };
}

/**
 * Punto de la curva en el instante t (0 = origen, 1 = destino). t se acota a
 * [0, 1]: el llamante puede pasarse un pelo por redondeo de tiempos sin que el
 * barco se salga del trayecto.
 *
 * @param {VoyagePath} path Trayecto de voyagePath.
 * @param {number} t Progreso del viaje.
 * @returns {SeaPoint}
 */
export function voyagePointAt(path, t) {
  if (!Number.isFinite(t)) {
    throw new Error(`Progreso inválido para voyagePointAt: "${t}"`);
  }
  const k = Math.min(Math.max(t, 0), 1);
  const u = 1 - k;
  return {
    x: u * u * path.from.x + 2 * u * k * path.control.x + k * k * path.to.x,
    y: u * u * path.from.y + 2 * u * k * path.control.y + k * k * path.to.y,
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
 * Rumbo TANGENTE a la curva en el instante t: la derivada de la Bézier
 * cuadrática, B'(t) = 2(1-t)(control-from) + 2t(to-control). Es el ángulo con
 * el que se orienta el barco en cada frame (la proa sigue la curva, no la
 * recta origen→destino). Si la derivada degenera (control clavado en un
 * extremo y t en ese extremo), cae al rumbo recto origen→destino.
 *
 * @param {VoyagePath} path Trayecto de voyagePath.
 * @param {number} t Progreso del viaje (se acota a [0, 1]).
 * @returns {number} Ángulo en (-π, π].
 */
export function voyageTangentAngle(path, t) {
  if (!Number.isFinite(t)) {
    throw new Error(`Progreso inválido para voyageTangentAngle: "${t}"`);
  }
  const k = Math.min(Math.max(t, 0), 1);
  const dx = 2 * (1 - k) * (path.control.x - path.from.x) + 2 * k * (path.to.x - path.control.x);
  const dy = 2 * (1 - k) * (path.control.y - path.from.y) + 2 * k * (path.to.y - path.control.y);
  if (Math.hypot(dx, dy) < 1e-9) return voyageAngle(path.from, path.to);
  return Math.atan2(dy, dx);
}

/**
 * Duración del viaje (ms) proporcional a la distancia: lineal entre
 * VOYAGE_MIN_MS (distancia ~0) y VOYAGE_MAX_MS (VOYAGE_REF_DISTANCE o más).
 * Islas vecinas ≈ 1.2 s; punta a punta del archipiélago ≈ 2.5 s.
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
 * Orientación del SPRITE del barco a partir del rumbo: el glifo nominal navega
 * hacia +x (este); para rumbos hacia el oeste (|deg| > 90) se ESPEJA en
 * horizontal y se rota el suplementario, de modo que el mástil nunca queda
 * boca abajo (el truco clásico de voltear sprites). El componente lo traduce a
 * `rotate(rotateDeg deg) scaleX(-1)` — el scale se aplica antes que el rotate.
 *
 * @param {number} angle Rumbo en radianes (el de voyageTangentAngle).
 * @returns {{ rotateDeg: number, mirrored: boolean }}
 */
export function voyageHeading(angle) {
  if (!Number.isFinite(angle)) {
    throw new Error(`Rumbo inválido para voyageHeading: "${angle}"`);
  }
  // Normalizado a (-180, 180]: los rumbos de atan2 ya lo cumplen, pero un
  // ángulo con vueltas de más no debe producir rotaciones absurdas.
  const raw = ((angle * 180) / Math.PI) % 360;
  const deg = raw > 180 ? raw - 360 : raw <= -180 ? raw + 360 : raw;
  if (deg > 90) return { rotateDeg: deg - 180, mirrored: true };
  if (deg < -90) return { rotateDeg: deg + 180, mirrored: true };
  return { rotateDeg: deg, mirrored: false };
}
