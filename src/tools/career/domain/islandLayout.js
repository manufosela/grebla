/**
 * Layout 3D de la isla de carrera (funciones PURAS, sin Three ni DOM).
 *
 * Convierte el modelo lógico del mapa (x, y en 0..100) al espacio de mundo 3D
 * que consume <career-island-3d>: el plano del suelo es XZ (la y lógica del
 * mapa pasa a ser la z del mundo) y la altura es el eje Y. El mundo queda
 * centrado en el origen para que la cámara orbite alrededor de (0, 0, 0).
 *
 * También resuelve los colores por estado de ciudad (paleta --rm-* de GREBLA)
 * y la geometría lógica de comarcas e isla (centroides, radios). Aquí no hay
 * ningún conocimiento de Three.js ni de WebGL: todo es testeable en Vitest.
 *
 * @typedef {import('./types.js').CareerMap} CareerMap
 * @typedef {import('./types.js').Area} Area
 * @typedef {{ wx: number, wz: number }} WorldPoint  Punto de mundo en el plano XZ.
 * @typedef {{ size?: number }} WorldOptions
 * @typedef {{ area: Area, center: WorldPoint, radius: number, color: number }} AreaLayout
 * @typedef {{ wx: number, wz: number, distance: number, elevation: number }} FocusFrame
 *   Encuadre de foco de cámara: punto del suelo a mirar, distancia de cámara y
 *   elevación (radianes sobre el plano del suelo).
 */

/** Lado del mundo: el rango lógico 0..100 se proyecta a -WORLD_SIZE/2..WORLD_SIZE/2. */
export const WORLD_SIZE = 100;
/** Margen (unidades de mundo) alrededor de las ciudades de una comarca (su plataforma). */
export const AREA_PAD = 8;
/** Margen de playa: distancia extra entre la envolvente del contenido y el borde de la isla. */
export const BEACH_MARGIN = 12;
/** Radio mínimo de la isla (mapas vacíos o muy pequeños siguen siendo una isla visible). */
export const MIN_ISLAND_RADIUS = 20;

/**
 * Colores por estado de ciudad. Mapean la paleta CSS --rm-* del proyecto:
 *  - visited:    --rm-accent  #2a9d8f (teal GREBLA)
 *  - available:  --gr-coral   #f2887a
 *  - blocked:    --rm-track   #d7dee2 (gris de la leyenda)
 *  - deprecated: --rm-danger  #dc2626 atenuado al 50% sobre blanco → #ed9292
 *    (equivalente al `opacity: 0.5` que usa la vista 2.5D sobre fondo claro,
 *    pero horneado en el color para no depender de transparencias en 3D).
 */
export const STATUS_COLORS = Object.freeze({
  visited: 0x2a9d8f,
  available: 0xf2887a,
  blocked: 0xd7dee2,
  deprecated: 0xed9292,
});

/** Acentos overlay (no son estados): ciudad actual y ruta planificada. */
export const ACCENT_COLORS = Object.freeze({
  current: 0xe26d5e, // --rm-coral-600
  route: 0x1e3a5f, // --rm-navy
});

/**
 * Proyecta una coordenada lógica del mapa (0..100) al plano XZ del mundo,
 * centrado en el origen: 50 → 0, 0 → -size/2, 100 → +size/2.
 *
 * @param {number} x Coordenada lógica 0..100.
 * @param {number} y Coordenada lógica 0..100 (pasa a ser z del mundo).
 * @param {WorldOptions} [opts] size: lado del mundo (por defecto WORLD_SIZE).
 * @returns {WorldPoint}
 */
export function worldFromMap(x, y, opts = {}) {
  const size = opts.size ?? WORLD_SIZE;
  const scale = size / 100;
  return { wx: (x - 50) * scale, wz: (y - 50) * scale };
}

/**
 * Color (hex numérico para materiales 3D) de una ciudad según su estado.
 * Falla en alto si llega un estado desconocido: sin fallbacks silenciosos.
 *
 * @param {'visited'|'available'|'blocked'|'deprecated'} status
 * @returns {number}
 */
export function cityStatusColor(status) {
  const color = STATUS_COLORS[status];
  if (color === undefined) {
    throw new Error(`Estado de ciudad desconocido para el color 3D: "${status}"`);
  }
  return color;
}

