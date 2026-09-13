/**
 * Del ancla de la URL a la pestaña que hay que abrir (RMR-TSK-0499).
 *
 * Las tarjetas de Administración enlazan a la herramienta con el ancla de su
 * vista de gestión —`/tools/lean#teams`— para dejar a quien administra donde
 * iba, en vez de en la portada, teniendo que buscar la pestaña a mano.
 *
 * El ancla ORIENTA, no da permiso. Se valida contra las pestañas que esa
 * persona puede ver, nunca contra la lista completa: si no le toca, cae en la
 * primera que sí, y la que no le corresponde no existe para ella.
 */

/**
 * @param {string} hash        location.hash, con o sin almohadilla
 * @param {ReadonlyArray<string|{id: string}>} visibles  pestañas de quien mira
 * @param {string} [fallback]  la que se abre si el ancla no vale
 * @returns {string}
 */
export function tabFromHash(hash, visibles = [], fallback = '') {
  const ids = visibles.map((t) => (typeof t === 'string' ? t : t?.id)).filter(Boolean);
  const pedida = String(hash ?? '').replace(/^#/, '').split('=')[0].trim();
  if (pedida && ids.includes(pedida)) return pedida;
  return fallback || ids[0] || '';
}
