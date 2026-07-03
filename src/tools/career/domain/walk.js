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
/** Velocidad angular del giro sobre uno mismo con ←/→ (radianes por segundo). */
export const TURN_SPEED = 2.5;
/** Altura de los ojos sobre el suelo (unidades de mundo, escala humana). */
export const EYE_HEIGHT = 1.7;
/** Radio (unidades de mundo) para considerar «cerca» una ciudad al caminar. */
export const PROXIMITY_RADIUS = 8;
/**
 * Alineación mínima para considerar que una casa se empuja DE FRENTE al
 * chocar: coseno entre el avance y la normal ENTRANTE de la superficie en el
 * punto de contacto (0.75 ≈ ±41° respecto a la perpendicular de la «pared»).
 * Un roce tangencial desliza sin «entrar»; un empuje frontal abre la puerta.
 */
export const CITY_ENTER_ALIGNMENT = 0.75;
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
 * Normaliza un ángulo a (-π, π]: mismo dominio que atan2, para que los yaws no
 * crezcan sin límite en paseos o giros largos.
 * @param {number} angle Ángulo en radianes.
 * @returns {number} Ángulo equivalente en (-π, π].
 */
function normalizeYaw(angle) {
  const raw = angle % (2 * Math.PI);
  if (raw > Math.PI) return raw - 2 * Math.PI;
  if (raw <= -Math.PI) return raw + 2 * Math.PI;
  return raw;
}

/**
 * Un paso de giro sobre uno mismo (controles tipo DOOM): avanza el yaw según
 * la dirección (+1 gira a la izquierda, -1 a la derecha) a velocidad angular
 * constante y normaliza el resultado a (-π, π] para que el ángulo no crezca
 * sin límite en paseos largos.
 *
 * @param {number} yaw Yaw actual (radianes).
 * @param {number} dir Sentido del giro: +1 izquierda, -1 derecha (0 = quieto).
 * @param {number} dt Delta de tiempo en segundos.
 * @param {number} speed Velocidad angular (radianes por segundo).
 * @returns {number} Nuevo yaw en (-π, π].
 */
export function turnYaw(yaw, dir, dt, speed) {
  if (!Number.isFinite(speed) || speed <= 0) {
    throw new Error(`Velocidad de giro inválida para turnYaw: "${speed}"`);
  }
  return normalizeYaw(yaw + dir * speed * dt);
}

/**
 * Un paso de giro HACIA un yaw objetivo por el arco más corto (MC-10): el
 * avatar de la vista aérea rota suavemente hacia su dirección de marcha. El
 * giro avanza a velocidad angular constante y NUNCA se pasa del objetivo (si
 * el paso llega, se clava en él): sin oscilaciones alrededor del destino.
 *
 * @param {number} yaw Yaw actual (radianes).
 * @param {number} targetYaw Yaw objetivo (radianes, cualquier vuelta).
 * @param {number} dt Delta de tiempo en segundos.
 * @param {number} speed Velocidad angular (radianes por segundo).
 * @returns {number} Nuevo yaw en (-π, π].
 */
export function yawToward(yaw, targetYaw, dt, speed) {
  if (!Number.isFinite(speed) || speed <= 0) {
    throw new Error(`Velocidad de giro inválida para yawToward: "${speed}"`);
  }
  const delta = normalizeYaw(targetYaw - yaw);
  const step = speed * Math.max(dt, 0);
  if (Math.abs(delta) <= step) return normalizeYaw(targetYaw);
  return normalizeYaw(yaw + Math.sign(delta) * step);
}

/**
 * Colisión del caminante con las casas de la isla (MC-9): las casas no se
 * atraviesan. Cada ciudad es un cilindro de colisión de radio `radius`; si el
 * paso pos→nextPos acaba dentro de una casa, la posición se proyecta
 * radialmente sobre su borde: la componente tangencial se conserva, así que se
 * DESLIZA por el contorno en vez de clavarse (misma estrategia que el borde de
 * la costa en stepPosition, pero hacia FUERA del círculo).
 *
 * Además detecta el empuje FRONTAL: si el avance empuja CONTRA la pared en el
 * punto de contacto (coseno con la normal entrante ≥ CITY_ENTER_ALIGNMENT),
 * `hitCityId` lleva su id — es la señal de «entrar» (abrir la ciudadanía). Un
 * roce lateral desliza con `hitCityId` null.
 *
 * @template {{ id: string, wx: number, wz: number }} T
 * @param {WalkPoint} pos Posición actual (antes del paso).
 * @param {WalkPoint} nextPos Posición deseada (después del paso).
 * @param {T[]} cities Ciudades con su posición de mundo (wx, wz).
 * @param {number} radius Radio de colisión de una casa (unidades de mundo).
 * @returns {{ x: number, z: number, hitCityId: string|null }} Posición corregida
 *   y, si el avance empuja de frente contra una casa, su id.
 */