/**
 * Convierte HSL a un color hex numérico (0xRRGGBB). Interno pero exportado
 * para poder testear el determinismo de los colores de comarca.
 *
 * @param {number} h Tono 0..360.
 * @param {number} s Saturación 0..100.
 * @param {number} l Luminosidad 0..100.
 * @returns {number}
 */
export function hslToHex(h, s, l) {
  const sat = s / 100;
  const lig = l / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to255 = (v) => Math.round(v * 255);
  return (to255(f(0)) << 16) | (to255(f(8)) << 8) | to255(f(4));
}

/**
 * Color suave y determinista para la plataforma de una comarca, repartiendo
 * el tono por índice (misma estrategia que la vista 2.5D: hue equiespaciado,
 * saturación y luminosidad fijas para que el terreno no compita con las ciudades).
 *
 * @param {number} index Índice de la comarca en map.areas.
 * @param {number} total Número total de comarcas.
 * @returns {number} Color hex numérico.
 */
export function areaColor(index, total) {
  const hue = Math.round((index * 360) / Math.max(total, 1));
  return hslToHex(hue, 45, 82);
}

/**
 * Layout de las comarcas: para cada comarca CON ciudades, su centroide en
 * coordenadas de mundo, el radio que envuelve a sus ciudades (+ AREA_PAD) y
 * su color suave determinista. Las comarcas sin ciudades se omiten (no hay
 * nada que pintar debajo).
 *
 * @param {CareerMap} map
 * @param {WorldOptions} [opts]
 * @returns {AreaLayout[]}
 */
export function areaLayout(map, opts = {}) {
  const areas = map?.areas ?? [];
  const groups = Object.groupBy(map?.cities ?? [], (c) => c.area);
  return areas
    .map((area, i) => {
      const cities = groups[area.id] ?? [];
      if (cities.length === 0) return null;
      const pts = cities.map((c) => worldFromMap(c.x, c.y, opts));
      const cx = pts.reduce((s, p) => s + p.wx, 0) / pts.length;
      const cz = pts.reduce((s, p) => s + p.wz, 0) / pts.length;
      const spread = pts.reduce((m, p) => Math.max(m, Math.hypot(p.wx - cx, p.wz - cz)), 0);
      return {
        area,
        center: { wx: cx, wz: cz },
        radius: spread + AREA_PAD,
        color: areaColor(i, areas.length),
      };
    })
    .filter((a) => a !== null);
}

/**
 * Hash determinista (FNV-1a de 32 bits) de un id de ciudad. Es la ÚNICA fuente
 * de aleatoriedad aparente de la escena: nada de Math.random(), el mismo id
 * produce siempre la misma variación entre sesiones y re-renders.
 *
 * @param {string} id
 * @returns {number} Entero sin signo de 32 bits.
 */
export function hashId(id) {
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error(`Id inválido para hashId: "${id}"`);
  }
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Variación visual determinista de la casa de una ciudad (MC-8): cada ciudad
 * tiene una altura, una rotación extra y un tono ligeramente distintos, en
 * función únicamente de su id (bytes independientes del hash).
 *
 *  - height: factor de altura del cuerpo, 0.9..1.2
 *  - rotation: yaw extra sobre la orientación base, ±0.3 rad
 *  - tone: multiplicador de color en 5 pasos, 0.92..1.08 (cuantizado para que
 *    la caché de materiales por color siga siendo pequeña)
 *
 * @param {string} cityId
 * @returns {{ height: number, rotation: number, tone: number }}
 */
export function cityVariant(cityId) {
  const h = hashId(cityId);
  const byte = (shift) => (h >>> shift) & 0xff;
  return {
    height: 0.9 + (byte(0) / 255) * 0.3,
    rotation: (byte(8) / 255 - 0.5) * 0.6,
    tone: 0.92 + (Math.round((byte(16) / 255) * 4) / 4) * 0.16,
  };
}

