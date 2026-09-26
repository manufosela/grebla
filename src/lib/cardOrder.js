/**
 * Coloca las tarjetas de una pantalla según el orden guardado (RMR-TSK-0571).
 *
 * Vive aparte de los dos glues que lo usan —el inicio y el panel— porque
 * importar uno desde el otro arrastraría sus efectos: el del panel redirige por
 * hash nada más cargarse.
 */
import { getCardLayout } from './cardLayout.js';
import { orderedKeys } from '../tools/admin/domain/cardLayout.js';
import { CARD_STYLES, styleOf, cardClasses } from '../tools/admin/domain/cardStyle.js';

/** Todas las clases de la paleta, para poder quitar la anterior al repintar. */
const ALL_CLASSES = [...Object.values(CARD_STYLES).map((s) => s.className), 'cs-featured'];

/**
 * Reordena los hijos de `box` según el orden guardado de esa superficie.
 *
 * Se llama DESPUÉS de decidir qué tarjetas se ven: el orden no decide
 * visibilidad, solo posición. Y si el orden no se puede leer no pasa nada —queda
 * el del código—: una pantalla sin tarjetas por un fallo de lectura sería mucho
 * peor que un orden que no se aplica.
 *
 * Acepta VARIAS cajas porque el inicio reparte las tarjetas en grupos: el orden
 * manda dentro de cada grupo, no entre grupos. Mover una tarjeta al contenedor
 * de todos la sacaria de su grupo.
 *
 * @param {Element|Iterable<Element>|null} boxes contenedor o contenedores
 * @param {'home'|'admin'} surface
 * @param {string} selector con el que encontrar las tarjetas dentro
 * @param {(el: Element) => string|undefined|null} keyOf clave de cada tarjeta
 */
export async function applyCardOrder(boxes, surface, selector, keyOf) {
  const cajas = toBoxes(boxes);
  if (cajas.length === 0) return;
  // Una sola lectura para todas las cajas: el orden es el mismo documento.
  const layout = await getCardLayout();
  for (const box of cajas) applyToBox(box, layout, surface, selector, keyOf);
}

/** Un elemento, una lista de elementos o nada. */
function toBoxes(boxes) {
  if (!boxes) return [];
  if (boxes instanceof Element) return [boxes];
  return [...boxes];
}

function applyToBox(box, layout, surface, selector, keyOf) {
  const orden = layout[surface] ?? [];
  const estilos = layout.styles?.[surface] ?? {};

  const porClave = new Map();
  for (const el of box.querySelectorAll(selector)) {
    const key = keyOf(el);
    if (key) porClave.set(key, el);
  }

  // El aspecto: se quitan SIEMPRE las clases de la paleta antes de poner las que
  // tocan, para que quitar un estilo en el editor se note de verdad.
  for (const [key, el] of porClave) {
    el.classList.remove(...ALL_CLASSES);
    const clases = cardClasses(styleOf(estilos, key));
    if (clases.length > 0) el.classList.add(...clases);
  }

  if (orden.length === 0) return; // sin orden guardado manda el del código
  // appendChild MUEVE el nodo: recorrer el orden deja cada tarjeta en su sitio
  // sin tener que sacarlas todas antes.
  for (const key of orderedKeys([...porClave.keys()], orden)) {
    const el = porClave.get(key);
    if (el) box.appendChild(el);
  }
}
