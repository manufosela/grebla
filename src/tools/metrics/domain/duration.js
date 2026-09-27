/**
 * Duraciones legibles de las métricas de entrega (lead time, restauración).
 *
 * Vivía en `components/dora/format.js`. Cuando DORA se retiró, el fichero se
 * quedaba huérfano en una carpeta que desaparece, pero **Entrega lo usa**: es
 * una función pura de dominio que estaba entre componentes por accidente de
 * quién la necesitó primero.
 *
 * Intenté moverla ya una vez y lo deshice, porque entonces borrar el fichero
 * viejo dejaba a Sonar sin poder indexarlo y habría hecho falta un permiso
 * humano por una causa mecánica. Ahora la carpeta entera se va de todas formas,
 * así que el movimiento sale gratis y es el que toca.
 *
 * Sin fallbacks a «0»: devuelve `null` cuando no hay medida y quien pinta decide
 * qué poner. Un «0 h» de lead time diría «entregan al instante», que es lo
 * contrario de «no lo sabemos».
 */
const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Horas → etiqueta compacta: horas hasta un día, días a partir de ahí.
 * @param {number|null|undefined} hours
 * @returns {string|null}  «X h», «X d», o null si no es medible.
 */
export function formatHours(hours) {
  if (hours == null || !Number.isFinite(hours)) return null;
  if (hours < 24) return `${round1(hours)} h`;
  return `${round1(hours / 24)} d`;
}
