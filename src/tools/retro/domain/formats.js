/**
 * Catálogo de formatos de retrospectiva (RMR-TSK-0242). Puro y extensible:
 * añadir un formato es solo datos. Cada formato define sus columnas/zonas con un
 * acento de color; el tablero (card 3) las pinta y las notas se colocan en ellas.
 *
 * `kind`: 'columns' (tablero clásico) o 'barco' (velero: Viento/Ancla/Rocas/Isla).
 * `accent`: token de color GREBLA (teal/coral/navy/amber).
 */

/**
 * @typedef {{ id: string, title: string, hint?: string, accent: 'teal'|'coral'|'navy'|'amber' }} RetroColumn
 * @typedef {{ id: string, name: string, kind: 'columns'|'barco', columns: RetroColumn[] }} RetroFormat
 */

/** @type {Record<string, RetroFormat>} */
export const RETRO_FORMATS = {
  ssc: {
    id: 'ssc', name: 'Start / Stop / Continue', kind: 'columns',
    columns: [
      { id: 'start', title: 'Empezar', accent: 'navy' },
      { id: 'stop', title: 'Dejar de hacer', accent: 'coral' },
      { id: 'continue', title: 'Seguir', accent: 'teal' },
    ],
  },
  pmss: {
    id: 'pmss', name: '+ / − / Start / Stop', kind: 'columns',
    columns: [
      { id: 'plus', title: '+ Va bien', accent: 'teal' },
      { id: 'minus', title: '− A mejorar', accent: 'coral' },
      { id: 'start', title: 'Empezar', accent: 'navy' },
      { id: 'stop', title: 'Parar', accent: 'amber' },
    ],
  },
  barco: {
    id: 'barco', name: 'Barco', kind: 'barco',
    columns: [
      { id: 'viento', title: 'Viento', hint: 'nos empuja', accent: 'teal' },
      { id: 'ancla', title: 'Ancla', hint: 'nos frena', accent: 'navy' },
      { id: 'rocas', title: 'Rocas', hint: 'riesgos', accent: 'coral' },
      { id: 'isla', title: 'Isla', hint: 'meta', accent: 'amber' },
    ],
  },
};

/** Ids de formato disponibles (para el selector al crear una retro). */
export const RETRO_FORMAT_IDS = Object.keys(RETRO_FORMATS);

/** @param {string} formatId @returns {RetroFormat|null} */
export function getFormat(formatId) {
  return RETRO_FORMATS[formatId] ?? null;
}

/** Columnas/zonas de un formato (vacío si el formato no existe). @param {string} formatId @returns {RetroColumn[]} */
export function formatColumns(formatId) {
  return RETRO_FORMATS[formatId]?.columns ?? [];
}

/** ¿La columna pertenece al formato? Valida dónde se coloca una nota. @param {string} formatId @param {string} columnId */
export function isValidColumn(formatId, columnId) {
  return formatColumns(formatId).some((c) => c.id === columnId);
}
