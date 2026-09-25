/**
 * Orden de las tarjetas (RMR-TSK-0571). Lógica pura: ni Firestore ni DOM.
 *
 * El inicio y el panel de administración crecen a base de tarjetas, y el orden
 * en que salen era el que tuvieran en el código: quien decide qué es importante
 * ahora no tenía forma de decirlo sin tocar un `.astro`.
 *
 * La regla que lo gobierna: **el código manda sobre qué tarjetas hay; la
 * configuración solo dice en qué orden**. Por eso una tarjeta nueva aparece
 * aunque nadie la haya colocado —al final— y una clave guardada que ya no existe
 * se ignora. Un orden guardado no puede esconder una herramienta ni dejar un
 * hueco: sería una avería invisible, de las que nadie relaciona con «cambié el
 * orden hace tres semanas».
 */

import { normalizeStyles } from './cardStyle.js';

/** Las dos superficies con tarjetas. Cualquier otra clave del documento se ignora. */
export const SURFACES = ['home', 'admin'];

/** Una clave utilizable: texto con contenido, ya recortado. */
function cleanKey(raw) {
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null;
}

/**
 * Orden guardado, saneado. Lo que no sea una lista de claves se descarta: una
 * configuración rota tiene que dejar las tarjetas como las pusiera el código, no
 * dejar la pantalla vacía.
 * Incluye el ASPECTO (RMR-TSK-0573) en la misma puerta: orden y estilos viven en
 * el mismo documento, asi que sanearlos por separado seria dejar media puerta
 * abierta.
 *
 * @param {Record<string, unknown>|null|undefined} doc
 * @returns {{ home: string[], admin: string[], styles: { home: Object, admin: Object } }}
 */
export function normalizeLayout(doc) {
  /** @type {{ home: string[], admin: string[], styles: { home: Object, admin: Object } }} */
  const out = { home: [], admin: [], styles: { home: {}, admin: {} } };
  for (const surface of SURFACES) {
    out.styles[surface] = normalizeStyles(doc?.styles?.[surface]);
    const raw = doc?.[surface];
    if (!Array.isArray(raw)) continue;
    const vistas = new Set();
    for (const item of raw) {
      const key = cleanKey(item);
      // Repetida no significa nada: una tarjeta está en un sitio.
      if (key === null || vistas.has(key)) continue;
      vistas.add(key);
      out[surface].push(key);
    }
  }
  return out;
}

/**
 * Las claves presentes, colocadas según el orden guardado. Lo que el orden no
 * menciona va detrás, conservando el orden del código.
 * @param {string[]} present claves que existen ahora mismo
 * @param {string[]|null|undefined} order orden guardado
 * @returns {string[]}
 */
export function orderedKeys(present, order) {
  const hay = new Set(present ?? []);
  const colocadas = (order ?? []).filter((key) => hay.has(key));
  const puestas = new Set(colocadas);
  const restantes = (present ?? []).filter((key) => !puestas.has(key));
  return [...colocadas, ...restantes];
}

/**
 * Mueve una clave una posición. En los bordes no pasa nada —no da la vuelta—,
 * porque dar la vuelta al pulsar «subir» en la primera es justo lo que nadie
 * espera.
 * @param {string[]} order
 * @param {string} key
 * @param {-1|1} delta
 * @returns {string[]} lista nueva
 */
export function moveKey(order, key, delta) {
  const lista = [...(order ?? [])];
  const from = lista.indexOf(key);
  const to = from + delta;
  if (from === -1 || to < 0 || to >= lista.length) return lista;
  const movida = [...lista];
  [movida[from], movida[to]] = [movida[to], movida[from]];
  return movida;
}
