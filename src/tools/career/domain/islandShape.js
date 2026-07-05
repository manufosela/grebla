/**
 * Silueta de ISLA para el mapa del archipiélago (JG-12): funciones PURAS que
 * generan la mancha asimétrica de costa irregular de cada isla como un path
 * SVG cerrado. Las islas del mar dejan de ser círculos: cada id produce una
 * costa propia, SIEMPRE la misma (determinista, sin Math.random), sembrada
 * con el hashId compartido de islandLayout.js — la única fuente de
 * «aleatoriedad» aparente de todo el juego.
 *
 * Geometría: N puntos angulares (12–16, según el id) repartidos alrededor del
 * centro, con el radio jitterreado entre el 55% y el 100% del radio nominal y
 * un pequeño temblor angular; los puntos se suavizan con Catmull-Rom→Bézier
 * para que la costa sea orgánica (calas y cabos, nunca picos de estrella).
 *
 * ViewBox nominal: 0 0 100 100, centrado en (50, 50). Con `scale` se generan
 * las capas concéntricas del dibujo (bajío exterior, línea de sonda, playa
 * interior) SIN cambiar la forma: es una homotecia sobre el mismo contorno.
 */
import { hashId } from './islandLayout.js';

/**
 * Parámetros por defecto de la mancha: nº de puntos de costa (el id elige
 * dentro del rango), radio nominal (40 sobre viewBox de 100: la capa de bajío
 * escalada ~1.2 sigue cabiendo sin recortes), rango de jitter radial
 * (55%–100% del nominal: asimetría clara sin agujeros) y temblor angular
 * (±25% del paso entre puntos: rompe la regularidad del polígono).
 */
export const BLOB_DEFAULTS = Object.freeze({
  minPoints: 12,
  maxPoints: 16,
  radius: 40,
  minFactor: 0.55,
  maxFactor: 1,
  angleJitter: 0.25,
  center: 50,
});

/**
 * PRNG mulberry32: generador determinista sembrado con un entero de 32 bits.
 * Mismo seed → misma secuencia SIEMPRE (entre sesiones y re-renders). Es la
 * pieza que garantiza que cada isla conserve su costa para toda la vida.
 *
 * @param {number} seed Entero de 32 bits (p. ej. hashId(id)).
 * @returns {() => number} Función que devuelve valores en [0, 1).
 */
export function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Puntos de costa DETERMINISTAS de una isla: N vértices alrededor del centro,
 * con radio y ángulo jitterreados por el PRNG sembrado con hashId(id). Son los
 * puntos de anclaje ANTES del suavizado (islandBlobPath los interpola).
 *
 * @param {string} id Id de la isla (cualquier string no vacío; '/' permitido).
 * @param {{ radius?: number, center?: number }} [opts]
 * @returns {{ x: number, y: number }[]} Vértices en el viewBox 0..100.
 */
export function islandBlobPoints(id, opts = {}) {
  const radius = opts.radius ?? BLOB_DEFAULTS.radius;
  const center = opts.center ?? BLOB_DEFAULTS.center;
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new Error(`Radio inválido para islandBlobPoints: "${radius}"`);
  }
  const rand = mulberry32(hashId(id));
  const span = BLOB_DEFAULTS.maxPoints - BLOB_DEFAULTS.minPoints + 1;
  const count = BLOB_DEFAULTS.minPoints + Math.floor(rand() * span);
  const step = (2 * Math.PI) / count;
  return Array.from({ length: count }, (_, i) => {
    const angle = i * step + (rand() - 0.5) * 2 * BLOB_DEFAULTS.angleJitter * step;
    const factor = BLOB_DEFAULTS.minFactor + rand() * (BLOB_DEFAULTS.maxFactor - BLOB_DEFAULTS.minFactor);
    const r = radius * factor;
    return { x: center + Math.cos(angle) * r, y: center + Math.sin(angle) * r };
  });
}

/** Redondeo a 2 decimales para el path (strings compactos y testeables). */
const round2 = (v) => Math.round(v * 100) / 100;

/**
 * Path SVG CERRADO de la mancha de una isla: la costa de islandBlobPoints
 * suavizada con Catmull-Rom→Bézier (tensión estándar 1/6, curva cerrada:
 * cada tramo usa a sus dos vecinos como tangentes). Determinista: misma id →
 * mismo path SIEMPRE. Valores redondeados a 2 decimales.
 *
 * @param {string} id Id de la isla.
 * @param {{ scale?: number, radius?: number, center?: number }} [opts]
 *   `scale` aplica una homotecia sobre el centro SIN cambiar la forma: >1 para
 *   el bajío/orilla exterior, <1 para la playa interior.
 * @returns {string} Path SVG (M … C … Z) en el viewBox nominal 0 0 100 100.
 */
export function islandBlobPath(id, opts = {}) {
  const scale = opts.scale ?? 1;
  const center = opts.center ?? BLOB_DEFAULTS.center;
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new Error(`Escala inválida para islandBlobPath: "${scale}"`);
  }
  const pts = islandBlobPoints(id, opts).map((p) => ({
    x: center + (p.x - center) * scale,
    y: center + (p.y - center) * scale,
  }));
  const n = pts.length;
  const parts = [`M ${round2(pts[0].x)} ${round2(pts[0].y)}`];
  for (let i = 0; i < n; i += 1) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    parts.push(
      `C ${round2(c1x)} ${round2(c1y)}, ${round2(c2x)} ${round2(c2y)}, ${round2(p2.x)} ${round2(p2.y)}`,
    );
  }
  return `${parts.join(' ')} Z`;
}
