/**
 * Celebración de ciudadanía (MC-11): lógica PURA y DETERMINISTA que consume
 * <career-island-3d> cuando una ciudad acaba de pasar a visitada.
 *
 *  - `justVisitedCity` detecta, por diff de visitedCities (anterior vs nuevo),
 *    la ciudad que ACABA de conseguir la ciudadanía. Solo reconoce el gesto de
 *    «marcar como visitada» (el conjunto anterior + exactamente una ciudad):
 *    cargar el journey de OTRA persona (conjuntos que pierden o cambian varias
 *    ciudades) no dispara celebraciones espurias.
 *  - `confettiParticles` deriva las trayectorias del confeti de hash+índice
 *    (hashUnit de walk.js): la MISMA ciudad produce SIEMPRE la misma lluvia de
 *    confeti — en la escena no hay Math.random (el audio es la única excepción,
 *    ver islandAudio.js).
 *  - `confettiPosition` evalúa la posición de una partícula en el tiempo con
 *    balística simple (brote hacia arriba/afuera + gravedad), sin estado: el
 *    componente 3D solo mapea posiciones a matrices de instancia.
 */
import { hashUnit } from './walk.js';

/** Parámetros de la celebración: duración, confeti y balística. */
export const CELEBRATION = Object.freeze({
  /** Duración total (s) de la celebración (pulso + confeti). */
  durationS: 2.2,
  /** Fundido de salida del confeti (s finales de la celebración). */
  fadeS: 0.5,
  /** Número de partículas de confeti. */
  count: 64,
  /** Gravedad (unidades/s²) de la caída del confeti. */
  gravity: 7.5,
});

/**
 * Variantes de celebración (MC-20). La de siempre ('city', MC-11) celebra un
 * CERTIFICADO; la MAYOR ('island') celebra la CIUDADANÍA de la isla: dura más
 * y suelta bastante más confeti (la fanfarria larga vive en islandAudio.js,
 * misma clave de variante). Misma balística y mismo determinismo.
 * @type {Readonly<Record<'city'|'island', typeof CELEBRATION>>}
 */
export const CELEBRATION_VARIANTS = Object.freeze({
  city: CELEBRATION,
  island: Object.freeze({
    durationS: 4.2,
    fadeS: 0.9,
    count: 180,
    gravity: 7.5,
  }),
});

/** Número de colores del confeti (paleta GREBLA: teal, coral, navy, dorado). */
export const CONFETTI_COLOR_COUNT = 4;

/**
 * Ciudad que ACABA de pasar a visitada, o null. Solo reconoce el gesto de
 * «marcar como visitada»: el conjunto nuevo debe ser EXACTAMENTE el anterior
 * más una ciudad. Cualquier otra transición (quitar de visitadas, cargar el
 * journey de otra persona, resets) devuelve null.
 * @param {string[]|undefined} prevVisited visitedCities anterior.
 * @param {string[]|undefined} nextVisited visitedCities nuevo.
 * @returns {string|null} id de la ciudad recién visitada, o null.
 */
export function justVisitedCity(prevVisited, nextVisited) {
  const prev = new Set(prevVisited ?? []);
  const next = nextVisited ?? [];
  if (next.length !== prev.size + 1) return null;
  const added = next.filter((id) => !prev.has(id));
  // Con |next| = |prev| + 1, exactamente un añadido garantiza que ninguna
  // ciudad anterior desapareció (no hay hueco que rellenar con duplicados).
  return added.length === 1 ? added[0] : null;
}

/**
 * @typedef {object} ConfettiParticle
 * @property {number} x0 Desplazamiento inicial en x respecto a la casa.
 * @property {number} z0 Desplazamiento inicial en z respecto a la casa.
 * @property {number} vx Velocidad horizontal en x (unidades/s).
 * @property {number} vz Velocidad horizontal en z (unidades/s).
 * @property {number} vy Velocidad vertical inicial (unidades/s, hacia arriba).
 * @property {number} spin Velocidad de giro (rad/s) del plano de confeti.
 * @property {number} tilt Inclinación inicial (rad) del plano.
 * @property {number} colorIndex Índice de color 0..CONFETTI_COLOR_COUNT-1.
 */

/**
 * Trayectorias del confeti, DETERMINISTAS por semilla e índice (hashUnit):
 * brotan del tejado hacia arriba y afuera en abanico y caen con gravedad.
 * @param {number} seed Semilla (p. ej. hashId de la ciudad celebrada).
 * @param {number} [count] Número de partículas (por defecto CELEBRATION.count).
 * @returns {ConfettiParticle[]}
 */
export function confettiParticles(seed, count = CELEBRATION.count) {
  const particles = [];
  for (let i = 0; i < count; i += 1) {
    const angle = hashUnit(seed, i * 7) * Math.PI * 2;
    const radial = 0.6 + hashUnit(seed, i * 7 + 1) * 1.7;
    particles.push({
      x0: (hashUnit(seed, i * 7 + 2) - 0.5) * 1.6,
      z0: (hashUnit(seed, i * 7 + 3) - 0.5) * 1.6,
      vx: Math.cos(angle) * radial,
      vz: Math.sin(angle) * radial,
      vy: 3.2 + hashUnit(seed, i * 7 + 4) * 3.2,
      spin: 2 + hashUnit(seed, i * 7 + 5) * 6,
      tilt: hashUnit(seed, i * 7 + 6) * Math.PI,
      colorIndex: i % CONFETTI_COLOR_COUNT,
    });
  }
  return particles;
}

/**
 * Posición de una partícula de confeti en el instante t (balística simple):
 * sale de la altura del tejado, sube frenando y cae con gravedad. Nunca se
 * hunde bajo el suelo (queda posada a ras).
 * @param {ConfettiParticle} p
 * @param {number} t Segundos desde el inicio de la celebración.
 * @param {number} topY Altura (y local) del tejado del que brota el confeti.
 * @returns {{x: number, y: number, z: number}}
 */
export function confettiPosition(p, t, topY) {
  return {
    x: p.x0 + p.vx * t,
    y: Math.max(topY + p.vy * t - 0.5 * CELEBRATION.gravity * t * t, 0.05),
    z: p.z0 + p.vz * t,
  };
}