export function collideWithCities(pos, nextPos, cities, radius) {
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new Error(`Radio de colisión inválido para collideWithCities: "${radius}"`);
  }
  let x = nextPos.x;
  let z = nextPos.z;
  let hitCityId = null;
  const moveX = nextPos.x - pos.x;
  const moveZ = nextPos.z - pos.z;
  const moveLen = Math.hypot(moveX, moveZ);
  for (const city of cities) {
    const dx = x - city.wx;
    const dz = z - city.wz;
    const dist = Math.hypot(dx, dz);
    if (dist >= radius) continue;
    if (dist < 1e-9) {
      // Degenerado (justo en el eje de la casa): se expulsa hacia la posición
      // previa o, sin dirección posible, hacia +x (determinista).
      const backX = pos.x - city.wx;
      const backZ = pos.z - city.wz;
      const backLen = Math.hypot(backX, backZ);
      x = city.wx + (backLen > 1e-9 ? backX / backLen : 1) * radius;
      z = city.wz + (backLen > 1e-9 ? backZ / backLen : 0) * radius;
    } else {
      // Proyección radial al borde del círculo → deslizamiento por el contorno.
      const s = radius / dist;
      x = city.wx + dx * s;
      z = city.wz + dz * s;
    }
    // ¿Empuje frontal? El avance empuja contra la pared: coseno entre la
    // dirección del movimiento y la normal ENTRANTE de la superficie en el
    // punto de contacto (independiente de lo lejos que estuviera pos).
    if (moveLen > 1e-9) {
      const normalX = (x - city.wx) / radius;
      const normalZ = (z - city.wz) / radius;
      if (-(moveX * normalX + moveZ * normalZ) / moveLen >= CITY_ENTER_ALIGNMENT) {
        hitCityId = city.id;
      }
    }
  }
  return { x, z, hitCityId };
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

/** Ángulo áureo (radianes): reparte puntos en espiral sin patrones visibles. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * Valor pseudoaleatorio DETERMINISTA en [0, 1) a partir de una semilla y un
 * índice (mezcla de enteros estilo splitmix/murmur, sin estado). Es la fuente
 * de «aleatoriedad» del scatter de vegetación: nada de Math.random(), la misma
 * pareja (seed, i) produce siempre el mismo valor entre sesiones y renders.
 *
 * @param {number} seed Semilla (entero de 32 bits; hashId de layout vale).
 * @param {number} i Índice del elemento.
 * @returns {number} Valor en [0, 1).
 */
export function hashUnit(seed, i) {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ i, 2654435761);
  h ^= h >>> 13;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * Posiciones dispersas DETERMINISTAS para vegetación y props (MC-10): espiral
 * de girasol (radio ∝ √i, ángulo áureo) con jitter por hash, que reparte los
 * puntos de forma natural por el disco sin patrones visibles ni RNG. Los
 * candidatos que caen dentro de alguna exclusión (casas, puerto, senda) se
 * descartan; si las exclusiones se comen demasiados candidatos se devuelven
 * menos de `count` posiciones (no es un error: la isla está llena).
 *
 * @param {number} count Posiciones deseadas (entero ≥ 0).
 * @param {number} maxRadius Radio máximo del disco (p. ej. el borde de la hierba).
 * @param {{ x: number, z: number, r: number }[]} exclusions Círculos vetados.
 * @param {number} seed Semilla determinista (misma semilla → mismo scatter).
 * @returns {WalkPoint[]} Posiciones en el plano del suelo (≤ count).
 */
export function scatterPositions(count, maxRadius, exclusions, seed) {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`Cantidad inválida para scatterPositions: "${count}"`);
  }
  if (!Number.isFinite(maxRadius) || maxRadius <= 0) {
    throw new Error(`Radio inválido para scatterPositions: "${maxRadius}"`);
  }
  if (!Number.isFinite(seed)) {
    throw new Error(`Semilla inválida para scatterPositions: "${seed}"`);
  }
  const list = exclusions ?? [];
  /** @type {WalkPoint[]} */
  const positions = [];
  if (count === 0) return positions;
  const excluded = (x, z) => list.some((ex) => Math.hypot(x - ex.x, z - ex.z) < ex.r);
  // La semilla también rota la espiral completa: dos scatters con semillas
  // distintas no comparten ninguna dirección.
  const spin = hashUnit(seed, 0) * 2 * Math.PI;
  // Jitter radial acotado a ~medio paso de la espiral (no rompe el reparto).
  const jitterR = (maxRadius / Math.sqrt(count)) * 0.5;
  // Pasada 1 — espiral de girasol sobre el disco COMPLETO (radio ∝ √i cubre
  // de centro a borde con densidad uniforme): reparto natural y sin patrones.
  for (let i = 0; i < count; i += 1) {
    const r =
      maxRadius * Math.sqrt((i + 0.5) / count) + (hashUnit(seed, i * 2 + 1) - 0.5) * 2 * jitterR;
    const angle = spin + i * GOLDEN_ANGLE + (hashUnit(seed, i * 2 + 2) - 0.5) * 0.5;
    const x = Math.cos(angle) * Math.min(Math.max(r, 0), maxRadius);
    const z = Math.sin(angle) * Math.min(Math.max(r, 0), maxRadius);
    if (excluded(x, z)) continue;
    positions.push({ x, z });
  }
  // Pasada 2 — repone los candidatos comidos por las exclusiones con puntos
  // uniformes en el disco (r ∝ √u), también por hash: sigue siendo determinista.
  for (let i = 0; i < count * 3 && positions.length < count; i += 1) {
    const base = (count + i) * 2;
    const r = maxRadius * Math.sqrt(hashUnit(seed, base + 1));
    const angle = hashUnit(seed, base + 2) * 2 * Math.PI;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    if (excluded(x, z)) continue;
    positions.push({ x, z });
  }
  return positions;
}
