/**
 * Coloca las tarjetas de una pantalla según el orden guardado (RMR-TSK-0571).
 *
 * Vive aparte de los dos glues que lo usan —el inicio y el panel— porque
 * importar uno desde el otro arrastraría sus efectos: el del panel redirige por
 * hash nada más cargarse.
 */
import { getCardLayout } from './cardLayout.js';
import { orderedKeys } from '../tools/admin/domain/cardLayout.js';

/**
 * Reordena los hijos de `box` según el orden guardado de esa superficie.
 *
 * Se llama DESPUÉS de decidir qué tarjetas se ven: el orden no decide
 * visibilidad, solo posición. Y si el orden no se puede leer no pasa nada —queda
 * el del código—: una pantalla sin tarjetas por un fallo de lectura sería mucho
 * peor que un orden que no se aplica.
 *
 * @param {Element|null} box contenedor de las tarjetas
 * @param {'home'|'admin'} surface
 * @param {string} selector con el que encontrarlas dentro
 * @param {(el: Element) => string|undefined|null} keyOf clave de cada tarjeta
 */
export async function applyCardOrder(box, surface, selector, keyOf) {
  if (!box) return;
  const layout = await getCardLayout();
  const orden = layout[surface] ?? [];
  if (orden.length === 0) return; // nada guardado: manda el del código

  const porClave = new Map();
  for (const el of box.querySelectorAll(selector)) {
    const key = keyOf(el);
    if (key) porClave.set(key, el);
  }
  // appendChild MUEVE el nodo: recorrer el orden deja cada tarjeta en su sitio
  // sin tener que sacarlas todas antes.
  for (const key of orderedKeys([...porClave.keys()], orden)) {
    const el = porClave.get(key);
    if (el) box.appendChild(el);
  }
}
