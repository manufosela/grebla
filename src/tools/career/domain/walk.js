/**
 * Lógica PURA del modo primera persona (MC-7): caminar por la isla sin Three
 * ni DOM, testeable en Vitest.
 *
 * Es la ÚNICA fuente de verdad del perfil del terreno: <career-island-3d>
 * construye las mallas de hierba y playa con estos mismos parámetros
 * (TERRAIN + coastFactor), de modo que el suelo que se pinta y el suelo que
 * pisa el caminante son LA MISMA función. Si se cambia la forma de la isla,
 * se cambia aquí y ambos se mueven a la vez.
 *
 * Modelo del terreno (alturas de mundo, eje Y):
 *  - Meseta de hierba: cilindro troncocónico (radio superior R, inferior R+3,
 *    alto 2.4) asentado en baseY=1 → superficie plana a y=2.2 hasta ~R y
 *    talud hasta y=-0.2 en ~R+3.
 *  - Playa: cilindro (radio superior R+4, inferior R+8, alto 2) en baseY=1 →
 *    llano de arena a y=2 hasta ~R+4 y pendiente hasta y=0 en ~R+8.
 *  - Agua: disco a y=0.6 alrededor de todo.
 * La costa es irregular: cada radio se multiplica por coastFactor(angle),
 * determinista (sin RNG), igual que hace la geometría low-poly.
 *
 * @typedef {{ x: number, z: number }} WalkPoint  Posición 2D en el plano del suelo.
 * @typedef {{ radius: number }} WalkBounds       Límite circular del área caminable.
 * @typedef {{ radius: number }} IslandParams     Radio lógico de la isla (islandRadius del layout).
 */

/** Velocidad al caminar (unidades de mundo por segundo). */
export const WALK_SPEED = 8;
/** Multiplicador de velocidad al correr (Shift). */
export const RUN_MULTIPLIER = 1.8;
/** Altura de los ojos sobre el suelo (unidades de mundo, escala humana). */
export const EYE_HEIGHT = 1.7;
/** Radio (unidades de mundo) para considerar «cerca» una ciudad al caminar. */
export const PROXIMITY_RADIUS = 8;
/** Margen de seguridad respecto al borde llano de la playa (no pisar el talud). */
export const WALK_EDGE_MARGIN = 1;

/**
 * Perfil del terreno de la isla. Cada capa es un cilindro troncocónico:
 * radios superior/inferior relativos al radio R de la isla (topPad/bottomPad),
 * alto de la capa y amplitud del desplazamiento de costa. `baseY` es la y de
 * mundo donde se asienta el CENTRO de ambos cilindros (mesh.position.y).
 */
export const TERRAIN = Object.freeze({
  baseY: 1,
  grass: Object.freeze({ topPad: 0, bottomPad: 3, height: 2.4, amount: 0.04 }),
  beach: Object.freeze({ topPad: 4, bottomPad: 8, height: 2, amount: 0.05 }),
  waterY: 0.6,
});

/**
 * Factor determinista de irregularidad de costa: cuánto se expande (>1) o
 * contrae (<1) el radio en un ángulo dado. Es la fórmula con la que la vista
 * 3D desplaza los vértices del perímetro (sin RNG: estable entre renders).
 * Acotado en [1 - 1.6·amount, 1 + 1.6·amount].
 *
 * @param {number} angle Ángulo polar (radianes), atan2(z, x).
 * @param {number} amount Amplitud relativa (0.05 → ±5% aprox.).
 * @returns {number}
 */
export function coastFactor(angle, amount) {
  return 1 + amount * Math.sin(angle * 4.7) + amount * 0.6 * Math.cos(angle * 7.3);
}

/**
 * Altura de la superficie de una capa troncocónica en un radio/ángulo dados,
 * o -Infinity si el punto queda más allá de su falda (la capa no aporta suelo).
 *
 * @param {{ topPad: number, bottomPad: number, height: number, amount: number }} layer
 * @param {number} R Radio de la isla.
 * @param {number} r Distancia del punto al centro.
 * @param {number} angle Ángulo polar del punto.
 * @returns {number}
 */