/**
 * Yaw de fachada de una casa para que su puerta y placa miren HACIA el puerto
 * (el punto de llegada del caminante, MC-9). Convención de <career-island-3d>:
 * la fachada es la cara +z local del nodo, y con rotation.y = yaw esa cara
 * apunta a la dirección de mundo (sin(yaw), cos(yaw)) — de ahí atan2(dx, dz).
 * Si la casa está exactamente sobre el puerto no hay dirección definida y se
 * devuelve 0 (determinista, no es un error de datos).
 *
 * @param {WorldPoint} housePos Posición de mundo de la casa.
 * @param {WorldPoint} portPos Posición de mundo del puerto (o del extremo del muelle).
 * @returns {number} Yaw (radianes) para que la fachada mire al puerto.
 */
export function facadeYawToward(housePos, portPos) {
  const dx = portPos?.wx - housePos?.wx;
  const dz = portPos?.wz - housePos?.wz;
  if (!Number.isFinite(dx) || !Number.isFinite(dz)) {
    throw new Error(
      `Posiciones inválidas para facadeYawToward: casa (${housePos?.wx}, ${housePos?.wz}), puerto (${portPos?.wx}, ${portPos?.wz})`,
    );
  }
  if (Math.hypot(dx, dz) < 1e-9) return 0;
  return Math.atan2(dx, dz);
}

/**
 * Arco de compañeros frente a la fachada de una casa (MC-12): radio desde el
 * eje de la casa (fuera del radio de colisión, ~2.5, sin invadir la puerta) y
 * apertura total del arco. En coordenadas LOCALES de la casa la fachada es la
 * cara +z (la misma convención que facadeYawToward).
 */
export const TEAMMATE_ARC = Object.freeze({ radius: 4.4, span: (2 * Math.PI) / 3 });

/**
 * Rango de tonos HSL (grados) para camiseta y gorra de los compañeros (MC-12).
 * Excluye la franja coral (~8°, la gorra coral es EXCLUSIVA del avatar propio):
 * los tonos generados caen siempre en [min, max) y nunca rozan el coral.
 */
export const TEAMMATE_HUE = Object.freeze({ min: 30, max: 330 });

/**
 * Offsets DETERMINISTAS de los compañeros alrededor de una casa (MC-12): un
 * arco frente a la fachada (+z local), centrado en la puerta, para que varios
 * compañeros en la misma ciudad no se solapen. Con 1 compañero queda frente a
 * la puerta; con n, repartidos uniformemente por el arco. `yaw` es el ángulo
 * local del offset (0 = eje de la fachada): rotándolo con el yaw de la casa
 * cada figura queda mirando hacia FUERA (de espaldas a su casa).
 *
 * @param {number} count Número de compañeros en la ciudad (entero ≥ 0).
 * @param {{ radius?: number, span?: number }} [opts] Radio del arco y apertura
 *   total (radianes); por defecto TEAMMATE_ARC.
 * @returns {{ lx: number, lz: number, yaw: number }[]} Offsets locales de la casa.
 */
export function teammateOffsets(count, opts = {}) {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`Cantidad inválida para teammateOffsets: "${count}"`);
  }
  const radius = opts.radius ?? TEAMMATE_ARC.radius;
  const span = opts.span ?? TEAMMATE_ARC.span;
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new Error(`Radio inválido para teammateOffsets: "${radius}"`);
  }
  if (!Number.isFinite(span) || span <= 0 || span > Math.PI * 2) {
    throw new Error(`Apertura de arco inválida para teammateOffsets: "${span}"`);
  }
  return Array.from({ length: count }, (_, i) => {
    const yaw = count === 1 ? 0 : -span / 2 + (span * i) / (count - 1);
    return { lx: Math.sin(yaw) * radius, lz: Math.cos(yaw) * radius, yaw };
  });
}

/**
 * Colores DETERMINISTAS de un compañero (MC-12) a partir de su personId: tono
 * de camiseta y de gorra derivados de bytes independientes del hash, dentro de
 * TEAMMATE_HUE (nunca la gorra coral del avatar propio). Piernas y piel no
 * varían: las aporta la paleta base del componente.
 *
 * @param {string} personId
 * @returns {{ body: number, cap: number }} Colores hex numéricos (materiales 3D).
 */
export function teammateTint(personId) {
  const h = hashId(personId);
  const range = TEAMMATE_HUE.max - TEAMMATE_HUE.min;
  const bodyHue = TEAMMATE_HUE.min + (h % range);
  const capHue = TEAMMATE_HUE.min + ((h >>> 8) % range);
  return { body: hslToHex(bodyHue, 52, 50), cap: hslToHex(capHue, 55, 42) };
}

