/**
 * A dónde vuelve el «← Volver» de una herramienta (RMR-BUG-0115).
 *
 * El destino estaba fijo a la portada, así que quien entraba desde
 * Administración a configurar algo aterrizaba en el hub de herramientas y tenía
 * que rehacer el camino a mano —cada vez, y administrar suele ser varias
 * herramientas seguidas.
 *
 * La procedencia viaja en el enlace (`?from=admin`) y no en el historial ni en
 * el `referrer`: así sobrevive a una recarga y a compartir la URL, y no hay que
 * adivinar de dónde venía nadie.
 */

/** De dónde se puede venir, y a dónde devuelve cada sitio. */
const ORIGENES = {
  admin: { href: '/admin', label: 'Volver a Administración' },
};

/**
 * @param {string} search        location.search, con o sin interrogación
 * @param {string} [fallback]    destino de siempre cuando no se viene de ningún sitio
 * @returns {{ href: string, label: string }}
 */
export function backTarget(search, fallback = '/') {
  const from = new URLSearchParams(String(search ?? '')).get('from');
  return ORIGENES[from] ?? { href: fallback || '/', label: 'Volver' };
}