function layerHeight(layer, R, r, angle) {
  const k = coastFactor(angle, layer.amount);
  const topR = (R + layer.topPad) * k;
  const bottomR = (R + layer.bottomPad) * k;
  const top = TERRAIN.baseY + layer.height / 2;
  if (r <= topR) return top;
  if (r >= bottomR) return -Infinity;
  const bottom = TERRAIN.baseY - layer.height / 2;
  return top + ((bottom - top) * (r - topR)) / (bottomR - topR);
}

/**
 * Altura del suelo VISIBLE en un punto del plano XZ: el máximo de las capas
 * (la meseta de hierba sobresale de la playa; el talud de hierba desaparece
 * bajo el llano de arena). Más allá de la playa devuelve el nivel del agua
 * (allí no se camina: stepPosition acota antes).
 *
 * @param {number} x
 * @param {number} z
 * @param {IslandParams} islandParams Radio de la isla (el de islandRadius()).
 * @returns {number} Altura y de mundo del suelo.
 */
export function groundHeightAt(x, z, islandParams) {
  const R = islandParams?.radius;
  if (!Number.isFinite(R) || R <= 0) {
    throw new Error(`Radio de isla inválido para groundHeightAt: "${R}"`);
  }
  const r = Math.hypot(x, z);
  const angle = Math.atan2(z, x);
  const h = Math.max(
    layerHeight(TERRAIN.grass, R, r, angle),
    layerHeight(TERRAIN.beach, R, r, angle),
  );
  return h === -Infinity ? TERRAIN.waterY : h;
}

/**
 * Radio caminable de la isla: el mayor círculo centrado en el origen que se
 * queda SIEMPRE (para cualquier ángulo, pese a la costa irregular) sobre el
 * llano de arena o más adentro, con un margen de seguridad. Así el caminante
 * nunca pisa el talud de la playa ni el agua.
 *
 * @param {number} islandR Radio de la isla (islandRadius del layout).
 * @returns {number}
 */
export function walkableRadius(islandR) {
  if (!Number.isFinite(islandR) || islandR <= 0) {
    throw new Error(`Radio de isla inválido para walkableRadius: "${islandR}"`);
  }
  const minCoast = 1 - 1.6 * TERRAIN.beach.amount; // cota inferior de coastFactor
  return (islandR + TERRAIN.beach.topPad) * minCoast - WALK_EDGE_MARGIN;
}

/**
 * Un paso de caminante: normaliza la dirección, avanza velocidad×dt y ACOTA
 * al círculo caminable. Si el paso saldría del límite, la posición se proyecta
 * radialmente sobre el borde: la componente tangencial se conserva, así que se
 * DESLIZA por la costa en vez de frenar en seco.
 *
 * @param {WalkPoint} pos Posición actual.
 * @param {WalkPoint} dir Dirección deseada (no hace falta normalizarla).
 * @param {number} dt Delta de tiempo en segundos.
 * @param {number} speed Velocidad en unidades por segundo.
 * @param {WalkBounds} bounds Límite circular (walkableRadius).
 * @returns {WalkPoint} Nueva posición.
 */
export function stepPosition(pos, dir, dt, speed, bounds) {
  const radius = bounds?.radius;
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new Error(`Límite caminable inválido para stepPosition: "${radius}"`);
  }
  const len = Math.hypot(dir.x, dir.z);
  if (len === 0 || dt <= 0) return { x: pos.x, z: pos.z };
  const nx = pos.x + (dir.x / len) * speed * dt;
  const nz = pos.z + (dir.z / len) * speed * dt;
  const r = Math.hypot(nx, nz);
  if (r <= radius) return { x: nx, z: nz };
  const s = radius / r; // proyección radial al borde → deslizamiento tangencial
  return { x: nx * s, z: nz * s };
}

/**
 * Ciudad más cercana a una posición dentro de un radio máximo, o null si no
 * hay ninguna tan cerca. Para el resalte de proximidad y el prompt «[E] Ver
 * ciudadanía» del modo primera persona.
 *
 * @template {{ wx: number, wz: number }} T
 * @param {WalkPoint} pos
 * @param {T[]} cities Ciudades con su posición de mundo (wx, wz).
 * @param {number} maxDist
 * @returns {T|null}
 */
export function nearestCityWithin(pos, cities, maxDist) {
  let best = null;
  let bestDist = maxDist;
  for (const city of cities) {
    const d = Math.hypot(city.wx - pos.x, city.wz - pos.z);
    if (d <= bestDist) {
      best = city;
      bestDist = d;
    }
  }
  return best;
}