/**
 * Puntos de mundo (en orden) de una secuencia de ids de ciudad. Los ids que no
 * existen en el mapa se omiten (journeys antiguos pueden referenciar ciudades
 * retiradas del mapa; no es un error de datos). Para dibujar la senda del
 * camino recorrido y la ruta planificada (MC-8).
 *
 * @param {CareerMap} map
 * @param {string[]} cityIds
 * @param {WorldOptions} [opts]
 * @returns {WorldPoint[]}
 */
export function journeyPathPoints(map, cityIds, opts = {}) {
  const byId = new Map((map?.cities ?? []).map((c) => [c.id, c]));
  return (cityIds ?? [])
    .map((id) => byId.get(id))
    .filter((c) => c !== undefined)
    .map((c) => worldFromMap(c.x, c.y, opts));
}

/**
 * Cinta (ribbon) de una polilínea en el plano XZ: para cada punto, sus dos
 * vértices laterales desplazados media anchura en la perpendicular de la
 * dirección local (media de los segmentos adyacentes, así las esquinas no se
 * pellizcan). Con menos de 2 puntos no hay cinta ([]).
 *
 * @param {WorldPoint[]} points
 * @param {number} width Anchura total de la cinta.
 * @returns {{ lx: number, lz: number, rx: number, rz: number }[]}
 */
export function ribbonStrip(points, width) {
  if (!Number.isFinite(width) || width <= 0) {
    throw new Error(`Anchura de cinta inválida para ribbonStrip: "${width}"`);
  }
  if ((points?.length ?? 0) < 2) return [];
  const half = width / 2;
  return points.map((p, i) => {
    const prev = points[Math.max(i - 1, 0)];
    const next = points[Math.min(i + 1, points.length - 1)];
    let dx = next.wx - prev.wx;
    let dz = next.wz - prev.wz;
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) {
      // Puntos coincidentes: dirección arbitraria pero estable.
      dx = 1;
      dz = 0;
    } else {
      dx /= len;
      dz /= len;
    }
    // Perpendicular en el plano XZ (giro de 90°): (-dz, dx).
    return {
      lx: p.wx - dz * half,
      lz: p.wz + dx * half,
      rx: p.wx + dz * half,
      rz: p.wz - dx * half,
    };
  });
}

/**
 * Encuadre de foco de CIUDAD (MC-6): las casas tienen tamaño constante, así que
 * la distancia es fija y la elevación (~38°) muestra fachada y tejado sin
 * aplastar la perspectiva.
 */
export const CITY_FOCUS = Object.freeze({ distance: 34, elevation: (38 * Math.PI) / 180 });

/**
 * Encuadre de foco de COMARCA (MC-6): la distancia escala con el radio de la
 * plataforma (factor ~2.4 ≈ radio/tan(fov/2) para fov vertical de 45°), con un
 * mínimo para comarcas de una sola ciudad, y elevación más aérea (~48°).
 */
export const AREA_FOCUS = Object.freeze({ factor: 2.4, minDistance: 30, elevation: (48 * Math.PI) / 180 });

/**
 * Encuadre de cámara para enfocar una ciudad. Devuelve null si la ciudad no
 * existe en el mapa (el componente decide no animar; no es un error de datos).
 *
 * @param {CareerMap} map
 * @param {string} cityId
 * @param {WorldOptions} [opts]
 * @returns {FocusFrame|null}
 */
export function cityFocusFrame(map, cityId, opts = {}) {
  const city = (map?.cities ?? []).find((c) => c.id === cityId);
  if (!city) return null;
  const { wx, wz } = worldFromMap(city.x, city.y, opts);
  return { wx, wz, distance: CITY_FOCUS.distance, elevation: CITY_FOCUS.elevation };
}

/**
 * Encuadre de cámara para enfocar una comarca (su plataforma completa).
 * Devuelve null si la comarca no existe o no tiene ciudades (areaLayout la omite).
 *
 * @param {CareerMap} map
 * @param {string} areaId
 * @param {WorldOptions} [opts]
 * @returns {FocusFrame|null}
 */
export function areaFocusFrame(map, areaId, opts = {}) {
  const layout = areaLayout(map, opts).find((l) => l.area.id === areaId);
  if (!layout) return null;
  return {
    wx: layout.center.wx,
    wz: layout.center.wz,
    distance: Math.max(layout.radius * AREA_FOCUS.factor, AREA_FOCUS.minDistance),
    elevation: AREA_FOCUS.elevation,
  };
}

/**
 * Radio de la isla: envolvente (desde el origen del mundo) de todas las
 * ciudades y del puerto de inicio, más el margen de playa. Nunca menor que
 * MIN_ISLAND_RADIUS para que un mapa vacío siga siendo una isla visible.
 *
 * @param {CareerMap} map
 * @param {WorldOptions} [opts]
 * @returns {number}
 */
export function islandRadius(map, opts = {}) {
  const pts = (map?.cities ?? []).map((c) => worldFromMap(c.x, c.y, opts));
  if (map?.startPort) pts.push(worldFromMap(map.startPort.x, map.startPort.y, opts));
  const reach = pts.reduce((m, p) => Math.max(m, Math.hypot(p.wx, p.wz)), 0);
  return Math.max(reach + BEACH_MARGIN, MIN_ISLAND_RADIUS);
}

/**
 * Colocación de la CABAÑA DEL BRUJO (MC-22): distancia hacia el interior desde
 * el puerto, holgura mínima al eje de cualquier casa (colisión de casa ~2.5 +
 * planta de la cabaña + respiro) y barrido de ángulos candidatos alrededor del
 * centro de la isla (radianes, en orden de preferencia: primero junto al
 * puerto, luego alternando a ambos lados hasta la cara opuesta).
 */
export const WIZARD_SPOT = Object.freeze({
  inland: 16,
  clearance: 8,
  sweep: Object.freeze([0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.6, -1.6, 2.1, -2.1, 2.6, -2.6, Math.PI]),
});

/**
 * Posición de mundo de la cabaña del brujo (MC-22), DETERMINISTA: el primer
 * candidato del barrido (misma «anilla» radial que el puerto, retranqueada
 * WIZARD_SPOT.inland hacia el interior) que respeta la holgura con TODAS las
 * casas. La cabaña vive cerca del puerto — el viajero la encuentra al llegar —
 * pero nunca pisa una casa. En un mapa sin puerto se ancla al sur de la isla
 * (misma convención que el spawn). Si ningún candidato librara todas las casas
 * (mapa imposiblemente denso), se devuelve el primero: mejor una cabaña rozada
 * que una isla sin brujo — degradación documentada, no silenciosa.
 *
 * @param {CareerMap} map
 * @param {WorldOptions & { maxRadius?: number }} [opts] `maxRadius` acota el
 *   anillo de candidatos (p. ej. el radio caminable: la cabaña siempre pisable).
 * @returns {WorldPoint}
 */
export function wizardSpot(map, opts = {}) {
  const R = islandRadius(map, opts);
  const port = map?.startPort ? worldFromMap(map.startPort.x, map.startPort.y, opts) : null;
  const portDist = port ? Math.hypot(port.wx, port.wz) : R * 0.6;
  // Ángulo base: el del puerto; sin puerto, el sur (+z, hacia la cámara aérea).
  const baseAngle = port && portDist > 1e-6 ? Math.atan2(port.wz, port.wx) : Math.PI / 2;
  let ring = Math.max(portDist - WIZARD_SPOT.inland, WIZARD_SPOT.inland);
  if (Number.isFinite(opts.maxRadius) && opts.maxRadius > 0) {
    ring = Math.min(ring, opts.maxRadius);
  }
  const cities = (map?.cities ?? []).map((c) => worldFromMap(c.x, c.y, opts));
  const candidate = (offset) => ({
    wx: Math.cos(baseAngle + offset) * ring,
    wz: Math.sin(baseAngle + offset) * ring,
  });
  const clear = (p) =>
    cities.every((c) => Math.hypot(c.wx - p.wx, c.wz - p.wz) >= WIZARD_SPOT.clearance);
  for (const offset of WIZARD_SPOT.sweep) {
    const p = candidate(offset);
    if (clear(p)) return p;
  }
  return candidate(WIZARD_SPOT.sweep[0]);
}
